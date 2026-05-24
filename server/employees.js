const express = require("express");
const argon2 = require("argon2");
const pool = require("./db");
const { requireAuth, requireScheduleManager } = require("./middleware");

const router = express.Router();

async function verifyActorPassword(userId, password) {
  const result = await pool.query(
    `SELECT password_hash FROM users WHERE id = $1`,
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

  if (row.plan_employee_limit !== null && row.employee_count >= row.plan_employee_limit) {
    const err = new Error("PLAN_LIMIT");
    err.status = 402;
    err.message = "Plan limit reached. Upgrade to add more employees.";
    throw err;
  }
}

router.get("/", requireAuth, async (req, res) => {
  const { locationId, page = 1, pageSize = 25 } = req.query;
  const offset = (Number(page) - 1) * Number(pageSize);

  const result = await pool.query(
    `SELECT e.*, u.first_name, u.last_name, u.username, u.full_login, u.can_manage_schedule
     FROM employees e
     JOIN users u ON u.id = e.user_id
     WHERE e.business_id = $1
       AND e.location_id = $2
       AND e.active = true
     ORDER BY e.priority ASC, u.last_name ASC, u.first_name ASC
     LIMIT $3 OFFSET $4`,
    [req.user.businessId, locationId, Number(pageSize), offset]
  );

  res.json({ employees: result.rows });
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
    availability
  } = req.body;

  if (!locationId || !firstName || !lastName || !username || !password || !employeeCode || !title) {
    return res.status(400).json({ error: "Missing required employee fields." });
  }

  try {
    await enforceEmployeeLimit(req.user.businessId);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }

  const businessResult = await pool.query(
    `SELECT business_slug FROM businesses WHERE id = $1`,
    [req.user.businessId]
  );

  const businessSlug = businessResult.rows[0].business_slug;
  const normalizedUsername = username.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "");
  const fullLogin = `${normalizedUsername}.${businessSlug}`;
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      `INSERT INTO users (
         business_id, first_name, last_name, username, full_login,
         password_hash, role, can_manage_schedule
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'employee', false)
       RETURNING id, username, full_login`,
      [
        req.user.businessId,
        firstName.trim(),
        lastName.trim(),
        normalizedUsername,
        fullLogin,
        passwordHash
      ]
    );

    const user = userResult.rows[0];

    const employeeResult = await client.query(
      `INSERT INTO employees (
         business_id, location_id, user_id, priority, employee_code, title,
         employment_type, weekly_hours, daily_hours, orientation_start, preferred_shift_id
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        req.user.businessId,
        locationId,
        user.id,
        Number(priority),
        employeeCode.trim(),
        title.trim(),
        employmentType,
        Number(weeklyHours),
        Number(dailyHours),
        orientationStart || null,
        preferredShiftId || null
      ]
    );

    const employee = employeeResult.rows[0];

    for (const day of availability || []) {
      await client.query(
        `INSERT INTO employee_availability (employee_id, day_of_week, available)
         VALUES ($1, $2, $3)`,
        [employee.id, day.dayOfWeek, !!day.available]
      );
    }

    await client.query("COMMIT");

    res.status(201).json({
      employee,
      login: user.full_login
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

  await pool.query(
    `UPDATE employees SET active = false WHERE id = $1 AND business_id = $2`,
    [req.params.id, req.user.businessId]
  );

  res.json({ message: "Employee deleted." });
});

module.exports = router;
