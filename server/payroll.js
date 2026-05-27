const express = require("express");
const pool = require("./db");
const { requireAuth, requireOwner, requireScheduleManager } = require("./middleware");
const { logAudit } = require("./audit");
const { normalizeAccountNumber, isValidAccountNumber } = require("./id-utils");

const router = express.Router();
const EARLY_LATE_GRACE_MINUTES = 15;

function cleanDate(value) {
  const text = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function toDateOnly(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function moneyFromCents(cents) {
  return Math.round(Number(cents || 0));
}

async function ensurePayrollSettings(businessId) {
  await pool.query(
    `INSERT INTO payroll_settings (business_id)
     VALUES ($1)
     ON CONFLICT (business_id) DO NOTHING`,
    [businessId]
  );
}

async function findEmployeeByAccountNumber(accountNumber) {
  const result = await pool.query(
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
     WHERE u.account_number = $1
       AND u.active = true
       AND e.active = true
     LIMIT 1`,
    [accountNumber]
  );
  return result.rows[0] || null;
}

async function openClockEntry(employeeId) {
  const result = await pool.query(
    `SELECT *
     FROM time_clock_entries
     WHERE employee_id = $1
       AND clock_out_at IS NULL
     ORDER BY clock_in_at DESC
     LIMIT 1`,
    [employeeId]
  );
  return result.rows[0] || null;
}

async function scheduledWindow(employee, instant = new Date()) {
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
    startAt: new Date(`${date}T${String(row.start_time).slice(0, 5)}:00`),
    endAt: new Date(`${date}T${String(row.end_time).slice(0, 5)}:00`)
  };
}

function punchStatus(now, scheduledAt, type) {
  if (!scheduledAt) return "unscheduled";
  const diffMinutes = Math.round((now.getTime() - scheduledAt.getTime()) / 60000);
  if (diffMinutes < -EARLY_LATE_GRACE_MINUTES) return "early";
  if (diffMinutes > EARLY_LATE_GRACE_MINUTES) return "late";
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

function payPeriodSql(alias = "ps") {
  return `(
    ${alias}.first_pay_period_start
    + (
      floor(GREATEST(0, (CURRENT_DATE - ${alias}.first_pay_period_start))::numeric / (${alias}.pay_period_weeks * 7))::int
      * (${alias}.pay_period_weeks * 7)
    )
  )`;
}

router.post("/clock/lookup", async (req, res) => {
  const accountNumber = normalizeAccountNumber(req.body.accountNumber);
  if (!isValidAccountNumber(accountNumber)) {
    return res.status(400).json({ error: "Enter a valid 9 digit ID#." });
  }

  try {
    const employee = await findEmployeeByAccountNumber(accountNumber);
    if (!employee) return res.status(404).json({ error: "No active employee was found for that ID#." });

    const openEntry = await openClockEntry(employee.employee_id);
    res.json({
      employee: {
        id: employee.employee_id,
        accountNumber: employee.account_number,
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
  const accountNumber = normalizeAccountNumber(req.body.accountNumber);
  const action = req.body.action === "clock_out" ? "clock_out" : "clock_in";

  if (!isValidAccountNumber(accountNumber)) {
    return res.status(400).json({ error: "Enter a valid 9 digit ID#." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const employee = await findEmployeeByAccountNumber(accountNumber);
    if (!employee) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "No active employee was found for that ID#." });
    }

    await ensurePayrollSettings(employee.business_id);
    const now = new Date();
    const window = await scheduledWindow(employee, now);
    const openEntry = await openClockEntry(employee.employee_id);

    if (action === "clock_in") {
      if (openEntry) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: "This employee is already clocked in." });
      }

      const status = punchStatus(now, window?.startAt, "clock_in");
      const insert = await client.query(
        `INSERT INTO time_clock_entries (
           business_id, location_id, employee_id, account_number, clock_in_at,
           clock_in_status, scheduled_start_at, scheduled_end_at
         )
         VALUES ($1, $2, $3, $4, now(), $5, $6, $7)
         RETURNING *`,
        [employee.business_id, employee.location_id, employee.employee_id, employee.account_number, status, window?.startAt || null, window?.endAt || null]
      );

      await createPayrollAlert(client, { employee, entryId: insert.rows[0].id, action, status, scheduledAt: window?.startAt });
      await client.query("COMMIT");
      return res.json({ message: "Clock in successful.", status, entry: insert.rows[0] });
    }

    if (!openEntry) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "This employee is not currently clocked in." });
    }

    const status = punchStatus(now, window?.endAt, "clock_out");
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

    await createPayrollAlert(client, { employee, entryId: openEntry.id, action, status, scheduledAt: window?.endAt });
    await client.query("COMMIT");
    return res.json({ message: "Clock out successful.", status, entry: update.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err);
    res.status(500).json({ error: "Clock action failed." });
  } finally {
    client.release();
  }
});

router.get("/settings", requireAuth, requireScheduleManager, async (req, res) => {
  try {
    await ensurePayrollSettings(req.user.businessId);
    const result = await pool.query(
      `SELECT first_pay_period_start, pay_period_weeks
       FROM payroll_settings
       WHERE business_id = $1`,
      [req.user.businessId]
    );
    res.json({ settings: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load payroll settings." });
  }
});

router.put("/settings", requireAuth, requireOwner, async (req, res) => {
  const firstPayPeriodStart = cleanDate(req.body.firstPayPeriodStart);
  const payPeriodWeeks = Math.max(1, Math.min(12, Number(req.body.payPeriodWeeks) || 2));

  if (!firstPayPeriodStart) {
    return res.status(400).json({ error: "First pay cycle start date is required." });
  }

  try {
    const result = await pool.query(
      `INSERT INTO payroll_settings (business_id, first_pay_period_start, pay_period_weeks, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (business_id)
       DO UPDATE SET first_pay_period_start = EXCLUDED.first_pay_period_start,
                     pay_period_weeks = EXCLUDED.pay_period_weeks,
                     updated_by = EXCLUDED.updated_by,
                     updated_at = now()
       RETURNING first_pay_period_start, pay_period_weeks`,
      [req.user.businessId, firstPayPeriodStart, payPeriodWeeks, req.user.id]
    );

    await logAudit({
      businessId: req.user.businessId,
      actorUserId: req.user.id,
      action: "Payroll settings updated",
      entityType: "payroll_settings",
      details: `First pay cycle ${firstPayPeriodStart}; every ${payPeriodWeeks} week(s)`
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

    if (employeeResult.rows.length === 0) return res.json({ entries: [], currentPeriod: null });
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

    const entries = await pool.query(
      `SELECT clock_in_at, clock_out_at, minutes_worked, clock_in_status, clock_out_status
       FROM time_clock_entries
       WHERE employee_id = $1
       ORDER BY clock_in_at DESC
       LIMIT 40`,
      [employee.id]
    );

    res.json({ currentPeriod: summary.rows[0], entries: entries.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load payroll summary." });
  }
});

router.get("/manager-summary", requireAuth, requireScheduleManager, async (req, res) => {
  const locationId = req.query.locationId || null;

  try {
    await ensurePayrollSettings(req.user.businessId);
    const settings = await pool.query(
      `SELECT first_pay_period_start, pay_period_weeks
       FROM payroll_settings
       WHERE business_id = $1`,
      [req.user.businessId]
    );

    const locationFilter = locationId ? "AND e.location_id = $2" : "";
    const params = locationId ? [req.user.businessId, locationId] : [req.user.businessId];

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
         ROUND((COALESCE(SUM(tce.minutes_worked), 0)::numeric / 60) * e.pay_rate_cents)::int AS estimated_pay_cents
       FROM employees e
       JOIN users u ON u.id = e.user_id
       CROSS JOIN period p
       LEFT JOIN time_clock_entries tce
         ON tce.employee_id = e.id
        AND tce.clock_out_at IS NOT NULL
        AND tce.clock_in_at::date BETWEEN p.period_start AND p.period_end
       WHERE e.business_id = $1
         AND e.active = true
         AND u.active = true
         ${locationFilter}
       GROUP BY e.id, u.id, p.period_start, p.period_end
       ORDER BY u.last_name, u.first_name, e.employee_code`,
      params
    );

    const alerts = await pool.query(
      `SELECT pa.*, e.employee_code, u.first_name, u.last_name, u.account_number
       FROM payroll_alerts pa
       JOIN employees e ON e.id = pa.employee_id
       JOIN users u ON u.id = e.user_id
       WHERE pa.business_id = $1
         ${locationId ? "AND pa.location_id = $2" : ""}
       ORDER BY pa.created_at DESC
       LIMIT 25`,
      params
    );

    res.json({ settings: settings.rows[0], employees: rows.rows, alerts: alerts.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load payroll manager summary." });
  }
});

module.exports = router;
