const express = require("express");
const pool = require("./db");
const { requireAuth } = require("./middleware");

const router = express.Router();

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function parseDateOnly(value) {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function minutesFromTime(value) {
  const [hours, minutes] = String(value || "00:00").split(":").map(Number);
  return (hours * 60) + (minutes || 0);
}

function timeFromMinutes(totalMinutes) {
  const minutesInDay = Math.max(0, Math.min(24 * 60, Math.round(totalMinutes)));
  const hours = Math.floor(minutesInDay / 60);
  const minutes = minutesInDay % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function dayOfWeekForDate(date) {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

async function assertScheduleAccess(user, locationId) {
  if (!locationId) {
    const error = new Error("Location ID is required.");
    error.status = 400;
    throw error;
  }

  if (user.role === "owner") {
    const locationResult = await pool.query(
      `SELECT id
       FROM locations
       WHERE id = $1
         AND business_id = $2`,
      [locationId, user.businessId]
    );

    if (locationResult.rows.length === 0) {
      const error = new Error("Location not found.");
      error.status = 404;
      throw error;
    }

    return;
  }

  const assignedResult = await pool.query(
    `SELECT 1
     FROM employees
     WHERE business_id = $1
       AND user_id = $2
       AND location_id = $3
       AND active = true
     LIMIT 1`,
    [user.businessId, user.id, locationId]
  );

  if (assignedResult.rows.length === 0) {
    const error = new Error("You can only view schedules for your assigned location.");
    error.status = 403;
    throw error;
  }
}

function buildAvailabilityMap(rows) {
  const map = new Map();

  for (const row of rows) {
    if (!map.has(row.employee_id)) map.set(row.employee_id, new Map());
    map.get(row.employee_id).set(Number(row.day_of_week), Boolean(row.available));
  }

  return map;
}

function buildDaysOffMap(rows) {
  const map = new Map();

  for (const row of rows) {
    if (!map.has(row.employee_id)) map.set(row.employee_id, new Set());
    map.get(row.employee_id).add(toDateOnly(new Date(row.day_off)));
  }

  return map;
}

function buildShiftMap(rows) {
  const byPreferredShift = new Map();
  const fallbackByDay = new Map();

  for (const row of rows) {
    const item = {
      shiftId: row.shift_id,
      shiftName: row.shift_name,
      dayOfWeek: Number(row.day_of_week),
      startTime: row.start_time,
      endTime: row.end_time,
      startMinutes: minutesFromTime(row.start_time),
      endMinutes: minutesFromTime(row.end_time),
      sortOrder: Number(row.sort_order || 1)
    };

    if (!byPreferredShift.has(row.shift_id)) byPreferredShift.set(row.shift_id, new Map());
    byPreferredShift.get(row.shift_id).set(item.dayOfWeek, item);

    if (!fallbackByDay.has(item.dayOfWeek)) fallbackByDay.set(item.dayOfWeek, []);
    fallbackByDay.get(item.dayOfWeek).push(item);
  }

  for (const options of fallbackByDay.values()) {
    options.sort((a, b) => a.sortOrder - b.sortOrder || a.shiftName.localeCompare(b.shiftName));
  }

  return { byPreferredShift, fallbackByDay };
}

router.get("/", requireAuth, async (req, res) => {
  const { locationId, weekStart } = req.query;

  const weekStartDate = parseDateOnly(weekStart);

  if (!locationId || !weekStartDate) {
    return res.status(400).json({ error: "Location ID and valid week start are required." });
  }

  try {
    await assertScheduleAccess(req.user, locationId);

    const employeesResult = await pool.query(
      `SELECT
         e.id AS employee_id,
         e.priority,
         e.employee_code,
         e.title,
         e.employment_type,
         e.weekly_hours,
         e.daily_hours,
         e.preferred_shift_id,
         u.first_name,
         u.last_name,
         u.username,
         u.role,
         u.can_manage_schedule
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

    const daysOffResult = await pool.query(
      `SELECT edo.employee_id, edo.day_off
       FROM employee_days_off edo
       JOIN employees e ON e.id = edo.employee_id
       WHERE e.business_id = $1
         AND e.location_id = $2
         AND e.active = true
         AND edo.day_off >= $3::date
         AND edo.day_off < ($3::date + interval '7 days')`,
      [req.user.businessId, locationId, toDateOnly(weekStartDate)]
    );

    const shiftsResult = await pool.query(
      `SELECT
         s.id AS shift_id,
         s.name AS shift_name,
         s.sort_order,
         sd.day_of_week,
         to_char(sd.start_time, 'HH24:MI') AS start_time,
         to_char(sd.end_time, 'HH24:MI') AS end_time
       FROM shifts s
       JOIN shift_days sd ON sd.shift_id = s.id
       WHERE s.business_id = $1
         AND s.location_id = $2
         AND sd.enabled = true
         AND sd.start_time IS NOT NULL
         AND sd.end_time IS NOT NULL
       ORDER BY s.sort_order, s.name, sd.day_of_week`,
      [req.user.businessId, locationId]
    );

    const availabilityByEmployee = buildAvailabilityMap(availabilityResult.rows);
    const daysOffByEmployee = buildDaysOffMap(daysOffResult.rows);
    const { byPreferredShift, fallbackByDay } = buildShiftMap(shiftsResult.rows);
    const cells = [];

    for (const employee of employeesResult.rows) {
      let remainingWeeklyMinutes = Math.round(Number(employee.weekly_hours || 0) * 60);
      const maxDailyMinutes = Math.round(Number(employee.daily_hours || 0) * 60);
      const employeeAvailability = availabilityByEmployee.get(employee.employee_id) || new Map();
      const employeeDaysOff = daysOffByEmployee.get(employee.employee_id) || new Set();

      for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
        const workDate = addDays(weekStartDate, dayOffset);
        const workDateText = toDateOnly(workDate);
        const dayOfWeek = dayOfWeekForDate(workDate);

        const available = employeeAvailability.has(dayOfWeek)
          ? employeeAvailability.get(dayOfWeek)
          : true;

        if (!available || employeeDaysOff.has(workDateText) || remainingWeeklyMinutes <= 0) {
          continue;
        }

        const preferredShiftForDay = employee.preferred_shift_id
          ? byPreferredShift.get(employee.preferred_shift_id)?.get(dayOfWeek)
          : null;

        const shift = preferredShiftForDay || (fallbackByDay.get(dayOfWeek) || [])[0];

        if (!shift) continue;

        const shiftMinutes = Math.max(0, shift.endMinutes - shift.startMinutes);
        const scheduledMinutes = Math.min(shiftMinutes, maxDailyMinutes, remainingWeeklyMinutes);

        if (scheduledMinutes <= 0) continue;

        cells.push({
          employee_id: employee.employee_id,
          priority: employee.priority,
          employee_code: employee.employee_code,
          title: employee.title,
          first_name: employee.first_name,
          last_name: employee.last_name,
          username: employee.username,
          role: employee.role,
          can_manage_schedule: employee.can_manage_schedule,
          work_date: workDateText,
          shift_id: shift.shiftId,
          shift_name: shift.shiftName,
          start_time: timeFromMinutes(shift.startMinutes),
          end_time: timeFromMinutes(shift.startMinutes + scheduledMinutes),
          is_forecast: true
        });

        remainingWeeklyMinutes -= scheduledMinutes;
      }
    }

    res.json({ cells });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to load schedule." });
  }
});

module.exports = router;
