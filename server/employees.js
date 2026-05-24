const express = require("express");
const argon2 = require("argon2");
const pool = require("./db");
const { requireAuth, requireScheduleManager } = require("./middleware");

const router = express.Router();

function normalizeUsername(username) {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "");
}

function buildFullLogin(username, businessSlug) {
  return `${username}/${businessSlug}`;
}

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

async function enforceEmployeeLimit(businessId) {
  const result = await pool.query(
    `SELECT b.plan_employee_limit, count(e.id)::int AS employee_count
     FROM businesses b
     LEFT JOIN employees e ON e.business_id = b.id AND e.active = true
     WHERE b.id = $1
     GROUP BY b.id`,
    [businessId]
  );

  const row = result.rows[0];

  if (!row) {
    const error = new Error("Business not found.");
    error.status = 404;
    throw error;
  }

  if (row.plan_employee_limit !== null && row.employee_count >= row.plan_employee_limit) {
    const error = new Error("Plan limit reached. Upgrade to add more employees.");
    error.status = 402;
    throw error;
  }
}

router.get("/", requireAuth, requireScheduleManager, async (req, res) => {
  const { locationId, page = 1, pageSize = 25 } = req.query;

  if (!locationId) {
    return res.status(400).json({ error: "Location ID is required." });
  }

  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(100, Math.max(1, Number(pageSize) || 25));
  const offset = (safePage - 1) * safePageSize;

  try {
    const result = await pool.query(
      `SELECT
         e.*,
         u.first_name,
         u.last_name,
         u.username,
         u.full_login,
         u.can_manage_schedule,
         u.role
       FROM employees e
       JOIN users u ON u.id = e.user_id
       WHERE e.business_id = $1
         AND e.location_id = $2
         AND e.active = true
         AND u.active = true
       ORDER BY e.priority ASC, u.last_name ASC, u.first_name ASC
       LIMIT $3 OFFSET $4`,
      [req.user.businessId, locationId, safePageSize, offset]
    );

    res.json({ employees: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load employees." });
  }
});

router.post("/", requireAuth, requireScheduleManager, async (req, res) => {
  const {
    locationId,
    firstName,
    lastName,
    username,
    password,
    employeeCode,
    title,
    priority,
    employmentType,
    weeklyHours,
    dailyHours,
    orientationStart,
    preferredShiftId,
    availability,
    canManageSchedule = false
  } = req.body;

  if (!locationId || !firstName || !lastName || !username || !password || !employeeCode || !title) {
    return res.status(400).json({ error: "Missing required employee fields." });
  }

  if (password.length < 12) {
    return res.status(400).json({ error: "Employee password must be at least 12 characters." });
  }

  const safePriority = Number(priority);

  if (!Number.isInteger(safePriority) || safePriority < 1 || safePriority > 25) {
    return res.status(400).json({ error: "Priority must be a whole number from 1 to 25." });
  }

  const safeEmploymentType = employmentType === "full_time" ? "full_time" : "part_time";

  const safeWeeklyHours =
    weeklyHours !== undefined && weeklyHours !== null && weeklyHours !== ""
      ? Number(weeklyHours)
      : safeEmploymentType === "full_time"
        ? 40
        : 22.5;

  const safeDailyHours =
    dailyHours !== undefined && dailyHours !== null && dailyHours !== ""
      ? Number(dailyHours)
      : safeEmploymentType === "full_time"
        ? 9
        : 4.5;

  if (!Number.isFinite(safeWeeklyHours) || safeWeeklyHours <= 0) {
    return res.status(400).json({ error: "Weekly hours must be greater than 0." });
  }

  if (!Number.isFinite(safeDailyHours) || safeDailyHours <= 0) {
    return res.status(400).json({ error: "Daily hours must be greater than 0." });
  }

  const normalizedUsername = normalizeUsername(username);

  if (!normalizedUsername) {
    return res.status(400).json({ error: "Username must contain letters or numbers." });
  }

  try {
    await enforceEmployeeLimit(req.user.businessId);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }

  const businessResult = await pool.query(
    `SELECT business_slug
     FROM businesses
     WHERE id = $1`,
    [req.user.businessId]
  );

  if (businessResult.rows.length === 0) {
    return res.status(404).json({ error: "Business not found." });
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

  if (preferredShiftId) {
    const shiftResult = await pool.query(
      `SELECT id
       FROM shifts
       WHERE id = $1
         AND business_id = $2
         AND location_id = $3`,
      [preferredShiftId, req.user.businessId, locationId]
    );

    if (shiftResult.rows.length === 0) {
      return res.status(404).json({ error: "Preferred shift not found for this location." });
    }
  }

  const businessSlug = businessResult.rows[0].business_slug;
  const fullLogin = buildFullLogin(normalizedUsername, businessSlug);
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const managerFlag = Boolean(canManageSchedule);
  const role = managerFlag ? "manager" : "employee";

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      `INSERT INTO users (
         business_id,
         first_name,
         last_name,
         username,
         full_login,
         password_hash,
         role,
         can_manage_schedule
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, username, full_login, role, can_manage_schedule`,
      [
        req.user.businessId,
        firstName.trim(),
        lastName.trim(),
        normalizedUsername,
        fullLogin,
        passwordHash,
        role,
        managerFlag
      ]
    );

    const user = userResult.rows[0];

    const employeeResult = await client.query(
      `INSERT INTO employees (
         business_id,
         location_id,
         user_id,
         priority,
         employee_code,
         title,
         employment_type,
         weekly_hours,
         daily_hours,
         orientation_start,
         preferred_shift_id
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        req.user.businessId,
        locationId,
        user.id,
        safePriority,
        employeeCode.trim(),
        title.trim(),
        safeEmploymentType,
        safeWeeklyHours,
        safeDailyHours,
        orientationStart || null,
        preferredShiftId || null
      ]
    );

    const employee = employeeResult.rows[0];

    for (const day of availability || []) {
      const dayOfWeek = Number(day.dayOfWeek);

      if (!Number.isInteger(dayOfWeek) || dayOfWeek < 1 || dayOfWeek > 7) {
        continue;
      }

      await client.query(
        `INSERT INTO employee_availability (employee_id, day_of_week, available)
         VALUES ($1, $2, $3)
         ON CONFLICT (employee_id, day_of_week)
         DO UPDATE SET available = EXCLUDED.available`,
        [employee.id, dayOfWeek, Boolean(day.available)]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      employee,
      login: user.full_login,
      fullLogin: user.full_login,
      role: user.role,
      canManageSchedule: user.can_manage_schedule
    });
  } catch (err) {
    await client.query("ROLLBACK");

    if (err.code === "23505") {
      return res.status(409).json({ error: "Employee username or code already exists." });
    }

    console.error(err);
    res.status(500).json({ error: "Employee creation failed." });
  } finally {
    client.release();
  }
});

router.delete("/:id", requireAuth, requireScheduleManager, async (req, res) => {
  const { password } = req.body;

  const valid = await verifyActorPassword(req.user.id, password);

  if (!valid) {
    return res.status(401).json({ error: "Owner/manager credentials are required." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const employeeResult = await client.query(
      `UPDATE employees
       SET active = false
       WHERE id = $1
         AND business_id = $2
       RETURNING user_id`,
      [req.params.id, req.user.businessId]
    );

    if (employeeResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Employee not found." });
    }

    await client.query(
      `UPDATE users
       SET active = false
       WHERE id = $1
         AND business_id = $2`,
      [employeeResult.rows[0].user_id, req.user.businessId]
    );

    await client.query("COMMIT");

    res.json({ message: "Employee deleted." });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Employee delete failed." });
  } finally {
    client.release();
  }
});

module.exports = router;
