const express = require("express");
const argon2 = require("argon2");
const pool = require("./db");
const { requireAuth, requireOwner, requireScheduleManager } = require("./middleware");

const router = express.Router();

const DEFAULT_DAYS = [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
  dayOfWeek,
  enabled: dayOfWeek <= 5,
  startTime: dayOfWeek <= 5 ? "08:00" : null,
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

  return argon2.verify(result.rows[0].password_hash, String(password || "").normalize("NFKC"));
}

async function assertLocationAccess(user, locationId) {
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
    const error = new Error("You can only view shifts for your assigned location.");
    error.status = 403;
    throw error;
  }
}

function normalizeDays(days) {
  const input = Array.isArray(days) && days.length > 0 ? days : DEFAULT_DAYS;
  const byDay = new Map();

  for (const day of input) {
    const dayOfWeek = Number(day.dayOfWeek);

    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
      continue;
    }

    const enabled = Boolean(day.enabled);
    byDay.set(dayOfWeek, {
      dayOfWeek,
      enabled,
      startTime: enabled ? day.startTime || "08:00" : null,
      endTime: enabled ? day.endTime || "17:00" : null
    });
  }

  return [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => (
    byDay.get(dayOfWeek) || {
      dayOfWeek,
      enabled: false,
      startTime: null,
      endTime: null
    }
  ));
}

async function loadShiftWithDays(clientOrPool, shiftId, businessId) {
  const result = await clientOrPool.query(
    `SELECT
       s.id,
       s.location_id,
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
  const { locationId, page = 1, pageSize = 5, filter = "" } = req.query;

  try {
    await assertLocationAccess(req.user, locationId);

    const safePage = Math.max(1, Number(page) || 1);
    const safePageSize = Math.min(25, Math.max(1, Number(pageSize) || 5));
    const offset = (safePage - 1) * safePageSize;
    const search = `%${filter}%`;

    const countResult = await pool.query(
      `SELECT count(*)::int AS total
       FROM shifts s
       WHERE s.business_id = $1
         AND s.location_id = $2
         AND s.name ILIKE $3`,
      [req.user.businessId, locationId, search]
    );

    const total = countResult.rows[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / safePageSize));
    const currentPage = Math.min(safePage, totalPages);
    const currentOffset = (currentPage - 1) * safePageSize;

    const result = await pool.query(
      `SELECT
         s.id,
         s.location_id,
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
      [req.user.businessId, locationId, search, safePageSize, currentOffset]
    );

    res.json({
      shifts: result.rows,
      page: currentPage,
      pageSize: safePageSize,
      total,
      totalPages
    });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to load shifts." });
  }
});

router.post("/", requireAuth, requireOwner, async (req, res) => {
  const { locationId, name, sortOrder = 1, days = DEFAULT_DAYS } = req.body;

  if (!locationId || !name || !String(name).trim()) {
    return res.status(400).json({ error: "Location and shift name are required." });
  }

  const client = await pool.connect();

  try {
    await assertLocationAccess(req.user, locationId);
    await client.query("BEGIN");

    const shiftResult = await client.query(
      `INSERT INTO shifts (business_id, location_id, name, sort_order)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [req.user.businessId, locationId, String(name).trim(), Number(sortOrder) || 1]
    );

    const shiftId = shiftResult.rows[0].id;

    for (const day of normalizeDays(days)) {
      await client.query(
        `INSERT INTO shift_days (shift_id, day_of_week, enabled, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5)`,
        [shiftId, day.dayOfWeek, day.enabled, day.startTime, day.endTime]
      );
    }

    const shift = await loadShiftWithDays(client, shiftId, req.user.businessId);

    await client.query("COMMIT");

    res.status(201).json({ shift });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err);

    if (err.code === "23505") {
      return res.status(409).json({ error: "A shift with this name already exists for this location." });
    }

    res.status(err.status || 500).json({ error: err.status ? err.message : "Shift creation failed." });
  } finally {
    client.release();
  }
});

router.put("/:id", requireAuth, requireOwner, async (req, res) => {
  const { id } = req.params;
  const { name, sortOrder = 1, days = DEFAULT_DAYS } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Shift name is required." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const current = await loadShiftWithDays(client, id, req.user.businessId);

    if (!current) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Shift not found." });
    }

    await assertLocationAccess(req.user, current.location_id);

    await client.query(
      `UPDATE shifts
       SET name = $1,
           sort_order = $2,
           updated_at = now()
       WHERE id = $3
         AND business_id = $4`,
      [String(name).trim(), Number(sortOrder) || 1, id, req.user.businessId]
    );

    await client.query(`DELETE FROM shift_days WHERE shift_id = $1`, [id]);

    for (const day of normalizeDays(days)) {
      await client.query(
        `INSERT INTO shift_days (shift_id, day_of_week, enabled, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, day.dayOfWeek, day.enabled, day.startTime, day.endTime]
      );
    }

    const shift = await loadShiftWithDays(client, id, req.user.businessId);

    await client.query("COMMIT");

    res.json({ shift });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err);

    if (err.code === "23505") {
      return res.status(409).json({ error: "A shift with this name already exists for this location." });
    }

    res.status(err.status || 500).json({ error: err.status ? err.message : "Shift update failed." });
  } finally {
    client.release();
  }
});

router.delete("/:id", requireAuth, requireOwner, async (req, res) => {
  const { id } = req.params;
  const { actorPassword } = req.body;

  const verified = await verifyActorPassword(req.user.id, actorPassword);
  if (!verified) {
    return res.status(401).json({ error: "Owner credentials are required to delete a shift." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const shiftResult = await client.query(
      `SELECT id
       FROM shifts
       WHERE id = $1
         AND business_id = $2
       FOR UPDATE`,
      [id, req.user.businessId]
    );

    if (shiftResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Shift not found." });
    }

    await client.query(
      `UPDATE employees
       SET preferred_shift_id = NULL,
           updated_at = now()
       WHERE business_id = $1
         AND preferred_shift_id = $2`,
      [req.user.businessId, id]
    );

    await client.query(
      `UPDATE schedule_cells
       SET shift_id = NULL
       WHERE shift_id = $1`,
      [id]
    );

    await client.query(`DELETE FROM shift_days WHERE shift_id = $1`, [id]);

    await client.query(
      `DELETE FROM shifts
       WHERE id = $1
         AND business_id = $2`,
      [id, req.user.businessId]
    );

    await client.query("COMMIT");
    res.json({ message: "Shift deleted." });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err);
    res.status(500).json({ error: "Shift deletion failed." });
  } finally {
    client.release();
  }
});

module.exports = router;
