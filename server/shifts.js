const express = require("express");
const pool = require("./db");
const { requireAuth, requireScheduleManager } = require("./middleware");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const { locationId, page = 1, pageSize = 10, filter = "" } = req.query;
  const offset = (Number(page) - 1) * Number(pageSize);

  const result = await pool.query(
    `SELECT s.id, s.name, s.sort_order,
       COALESCE(json_agg(
         json_build_object(
           'dayOfWeek', sd.day_of_week,
           'enabled', sd.enabled,
           'startTime', sd.start_time,
           'endTime', sd.end_time
         )
         ORDER BY sd.day_of_week
       ) FILTER (WHERE sd.id IS NOT NULL), '[]') AS days
     FROM shifts s
     LEFT JOIN shift_days sd ON sd.shift_id = s.id
     WHERE s.business_id = $1
       AND s.location_id = $2
       AND s.name ILIKE $3
     GROUP BY s.id
     ORDER BY s.sort_order, s.name
     LIMIT $4 OFFSET $5`,
    [req.user.businessId, locationId, `%${filter}%`, Number(pageSize), offset]
  );

  res.json({ shifts: result.rows });
});

router.post("/", requireAuth, requireScheduleManager, async (req, res) => {
  const { locationId, name, sortOrder = 1, days = [] } = req.body;

  if (!locationId || !name) {
    return res.status(400).json({ error: "Location and shift name are required." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const shiftResult = await client.query(
      `INSERT INTO shifts (business_id, location_id, name, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user.businessId, locationId, name.trim(), Number(sortOrder)]
    );

    const shift = shiftResult.rows[0];

    for (const day of days) {
      await client.query(
        `INSERT INTO shift_days (shift_id, day_of_week, enabled, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          shift.id,
          day.dayOfWeek,
          !!day.enabled,
          day.enabled ? day.startTime : null,
          day.enabled ? day.endTime : null
        ]
      );
    }

    await client.query("COMMIT");
    res.status(201).json({ shift });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Shift creation failed." });
  } finally {
    client.release();
  }
});

module.exports = router;
