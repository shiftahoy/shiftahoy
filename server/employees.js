const express = require("express");
const argon2 = require("argon2");
const pool = require("./db");
const { requireAuth, requireScheduleManager, requireOwner } = require("./middleware");

const router = express.Router();

const USERNAME_RULE_MESSAGE =
  "Username must be 3 to 30 characters and can only contain lowercase letters and numbers. No spaces or symbols.";

const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;
const PASSWORD_RULE_MESSAGE =
  `Password must be ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters. Spaces and symbols are allowed.`;

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function isValidUsername(username) {
  return /^[a-z0-9]{3,30}$/.test(String(username || ""));
}

function normalizePassword(password) {
  return String(password || "").normalize("NFKC");
}

function isValidPassword(password) {
  const normalizedPassword = normalizePassword(password);
  return (
    normalizedPassword.length >= PASSWORD_MIN_LENGTH &&
    normalizedPassword.length <= PASSWORD_MAX_LENGTH
  );
}

function buildFullLogin(username, businessSlug) {
  return `${username}/${businessSlug}`;
}

function normalizeAvailability(availability) {
  const input = Array.isArray(availability) ? availability : [];
  const availabilityByDay = new Map(input.map((item) => [Number(item.dayOfWeek), Boolean(item.available)]));

  return [1, 2, 3, 4, 5, 6, 7].map((dayOfWeek) => ({
    dayOfWeek,
    available: availabilityByDay.has(dayOfWeek) ? availabilityByDay.get(dayOfWeek) : true
  }));
}

function normalizeDaysOff(daysOff) {
  const input = Array.isArray(daysOff) ? daysOff : [];
  const unique = new Set();

  for (const date of input) {
    const value = String(date || "").slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      unique.add(value);
    }
  }

  return [...unique].sort();
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

  return argon2.verify(result.rows[0].password_hash, normalizePassword(password));
}

