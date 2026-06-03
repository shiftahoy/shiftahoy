const express = require("express");
const argon2 = require("argon2");
const pool = require("./db");
const { requireAuth, requireOwner, requireScheduleManager } = require("./middleware");
const { logAudit } = require("./audit");

const router = express.Router();

function normalizeDate(value) {
  const text = String(value || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeBoolean(value) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function normalizeLeaveType(value) {
  const text = String(value || "unpaid").trim().toLowerCase();
  return ["unpaid", "pto", "sick"].includes(text) ? text : "unpaid";
}

function businessDaysBetween(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  let days = 0;
  for (let date = start; date <= end; date = new Date(date.getTime() + 24 * 60 * 60 * 1000)) {
    const day = date.getUTCDay();
    if (day !== 0 && day !== 6) days += 1;
  }
  return Math.max(1, days);
}

function requestedMinutesForRange(startDate, endDate, providedHours) {
  const hours = Number(providedHours);
  if (Number.isFinite(hours) && hours > 0) return Math.round(Math.min(hours, 24 * 365) * 60);
  return businessDaysBetween(startDate, endDate) * 8 * 60;
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
  return argon2.verify(result.rows[0].password_hash, String(password || "").normalize("NFKC"));
}

async function employeeForUser(user) {
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

async function loadSettings(businessId, locationId = null) {
  await pool.query(
    `INSERT INTO time_off_settings (business_id, requests_enabled, shift_swaps_enabled)
     VALUES ($1, true, true)
     ON CONFLICT (business_id) DO NOTHING`,
    [businessId]
  );

  const settingsResult = await pool.query(
    `SELECT requests_enabled, shift_swaps_enabled
     FROM time_off_settings
     WHERE business_id = $1`,
    [businessId]
  );

  const blockedResult = locationId
    ? await pool.query(
        `SELECT id, blocked_date, reason, location_id, recurs_yearly
         FROM time_off_blocked_dates
         WHERE business_id = $1
           AND location_id = $2
           AND (blocked_date >= CURRENT_DATE OR recurs_yearly = true)
         ORDER BY recurs_yearly DESC, blocked_date ASC`,
        [businessId, locationId]
      )
    : { rows: [] };

  const holidayResult = locationId
    ? await pool.query(
        `SELECT id, holiday_date, name, location_id, recurs_yearly
         FROM time_off_holiday_dates
         WHERE business_id = $1
           AND location_id = $2
           AND (holiday_date >= CURRENT_DATE OR recurs_yearly = true)
         ORDER BY recurs_yearly DESC, holiday_date ASC`,
        [businessId, locationId]
      )
    : { rows: [] };

  return {
    settings: {
      requestsEnabled: settingsResult.rows[0]?.requests_enabled !== false,
      shiftSwapsEnabled: settingsResult.rows[0]?.shift_swaps_enabled !== false
    },
    blockedDates: blockedResult.rows,
    holidayDates: holidayResult.rows
  };
}

async function hasBlockedDateInRange(businessId, locationId, startDate, endDate) {
  const result = await pool.query(
    `SELECT blocked_date, reason, recurs_yearly
     FROM time_off_blocked_dates
     WHERE business_id = $1
       AND location_id = $2
       AND (
         (blocked_date >= $3::date AND blocked_date <= $4::date)
         OR (
           recurs_yearly = true
           AND EXISTS (
             SELECT 1
             FROM generate_series($3::date, $4::date, interval '1 day') AS requested_day(day_value)
             WHERE to_char(requested_day.day_value, 'MM-DD') = to_char(blocked_date, 'MM-DD')
           )
         )
       )
     ORDER BY recurs_yearly ASC, blocked_date ASC
     LIMIT 1`,
    [businessId, locationId, startDate, endDate]
  );

  return result.rows[0] || null;
}

async function assertManagerLocationAccess(user, locationId) {
  if (user.role === "owner") {
    const result = await pool.query(
      `SELECT id
       FROM locations
       WHERE id = $1
         AND business_id = $2`,
      [locationId, user.businessId]
    );

    if (result.rows.length === 0) {
      const error = new Error("Location not found.");
      error.status = 404;
      throw error;
    }

    return;
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
    const error = new Error("You can only manage requests for your assigned location.");
    error.status = 403;
    throw error;
  }
}


async function ownerOwnsLocation(user, locationId) {
  if (!locationId) return false;

  const result = await pool.query(
    `SELECT 1
     FROM locations
     WHERE id = $1
       AND business_id = $2
     LIMIT 1`,
    [locationId, user.businessId]
  );

  return result.rows.length > 0;
}

async function safeOwnerLocationId(user, locationId) {
  return (await ownerOwnsLocation(user, locationId)) ? locationId : null;
}
async function requireOwnerSelectedLocation(user, locationId) {
  if (!locationId) {
    const error = new Error("Selected location is required.");
    error.status = 400;
    throw error;
  }

  const owns = await ownerOwnsLocation(user, locationId);
  if (!owns) {
    const error = new Error("Location not found.");
    error.status = 404;
    throw error;
  }

  return locationId;
}

async function resolveTimeOffLocationId(user, locationId) {
  if (locationId) {
    await assertManagerLocationAccess(user, locationId);
    return locationId;
  }

  const employee = await employeeForUser(user);
  return employee?.location_id || null;
}

router.get("/settings", requireAuth, async (req, res) => {
  try {
    const locationId = await resolveTimeOffLocationId(req.user, req.query.locationId);
    res.json(await loadSettings(req.user.businessId, locationId));
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to load time off settings." });
  }
});

router.post("/settings/toggle", requireAuth, requireOwner, async (req, res) => {
  const requestsEnabled = req.body.requestsEnabled !== false;
  const shiftSwapsEnabled = req.body.shiftSwapsEnabled !== false;
  const auditLocationId = await safeOwnerLocationId(req.user, req.body.locationId);
  const verified = await verifyActorPassword(req.user.id, req.body.actorPassword);

  if (!verified) {
    return res.status(403).json({ error: "Wrong password" });
  }

  try {
    await pool.query(
      `INSERT INTO time_off_settings (business_id, requests_enabled, shift_swaps_enabled, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (business_id)
       DO UPDATE SET
         requests_enabled = EXCLUDED.requests_enabled,
         shift_swaps_enabled = EXCLUDED.shift_swaps_enabled,
         updated_at = now()`,
      [req.user.businessId, requestsEnabled, shiftSwapsEnabled]
    );

    await logAudit({
      businessId: req.user.businessId,
      actorUserId: req.user.id,
      locationId: auditLocationId,
      action: "Request settings updated",
      entityType: "request_settings",
      details: {
        timeOffRequests: requestsEnabled ? "on" : "off",
        shiftCoverSwapRequests: shiftSwapsEnabled ? "on" : "off"
      }
    });

    res.json(await loadSettings(req.user.businessId, auditLocationId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update time off settings." });
  }
});

router.post("/blocked-dates", requireAuth, requireOwner, async (req, res) => {
  const blockedDate = normalizeDate(req.body.blockedDate);
  const reason = cleanText(req.body.reason);
  const leaveType = normalizeLeaveType(req.body.leaveType);
  const requestedMinutes = leaveType === "unpaid" ? 0 : requestedMinutesForRange(startDate, endDate, req.body.requestedHours);
  const recursYearly = normalizeBoolean(req.body.recursYearly);
  let auditLocationId;
  try {
    auditLocationId = await requireOwnerSelectedLocation(req.user, req.body.locationId);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message, field: "blockedDate" });
  }

  if (!blockedDate) {
    return res.status(400).json({ error: "Blocked date is required.", field: "blockedDate" });
  }

  if (!reason) {
    return res.status(400).json({ error: "Blocked date reason is required.", field: "blockedReason" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO time_off_blocked_dates (business_id, location_id, blocked_date, reason, recurs_yearly)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (business_id, location_id, blocked_date)
       DO UPDATE SET
         reason = EXCLUDED.reason,
         recurs_yearly = EXCLUDED.recurs_yearly
       RETURNING id, blocked_date, reason, location_id, recurs_yearly`,
      [req.user.businessId, auditLocationId, blockedDate, reason, recursYearly]
    );

    await logAudit({
      businessId: req.user.businessId,
      actorUserId: req.user.id,
      locationId: auditLocationId,
      action: "Blocked time off date saved",
      entityType: "time_off_blocked_date",
      entityId: result.rows[0]?.id,
      details: `${blockedDate}${recursYearly ? " yearly" : ""} — ${reason}`
    });

    res.status(201).json(await loadSettings(req.user.businessId, auditLocationId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add blocked date." });
  }
});

router.post("/blocked-dates/:id/delete", requireAuth, requireOwner, async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await pool.query(
      `SELECT blocked_date, reason, location_id, recurs_yearly
       FROM time_off_blocked_dates
       WHERE id = $1
         AND business_id = $2`,
      [id, req.user.businessId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Blocked date not found." });
    }

    const auditLocationId = existing.rows[0].location_id;
    await requireOwnerSelectedLocation(req.user, auditLocationId);

    await pool.query(
      `DELETE FROM time_off_blocked_dates
       WHERE id = $1
         AND business_id = $2`,
      [id, req.user.businessId]
    );

    await logAudit({
      businessId: req.user.businessId,
      actorUserId: req.user.id,
      locationId: auditLocationId,
      action: "Blocked time off date removed",
      entityType: "time_off_blocked_date",
      entityId: id,
      details: `${String(existing.rows[0].blocked_date).slice(0, 10)}${existing.rows[0].recurs_yearly ? " yearly" : ""} — ${existing.rows[0].reason || "No reason"}`
    });

    res.json(await loadSettings(req.user.businessId, auditLocationId));
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to remove blocked date." });
  }
});


router.post("/holidays", requireAuth, requireOwner, async (req, res) => {
  const holidayDate = normalizeDate(req.body.holidayDate);
  const name = cleanText(req.body.name);
  const recursYearly = normalizeBoolean(req.body.recursYearly);
  let auditLocationId;
  try {
    auditLocationId = await requireOwnerSelectedLocation(req.user, req.body.locationId);
  } catch (err) {
    return res.status(err.status || 400).json({ error: err.message, field: "holidayDate" });
  }

  if (!holidayDate) {
    return res.status(400).json({ error: "Holiday date is required.", field: "holidayDate" });
  }

  if (!name) {
    return res.status(400).json({ error: "Holiday name is required.", field: "holidayName" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO time_off_holiday_dates (business_id, location_id, holiday_date, name, recurs_yearly)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (business_id, location_id, holiday_date)
       DO UPDATE SET
         name = EXCLUDED.name,
         recurs_yearly = EXCLUDED.recurs_yearly
       RETURNING id, holiday_date, name, location_id, recurs_yearly`,
      [req.user.businessId, auditLocationId, holidayDate, name, recursYearly]
    );

    await logAudit({
      businessId: req.user.businessId,
      actorUserId: req.user.id,
      locationId: auditLocationId,
      action: "Holiday date saved",
      entityType: "time_off_holiday_date",
      entityId: result.rows[0]?.id,
      details: `${holidayDate}${recursYearly ? " yearly" : ""} — ${name}`
    });

    res.status(201).json(await loadSettings(req.user.businessId, auditLocationId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add holiday date." });
  }
});

router.post("/holidays/:id/delete", requireAuth, requireOwner, async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await pool.query(
      `SELECT holiday_date, name, location_id, recurs_yearly
       FROM time_off_holiday_dates
       WHERE id = $1
         AND business_id = $2`,
      [id, req.user.businessId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Holiday date not found." });
    }

    const auditLocationId = existing.rows[0].location_id;
    await requireOwnerSelectedLocation(req.user, auditLocationId);

    await pool.query(
      `DELETE FROM time_off_holiday_dates
       WHERE id = $1
         AND business_id = $2`,
      [id, req.user.businessId]
    );

    await logAudit({
      businessId: req.user.businessId,
      actorUserId: req.user.id,
      locationId: auditLocationId,
      action: "Holiday date removed",
      entityType: "time_off_holiday_date",
      entityId: id,
      details: `${String(existing.rows[0].holiday_date).slice(0, 10)}${existing.rows[0].recurs_yearly ? " yearly" : ""} — ${existing.rows[0].name || "Holiday"}`
    });

    res.json(await loadSettings(req.user.businessId, auditLocationId));
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to remove holiday date." });
  }
});

router.get("/", requireAuth, async (req, res) => {
  const { locationId } = req.query;

  try {
    let result;

    if (req.user.role === "owner" || req.user.canManageSchedule) {
      if (!locationId) return res.status(400).json({ error: "Location ID is required." });
      await assertManagerLocationAccess(req.user, locationId);

      result = await pool.query(
        `SELECT
           tor.*,
           e.employee_code,
           u.first_name,
           u.last_name,
           u.username,
           approver.first_name AS approver_first_name,
           approver.last_name AS approver_last_name,
           approver.username AS approver_username
         FROM time_off_requests tor
         JOIN employees e ON e.id = tor.employee_id
         JOIN users u ON u.id = e.user_id
         LEFT JOIN users approver ON approver.id = tor.decided_by
         WHERE tor.business_id = $1
           AND tor.location_id = $2
         ORDER BY tor.created_at DESC, tor.start_date DESC
         LIMIT 250`,
        [req.user.businessId, locationId]
      );
    } else {
      const employee = await employeeForUser(req.user);
      if (!employee) return res.json({ requests: [] });

      result = await pool.query(
        `SELECT
           tor.*,
           e.employee_code,
           u.first_name,
           u.last_name,
           u.username,
           approver.first_name AS approver_first_name,
           approver.last_name AS approver_last_name,
           approver.username AS approver_username
         FROM time_off_requests tor
         JOIN employees e ON e.id = tor.employee_id
         JOIN users u ON u.id = e.user_id
         LEFT JOIN users approver ON approver.id = tor.decided_by
         WHERE tor.business_id = $1
           AND tor.employee_id = $2
         ORDER BY tor.created_at DESC, tor.start_date DESC
         LIMIT 250`,
        [req.user.businessId, employee.id]
      );
    }

    res.json({ requests: result.rows });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to load time off requests." });
  }
});

router.post("/", requireAuth, async (req, res) => {
  const startDate = normalizeDate(req.body.startDate);
  const endDate = normalizeDate(req.body.endDate || req.body.startDate);
  const reason = cleanText(req.body.reason);
  const leaveType = normalizeLeaveType(req.body.leaveType);
  const requestedMinutes = leaveType === "unpaid" ? 0 : requestedMinutesForRange(startDate, endDate, req.body.requestedHours);

  if (!startDate || !endDate) {
    return res.status(400).json({ error: "Start and end dates are required.", field: "dateRange" });
  }

  if (!reason) {
    return res.status(400).json({ error: "Reason is required.", field: "requestReason" });
  }

  if (endDate < startDate) {
    return res.status(400).json({ error: "End date cannot be before start date.", field: "dateRange" });
  }

  try {
    const employee = await employeeForUser(req.user);
    if (!employee) return res.status(403).json({ error: "Only employees assigned to a location can request time off." });

    const settings = await loadSettings(req.user.businessId, employee.location_id);
    if (settings.settings.requestsEnabled === false) {
      return res.status(403).json({ error: "Time off requests are currently turned off." });
    }

    const blockedDate = await hasBlockedDateInRange(req.user.businessId, employee.location_id, startDate, endDate);
    if (blockedDate) {
      const dateText = String(blockedDate.blocked_date).slice(0, 10);
      return res.status(409).json({ error: `Time off cannot be requested for ${dateText}. ${blockedDate.reason || ""}`.trim(), field: "dateRange" });
    }

    const result = await pool.query(
      `INSERT INTO time_off_requests (business_id, location_id, employee_id, start_date, end_date, reason, leave_type, requested_minutes, paid)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [req.user.businessId, employee.location_id, employee.id, startDate, endDate, reason, leaveType, requestedMinutes, leaveType !== "unpaid"]
    );

    await logAudit({
      businessId: req.user.businessId,
      actorUserId: req.user.id,
      locationId: employee.location_id,
      action: "Time off requested",
      entityType: "time_off_request",
      entityId: result.rows[0].id,
      details: `${startDate} to ${endDate} — ${reason}`
    });

    res.status(201).json({ request: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Time off request failed." });
  }
});

async function decideRequest(req, res, status) {
  const { id } = req.params;
  const decisionReason = cleanText(req.body.decisionReason || req.body.reason);

  if (!decisionReason) {
    return res.status(400).json({ error: status === "approved" ? "Approval reason is required." : "Denial reason is required." });
  }

  try {
    const requestResult = await pool.query(
      `SELECT id, location_id, employee_id, start_date, end_date, leave_type, requested_minutes, leave_transaction_id, status
       FROM time_off_requests
       WHERE id = $1
         AND business_id = $2`,
      [id, req.user.businessId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: "Time off request not found." });
    }

    const request = requestResult.rows[0];
    await assertManagerLocationAccess(req.user, request.location_id);

    let leaveTransactionId = request.leave_transaction_id || null;
    const client = await pool.connect();
    let result;
    try {
      await client.query("BEGIN");

      if (status === "approved" && ["pto", "sick"].includes(request.leave_type) && Number(request.requested_minutes || 0) > 0 && !leaveTransactionId) {
        await client.query(
          `INSERT INTO employee_leave_balances (business_id, employee_id, leave_type)
           VALUES ($1, $2, $3)
           ON CONFLICT (employee_id, leave_type) DO NOTHING`,
          [req.user.businessId, request.employee_id, request.leave_type]
        );

        const settingsResult = await client.query(
          `SELECT allow_negative_leave_balance FROM payroll_settings WHERE business_id = $1`,
          [req.user.businessId]
        );
        const allowNegative = settingsResult.rows[0]?.allow_negative_leave_balance === true;
        const balanceResult = await client.query(
          `SELECT balance_minutes FROM employee_leave_balances WHERE employee_id = $1 AND leave_type = $2 FOR UPDATE`,
          [request.employee_id, request.leave_type]
        );
        const currentBalance = Number(balanceResult.rows[0]?.balance_minutes || 0);
        const deduction = Number(request.requested_minutes || 0);
        if (!allowNegative && currentBalance < deduction) {
          const error = new Error(`Insufficient ${request.leave_type === "pto" ? "PTO" : "sick leave"} balance for this approval.`);
          error.status = 409;
          throw error;
        }

        const tx = await client.query(
          `INSERT INTO employee_leave_transactions (business_id, employee_id, leave_type, minutes_delta, reason, source, source_key, time_off_request_id, created_by)
           VALUES ($1, $2, $3, $4, $5, 'time_off_approval', $6, $7, $8)
           ON CONFLICT (business_id, employee_id, leave_type, source, source_key)
           WHERE source_key IS NOT NULL
           DO NOTHING
           RETURNING id`,
          [req.user.businessId, request.employee_id, request.leave_type, -deduction, `Approved time off: ${decisionReason}`, `time-off:${request.id}`, request.id, req.user.id]
        );
        leaveTransactionId = tx.rows[0]?.id || leaveTransactionId;
        if (tx.rows[0]) {
          await client.query(
            `UPDATE employee_leave_balances
             SET balance_minutes = balance_minutes - $1,
                 used_minutes_lifetime = used_minutes_lifetime + $1,
                 updated_at = now()
             WHERE employee_id = $2
               AND leave_type = $3`,
            [deduction, request.employee_id, request.leave_type]
          );
        }
      }

      if (status === "denied" && request.status === "approved" && ["pto", "sick"].includes(request.leave_type) && request.leave_transaction_id) {
        const previous = await client.query(
          `SELECT minutes_delta FROM employee_leave_transactions WHERE id = $1 AND business_id = $2`,
          [request.leave_transaction_id, req.user.businessId]
        );
        const restoreMinutes = Math.abs(Number(previous.rows[0]?.minutes_delta || request.requested_minutes || 0));
        if (restoreMinutes > 0) {
          await client.query(
            `INSERT INTO employee_leave_transactions (business_id, employee_id, leave_type, minutes_delta, reason, source, source_key, time_off_request_id, created_by)
             VALUES ($1, $2, $3, $4, $5, 'time_off_restored', $6, $7, $8)
             ON CONFLICT (business_id, employee_id, leave_type, source, source_key)
             WHERE source_key IS NOT NULL
             DO NOTHING`,
            [req.user.businessId, request.employee_id, request.leave_type, restoreMinutes, `Restored after denial: ${decisionReason}`, `time-off-restore:${request.id}`, request.id, req.user.id]
          );
          await client.query(
            `UPDATE employee_leave_balances
             SET balance_minutes = balance_minutes + $1,
                 updated_at = now()
             WHERE employee_id = $2
               AND leave_type = $3`,
            [restoreMinutes, request.employee_id, request.leave_type]
          );
        }
        leaveTransactionId = null;
      }

      result = await client.query(
        `UPDATE time_off_requests
         SET status = $1,
             decided_by = $2,
             decided_at = now(),
             decision_reason = $3,
             leave_transaction_id = $4,
             updated_at = now()
         WHERE id = $5
           AND business_id = $6
         RETURNING *`,
        [status, req.user.id, decisionReason, leaveTransactionId, id, req.user.businessId]
      );

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    await logAudit({
      businessId: req.user.businessId,
      actorUserId: req.user.id,
      locationId: requestResult.rows[0].location_id,
      action: status === "approved" ? "Time off approved" : "Time off not approved",
      entityType: "time_off_request",
      entityId: id,
      details: `${String(requestResult.rows[0].start_date).slice(0, 10)} to ${String(requestResult.rows[0].end_date).slice(0, 10)} — ${decisionReason}`
    });

    res.json({ request: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Time off request update failed." });
  }
}

router.post("/:id/approve", requireAuth, requireScheduleManager, (req, res) => decideRequest(req, res, "approved"));
router.post("/:id/deny", requireAuth, requireScheduleManager, (req, res) => decideRequest(req, res, "denied"));

module.exports = router;
