const express = require("express");
const argon2 = require("argon2");
const pool = require("./db");
const { requireAuth, requireScheduleManager } = require("./middleware");

const router = express.Router();

const DEFAULT_DAYS = [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
  dayOfWeek,
  enabled: dayOfWeek <= 5,
  startTime: dayOfWeek <= 5 ? "09:00" : null,
  endTime: dayOfWeek <= 5 ? "17:00" : null
}));

async function verifyActorPassword(userId, password) {
  if (!password) return false;

  const result = await pool.query(
    `SELECT password_hash
     FROM users
     WHERE id = $1
       AND active = true`,
    [userId]
  );

  if (result.rows.length === 0) return false;

  return argon2.verify(result.rows[0].password_hash, password);
}

function normalizeDays(days) {
  const input = Array.isArray(days) && days.length > 0 ? days : DEFAULT_DAYS;
  const seen = new Set();
  const normalized = [];

  for (const day of input) {
    const dayOfWeek = Number(day.dayOfWeek);

    if (
      !Number.isInteger(dayOfWeek) ||
      dayOfWeek < 1 ||
      dayOfWeek > 7 ||
      seen.has(dayOfWeek)
    ) {
      continue;
    }

    seen.add(dayOfWeek);

    const enabled = Boolean(day.enabled);

    normalized.push({
      dayOfWeek,
      enabled,
      startTime: enabled ? day.startTime || "09:00" : null,
      endTime: enabled ? day.endTime || "17:00" : null
    });
  }

  return normalized;
}

async function loadShiftWithDays(clientOrPool, shiftId, businessId) {
  const result = await clientOrPool.query(
    `SELECT
       s.id,
       s.name,
       s.sort_order,
       COALESCE(
         json_agg(
           json_build_object(
             'dayOfWeek', sd.day_of_week,
             'enabled', sd.enabled,
             'startTime', to_char(sd.start_time, 'HH24:MI'),
             'endTime', to_char(sd.end_time, 'HH24:MI')
           )
           ORDER BY sd.day_of_week
         ) FILTER (WHERE sd.id IS NOT NULL),
         '[]'::json
       ) AS days
     FROM shifts s
     LEFT JOIN shift_days sd ON sd.shift_id = s.id
     WHERE s.id = $1
       AND s.business_id = $2
     GROUP BY s.id`,
    [shiftId, businessId]
  );

  return result.rows[0] || null;
}

router.get("/", requireAuth, requireScheduleManager, async (req, res) => {
  const { locationId, page = 1, pageSize = 10, filter = "" } = req.query;

  if (!locationId) {
    return res.status(400).json({ error: "Location ID is required." });
  }

  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 10));
  const offset = (safePage - 1) * safePageSize;

  try {
    const result = await pool.query(
      `SELECT
         s.id,
         s.name,
         s.sort_order,
         COALESCE(
           json_agg(
             json_build_object(
               'dayOfWeek', sd.day_of_week,
               'enabled', sd.enabled,
               'startTime', to_char(sd.start_time, 'HH24:MI'),
               'endTime', to_char(sd.end_time, 'HH24:MI')
             )
             ORDER BY sd.day_of_week
           ) FILTER (WHERE sd.id IS NOT NULL),
           '[]'::json
         ) AS days
       FROM shifts s
       LEFT JOIN shift_days sd ON sd.shift_id = s.id
       WHERE s.business_id = $1
         AND s.location_id = $2
         AND s.name ILIKE $3
       GROUP BY s.id
       ORDER BY s.sort_order, s.name
       LIMIT $4 OFFSET $5`,
      [req.user.businessId, locationId, `%${filter}%`, safePageSize, offset]
    );

    res.json({ shifts: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load shifts." });
  }
});

router.post("/", requireAuth, requireScheduleManager, async (req, res) => {
  const { locationId, name, sortOrder = 1, days = [] } = req.body;

  if (!locationId || !name) {
    return res.status(400).json({ error: "Location and shift name are required." });
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

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const shiftResult = await client.query(
      `INSERT INTO shifts (business_id, location_id, name, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [req.user.businessId, locationId, name.trim(), Number(sortOrder) || 1]
    );

    const shiftId = shiftResult.rows[0].id;
    const normalizedDays = normalizeDays(days);

    for (const day of normalizedDays) {
      await client.query(
        `INSERT INTO shift_days (shift_id, day_of_week, enabled, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (shift_id, day_of_week)
         DO UPDATE SET
           enabled = EXCLUDED.enabled,
           start_time = EXCLUDED.start_time,
           end_time = EXCLUDED.end_time`,
        [shiftId, day.dayOfWeek, day.enabled, day.startTime, day.endTime]
      );
    }

    const shift = await loadShiftWithDays(client, shiftId, req.user.businessId);

    await client.query("COMMIT");

    res.status(201).json({ shift });
  } catch (err) {
    await client.query("ROLLBACK");

    if (err.code === "23505") {
      return res.status(409).json({
        error: "A shift with that name already exists for this location."
      });
    }

    console.error(err);
    res.status(500).json({ error: "Shift creation failed." });
  } finally {
    client.release();
  }
});

router.put("/:id", requireAuth, requireScheduleManager, async (req, res) => {
  const { locationId, name, sortOrder = 1, days = [] } = req.body;

  if (!locationId || !name) {
    return res.status(400).json({ error: "Location and shift name are required." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const shiftResult = await client.query(
      `UPDATE shifts
       SET name = $1,
           sort_order = $2,
           updated_at = now()
       WHERE id = $3
         AND business_id = $4
         AND location_id = $5
       RETURNING id`,
      [name.trim(), Number(sortOrder) || 1, req.params.id, req.user.businessId, locationId]
    );

    if (shiftResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Shift not found." });
    }

    const normalizedDays = normalizeDays(days);

    for (const day of normalizedDays) {
      await client.query(
        `INSERT INTO shift_days (shift_id, day_of_week, enabled, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (shift_id, day_of_week)
         DO UPDATE SET
           enabled = EXCLUDED.enabled,
           start_time = EXCLUDED.start_time,
           end_time = EXCLUDED.end_time`,
        [req.params.id, day.dayOfWeek, day.enabled, day.startTime, day.endTime]
      );
    }

    const shift = await loadShiftWithDays(client, req.params.id, req.user.businessId);

    await client.query("COMMIT");

    res.json({ shift });
  } catch (err) {
    await client.query("ROLLBACK");

    if (err.code === "23505") {
      return res.status(409).json({
        error: "A shift with that name already exists for this location."
      });
    }

    console.error(err);
    res.status(500).json({ error: "Shift update failed." });
  } finally {
    client.release();
  }
});

router.delete("/:id", requireAuth, requireScheduleManager, async (req, res) => {
  const { password } = req.body || {};

  const valid = await verifyActorPassword(req.user.id, password);

  if (!valid) {
    return res.status(401).json({ error: "Owner/manager credentials are required." });
  }

  try {
    const result = await pool.query(
      `DELETE FROM shifts
       WHERE id = $1
         AND business_id = $2
       RETURNING id`,
      [req.params.id, req.user.businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Shift not found." });
    }

    res.json({ message: "Shift deleted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Shift delete failed." });
  }
});

module.exports = router;
