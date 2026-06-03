const express = require("express");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const pool = require("./db");
const { requireAuth, requireScheduleManager } = require("./middleware");
const { logAudit } = require("./audit");
const { normalizeAccountNumber, isValidAccountNumber } = require("./id-utils");

const router = express.Router();
const CLOCK_SESSION_TTL = "12h";
const CLOCK_DESKTOP_HEADER = "x-shiftahoy-desktop-clock";

function cleanDate(value) {
  const text = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function normalizeBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function isDesktopClockRequest(req) {
  return String(req.headers[CLOCK_DESKTOP_HEADER] || "") === "1";
}

function requireDesktopClockRequest(req, res) {
  if (isDesktopClockRequest(req)) return true;
  res.status(403).json({ error: "Clock in/out is only available from the Shift Ahoy desktop app." });
  return false;
}

function cleanPositiveInt(value, fallback, min = 0, max = 100000) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function toDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

async function ensurePayrollSettings(businessId) {
  await pool.query(
    `INSERT INTO payroll_settings (business_id)
     VALUES ($1)
     ON CONFLICT (business_id) DO NOTHING`,
    [businessId]
  );
}

async function businessByAccountNumber(value) {
  const accountNumber = normalizeAccountNumber(value);
  if (!isValidAccountNumber(accountNumber)) return null;

  const result = await pool.query(
    `SELECT id, business_name, account_number
     FROM businesses
     WHERE account_number = $1
     LIMIT 1`,
    [accountNumber]
  );
  return result.rows[0] || null;
}

async function verifyBusinessManagerPassword(businessId, password) {
  if (!password) return null;

  const result = await pool.query(
    `SELECT id, first_name, last_name, role, can_manage_schedule, password_hash
     FROM users
     WHERE business_id = $1
       AND active = true
       AND (role = 'owner' OR (role = 'manager' AND can_manage_schedule = true))`,
    [businessId]
  );

  for (const user of result.rows) {
    if (await argon2.verify(user.password_hash, String(password || "").normalize("NFKC"))) {
      return user;
    }
  }
  return null;
}

function createClockSessionToken({ businessId, businessAccountNumber, actorUserId }) {
  return jwt.sign(
    {
      purpose: "shiftahoy_clock_portal",
      businessId,
      businessAccountNumber,
      actorUserId
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: CLOCK_SESSION_TTL }
  );
}

function verifyClockSessionToken(token, businessId) {
  if (!token) return false;
  try {
    const payload = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    return payload.purpose === "shiftahoy_clock_portal" && payload.businessId === businessId;
  } catch {
    return false;
  }
}

async function settingsForBusiness(businessId) {
  await ensurePayrollSettings(businessId);
  const result = await pool.query(
    `SELECT *
     FROM payroll_settings
     WHERE business_id = $1`,
    [businessId]
  );
  return result.rows[0] || {};
}

async function findEmployeeForClock(businessId, employeeCode, clientOrPool = pool) {
  const result = await clientOrPool.query(
    `SELECT
       e.id AS employee_id,
       e.business_id,
       e.location_id,
       e.employee_code,
       e.title,
       e.pay_rate_cents,
       u.id AS user_id,
       u.account_number,
       u.first_name,
       u.last_name,
       u.role,
       u.can_manage_schedule
     FROM employees e
     JOIN users u ON u.id = e.user_id
     WHERE e.business_id = $1
       AND e.employee_code = $2
       AND u.account_number = $2
       AND u.active = true
       AND e.active = true
     LIMIT 1`,
    [businessId, employeeCode]
  );
  return result.rows[0] || null;
}

async function openClockEntry(employeeId, clientOrPool = pool) {
  const result = await clientOrPool.query(
    `SELECT *
     FROM time_clock_entries
     WHERE employee_id = $1
       AND clock_out_at IS NULL
     ORDER BY clock_in_at DESC
     LIMIT 1
     FOR UPDATE`,
    [employeeId]
  );
  return result.rows[0] || null;
}

async function scheduledWindow(employee) {
  const result = await pool.query(
    `SELECT
       sc.work_date,
       sc.start_time,
       sc.end_time,
       s.week_start
     FROM schedule_cells sc
     JOIN schedules s ON s.id = sc.schedule_id
     WHERE sc.employee_id = $1
       AND s.business_id = $2
       AND s.location_id = $3
       AND s.status IN ('published', 'revised')
       AND sc.work_date = CURRENT_DATE
     ORDER BY s.published_at DESC NULLS LAST, s.updated_at DESC
     LIMIT 1`,
    [employee.employee_id, employee.business_id, employee.location_id]
  );

  const row = result.rows[0];
  if (!row?.start_time || !row?.end_time) return null;

  const date = toDateOnly(row.work_date);
  return {
    workDate: date,
    startAt: new Date(`${date}T${String(row.start_time).slice(0, 5)}:00`),
    endAt: new Date(`${date}T${String(row.end_time).slice(0, 5)}:00`)
  };
}

function clockInStatus(now, scheduledAt, settings) {
  if (!scheduledAt) return "unscheduled";
  const earlyGrace = cleanPositiveInt(settings.clock_in_early_grace_minutes, 0, 0, 240);
  const lateGrace = cleanPositiveInt(settings.clock_in_late_grace_minutes, 5, 0, 240);
  const diffMinutes = Math.round((now.getTime() - scheduledAt.getTime()) / 60000);
  if (diffMinutes < -earlyGrace) return "early";
  if (diffMinutes > lateGrace) return "late";
  return "on_time";
}

function clockOutStatus(now, scheduledAt, settings) {
  if (!scheduledAt) return "unscheduled";
  const grace = cleanPositiveInt(settings.clock_out_grace_minutes, 15, 0, 240);
  const diffMinutes = Math.round((now.getTime() - scheduledAt.getTime()) / 60000);
  if (diffMinutes < -grace) return "early";
  if (diffMinutes > grace) return "late";
  return "on_time";
}

function alertTypeFor(action, status) {
  if (status === "on_time") return null;
  if (action === "clock_in") return `clock_in_${status}`;
  return `clock_out_${status}`;
}

async function createPayrollAlert(client, { employee, entryId, action, status, scheduledAt }) {
  const alertType = alertTypeFor(action, status);
  if (!alertType) return;

  const actionText = action === "clock_in" ? "clocked in" : "clocked out";
  const name = `${employee.first_name || ""} ${employee.last_name || ""}`.trim() || employee.employee_code;
  const scheduledText = scheduledAt ? ` Scheduled time: ${scheduledAt.toLocaleString()}.` : " No published schedule was found for today.";

  await client.query(
    `INSERT INTO payroll_alerts (business_id, location_id, employee_id, time_clock_entry_id, alert_type, message)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      employee.business_id,
      employee.location_id,
      employee.employee_id,
      entryId,
      alertType,
      `${name} ${actionText} ${status.replace("_", " ")}.${scheduledText}`
    ]
  );
}

async function createViolation(client, { employee, entryId = null, type, reason, scheduledAt = null, attemptedAt = new Date() }) {
  await client.query(
    `INSERT INTO payroll_violations (business_id, location_id, employee_id, time_clock_entry_id, violation_type, reason, attempted_at, scheduled_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [employee.business_id, employee.location_id, employee.employee_id, entryId, type, reason, attemptedAt, scheduledAt]
  );
}

function payPeriodSql(alias = "ps") {
  return `(
    ${alias}.first_pay_period_start
    + (
      floor(GREATEST(0, (CURRENT_DATE - ${alias}.first_pay_period_start))::numeric / (${alias}.pay_period_weeks * 7))::int
      * (${alias}.pay_period_weeks * 7)
    )
  )`;
}

async function requireClockBusiness(req, res) {
  const business = await businessByAccountNumber(req.body.businessAccountNumber || req.query.businessAccountNumber);
  if (!business) {
    res.status(404).json({ error: "Enter a valid Business ID# first." });
    return null;
  }
  return business;
}

async function enforceClockPortalAccess(req, res, business, settings) {
  if (settings.in_app_clock_enabled === false) {
    res.status(403).json({ error: "In-app clock in/out is turned off for this business." });
    return false;
  }

  if (settings.require_clock_session !== false && !verifyClockSessionToken(req.body.clockSessionToken, business.id)) {
    res.status(403).json({ error: "A manager or owner must unlock the clock portal first." });
    return false;
  }

  return true;
}

router.post("/clock/session", async (req, res) => {
  if (!requireDesktopClockRequest(req, res)) return;
  const business = await businessByAccountNumber(req.body.businessAccountNumber || req.body.businessId);
  if (!business) return res.status(404).json({ error: "No business was found for that Business ID#." });

  const actor = await verifyBusinessManagerPassword(business.id, req.body.password);
  if (!actor) return res.status(403).json({ error: "Wrong owner or manager password for that business." });

  const settings = await settingsForBusiness(business.id);
  if (settings.in_app_clock_enabled === false) {
    return res.status(403).json({ error: "In-app clock in/out is turned off for this business." });
  }

  const token = createClockSessionToken({
    businessId: business.id,
    businessAccountNumber: business.account_number,
    actorUserId: actor.id
  });

  res.json({
    clockSessionToken: token,
    business: { businessName: business.business_name, businessAccountNumber: business.account_number },
    message: "Clock portal unlocked."
  });
});

router.post("/clock/lookup", async (req, res) => {
  if (!requireDesktopClockRequest(req, res)) return;
  const business = await requireClockBusiness(req, res);
  if (!business) return;

  const employeeCode = normalizeAccountNumber(req.body.employeeCode || req.body.accountNumber);
  if (!isValidAccountNumber(employeeCode)) {
    return res.status(400).json({ error: "Enter a valid 9 digit Employee Company ID#." });
  }

  try {
    const settings = await settingsForBusiness(business.id);
    if (!(await enforceClockPortalAccess(req, res, business, settings))) return;

    const employee = await findEmployeeForClock(business.id, employeeCode);
    if (!employee) return res.status(404).json({ error: "No active employee was found for that Employee Company ID#." });

    const openEntry = await openClockEntry(employee.employee_id);
    res.json({
      employee: {
        id: employee.employee_id,
        employeeCode: employee.employee_code,
        name: `${employee.first_name || ""} ${employee.last_name || ""}`.trim(),
        title: employee.title
      },
      clockedIn: !!openEntry,
      openEntry: openEntry ? { clockInAt: openEntry.clock_in_at } : null
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to look up clock status." });
  }
});

router.post("/clock", async (req, res) => {
  if (!requireDesktopClockRequest(req, res)) return;
  const business = await requireClockBusiness(req, res);
  if (!business) return;

  const employeeCode = normalizeAccountNumber(req.body.employeeCode || req.body.accountNumber);
  const action = req.body.action === "clock_out" ? "clock_out" : "clock_in";

  if (!isValidAccountNumber(employeeCode)) {
    return res.status(400).json({ error: "Enter a valid 9 digit Employee Company ID#." });
  }

  const client = await pool.connect();

  try {
    const settings = await settingsForBusiness(business.id);
    if (!(await enforceClockPortalAccess(req, res, business, settings))) return;

    await client.query("BEGIN");
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`clock:${business.id}:${employeeCode}`]);
    const employee = await findEmployeeForClock(business.id, employeeCode, client);
    if (!employee) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "No active employee was found for that Employee Company ID#." });
    }

    const now = new Date();
    const window = await scheduledWindow(employee);
    const openEntry = await openClockEntry(employee.employee_id, client);

    if (action === "clock_in") {
      if (openEntry) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "This employee is already clocked in." });
      }

      const status = clockInStatus(now, window?.startAt, settings);
      const enforceStart = settings.enforce_scheduled_clock_in !== false;

      if (enforceStart && status === "early") {
        await createViolation(client, {
          employee,
          type: "clock_in_early_blocked",
          reason: `Tried to clock in before the allowed window for the scheduled start time.`,
          scheduledAt: window?.startAt || null,
          attemptedAt: now
        });
        await client.query("COMMIT");
        return res.status(409).json({ error: "Too early to clock in. This attempt was logged as a violation." });
      }

      const insert = await client.query(
        `INSERT INTO time_clock_entries (
           business_id, location_id, employee_id, account_number, employee_code, clock_in_at,
           clock_in_status, scheduled_start_at, scheduled_end_at
         )
         VALUES ($1, $2, $3, $4, $5, now(), $6, $7, $8)
         RETURNING *`,
        [business.id, employee.location_id, employee.employee_id, employee.employee_code, employee.employee_code, status, window?.startAt || null, window?.endAt || null]
      );

      if (["late", "unscheduled"].includes(status)) {
        await createViolation(client, {
          employee,
          entryId: insert.rows[0].id,
          type: `clock_in_${status}`,
          reason: status === "late" ? "Clocked in after the allowed start window." : "Clocked in without a published schedule for today.",
          scheduledAt: window?.startAt || null,
          attemptedAt: now
        });
      }

      await createPayrollAlert(client, { employee, entryId: insert.rows[0].id, action, status, scheduledAt: window?.startAt });
      await client.query("COMMIT");
      return res.json({ message: "Clock in successful.", status, entry: insert.rows[0] });
    }

    if (!openEntry) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "This employee is not currently clocked in." });
    }

    const status = clockOutStatus(now, window?.endAt, settings);
    const update = await client.query(
      `UPDATE time_clock_entries
       SET clock_out_at = now(),
           clock_out_status = $1,
           scheduled_end_at = COALESCE(scheduled_end_at, $2),
           updated_at = now()
       WHERE id = $3
       RETURNING *`,
      [status, window?.endAt || null, openEntry.id]
    );

    if (["early", "late", "unscheduled"].includes(status)) {
      await createViolation(client, {
        employee,
        entryId: openEntry.id,
        type: `clock_out_${status}`,
        reason: status === "unscheduled" ? "Clocked out without a published schedule for today." : `Clocked out ${status} compared with the scheduled end time.`,
        scheduledAt: window?.endAt || null,
        attemptedAt: now
      });
    }

    await createPayrollAlert(client, { employee, entryId: openEntry.id, action, status, scheduledAt: window?.endAt });
    await runAutomaticLeaveAccrualForClockOut(client, employee.business_id, employee.employee_id, update.rows[0], null);
    await runAutomaticBonusAwards(client, employee.business_id, employee.employee_id, req.user?.id || null);
    await client.query("COMMIT");
    return res.json({ message: "Clock out successful.", status, entry: update.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err);
    if (err.code === "23505") return res.status(409).json({ error: "This employee already has an open clock entry." });
    res.status(500).json({ error: "Clock action failed." });
  } finally {
    client.release();
  }
});

