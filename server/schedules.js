const express = require("express");
const pool = require("./db");
const { requireAuth, requireScheduleManager } = require("./middleware");

const router = express.Router();

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function shuffle(items) {
  return items
    .map((item) => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
}

router.get("/", requireAuth, async (req, res) => {
  const { locationId, weekStart } = req.query;

  if (!locationId || !weekStart) {
    return res.status(400).json({ error: "Location ID and week start are required." });
  }

  const result = await pool.query(
    `SELECT sc.*, e.priority, e.title, u.first_name, u.last_name, u.username
     FROM schedules s
     JOIN schedule_cells sc ON sc.schedule_id = s.id
     JOIN employees e ON e.id = sc.employee_id
     JOIN users u ON u.id = e.user_id
     WHERE s.business_id = $1
       AND s.location_id = $2
       AND s.week_start = $3
       AND e.active = true
       AND u.active = true
     ORDER BY e.priority ASC, u.last_name ASC, u.first_name ASC, sc.work_date ASC`,
    [req.user.businessId, locationId, weekStart]
  );

  res.json({ cells: result.rows });
});

router.post("/generate", requireAuth, requireScheduleManager, async (req, res) => {
  const { locationId, weekStart } = req.body;

  if (!locationId || !weekStart) {
    return res.status(400).json({ error: "Location ID and week start are required." });
  }

  const locationResult = await pool.query(
    `SELECT id
     FROM locations
     WHERE id = $1
       AND business_id = $2`,
    [locationId, req.user.businessId]
  );

  if (locationResult.rows.length === 0) {
    return res.status(404).json({ error: "Location not found." });
  }

  const employeesResult = await pool.query(
    `SELECT e.*, u.first_name, u.last_name
     FROM employees e
     JOIN users u ON u.id = e.user_id
     WHERE e.business_id = $1
       AND e.location_id = $2
       AND e.active = true
       AND u.active = true
     ORDER BY e.priority ASC, u.last_name ASC, u.first_name ASC`,
    [req.user.businessId, locationId]
  );

  const availabilityResult = await pool.query(
    `SELECT ea.employee_id, ea.day_of_week, ea.available
     FROM employee_availability ea
     JOIN employees e ON e.id = ea.employee_id
     WHERE e.business_id = $1
       AND e.location_id = $2
       AND e.active = true`,
    [req.user.businessId, locationId]
  );

  const shiftDaysResult = await pool.query(
    `SELECT s.id AS shift_id, sd.day_of_week, sd.start_time, sd.end_time
     FROM shifts s
     JOIN shift_days sd ON sd.shift_id = s.id
     WHERE s.business_id = $1
       AND s.location_id = $2
       AND sd.enabled = true`,
    [req.user.businessId, locationId]
  );

  const availabilityByEmployee = new Map();

  for (const row of availabilityResult.rows) {
    if (!availabilityByEmployee.has(row.employee_id)) {
      availabilityByEmployee.set(row.employee_id, []);
    }

    if (row.available) {
      availabilityByEmployee.get(row.employee_id).push(row.day_of_week);
    }
  }

  const shiftByShiftAndDay = new Map();

  for (const row of shiftDaysResult.rows) {
    shiftByShiftAndDay.set(`${row.shift_id}:${row.day_of_week}`, row);
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const scheduleResult = await client.query(
      `INSERT INTO schedules (business_id, location_id, week_start, generated_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (location_id, week_start)
       DO UPDATE SET generated_by = EXCLUDED.generated_by
       RETURNING id`,
      [req.user.businessId, locationId, weekStart, req.user.id]
    );

    const scheduleId = scheduleResult.rows[0].id;

    await client.query(`DELETE FROM schedule_cells WHERE schedule_id = $1`, [scheduleId]);

    const weekStartDate = new Date(`${weekStart}T00:00:00.000Z`);

    for (const employee of employeesResult.rows) {
      const weeklyHours = Number(employee.weekly_hours);
      const dailyHours = Number(employee.daily_hours);
      const neededDays = Math.ceil(weeklyHours / dailyHours);

      const availableDays = availabilityByEmployee.get(employee.id) || [];

      const validAvailableDays = availableDays.filter((day) => {
        if (!employee.preferred_shift_id) return false;
        return shiftByShiftAndDay.has(`${employee.preferred_shift_id}:${day}`);
      });

      const chosenDays = shuffle(validAvailableDays)
        .slice(0, neededDays)
        .sort((a, b) => a - b);

      for (let day = 1; day <= 7; day++) {
        const workDate = addDays(weekStartDate, day - 1);
        const dateOnly = toDateOnly(workDate);

        const orientationDate =
          employee.orientation_start &&
          toDateOnly(new Date(employee.orientation_start)) === dateOnly;

        const beforeOrientation =
          employee.orientation_start &&
          workDate < new Date(employee.orientation_start);

        const shouldWork =
          !orientationDate &&
          !beforeOrientation &&
          chosenDays.includes(day) &&
          employee.preferred_shift_id;

        const shiftDay = shouldWork
          ? shiftByShiftAndDay.get(`${employee.preferred_shift_id}:${day}`)
          : null;

        await client.query(
          `INSERT INTO schedule_cells (
             schedule_id, employee_id, work_date, shift_id, start_time, end_time, is_orientation
           )
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            scheduleId,
            employee.id,
            dateOnly,
            shiftDay ? employee.preferred_shift_id : null,
            shiftDay ? shiftDay.start_time : null,
            shiftDay ? shiftDay.end_time : null,
            !!orientationDate
          ]
        );
      }
    }

    await client.query("COMMIT");
    res.json({ message: "Schedule generated." });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Schedule generation failed." });
  } finally {
    client.release();
  }
});

module.exports = router;
