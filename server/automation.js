const express = require("express");
const pool = require("./db");
const { requireAuth, requireScheduleManager } = require("./middleware");
const { logAudit } = require("./audit");

const router = express.Router();

function cleanText(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function normalizeDate(value) {
  const text = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function normalizeTime(value, fallback = "08:00") {
  const text = String(value || fallback).slice(0, 5);
  return /^\d{2}:\d{2}$/.test(text) ? text : fallback;
}

function cents(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.round(number);
}

function hoursBetween(startTime, endTime) {
  const [sh, sm] = String(startTime || "00:00").split(":").map(Number);
  const [eh, em] = String(endTime || "00:00").split(":").map(Number);
  const start = (sh || 0) * 60 + (sm || 0);
  const end = (eh || 0) * 60 + (em || 0);
  return Math.max(0, end - start) / 60;
}

async function assignedLocationIds(user) {
  const result = await pool.query(
    `SELECT DISTINCT location_id
     FROM employees
     WHERE business_id = $1
       AND user_id = $2
       AND active = true`,
    [user.businessId, user.id]
  );
  return result.rows.map((row) => row.location_id).filter(Boolean);
}

async function assertLocationAccess(user, locationId, manage = false) {
  if (!locationId) {
    const error = new Error("Location ID is required.");
    error.status = 400;
    throw error;
  }

  if (user.role === "owner") {
    const result = await pool.query(
      `SELECT id FROM locations WHERE id = $1 AND business_id = $2`,
      [locationId, user.businessId]
    );
    if (result.rows.length === 0) {
      const error = new Error("Location not found.");
      error.status = 404;
      throw error;
    }
    return;
  }

  if (manage && !user.canManageSchedule) {
    const error = new Error("Manage Schedule permission required.");
    error.status = 403;
    throw error;
  }

  const result = await pool.query(
    `SELECT 1
     FROM employees
     WHERE business_id = $1
       AND user_id = $2
       AND location_id = $3
       AND active = true
     LIMIT 1`,
    [user.businessId, user.id, locationId]
  );

  if (result.rows.length === 0) {
    const error = new Error("You can only access your assigned location.");
    error.status = 403;
    throw error;
  }
}

async function currentEmployee(user) {
  const result = await pool.query(
    `SELECT id, location_id
     FROM employees
     WHERE business_id = $1
       AND user_id = $2
       AND active = true
     ORDER BY created_at ASC
     LIMIT 1`,
    [user.businessId, user.id]
  );
  return result.rows[0] || null;
}

router.get("/rules", requireAuth, async (req, res) => {
  try {
    const locationId = req.query.locationId;
    await assertLocationAccess(req.user, locationId, false);

    await pool.query(
      `INSERT INTO location_schedule_rules (business_id, location_id)
       VALUES ($1, $2)
       ON CONFLICT (location_id) DO NOTHING`,
      [req.user.businessId, locationId]
    );

    const result = await pool.query(
      `SELECT *
       FROM location_schedule_rules
       WHERE business_id = $1
         AND location_id = $2`,
      [req.user.businessId, locationId]
    );

    res.json({ rules: result.rows[0] || null });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to load location rules." });
  }
});

router.put("/rules", requireAuth, requireScheduleManager, async (req, res) => {
  const locationId = req.body.locationId;

  try {
    await assertLocationAccess(req.user, locationId, true);

    const openDays = Array.isArray(req.body.openDays)
      ? req.body.openDays.map(Number).filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
      : [1, 2, 3, 4, 5];

    const operatingStart = normalizeTime(req.body.operatingStart, "08:00");
    const operatingEnd = normalizeTime(req.body.operatingEnd, "17:00");
    const minEmployeesPerDay = Math.max(0, Math.min(999, Number(req.body.minEmployeesPerDay) || 0));
    const maxEmployeesPerDay = req.body.maxEmployeesPerDay === "" || req.body.maxEmployeesPerDay === null || req.body.maxEmployeesPerDay === undefined
      ? null
      : Math.max(1, Math.min(999, Number(req.body.maxEmployeesPerDay) || 1));
    const defaultRequiredStaff = Math.max(0, Math.min(99, Number(req.body.defaultRequiredStaff) || 1));
    const schedulePublishDay = Math.max(1, Math.min(7, Number(req.body.schedulePublishDay) || 1));
    const laborBudgetCents = cents(req.body.laborBudgetCents);
    const timeZone = cleanText(req.body.timeZone || "America/Chicago", 64) || "America/Chicago";

    const result = await pool.query(
      `INSERT INTO location_schedule_rules (
         business_id, location_id, open_days, operating_start, operating_end,
         min_employees_per_day, max_employees_per_day, default_required_staff,
         labor_budget_cents, schedule_publish_day, time_zone, updated_at
       )
       VALUES ($1,$2,$3::int[],$4::time,$5::time,$6,$7,$8,$9,$10,$11,now())
       ON CONFLICT (location_id)
       DO UPDATE SET
         open_days = EXCLUDED.open_days,
         operating_start = EXCLUDED.operating_start,
         operating_end = EXCLUDED.operating_end,
         min_employees_per_day = EXCLUDED.min_employees_per_day,
         max_employees_per_day = EXCLUDED.max_employees_per_day,
         default_required_staff = EXCLUDED.default_required_staff,
         labor_budget_cents = EXCLUDED.labor_budget_cents,
         schedule_publish_day = EXCLUDED.schedule_publish_day,
         time_zone = EXCLUDED.time_zone,
         updated_at = now()
       RETURNING *`,
      [req.user.businessId, locationId, openDays, operatingStart, operatingEnd, minEmployeesPerDay, maxEmployeesPerDay, defaultRequiredStaff, laborBudgetCents, schedulePublishDay, timeZone]
    );

    await logAudit({
      businessId: req.user.businessId,
      actorUserId: req.user.id,
      locationId,
      action: "Updated location schedule rules",
      entityType: "location_schedule_rules",
      entityId: result.rows[0].id,
      details: result.rows[0]
    });

    res.json({ rules: result.rows[0], message: "Location schedule rules saved." });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to save location rules." });
  }
});

router.post("/schedules/publish", requireAuth, requireScheduleManager, async (req, res) => {
  const locationId = req.body.locationId;
  const weekStart = normalizeDate(req.body.weekStart);
  const state = ["draft", "published", "revised"].includes(req.body.state) ? req.body.state : "draft";
  const cells = Array.isArray(req.body.cells) ? req.body.cells : [];

  if (!weekStart) return res.status(400).json({ error: "Valid weekStart is required." });

  const client = await pool.connect();
  try {
    await assertLocationAccess(req.user, locationId, true);
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT id, revision_number, status
       FROM schedules
       WHERE business_id = $1
         AND location_id = $2
         AND week_start = $3::date
       FOR UPDATE`,
      [req.user.businessId, locationId, weekStart]
    );

    const revisionNumber = existing.rows[0]
      ? Number(existing.rows[0].revision_number || 1) + (existing.rows[0].status === "published" && state !== "draft" ? 1 : 0)
      : 1;

    const scheduleResult = await client.query(
      `INSERT INTO schedules (
         business_id, location_id, week_start, generated_by, status, published_at, published_by,
         revision_number, notes, updated_at
       )
       VALUES ($1,$2,$3::date,$4,$5,CASE WHEN $5 IN ('published','revised') THEN now() ELSE NULL END,CASE WHEN $5 IN ('published','revised') THEN $4 ELSE NULL END,$6,$7,now())
       ON CONFLICT (location_id, week_start)
       DO UPDATE SET
         generated_by = EXCLUDED.generated_by,
         status = EXCLUDED.status,
         published_at = CASE WHEN EXCLUDED.status IN ('published','revised') THEN now() ELSE schedules.published_at END,
         published_by = CASE WHEN EXCLUDED.status IN ('published','revised') THEN EXCLUDED.generated_by ELSE schedules.published_by END,
         revision_number = EXCLUDED.revision_number,
         notes = EXCLUDED.notes,
         updated_at = now()
       RETURNING *`,
      [req.user.businessId, locationId, weekStart, req.user.id, state, revisionNumber, cleanText(req.body.notes, 1000)]
    );

    const schedule = scheduleResult.rows[0];
    await client.query(`DELETE FROM schedule_cells WHERE schedule_id = $1`, [schedule.id]);

    for (const cell of cells) {
      if (!cell.employee_id || !normalizeDate(cell.work_date)) continue;
      await client.query(
        `INSERT INTO schedule_cells (
           schedule_id, employee_id, work_date, shift_id, start_time, end_time, notes,
           assignment_reason, fairness_score, estimated_cost_cents
         )
         VALUES ($1,$2,$3::date,$4,$5::time,$6::time,$7,$8::jsonb,$9,$10)`,
        [
          schedule.id,
          cell.employee_id,
          normalizeDate(cell.work_date),
          cell.shift_id || null,
          normalizeTime(cell.start_time, "08:00"),
          normalizeTime(cell.end_time, "17:00"),
          cleanText(cell.notes, 500) || null,
          JSON.stringify(cell.assignment_reason || []),
          Number(cell.fairness_score) || null,
          cents(cell.estimated_cost_cents)
        ]
      );
    }

    await client.query(
      `DELETE FROM open_shifts
       WHERE business_id = $1
         AND location_id = $2
         AND week_start = $3::date
         AND status = 'open'`,
      [req.user.businessId, locationId, weekStart]
    );

    const coverage = Array.isArray(req.body.coverage) ? req.body.coverage : [];
    for (const slot of coverage) {
      const openSlots = Math.max(0, Number(slot.openSlots || 0));
      if (!openSlots || !normalizeDate(slot.date)) continue;
      await client.query(
        `INSERT INTO open_shifts (
           business_id, location_id, schedule_id, week_start, work_date, shift_id,
           shift_name, start_time, end_time, slots_open, status
         )
         VALUES ($1,$2,$3,$4::date,$5::date,$6,$7,$8::time,$9::time,$10,'open')`,
        [req.user.businessId, locationId, schedule.id, weekStart, normalizeDate(slot.date), slot.shiftId || null, cleanText(slot.shiftName, 120) || "Open Shift", normalizeTime(slot.startTime), normalizeTime(slot.endTime, "17:00"), openSlots]
      );
    }

    await logAudit({
      businessId: req.user.businessId,
      actorUserId: req.user.id,
      locationId,
      action: state === "draft" ? "Saved draft schedule" : state === "published" ? "Published schedule" : "Revised published schedule",
      entityType: "schedule",
      entityId: schedule.id,
      details: { weekStart, state, cells: cells.length, revisionNumber }
    });

    await client.query("COMMIT");
    res.json({ schedule, message: state === "draft" ? "Draft schedule saved." : "Schedule published." });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to save schedule." });
  } finally {
    client.release();
  }
});

router.get("/schedules/published", requireAuth, async (req, res) => {
  const locationId = req.query.locationId;
  const weekStart = normalizeDate(req.query.weekStart);
  if (!weekStart) return res.status(400).json({ error: "Valid weekStart is required." });

  try {
    await assertLocationAccess(req.user, locationId, false);

    const scheduleResult = await pool.query(
      `SELECT * FROM schedules
       WHERE business_id = $1
         AND location_id = $2
         AND week_start = $3::date`,
      [req.user.businessId, locationId, weekStart]
    );

    if (scheduleResult.rows.length === 0) return res.json({ schedule: null, cells: [] });

    const schedule = scheduleResult.rows[0];
    const cellsResult = await pool.query(
      `SELECT sc.*, e.employee_code, e.title, u.first_name, u.last_name, u.username, s.name AS shift_name
       FROM schedule_cells sc
       JOIN employees e ON e.id = sc.employee_id
       JOIN users u ON u.id = e.user_id
       LEFT JOIN shifts s ON s.id = sc.shift_id
       WHERE sc.schedule_id = $1
       ORDER BY sc.work_date, sc.start_time, u.last_name, u.first_name`,
      [schedule.id]
    );

    res.json({ schedule, cells: cellsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to load published schedule." });
  }
});

router.get("/employee-schedule", requireAuth, async (req, res) => {
  const weekStart = normalizeDate(req.query.weekStart);
  if (!weekStart) return res.status(400).json({ error: "Valid weekStart is required." });

  try {
    const employee = await currentEmployee(req.user);
    if (!employee) return res.json({ schedule: null, cells: [], timeOff: [], openShifts: [] });

    const result = await pool.query(
      `SELECT sc.*, sch.status, sch.week_start, l.name AS location_name, s.name AS shift_name
       FROM schedule_cells sc
       JOIN schedules sch ON sch.id = sc.schedule_id
       JOIN locations l ON l.id = sch.location_id
       LEFT JOIN shifts s ON s.id = sc.shift_id
       WHERE sch.business_id = $1
         AND sch.week_start = $2::date
         AND sch.status IN ('published','revised')
         AND sc.employee_id = $3
       ORDER BY sc.work_date, sc.start_time`,
      [req.user.businessId, weekStart, employee.id]
    );

    const timeOffResult = await pool.query(
      `SELECT id, start_date, end_date, reason, status, decision_reason
       FROM time_off_requests
       WHERE business_id = $1
         AND employee_id = $2
         AND end_date >= $3::date
       ORDER BY start_date ASC`,
      [req.user.businessId, employee.id, weekStart]
    );

    const openResult = await pool.query(
      `SELECT *
       FROM open_shifts
       WHERE business_id = $1
         AND location_id = $2
         AND week_start = $3::date
         AND status = 'open'
       ORDER BY work_date, start_time`,
      [req.user.businessId, employee.location_id, weekStart]
    );

    res.json({ employee, cells: result.rows, timeOff: timeOffResult.rows, openShifts: openResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load employee schedule." });
  }
});

router.get("/open-shifts", requireAuth, async (req, res) => {
  const locationId = req.query.locationId;
  const weekStart = normalizeDate(req.query.weekStart);
  if (!weekStart) return res.status(400).json({ error: "Valid weekStart is required." });

  try {
    await assertLocationAccess(req.user, locationId, false);
    const result = await pool.query(
      `SELECT * FROM open_shifts
       WHERE business_id = $1
         AND location_id = $2
         AND week_start = $3::date
       ORDER BY work_date, start_time`,
      [req.user.businessId, locationId, weekStart]
    );
    res.json({ openShifts: result.rows });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to load open shifts." });
  }
});

router.post("/open-shifts/:id/claim", requireAuth, async (req, res) => {
  const id = req.params.id;
  const client = await pool.connect();

  try {
    const employee = await currentEmployee(req.user);
    if (!employee) return res.status(403).json({ error: "Employee profile required to claim an open shift." });

    await client.query("BEGIN");
    const openResult = await client.query(
      `SELECT * FROM open_shifts
       WHERE id = $1
         AND business_id = $2
       FOR UPDATE`,
      [id, req.user.businessId]
    );

    const openShift = openResult.rows[0];
    if (!openShift) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Open shift not found." });
    }
    if (openShift.status !== "open" || Number(openShift.slots_open || 0) < 1) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Open shift is no longer available." });
    }

    await client.query(
      `INSERT INTO open_shift_claims (open_shift_id, business_id, employee_id, note)
       VALUES ($1,$2,$3,$4)`,
      [id, req.user.businessId, employee.id, cleanText(req.body.note, 500)]
    );

    await client.query(
      `UPDATE open_shifts
       SET status = CASE WHEN slots_open <= 1 THEN 'claimed' ELSE status END,
           slots_open = GREATEST(0, slots_open - 1),
           updated_at = now()
       WHERE id = $1`,
      [id]
    );

    await logAudit({
      businessId: req.user.businessId,
      actorUserId: req.user.id,
      locationId: openShift.location_id,
      action: "Employee claimed open shift",
      entityType: "open_shift",
      entityId: id,
      details: { employeeId: employee.id, workDate: openShift.work_date, shiftName: openShift.shift_name }
    });

    await client.query("COMMIT");
    res.json({ message: "Open shift claim submitted." });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ error: "Failed to claim open shift." });
  } finally {
    client.release();
  }
});

router.get("/shift-swaps", requireAuth, async (req, res) => {
  try {
    const locationId = req.query.locationId || null;
    let params = [req.user.businessId];
    let locationSql = "";

    if (locationId) {
      await assertLocationAccess(req.user, locationId, false);
      params.push(locationId);
      locationSql = "AND ssr.location_id = $2";
    } else if (req.user.role !== "owner") {
      const allowed = await assignedLocationIds(req.user);
      if (allowed.length === 0) return res.json({ requests: [] });
      params.push(allowed);
      locationSql = "AND ssr.location_id = ANY($2::uuid[])";
    }

    const result = await pool.query(
      `SELECT ssr.*, l.name AS location_name,
              fu.first_name AS from_first_name, fu.last_name AS from_last_name, fu.username AS from_username,
              tu.first_name AS to_first_name, tu.last_name AS to_last_name, tu.username AS to_username
       FROM shift_swap_requests ssr
       JOIN locations l ON l.id = ssr.location_id
       JOIN employees fe ON fe.id = ssr.from_employee_id
       JOIN users fu ON fu.id = fe.user_id
       LEFT JOIN employees te ON te.id = ssr.to_employee_id
       LEFT JOIN users tu ON tu.id = te.user_id
       WHERE ssr.business_id = $1
         ${locationSql}
       ORDER BY ssr.created_at DESC
       LIMIT 100`,
      params
    );

    res.json({ requests: result.rows });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to load shift swap requests." });
  }
});

router.post("/shift-swaps", requireAuth, async (req, res) => {
  try {
    const employee = await currentEmployee(req.user);
    if (!employee) return res.status(403).json({ error: "Employee profile required to request shift cover." });

    const workDate = normalizeDate(req.body.workDate);
    if (!workDate) return res.status(400).json({ error: "Valid work date is required." });

    const result = await pool.query(
      `INSERT INTO shift_swap_requests (
         business_id, location_id, schedule_cell_id, from_employee_id, to_employee_id,
         work_date, shift_id, request_type, reason, status
       )
       VALUES ($1,$2,$3,$4,$5,$6::date,$7,$8,$9,'pending_employee')
       RETURNING *`,
      [
        req.user.businessId,
        employee.location_id,
        req.body.scheduleCellId || null,
        employee.id,
        req.body.toEmployeeId || null,
        workDate,
        req.body.shiftId || null,
        req.body.requestType === "swap" ? "swap" : "cover",
        cleanText(req.body.reason, 500)
      ]
    );

    await logAudit({
      businessId: req.user.businessId,
      actorUserId: req.user.id,
      locationId: employee.location_id,
      action: "Employee requested shift cover/swap",
      entityType: "shift_swap_request",
      entityId: result.rows[0].id,
      details: result.rows[0]
    });

    res.json({ request: result.rows[0], message: "Shift cover/swap request submitted." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create shift swap request." });
  }
});

router.post("/shift-swaps/:id/accept", requireAuth, async (req, res) => {
  try {
    const employee = await currentEmployee(req.user);
    if (!employee) return res.status(403).json({ error: "Employee profile required." });

    const result = await pool.query(
      `UPDATE shift_swap_requests
       SET to_employee_id = $1,
           status = 'pending_manager',
           accepted_at = now(),
           updated_at = now()
       WHERE id = $2
         AND business_id = $3
         AND status = 'pending_employee'
         AND from_employee_id <> $1
       RETURNING *`,
      [employee.id, req.params.id, req.user.businessId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: "Shift request not available." });

    await logAudit({
      businessId: req.user.businessId,
      actorUserId: req.user.id,
      locationId: result.rows[0].location_id,
      action: "Employee accepted shift cover/swap request",
      entityType: "shift_swap_request",
      entityId: req.params.id,
      details: { toEmployeeId: employee.id }
    });

    res.json({ request: result.rows[0], message: "Request accepted and sent to manager approval." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to accept request." });
  }
});

router.post("/shift-swaps/:id/decision", requireAuth, requireScheduleManager, async (req, res) => {
  const approved = req.body.decision === "approve";
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const requestResult = await client.query(
      `SELECT * FROM shift_swap_requests
       WHERE id = $1
         AND business_id = $2
       FOR UPDATE`,
      [req.params.id, req.user.businessId]
    );
    const request = requestResult.rows[0];
    if (!request) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Request not found." });
    }

    await assertLocationAccess(req.user, request.location_id, true);

    if (approved && request.schedule_cell_id && request.to_employee_id) {
      await client.query(
        `UPDATE schedule_cells
         SET employee_id = $1,
             notes = concat_ws(' ', notes, $2)
         WHERE id = $3`,
        [request.to_employee_id, "Shift cover/swap approved.", request.schedule_cell_id]
      );
    }

    const result = await client.query(
      `UPDATE shift_swap_requests
       SET status = $1,
           manager_user_id = $2,
           manager_decision_at = now(),
           decision_reason = $3,
           updated_at = now()
       WHERE id = $4
       RETURNING *`,
      [approved ? "approved" : "denied", req.user.id, cleanText(req.body.reason, 500), req.params.id]
    );

    await logAudit({
      businessId: req.user.businessId,
      actorUserId: req.user.id,
      locationId: request.location_id,
      action: approved ? "Approved shift cover/swap request" : "Denied shift cover/swap request",
      entityType: "shift_swap_request",
      entityId: req.params.id,
      details: result.rows[0]
    });

    await client.query("COMMIT");
    res.json({ request: result.rows[0], message: approved ? "Request approved." : "Request denied." });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to decide request." });
  } finally {
    client.release();
  }
});

router.get("/labor", requireAuth, requireScheduleManager, async (req, res) => {
  const locationId = req.query.locationId;
  const weekStart = normalizeDate(req.query.weekStart);
  if (!weekStart) return res.status(400).json({ error: "Valid weekStart is required." });

  try {
    await assertLocationAccess(req.user, locationId, true);
    const result = await pool.query(
      `SELECT
         sc.work_date,
         COALESCE(s.name, 'Shift') AS shift_name,
         e.id AS employee_id,
         e.employee_code,
         u.first_name,
         u.last_name,
         e.pay_rate_cents,
         e.overtime_threshold_hours,
         e.overtime_allowed,
         sc.start_time,
         sc.end_time
       FROM schedules sch
       JOIN schedule_cells sc ON sc.schedule_id = sch.id
       JOIN employees e ON e.id = sc.employee_id
       JOIN users u ON u.id = e.user_id
       LEFT JOIN shifts s ON s.id = sc.shift_id
       WHERE sch.business_id = $1
         AND sch.location_id = $2
         AND sch.week_start = $3::date
       ORDER BY sc.work_date, sc.start_time`,
      [req.user.businessId, locationId, weekStart]
    );

    const byDay = new Map();
    const byEmployee = new Map();
    let totalCostCents = 0;
    const warnings = [];

    for (const row of result.rows) {
      const hours = hoursBetween(row.start_time, row.end_time);
      const cost = Math.round(hours * Number(row.pay_rate_cents || 0));
      totalCostCents += cost;

      const dayKey = String(row.work_date).slice(0, 10);
      if (!byDay.has(dayKey)) byDay.set(dayKey, { date: dayKey, hours: 0, costCents: 0 });
      byDay.get(dayKey).hours += hours;
      byDay.get(dayKey).costCents += cost;

      if (!byEmployee.has(row.employee_id)) {
        byEmployee.set(row.employee_id, {
          employeeId: row.employee_id,
          employeeCode: row.employee_code,
          name: `${row.first_name || ""} ${row.last_name || ""}`.trim(),
          hours: 0,
          costCents: 0,
          overtimeThresholdHours: Number(row.overtime_threshold_hours || 40),
          overtimeAllowed: row.overtime_allowed !== false
        });
      }
      byEmployee.get(row.employee_id).hours += hours;
      byEmployee.get(row.employee_id).costCents += cost;
    }

    for (const employee of byEmployee.values()) {
      if (employee.hours > employee.overtimeThresholdHours) {
        warnings.push({
          type: "overtime",
          severity: employee.overtimeAllowed ? "warning" : "error",
          message: `${employee.name || employee.employeeCode} is at ${employee.hours.toFixed(2)} hours, above the ${employee.overtimeThresholdHours} hour overtime threshold.`
        });
      }
    }

    const ruleResult = await pool.query(
      `SELECT labor_budget_cents
       FROM location_schedule_rules
       WHERE business_id = $1
         AND location_id = $2`,
      [req.user.businessId, locationId]
    );
    const laborBudgetCents = Number(ruleResult.rows[0]?.labor_budget_cents || 0);
    if (laborBudgetCents > 0 && totalCostCents > laborBudgetCents) {
      warnings.push({
        type: "labor_budget",
        severity: "warning",
        message: `Estimated labor cost is ${(totalCostCents / 100).toFixed(2)}, above the budget of ${(laborBudgetCents / 100).toFixed(2)}.`
      });
    }

    res.json({
      totalCostCents,
      laborBudgetCents,
      byDay: [...byDay.values()],
      byEmployee: [...byEmployee.values()],
      warnings
    });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to load labor forecast." });
  }
});

router.get("/approval-queue", requireAuth, requireScheduleManager, async (req, res) => {
  const locationId = req.query.locationId;

  try {
    await assertLocationAccess(req.user, locationId, true);

    const timeOffResult = await pool.query(
      `SELECT tor.*, u.first_name, u.last_name, u.username
       FROM time_off_requests tor
       JOIN employees e ON e.id = tor.employee_id
       JOIN users u ON u.id = e.user_id
       WHERE tor.business_id = $1
         AND tor.location_id = $2
         AND tor.status = 'pending'
       ORDER BY tor.created_at ASC`,
      [req.user.businessId, locationId]
    );

    const swapResult = await pool.query(
      `SELECT ssr.*, fu.first_name AS from_first_name, fu.last_name AS from_last_name, tu.first_name AS to_first_name, tu.last_name AS to_last_name
       FROM shift_swap_requests ssr
       JOIN employees fe ON fe.id = ssr.from_employee_id
       JOIN users fu ON fu.id = fe.user_id
       LEFT JOIN employees te ON te.id = ssr.to_employee_id
       LEFT JOIN users tu ON tu.id = te.user_id
       WHERE ssr.business_id = $1
         AND ssr.location_id = $2
         AND ssr.status IN ('pending_employee','pending_manager')
       ORDER BY ssr.created_at ASC`,
      [req.user.businessId, locationId]
    );

    const openResult = await pool.query(
      `SELECT * FROM open_shifts
       WHERE business_id = $1
         AND location_id = $2
         AND status = 'open'
       ORDER BY work_date ASC, start_time ASC
       LIMIT 50`,
      [req.user.businessId, locationId]
    );

    res.json({
      queue: {
        timeOff: timeOffResult.rows,
        shiftSwaps: swapResult.rows,
        openShifts: openResult.rows,
        total: timeOffResult.rows.length + swapResult.rows.length + openResult.rows.length
      }
    });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to load approval queue." });
  }
});

module.exports = router;