router.get("/settings", requireAuth, requireScheduleManager, async (req, res) => {
  try {
    const settings = await settingsForBusiness(req.user.businessId);
    res.json({ settings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load payroll settings." });
  }
});

router.put("/settings", requireAuth, requireScheduleManager, async (req, res) => {
  const firstPayPeriodStart = cleanDate(req.body.firstPayPeriodStart);
  const payPeriodWeeks = cleanPositiveInt(req.body.payPeriodWeeks, 2, 1, 12);

  if (!firstPayPeriodStart) {
    return res.status(400).json({ error: "First pay cycle start date is required." });
  }

  try {
    const result = await pool.query(
      `INSERT INTO payroll_settings (
         business_id, first_pay_period_start, pay_period_weeks, updated_by, updated_at,
         in_app_clock_enabled, require_clock_session, enforce_scheduled_clock_in,
         clock_in_early_grace_minutes, clock_in_late_grace_minutes, clock_out_grace_minutes,
         pto_enabled, sick_leave_enabled, bonus_enabled
       )
       VALUES ($1, $2, $3, $4, now(), $5, $6, $7, $8, $9, $10, $11, $12, $13)
       ON CONFLICT (business_id)
       DO UPDATE SET first_pay_period_start = EXCLUDED.first_pay_period_start,
                     pay_period_weeks = EXCLUDED.pay_period_weeks,
                     updated_by = EXCLUDED.updated_by,
                     updated_at = now(),
                     in_app_clock_enabled = EXCLUDED.in_app_clock_enabled,
                     require_clock_session = EXCLUDED.require_clock_session,
                     enforce_scheduled_clock_in = EXCLUDED.enforce_scheduled_clock_in,
                     clock_in_early_grace_minutes = EXCLUDED.clock_in_early_grace_minutes,
                     clock_in_late_grace_minutes = EXCLUDED.clock_in_late_grace_minutes,
                     clock_out_grace_minutes = EXCLUDED.clock_out_grace_minutes,
                     pto_enabled = EXCLUDED.pto_enabled,
                     sick_leave_enabled = EXCLUDED.sick_leave_enabled,
                     bonus_enabled = EXCLUDED.bonus_enabled
       RETURNING *`,
      [
        req.user.businessId,
        firstPayPeriodStart,
        payPeriodWeeks,
        req.user.id,
        req.body.inAppClockEnabled !== false,
        req.body.requireClockSession !== false,
        req.body.enforceScheduledClockIn !== false,
        cleanPositiveInt(req.body.clockInEarlyGraceMinutes, 0, 0, 240),
        cleanPositiveInt(req.body.clockInLateGraceMinutes, 5, 0, 240),
        cleanPositiveInt(req.body.clockOutGraceMinutes, 15, 0, 240),
        normalizeBoolean(req.body.ptoEnabled),
        normalizeBoolean(req.body.sickLeaveEnabled),
        normalizeBoolean(req.body.bonusEnabled)
      ]
    );

    await logAudit({
      businessId: req.user.businessId,
      actorUserId: req.user.id,
      action: "Payroll settings updated",
      entityType: "payroll_settings",
      details: `Pay cycle ${firstPayPeriodStart}; every ${payPeriodWeeks} week(s); clock settings updated by ${req.user.role}.`
    });

    res.json({ settings: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save payroll settings." });
  }
});

router.get("/employee-summary", requireAuth, async (req, res) => {
  try {
    const employeeResult = await pool.query(
      `SELECT e.id, e.business_id, e.pay_rate_cents
       FROM employees e
       WHERE e.user_id = $1
         AND e.business_id = $2
         AND e.active = true
       ORDER BY e.created_at ASC
       LIMIT 1`,
      [req.user.id, req.user.businessId]
    );

    if (employeeResult.rows.length === 0) return res.json({ entries: [], violations: [], currentPeriod: null, allTime: null });
    const employee = employeeResult.rows[0];
    await ensurePayrollSettings(req.user.businessId);

    const summary = await pool.query(
      `WITH settings AS (
         SELECT *, ${payPeriodSql("payroll_settings")} AS period_start
         FROM payroll_settings
         WHERE business_id = $1
       ), period AS (
         SELECT period_start, (period_start + (pay_period_weeks * 7 - 1))::date AS period_end
         FROM settings
       )
       SELECT
         p.period_start,
         p.period_end,
         COALESCE(SUM(tce.minutes_worked), 0)::int AS minutes_worked,
         COALESCE(SUM(tce.minutes_worked), 0)::numeric / 60 AS hours_worked,
         ROUND((COALESCE(SUM(tce.minutes_worked), 0)::numeric / 60) * $3)::int AS estimated_pay_cents
       FROM period p
       LEFT JOIN time_clock_entries tce
         ON tce.employee_id = $2
        AND tce.clock_out_at IS NOT NULL
        AND tce.clock_in_at::date BETWEEN p.period_start AND p.period_end
       GROUP BY p.period_start, p.period_end`,
      [req.user.businessId, employee.id, employee.pay_rate_cents]
    );

    const allTime = await pool.query(
      `SELECT COALESCE(SUM(minutes_worked), 0)::int AS minutes_worked,
              COALESCE(SUM(minutes_worked), 0)::numeric / 60 AS hours_worked
       FROM time_clock_entries
       WHERE employee_id = $1
         AND clock_out_at IS NOT NULL`,
      [employee.id]
    );

    const entries = await pool.query(
      `SELECT clock_in_at, clock_out_at, minutes_worked, clock_in_status, clock_out_status
       FROM time_clock_entries
       WHERE employee_id = $1
       ORDER BY clock_in_at DESC
       LIMIT 40`,
      [employee.id]
    );

    const violations = await pool.query(
      `SELECT violation_type, reason, attempted_at, scheduled_at, created_at
       FROM payroll_violations
       WHERE employee_id = $1
       ORDER BY attempted_at DESC
       LIMIT 40`,
      [employee.id]
    );

    const leaveBalances = await pool.query(
      `SELECT leave_type,
              balance_minutes,
              accrued_minutes_lifetime,
              used_minutes_lifetime,
              updated_at
       FROM employee_leave_balances
       WHERE employee_id = $1
       ORDER BY leave_type`,
      [employee.id]
    );

    const leaveTransactions = await pool.query(
      `SELECT leave_type, minutes_delta, reason, source, period_start, period_end, created_at
       FROM employee_leave_transactions
       WHERE employee_id = $1
       ORDER BY created_at DESC
       LIMIT 40`,
      [employee.id]
    );

    const bonusAwards = await pool.query(
      `SELECT eba.*, br.name AS rule_name
       FROM employee_bonus_awards eba
       LEFT JOIN bonus_rules br ON br.id = eba.bonus_rule_id
       WHERE eba.employee_id = $1
       ORDER BY eba.awarded_at DESC
       LIMIT 25`,
      [employee.id]
    );

    res.json({ currentPeriod: summary.rows[0], allTime: allTime.rows[0], entries: entries.rows, violations: violations.rows, leaveBalances: leaveBalances.rows, leaveTransactions: leaveTransactions.rows, bonusAwards: bonusAwards.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load payroll summary." });
  }
});

router.get("/manager-summary", requireAuth, requireScheduleManager, async (req, res) => {
  const locationId = req.query.locationId || null;

  try {
    await ensurePayrollSettings(req.user.businessId);

    let locationFilter = "";
    let params = [req.user.businessId];

    if (locationId) {
      locationFilter = "AND e.location_id = $2";
      params.push(locationId);
    } else if (req.user.role !== "owner") {
      const assigned = await pool.query(
        `SELECT DISTINCT location_id FROM employees WHERE business_id = $1 AND user_id = $2 AND active = true`,
        [req.user.businessId, req.user.id]
      );
      const ids = assigned.rows.map((row) => row.location_id).filter(Boolean);
      if (!ids.length) return res.json({ settings: await settingsForBusiness(req.user.businessId), employees: [], alerts: [], violations: [] });
      locationFilter = "AND e.location_id = ANY($2::uuid[])";
      params.push(ids);
    }

    const settings = await settingsForBusiness(req.user.businessId);

    const rows = await pool.query(
      `WITH ps AS (
         SELECT *, ${payPeriodSql("payroll_settings")} AS period_start
         FROM payroll_settings
         WHERE business_id = $1
       ), period AS (
         SELECT period_start, (period_start + (pay_period_weeks * 7 - 1))::date AS period_end
         FROM ps
       )
       SELECT
         e.id,
         e.employee_code,
         u.account_number,
         u.first_name,
         u.last_name,
         e.pay_rate_cents,
         COALESCE(SUM(tce.minutes_worked), 0)::int AS minutes_worked,
         COALESCE(SUM(tce.minutes_worked), 0)::numeric / 60 AS hours_worked,
         ROUND((COALESCE(SUM(tce.minutes_worked), 0)::numeric / 60) * e.pay_rate_cents)::int AS estimated_pay_cents,
         all_time.minutes_worked AS all_time_minutes_worked,
         all_time.hours_worked AS all_time_hours_worked
       FROM employees e
       JOIN users u ON u.id = e.user_id
       CROSS JOIN period p
       LEFT JOIN time_clock_entries tce
         ON tce.employee_id = e.id
        AND tce.clock_out_at IS NOT NULL
        AND tce.clock_in_at::date BETWEEN p.period_start AND p.period_end
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(tce2.minutes_worked), 0)::int AS minutes_worked,
                COALESCE(SUM(tce2.minutes_worked), 0)::numeric / 60 AS hours_worked
         FROM time_clock_entries tce2
         WHERE tce2.employee_id = e.id
           AND tce2.clock_out_at IS NOT NULL
       ) all_time ON true
       WHERE e.business_id = $1
         AND e.active = true
         AND u.active = true
         ${locationFilter}
       GROUP BY e.id, u.id, p.period_start, p.period_end, all_time.minutes_worked, all_time.hours_worked
       ORDER BY u.last_name, u.first_name, e.employee_code`,
      params
    );

    const alerts = await pool.query(
      `SELECT pa.*, e.employee_code, u.first_name, u.last_name, u.account_number
       FROM payroll_alerts pa
       JOIN employees e ON e.id = pa.employee_id
       JOIN users u ON u.id = e.user_id
       WHERE pa.business_id = $1
         ${locationId ? "AND pa.location_id = $2" : req.user.role !== "owner" ? "AND pa.location_id = ANY($2::uuid[])" : ""}
       ORDER BY pa.created_at DESC
       LIMIT 25`,
      params
    );

    const violations = await pool.query(
      `SELECT pv.*, e.employee_code, u.first_name, u.last_name, u.account_number
       FROM payroll_violations pv
       JOIN employees e ON e.id = pv.employee_id
       JOIN users u ON u.id = e.user_id
       WHERE pv.business_id = $1
         ${locationId ? "AND pv.location_id = $2" : req.user.role !== "owner" ? "AND pv.location_id = ANY($2::uuid[])" : ""}
       ORDER BY pv.attempted_at DESC
       LIMIT 50`,
      params
    );

    const leaveBalances = await pool.query(
      `SELECT elb.*, e.employee_code, u.first_name, u.last_name
       FROM employee_leave_balances elb
       JOIN employees e ON e.id = elb.employee_id
       JOIN users u ON u.id = e.user_id
       WHERE elb.business_id = $1
         ${locationId ? "AND e.location_id = $2" : req.user.role !== "owner" ? "AND e.location_id = ANY($2::uuid[])" : ""}
       ORDER BY u.last_name, u.first_name, e.employee_code, elb.leave_type`,
      params
    );

    const bonusAwards = await pool.query(
      `SELECT eba.*, br.name AS rule_name, e.employee_code, u.first_name, u.last_name
       FROM employee_bonus_awards eba
       JOIN employees e ON e.id = eba.employee_id
       JOIN users u ON u.id = e.user_id
       LEFT JOIN bonus_rules br ON br.id = eba.bonus_rule_id
       WHERE eba.business_id = $1
         ${locationId ? "AND e.location_id = $2" : req.user.role !== "owner" ? "AND e.location_id = ANY($2::uuid[])" : ""}
       ORDER BY eba.awarded_at DESC
       LIMIT 50`,
      params
    );

    res.json({ settings, employees: rows.rows, alerts: alerts.rows, violations: violations.rows, leaveBalances: leaveBalances.rows, bonusAwards: bonusAwards.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load payroll manager summary." });
  }
});


function cleanMoneyCents(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.round(number));
}

function cleanHours(value, fallback = 0, min = 0, max = 100000) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function minutesFromHours(value) {
  return Math.round(cleanHours(value, 0, -100000, 100000) * 60);
}

function hoursFromMinutes(value) {
  return Number((Number(value || 0) / 60).toFixed(2));
}

function serviceYearsFrom(orientationStart, asOf = new Date()) {
  if (!orientationStart) return 0;
  const start = new Date(orientationStart);
  if (Number.isNaN(start.getTime())) return 0;
  const diffMs = Math.max(0, asOf.getTime() - start.getTime());
  return diffMs / (365.25 * 24 * 60 * 60 * 1000);
}

async function ensureLeaveRows(clientOrPool, businessId, employeeId) {
  for (const leaveType of ["pto", "sick"]) {
    await clientOrPool.query(
      `INSERT INTO employee_leave_balances (business_id, employee_id, leave_type)
       VALUES ($1, $2, $3)
       ON CONFLICT (employee_id, leave_type) DO NOTHING`,
      [businessId, employeeId, leaveType]
    );
  }
}

async function activeLeaveRule(clientOrPool, businessId, leaveType, employee, asOf = new Date()) {
  const years = serviceYearsFrom(employee.orientation_start, asOf);
  const result = await clientOrPool.query(
    `SELECT *
     FROM leave_accrual_rules
     WHERE business_id = $1
       AND leave_type = $2
       AND enabled = true
       AND years_of_service_min <= $3
     ORDER BY years_of_service_min DESC
     LIMIT 1`,
    [businessId, leaveType, years]
  );
  return result.rows[0] || null;
}

async function applyLeaveTransaction(client, {
  businessId,
  employeeId,
  leaveType,
  minutesDelta,
  reason,
  source = "manual",
  sourceKey = null,
  periodStart = null,
  periodEnd = null,
  timeOffRequestId = null,
  createdBy = null,
  allowNegative = false,
  maxBalanceMinutes = null
}) {
  if (!["pto", "sick"].includes(leaveType)) return null;
  const minutes = Math.round(Number(minutesDelta || 0));
  if (!minutes) return null;

  await ensureLeaveRows(client, businessId, employeeId);

  const balanceResult = await client.query(
    `SELECT *
     FROM employee_leave_balances
     WHERE employee_id = $1
       AND leave_type = $2
     FOR UPDATE`,
    [employeeId, leaveType]
  );
  const balance = balanceResult.rows[0];
  const current = Number(balance?.balance_minutes || 0);
  let next = current + minutes;

  if (!allowNegative && next < 0) {
    const error = new Error(`Insufficient ${leaveType === "pto" ? "PTO" : "sick leave"} balance.`);
    error.status = 409;
    throw error;
  }

  if (maxBalanceMinutes !== null && maxBalanceMinutes !== undefined && next > maxBalanceMinutes) {
    next = maxBalanceMinutes;
  }

  const transaction = await client.query(
    `INSERT INTO employee_leave_transactions (
       business_id, employee_id, leave_type, minutes_delta, reason, source, source_key,
       period_start, period_end, time_off_request_id, created_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9::date, $10, $11)
     ON CONFLICT (business_id, employee_id, leave_type, source, source_key)
     WHERE source_key IS NOT NULL
     DO NOTHING
     RETURNING *`,
    [businessId, employeeId, leaveType, next - current, reason || null, source, sourceKey, periodStart, periodEnd, timeOffRequestId, createdBy]
  );

  if (transaction.rows.length === 0) return null;

  await client.query(
    `UPDATE employee_leave_balances
     SET balance_minutes = $1,
         accrued_minutes_lifetime = accrued_minutes_lifetime + CASE WHEN $2 > 0 THEN $2 ELSE 0 END,
         used_minutes_lifetime = used_minutes_lifetime + CASE WHEN $2 < 0 THEN ABS($2) ELSE 0 END,
         updated_at = now()
     WHERE employee_id = $3
       AND leave_type = $4`,
    [next, next - current, employeeId, leaveType]
  );

  return transaction.rows[0];
}

async function runAutomaticLeaveAccrualForClockOut(client, businessId, employeeId, clockEntry, createdBy = null) {
  const settings = await settingsForBusiness(businessId);
  if (settings.auto_accrue_on_clock_out === false) return [];
  const minutesWorked = Number(clockEntry?.minutes_worked || 0);
  if (minutesWorked <= 0) return [];

  const employeeResult = await client.query(
    `SELECT id, business_id, location_id, orientation_start
     FROM employees
     WHERE id = $1
       AND business_id = $2
       AND active = true`,
    [employeeId, businessId]
  );
  const employee = employeeResult.rows[0];
  if (!employee) return [];

  const output = [];
  for (const leaveType of ["pto", "sick"]) {
    if (leaveType === "pto" && settings.pto_enabled === false) continue;
    if (leaveType === "sick" && settings.sick_leave_enabled === false) continue;
    const rule = await activeLeaveRule(client, businessId, leaveType, employee, new Date(clockEntry.clock_out_at || Date.now()));
    if (!rule || rule.accrual_method !== "worked_hours") continue;
    const earnedMinutes = Math.floor((minutesWorked / 60) * Number(rule.accrual_hours_per_worked_hour || 0) * 60);
    if (earnedMinutes <= 0) continue;
    const maxBalanceMinutes = rule.max_balance_hours === null || rule.max_balance_hours === undefined ? null : minutesFromHours(rule.max_balance_hours);
    const tx = await applyLeaveTransaction(client, {
      businessId,
      employeeId,
      leaveType,
      minutesDelta: earnedMinutes,
      reason: `Automatic ${leaveType.toUpperCase()} accrual from worked hours.`,
      source: "clock_accrual",
      sourceKey: String(clockEntry.id),
      timeOffRequestId: null,
      createdBy,
      allowNegative: false,
      maxBalanceMinutes
    });
    if (tx) output.push(tx);
  }
  return output;
}

async function runAutomaticBonusAwards(client, businessId, employeeId, createdBy = null, periodStart = null, periodEnd = null) {
  const settings = await settingsForBusiness(businessId);
  if (settings.bonus_enabled === false || settings.auto_award_bonuses_on_clock_out === false) return [];

  const rulesResult = await client.query(
    `SELECT * FROM bonus_rules WHERE business_id = $1 AND enabled = true ORDER BY hours_threshold ASC`,
    [businessId]
  );
  if (!rulesResult.rows.length) return [];

  const awards = [];
  for (const rule of rulesResult.rows) {
    let hoursResult;
    if (rule.award_type === "pay_period_hours" && periodStart && periodEnd) {
      hoursResult = await client.query(
        `SELECT COALESCE(SUM(minutes_worked), 0)::numeric / 60 AS hours_worked
         FROM time_clock_entries
         WHERE employee_id = $1
           AND clock_out_at IS NOT NULL
           AND clock_in_at::date BETWEEN $2::date AND $3::date`,
        [employeeId, periodStart, periodEnd]
      );
    } else {
      hoursResult = await client.query(
        `SELECT COALESCE(SUM(minutes_worked), 0)::numeric / 60 AS hours_worked
         FROM time_clock_entries
         WHERE employee_id = $1
           AND clock_out_at IS NOT NULL`,
        [employeeId]
      );
    }

    const hoursWorked = Number(hoursResult.rows[0]?.hours_worked || 0);
    const threshold = Number(rule.hours_threshold || 0);
    if (threshold <= 0 || hoursWorked < threshold) continue;
    const cycleNumber = rule.recurring ? Math.floor(hoursWorked / threshold) : 1;
    const maxCycle = rule.max_cycles ? Math.min(cycleNumber, Number(rule.max_cycles)) : cycleNumber;

    for (let cycle = 1; cycle <= maxCycle; cycle += 1) {
      const award = await client.query(
        `INSERT INTO employee_bonus_awards (
           business_id, employee_id, bonus_rule_id, cycle_number, hours_at_award,
           bonus_cents, pay_bump_cents, period_start, period_end, created_by
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9::date, $10)
         ON CONFLICT (employee_id, bonus_rule_id, cycle_number) DO NOTHING
         RETURNING *`,
        [businessId, employeeId, rule.id, cycle, hoursWorked, rule.bonus_cents, rule.pay_bump_cents, periodStart, periodEnd, createdBy]
      );

      if (award.rows[0]) {
        if (Number(rule.pay_bump_cents || 0) > 0 && rule.apply_pay_bump_to_employee !== false) {
          await client.query(
            `UPDATE employees
             SET pay_rate_cents = pay_rate_cents + $1,
                 updated_at = now()
             WHERE id = $2
               AND business_id = $3`,
            [Number(rule.pay_bump_cents || 0), employeeId, businessId]
          );
          await client.query(
            `UPDATE employee_bonus_awards SET applied_to_pay_rate = true WHERE id = $1`,
            [award.rows[0].id]
          );
        }
        awards.push(award.rows[0]);
      }
    }
  }
  return awards;
}

async function currentPayPeriodForBusiness(businessId) {
  await ensurePayrollSettings(businessId);
  const result = await pool.query(
    `WITH ps AS (
       SELECT *, ${payPeriodSql("payroll_settings")} AS period_start
       FROM payroll_settings
       WHERE business_id = $1
     )
     SELECT period_start, (period_start + (pay_period_weeks * 7 - 1))::date AS period_end
     FROM ps`,
    [businessId]
  );
  return result.rows[0] || null;
}

router.get("/leave/settings", requireAuth, requireScheduleManager, async (req, res) => {
  try {
    const settings = await settingsForBusiness(req.user.businessId);
    const rules = await pool.query(
      `SELECT * FROM leave_accrual_rules WHERE business_id = $1 ORDER BY leave_type, years_of_service_min`,
      [req.user.businessId]
    );
    const bonusRules = await pool.query(
      `SELECT * FROM bonus_rules WHERE business_id = $1 ORDER BY enabled DESC, hours_threshold ASC, name ASC`,
      [req.user.businessId]
    );
    res.json({ settings, leaveRules: rules.rows, bonusRules: bonusRules.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load leave and bonus settings." });
  }
});

router.put("/leave/settings", requireAuth, requireScheduleManager, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE payroll_settings
       SET pto_enabled = $2,
           sick_leave_enabled = $3,
           bonus_enabled = $4,
           allow_negative_leave_balance = $5,
           auto_accrue_on_clock_out = $6,
           auto_award_bonuses_on_clock_out = $7,
           leave_year_reset_month = $8,
           leave_year_reset_day = $9,
           updated_by = $10,
           updated_at = now()
       WHERE business_id = $1`,
      [
        req.user.businessId,
        normalizeBoolean(req.body.ptoEnabled),
        normalizeBoolean(req.body.sickLeaveEnabled),
        normalizeBoolean(req.body.bonusEnabled),
        normalizeBoolean(req.body.allowNegativeLeaveBalance),
        req.body.autoAccrueOnClockOut !== false,
        req.body.autoAwardBonusesOnClockOut !== false,
        cleanPositiveInt(req.body.leaveYearResetMonth, 1, 1, 12),
        cleanPositiveInt(req.body.leaveYearResetDay, 1, 1, 31),
        req.user.id
      ]
    );

    const leaveRules = Array.isArray(req.body.leaveRules) ? req.body.leaveRules : [];
    for (const raw of leaveRules) {
      const leaveType = raw.leaveType || raw.leave_type;
      if (!["pto", "sick"].includes(leaveType)) continue;
      const years = cleanHours(raw.yearsOfServiceMin ?? raw.years_of_service_min, 0, 0, 100);
      await client.query(
        `INSERT INTO leave_accrual_rules (
           business_id, leave_type, enabled, years_of_service_min, accrual_method,
           accrual_hours_per_worked_hour, flat_hours_per_pay_period, annual_cap_hours,
           carryover_cap_hours, max_balance_hours, reset_unused_at_year_end, notes, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())
         ON CONFLICT (business_id, leave_type, years_of_service_min)
         DO UPDATE SET enabled = EXCLUDED.enabled,
                       accrual_method = EXCLUDED.accrual_method,
                       accrual_hours_per_worked_hour = EXCLUDED.accrual_hours_per_worked_hour,
                       flat_hours_per_pay_period = EXCLUDED.flat_hours_per_pay_period,
                       annual_cap_hours = EXCLUDED.annual_cap_hours,
                       carryover_cap_hours = EXCLUDED.carryover_cap_hours,
                       max_balance_hours = EXCLUDED.max_balance_hours,
                       reset_unused_at_year_end = EXCLUDED.reset_unused_at_year_end,
                       notes = EXCLUDED.notes,
                       updated_at = now()`,
        [
          req.user.businessId,
          leaveType,
          raw.enabled !== false,
          years,
          ["worked_hours", "pay_period_flat"].includes(raw.accrualMethod || raw.accrual_method) ? (raw.accrualMethod || raw.accrual_method) : "worked_hours",
          cleanHours(raw.accrualHoursPerWorkedHour ?? raw.accrual_hours_per_worked_hour, 0, 0, 10),
          cleanHours(raw.flatHoursPerPayPeriod ?? raw.flat_hours_per_pay_period, 0, 0, 1000),
          raw.annualCapHours === "" || raw.annualCapHours === null || raw.annualCapHours === undefined ? null : cleanHours(raw.annualCapHours ?? raw.annual_cap_hours, 0, 0, 10000),
          raw.carryoverCapHours === "" || raw.carryoverCapHours === null || raw.carryoverCapHours === undefined ? null : cleanHours(raw.carryoverCapHours ?? raw.carryover_cap_hours, 0, 0, 10000),
          raw.maxBalanceHours === "" || raw.maxBalanceHours === null || raw.maxBalanceHours === undefined ? null : cleanHours(raw.maxBalanceHours ?? raw.max_balance_hours, 0, 0, 10000),
          normalizeBoolean(raw.resetUnusedAtYearEnd ?? raw.reset_unused_at_year_end),
          String(raw.notes || "").trim().slice(0, 500) || null
        ]
      );
    }

    const bonusRules = Array.isArray(req.body.bonusRules) ? req.body.bonusRules : [];
    for (const raw of bonusRules) {
      const id = raw.id || null;
      if (raw.delete === true && id) {
        await client.query(`DELETE FROM bonus_rules WHERE id = $1 AND business_id = $2`, [id, req.user.businessId]);
        continue;
      }
      const name = String(raw.name || "").trim().slice(0, 120);
      if (!name) continue;
      if (id) {
        await client.query(
          `UPDATE bonus_rules
           SET name = $3,
               enabled = $4,
               award_type = $5,
               hours_threshold = $6,
               bonus_cents = $7,
               pay_bump_cents = $8,
               recurring = $9,
               max_cycles = $10,
               apply_pay_bump_to_employee = $11,
               notes = $12,
               updated_at = now()
           WHERE id = $1
             AND business_id = $2`,
          [id, req.user.businessId, name, raw.enabled !== false, ["all_time_hours", "pay_period_hours"].includes(raw.awardType || raw.award_type) ? (raw.awardType || raw.award_type) : "all_time_hours", cleanHours(raw.hoursThreshold ?? raw.hours_threshold, 0, 0, 1000000), cleanMoneyCents(raw.bonusCents ?? raw.bonus_cents), cleanMoneyCents(raw.payBumpCents ?? raw.pay_bump_cents), normalizeBoolean(raw.recurring), raw.maxCycles ? cleanPositiveInt(raw.maxCycles ?? raw.max_cycles, 1, 1, 1000) : null, raw.applyPayBumpToEmployee !== false, String(raw.notes || "").trim().slice(0, 500) || null]
        );
      } else {
        await client.query(
          `INSERT INTO bonus_rules (business_id, name, enabled, award_type, hours_threshold, bonus_cents, pay_bump_cents, recurring, max_cycles, apply_pay_bump_to_employee, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [req.user.businessId, name, raw.enabled !== false, ["all_time_hours", "pay_period_hours"].includes(raw.awardType || raw.award_type) ? (raw.awardType || raw.award_type) : "all_time_hours", cleanHours(raw.hoursThreshold ?? raw.hours_threshold, 0, 0, 1000000), cleanMoneyCents(raw.bonusCents ?? raw.bonus_cents), cleanMoneyCents(raw.payBumpCents ?? raw.pay_bump_cents), normalizeBoolean(raw.recurring), raw.maxCycles ? cleanPositiveInt(raw.maxCycles ?? raw.max_cycles, 1, 1, 1000) : null, raw.applyPayBumpToEmployee !== false, String(raw.notes || "").trim().slice(0, 500) || null]
        );
      }
    }

    await logAudit({ businessId: req.user.businessId, actorUserId: req.user.id, action: "Leave and bonus settings updated", entityType: "payroll_settings" });
    await client.query("COMMIT");

    const settings = await settingsForBusiness(req.user.businessId);
    const rules = await pool.query(`SELECT * FROM leave_accrual_rules WHERE business_id = $1 ORDER BY leave_type, years_of_service_min`, [req.user.businessId]);
    const savedBonusRules = await pool.query(`SELECT * FROM bonus_rules WHERE business_id = $1 ORDER BY enabled DESC, hours_threshold ASC, name ASC`, [req.user.businessId]);
    res.json({ settings, leaveRules: rules.rows, bonusRules: savedBonusRules.rows });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err);
    res.status(500).json({ error: "Failed to save leave and bonus settings." });
  } finally {
    client.release();
  }
});

router.post("/leave/accrue", requireAuth, requireScheduleManager, async (req, res) => {
  const client = await pool.connect();
  try {
    const period = await currentPayPeriodForBusiness(req.user.businessId);
    const periodStart = cleanDate(req.body.periodStart) || toDateOnly(period?.period_start);
    const periodEnd = cleanDate(req.body.periodEnd) || toDateOnly(period?.period_end);
    if (!periodStart || !periodEnd) return res.status(400).json({ error: "A valid pay-period start and end date is required." });

    await client.query("BEGIN");
    const run = await client.query(
      `INSERT INTO leave_accrual_runs (business_id, location_id, period_start, period_end, run_by, notes)
       VALUES ($1, $2, $3::date, $4::date, $5, $6)
       ON CONFLICT (business_id, location_id, period_start, period_end) DO NOTHING
       RETURNING *`,
      [req.user.businessId, req.body.locationId || null, periodStart, periodEnd, req.user.id, String(req.body.notes || "").trim().slice(0, 500) || null]
    );
    if (run.rows.length === 0 && req.body.force !== true) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Leave was already accrued for that pay period and location. Use force only if you intentionally need a manual rerun; duplicate source keys still prevent double credit." });
    }

    const settings = await settingsForBusiness(req.user.businessId);
    const params = [req.user.businessId, periodStart, periodEnd];
    let locationSql = "";
    if (req.body.locationId) {
      params.push(req.body.locationId);
      locationSql = `AND e.location_id = $${params.length}`;
    }

    const employees = await client.query(
      `SELECT e.id, e.business_id, e.location_id, e.orientation_start,
              COALESCE(SUM(tce.minutes_worked), 0)::int AS minutes_worked
       FROM employees e
       LEFT JOIN time_clock_entries tce
         ON tce.employee_id = e.id
        AND tce.clock_out_at IS NOT NULL
        AND tce.clock_in_at::date BETWEEN $2::date AND $3::date
       WHERE e.business_id = $1
         AND e.active = true
         ${locationSql}
       GROUP BY e.id`,
      params
    );

    const transactions = [];
    for (const employee of employees.rows) {
      for (const leaveType of ["pto", "sick"]) {
        if (leaveType === "pto" && settings.pto_enabled === false) continue;
        if (leaveType === "sick" && settings.sick_leave_enabled === false) continue;
        const rule = await activeLeaveRule(client, req.user.businessId, leaveType, employee, new Date(`${periodEnd}T12:00:00`));
        if (!rule) continue;
        let earnedMinutes = 0;
        if (rule.accrual_method === "pay_period_flat") {
          earnedMinutes = minutesFromHours(rule.flat_hours_per_pay_period || 0);
        } else {
          earnedMinutes = Math.floor((Number(employee.minutes_worked || 0) / 60) * Number(rule.accrual_hours_per_worked_hour || 0) * 60);
        }
        const maxBalanceMinutes = rule.max_balance_hours === null || rule.max_balance_hours === undefined ? null : minutesFromHours(rule.max_balance_hours);
        const annualCapMinutes = rule.annual_cap_hours === null || rule.annual_cap_hours === undefined ? null : minutesFromHours(rule.annual_cap_hours);
        if (annualCapMinutes !== null && earnedMinutes > 0) {
          const yearAccrued = await client.query(
            `SELECT COALESCE(SUM(minutes_delta), 0)::int AS minutes
             FROM employee_leave_transactions
             WHERE employee_id = $1
               AND leave_type = $2
               AND minutes_delta > 0
               AND created_at >= date_trunc('year', $3::date)`,
            [employee.id, leaveType, periodEnd]
          );
          earnedMinutes = Math.max(0, Math.min(earnedMinutes, annualCapMinutes - Number(yearAccrued.rows[0]?.minutes || 0)));
        }
        if (earnedMinutes <= 0) continue;
        const tx = await applyLeaveTransaction(client, {
          businessId: req.user.businessId,
          employeeId: employee.id,
          leaveType,
          minutesDelta: earnedMinutes,
          reason: `Pay-period ${leaveType.toUpperCase()} accrual for ${periodStart} to ${periodEnd}.`,
          source: "pay_period_accrual",
          sourceKey: `${periodStart}:${periodEnd}:${rule.id}`,
          periodStart,
          periodEnd,
          createdBy: req.user.id,
          allowNegative: false,
          maxBalanceMinutes
        });
        if (tx) transactions.push(tx);
      }
      const awards = await runAutomaticBonusAwards(client, req.user.businessId, employee.id, req.user.id, periodStart, periodEnd);
      transactions.push(...awards.map((award) => ({ ...award, source: "bonus_award" })));
    }

    await logAudit({ businessId: req.user.businessId, actorUserId: req.user.id, locationId: req.body.locationId || null, action: "Leave accrual run", entityType: "leave_accrual_run", details: `${periodStart} to ${periodEnd}; ${transactions.length} item(s).` });
    await client.query("COMMIT");
    res.json({ periodStart, periodEnd, transactions });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to run leave accrual." });
  } finally {
    client.release();
  }
});

router.post("/leave/adjust", requireAuth, requireScheduleManager, async (req, res) => {
  const employeeId = req.body.employeeId;
  const leaveType = req.body.leaveType;
  const minutesDelta = minutesFromHours(req.body.hoursDelta);
  const reason = String(req.body.reason || "").trim().slice(0, 500);
  if (!employeeId || !["pto", "sick"].includes(leaveType) || !minutesDelta || !reason) {
    return res.status(400).json({ error: "Employee, leave type, hour adjustment, and reason are required." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const employee = await client.query(
      `SELECT id, business_id, location_id FROM employees WHERE id = $1 AND business_id = $2 AND active = true`,
      [employeeId, req.user.businessId]
    );
    if (!employee.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Employee not found." });
    }
    if (req.user.role !== "owner") {
      const allowed = await client.query(
        `SELECT 1 FROM employees WHERE business_id = $1 AND user_id = $2 AND location_id = $3 AND active = true LIMIT 1`,
        [req.user.businessId, req.user.id, employee.rows[0].location_id]
      );
      if (!allowed.rows.length) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Managers can only adjust employees in their assigned location." });
      }
    }
    const settings = await settingsForBusiness(req.user.businessId);
    const tx = await applyLeaveTransaction(client, {
      businessId: req.user.businessId,
      employeeId,
      leaveType,
      minutesDelta,
      reason,
      source: "manual_adjustment",
      createdBy: req.user.id,
      allowNegative: settings.allow_negative_leave_balance === true
    });
    await logAudit({ businessId: req.user.businessId, actorUserId: req.user.id, locationId: employee.rows[0].location_id, action: "Leave balance adjusted", entityType: "employee_leave_balance", entityId: employeeId, details: `${leaveType.toUpperCase()} ${hoursFromMinutes(minutesDelta)} hour(s): ${reason}` });
    await client.query("COMMIT");
    res.json({ transaction: tx });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to adjust leave balance." });
  } finally {
    client.release();
  }
});

router.post("/bonuses/evaluate", requireAuth, requireScheduleManager, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const params = [req.user.businessId];
    let locationSql = "";
    if (req.body.locationId) {
      params.push(req.body.locationId);
      locationSql = `AND location_id = $${params.length}`;
    }
    const employees = await client.query(
      `SELECT id FROM employees WHERE business_id = $1 AND active = true ${locationSql}`,
      params
    );
    const period = await currentPayPeriodForBusiness(req.user.businessId);
    const awards = [];
    for (const employee of employees.rows) {
      awards.push(...await runAutomaticBonusAwards(client, req.user.businessId, employee.id, req.user.id, toDateOnly(period?.period_start), toDateOnly(period?.period_end)));
    }
    await logAudit({ businessId: req.user.businessId, actorUserId: req.user.id, locationId: req.body.locationId || null, action: "Bonus rules evaluated", entityType: "bonus_rule", details: `${awards.length} new award(s).` });
    await client.query("COMMIT");
    res.json({ awards });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err);
    res.status(500).json({ error: "Failed to evaluate bonus rules." });
  } finally {
    client.release();
  }
});


module.exports = router;