async function enforceEmployeeLimit(businessId, excludingEmployeeId = null) {
  const result = await pool.query(
    `SELECT b.plan_employee_limit, count(e.id)::int AS employee_count
     FROM businesses b
     LEFT JOIN employees e
       ON e.business_id = b.id
      AND e.active = true
      AND ($2::uuid IS NULL OR e.id <> $2::uuid)
     WHERE b.id = $1
     GROUP BY b.id`,
    [businessId, excludingEmployeeId]
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

async function getBusinessSlug(clientOrPool, businessId) {
  const result = await clientOrPool.query(
    `SELECT business_slug
     FROM businesses
     WHERE id = $1`,
    [businessId]
  );

  return result.rows[0]?.business_slug || "";
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
    const error = new Error("Managers can only use their assigned location.");
    error.status = 403;
    throw error;
  }
}

async function loadEmployeeWithDetails(clientOrPool, employeeId, businessId) {
  const result = await clientOrPool.query(
    `SELECT
       e.*,
       u.first_name,
       u.last_name,
       u.username,
       u.full_login,
       u.can_manage_schedule,
       u.role,
       COALESCE(
         json_agg(
           DISTINCT jsonb_build_object(
             'dayOfWeek', ea.day_of_week,
             'available', ea.available
           )
         ) FILTER (WHERE ea.id IS NOT NULL),
         '[]'::json
       ) AS availability,
       COALESCE(
         json_agg(DISTINCT edo.day_off ORDER BY edo.day_off) FILTER (WHERE edo.id IS NOT NULL),
         '[]'::json
       ) AS days_off
     FROM employees e
     JOIN users u ON u.id = e.user_id
     LEFT JOIN employee_availability ea ON ea.employee_id = e.id
     LEFT JOIN employee_days_off edo ON edo.employee_id = e.id
     WHERE e.id = $1
       AND e.business_id = $2
     GROUP BY e.id, u.id`,
    [employeeId, businessId]
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
       FROM employees e
       JOIN users u ON u.id = e.user_id
       WHERE e.business_id = $1
         AND e.location_id = $2
         AND e.active = true
         AND u.active = true
         AND (
           e.employee_code ILIKE $3
           OR e.title ILIKE $3
           OR u.first_name ILIKE $3
           OR u.last_name ILIKE $3
           OR u.username ILIKE $3
           OR u.full_login ILIKE $3
         )`,
      [req.user.businessId, locationId, search]
    );

    const total = countResult.rows[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / safePageSize));
    const currentPage = Math.min(safePage, totalPages);
    const currentOffset = (currentPage - 1) * safePageSize;

    const result = await pool.query(
      `SELECT
         e.*,
         u.first_name,
         u.last_name,
         u.username,
         u.full_login,
         u.can_manage_schedule,
         u.role,
         COALESCE(
           json_agg(
             DISTINCT jsonb_build_object(
               'dayOfWeek', ea.day_of_week,
               'available', ea.available
             )
           ) FILTER (WHERE ea.id IS NOT NULL),
           '[]'::json
         ) AS availability,
         COALESCE(
           json_agg(DISTINCT edo.day_off ORDER BY edo.day_off) FILTER (WHERE edo.id IS NOT NULL),
           '[]'::json
         ) AS days_off
       FROM employees e
       JOIN users u ON u.id = e.user_id
       LEFT JOIN employee_availability ea ON ea.employee_id = e.id
       LEFT JOIN employee_days_off edo ON edo.employee_id = e.id
       WHERE e.business_id = $1
         AND e.location_id = $2
         AND e.active = true
         AND u.active = true
         AND (
           e.employee_code ILIKE $3
           OR e.title ILIKE $3
           OR u.first_name ILIKE $3
           OR u.last_name ILIKE $3
           OR u.username ILIKE $3
           OR u.full_login ILIKE $3
         )
       GROUP BY e.id, u.id
       ORDER BY e.priority ASC, u.last_name ASC, u.first_name ASC
       LIMIT $4 OFFSET $5`,
      [req.user.businessId, locationId, search, safePageSize, currentOffset]
    );

    res.json({
      employees: result.rows,
      page: currentPage,
      pageSize: safePageSize,
      total,
      totalPages
    });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to load employees." });
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
    daysOff,
    canManageSchedule = false
  } = req.body;

  if (!locationId || !username || !password || !employeeCode) {
    return res.status(400).json({ error: "Location, employee #, username, and password are required." });
  }

  const normalizedUsername = normalizeUsername(username);

  if (!isValidUsername(normalizedUsername)) {
    return res.status(400).json({ error: USERNAME_RULE_MESSAGE });
  }

  const normalizedPassword = normalizePassword(password);

  if (!isValidPassword(normalizedPassword)) {
    return res.status(400).json({ error: PASSWORD_RULE_MESSAGE });
  }

  const safePriority = Number(priority) || 1;

  if (!Number.isInteger(safePriority) || safePriority < 1 || safePriority > 25) {
    return res.status(400).json({ error: "Priority must be a whole number from 1 to 25." });
  }

  const safeEmploymentType = employmentType === "part_time" ? "part_time" : "full_time";

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
        ? 8
        : 4.5;

  if (!Number.isFinite(safeWeeklyHours) || safeWeeklyHours <= 0) {
    return res.status(400).json({ error: "Weekly hours must be greater than 0." });
  }

  if (!Number.isFinite(safeDailyHours) || safeDailyHours <= 0) {
    return res.status(400).json({ error: "Daily hours must be greater than 0." });
  }

  try {
    await assertLocationAccess(req.user, locationId);
    await enforceEmployeeLimit(req.user.businessId);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const businessSlug = await getBusinessSlug(client, req.user.businessId);
    const fullLogin = buildFullLogin(normalizedUsername, businessSlug);
    const passwordHash = await argon2.hash(normalizedPassword, { type: argon2.argon2id });
    const safeEmployeeCode = String(employeeCode).trim();
    const safeFirstName = String(firstName || "").trim() || safeEmployeeCode;
    const safeLastName = String(lastName || "").trim() || "Employee";
    const safeCanManage = req.user.role === "owner" ? Boolean(canManageSchedule) : false;
    const safeRole = safeCanManage ? "manager" : "employee";

    const userResult = await client.query(
      `INSERT INTO users (
         business_id,
         first_name,
         last_name,
         email,
         username,
         full_login,
         password_hash,
         role,
         can_manage_schedule,
         email_verified
       )
       VALUES ($1, $2, $3, NULL, $4, $5, $6, $7, $8, true)
       RETURNING id`,
      [
        req.user.businessId,
        safeFirstName,
        safeLastName,
        normalizedUsername,
        fullLogin,
        passwordHash,
        safeRole,
        safeCanManage
      ]
    );

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
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        req.user.businessId,
        locationId,
        userResult.rows[0].id,
        safePriority,
        safeEmployeeCode,
        String(title || "").trim() || "Employee",
        safeEmploymentType,
        safeWeeklyHours,
        safeDailyHours,
        orientationStart || null,
        preferredShiftId || null
      ]
    );

    const employeeId = employeeResult.rows[0].id;

    for (const day of normalizeAvailability(availability)) {
      await client.query(
        `INSERT INTO employee_availability (employee_id, day_of_week, available)
         VALUES ($1, $2, $3)`,
        [employeeId, day.dayOfWeek, day.available]
      );
    }

    for (const dayOff of normalizeDaysOff(daysOff)) {
      await client.query(
        `INSERT INTO employee_days_off (employee_id, day_off)
         VALUES ($1, $2)`,
        [employeeId, dayOff]
      );
    }

    const employee = await loadEmployeeWithDetails(client, employeeId, req.user.businessId);

    await client.query("COMMIT");

    res.status(201).json({ employee });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err);

    if (err.code === "23505") {
      return res.status(409).json({ error: "Employee #, username, or login already exists." });
    }

    res.status(500).json({ error: "Employee creation failed." });
  } finally {
    client.release();
  }
});

router.put("/:id", requireAuth, requireScheduleManager, async (req, res) => {
  const { id } = req.params;
  const {
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
    daysOff,
    canManageSchedule = false
  } = req.body;

  const current = await pool.query(
    `SELECT e.*, u.id AS user_id
     FROM employees e
     JOIN users u ON u.id = e.user_id
     WHERE e.id = $1
       AND e.business_id = $2
       AND e.active = true`,
    [id, req.user.businessId]
  );

  if (current.rows.length === 0) {
    return res.status(404).json({ error: "Employee not found." });
  }

  const employeeRow = current.rows[0];

  try {
    await assertLocationAccess(req.user, employeeRow.location_id);
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }

  const safePriority = Number(priority) || employeeRow.priority;

  if (!Number.isInteger(safePriority) || safePriority < 1 || safePriority > 25) {
    return res.status(400).json({ error: "Priority must be a whole number from 1 to 25." });
  }

  const safeEmploymentType = employmentType === "part_time" ? "part_time" : "full_time";
  const safeWeeklyHours = Number(weeklyHours);
  const safeDailyHours = Number(dailyHours);

  if (!Number.isFinite(safeWeeklyHours) || safeWeeklyHours <= 0) {
    return res.status(400).json({ error: "Weekly hours must be greater than 0." });
  }

  if (!Number.isFinite(safeDailyHours) || safeDailyHours <= 0) {
    return res.status(400).json({ error: "Daily hours must be greater than 0." });
  }

  const normalizedUsername = normalizeUsername(username);

  if (!isValidUsername(normalizedUsername)) {
    return res.status(400).json({ error: USERNAME_RULE_MESSAGE });
  }

  if (password && !isValidPassword(password)) {
    return res.status(400).json({ error: PASSWORD_RULE_MESSAGE });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const businessSlug = await getBusinessSlug(client, req.user.businessId);
    const fullLogin = buildFullLogin(normalizedUsername, businessSlug);
    const safeEmployeeCode = String(employeeCode || "").trim();
    const safeFirstName = String(firstName || "").trim() || safeEmployeeCode || "Employee";
    const safeLastName = String(lastName || "").trim() || "Employee";
    const safeCanManage = req.user.role === "owner" ? Boolean(canManageSchedule) : false;
    const safeRole = safeCanManage ? "manager" : "employee";

    if (password) {
      const passwordHash = await argon2.hash(normalizePassword(password), { type: argon2.argon2id });

      await client.query(
        `UPDATE users
         SET first_name = $1,
             last_name = $2,
             username = $3,
             full_login = $4,
             password_hash = $5,
             role = $6,
             can_manage_schedule = $7,
             updated_at = now()
         WHERE id = $8
           AND business_id = $9`,
        [
          safeFirstName,
          safeLastName,
          normalizedUsername,
          fullLogin,
          passwordHash,
          safeRole,
          safeCanManage,
          employeeRow.user_id,
          req.user.businessId
        ]
      );
    } else {
      await client.query(
        `UPDATE users
         SET first_name = $1,
             last_name = $2,
             username = $3,
             full_login = $4,
             role = $5,
             can_manage_schedule = $6,
             updated_at = now()
         WHERE id = $7
           AND business_id = $8`,
        [
          safeFirstName,
          safeLastName,
          normalizedUsername,
          fullLogin,
          safeRole,
          safeCanManage,
          employeeRow.user_id,
          req.user.businessId
        ]
      );
    }

    await client.query(
      `UPDATE employees
       SET priority = $1,
           employee_code = $2,
           title = $3,
           employment_type = $4,
           weekly_hours = $5,
           daily_hours = $6,
           orientation_start = $7,
           preferred_shift_id = $8,
           updated_at = now()
       WHERE id = $9
         AND business_id = $10`,
      [
        safePriority,
        safeEmployeeCode,
        String(title || "").trim() || "Employee",
        safeEmploymentType,
        safeWeeklyHours,
        safeDailyHours,
        orientationStart || null,
        preferredShiftId || null,
        id,
        req.user.businessId
      ]
    );

    await client.query(`DELETE FROM employee_availability WHERE employee_id = $1`, [id]);
    for (const day of normalizeAvailability(availability)) {
      await client.query(
        `INSERT INTO employee_availability (employee_id, day_of_week, available)
         VALUES ($1, $2, $3)`,
        [id, day.dayOfWeek, day.available]
      );
    }

    await client.query(`DELETE FROM employee_days_off WHERE employee_id = $1`, [id]);
    for (const dayOff of normalizeDaysOff(daysOff)) {
      await client.query(
        `INSERT INTO employee_days_off (employee_id, day_off)
         VALUES ($1, $2)`,
        [id, dayOff]
      );
    }

    const employee = await loadEmployeeWithDetails(client, id, req.user.businessId);

    await client.query("COMMIT");

    res.json({ employee });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err);

    if (err.code === "23505") {
      return res.status(409).json({ error: "Employee #, username, or login already exists." });
    }

    res.status(500).json({ error: "Employee update failed." });
  } finally {
    client.release();
  }
});

async function deleteEmployeeWithCredentials(req, res) {
  const { id } = req.params;
  const { actorPassword } = req.body;

  const verified = await verifyActorPassword(req.user.id, actorPassword);
  if (!verified) {
    return res.status(401).json({ error: "Owner credentials are required to delete an employee." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const employeeResult = await client.query(
      `UPDATE employees
       SET active = false,
           updated_at = now()
       WHERE id = $1
         AND business_id = $2
       RETURNING user_id`,
      [id, req.user.businessId]
    );

    if (employeeResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Employee not found." });
    }

    await client.query(
      `UPDATE users
       SET active = false,
           updated_at = now()
       WHERE id = $1
         AND business_id = $2`,
      [employeeResult.rows[0].user_id, req.user.businessId]
    );

    await client.query("COMMIT");

    res.json({ message: "Employee deleted." });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err);
    res.status(500).json({ error: "Employee deletion failed." });
  } finally {
    client.release();
  }
}

router.post("/:id/delete", requireAuth, requireOwner, deleteEmployeeWithCredentials);
router.delete("/:id", requireAuth, requireOwner, deleteEmployeeWithCredentials);

module.exports = router;
