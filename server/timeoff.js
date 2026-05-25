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

async function loadSettings(businessId) {
  await pool.query(
    `INSERT INTO time_off_settings (business_id, requests_enabled)
     VALUES ($1, true)
     ON CONFLICT (business_id) DO NOTHING`,
    [businessId]
  );

  const settingsResult = await pool.query(
    `SELECT requests_enabled
     FROM time_off_settings
     WHERE business_id = $1`,
    [businessId]
  );

  const blockedResult = await pool.query(
    `SELECT id, blocked_date, reason
     FROM time_off_blocked_dates
     WHERE business_id = $1
     ORDER BY blocked_date ASC`,
    [businessId]
  );

  return {
    settings: {
      requestsEnabled: settingsResult.rows[0]?.requests_enabled !== false
    },
    blockedDates: blockedResult.rows
  };
}

async function hasBlockedDateInRange(businessId, startDate, endDate) {
  const result = await pool.query(
    `SELECT blocked_date, reason
     FROM time_off_blocked_dates
     WHERE business_id = $1
       AND blocked_date >= $2::date
       AND blocked_date <= $3::date
     ORDER BY blocked_date ASC
     LIMIT 1`,
    [businessId, startDate, endDate]
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
router.get("/settings", requireAuth, async (req, res) => {
  try {
    res.json(await loadSettings(req.user.businessId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load time off settings." });
  }
});

router.post("/settings/toggle", requireAuth, requireOwner, async (req, res) => {
  const requestsEnabled = req.body.requestsEnabled !== false;
  const auditLocationId = await safeOwnerLocationId(req.user, req.body.locationId);
  const verified = await verifyActorPassword(req.user.id, req.body.actorPassword);

  if (!verified) {
    return res.status(403).json({ error: "Wrong password" });
  }

  try {
    await pool.query(
      `INSERT INTO time_off_settings (business_id, requests_enabled, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (business_id)
       DO UPDATE SET requests_enabled = EXCLUDED.requests_enabled, updated_at = now()`,
      [req.user.businessId, requestsEnabled]
    );

    await logAudit({
      businessId: req.user.businessId,
      actorUserId: req.user.id,
      locationId: auditLocationId,
      action: requestsEnabled ? "Time off requests turned on" : "Time off requests turned off",
      entityType: "time_off_settings",
      details: requestsEnabled ? "Employees can submit time off requests." : "Employees cannot submit time off requests."
    });

    res.json(await loadSettings(req.user.businessId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update time off settings." });
  }
});

router.post("/blocked-dates", requireAuth, requireOwner, async (req, res) => {
  const blockedDate = normalizeDate(req.body.blockedDate);
  const reason = cleanText(req.body.reason);
  const auditLocationId = await safeOwnerLocationId(req.user, req.body.locationId);

  if (!blockedDate) {
    return res.status(400).json({ error: "Blocked date is required." });
  }

  if (!reason) {
    return res.status(400).json({ error: "Blocked date reason is required." });
  }

  try {
    const result = await pool.query(
      `INSERT INTO time_off_blocked_dates (business_id, blocked_date, reason)
       VALUES ($1, $2, $3)
       ON CONFLICT (business_id, blocked_date)
       DO UPDATE SET reason = EXCLUDED.reason
       RETURNING id, blocked_date, reason`,
      [req.user.businessId, blockedDate, reason]
    );

    await logAudit({
      businessId: req.user.businessId,
      actorUserId: req.user.id,
      locationId: auditLocationId,
      action: "Blocked time off date saved",
      entityType: "time_off_blocked_date",
      entityId: result.rows[0]?.id,
      details: `${blockedDate} — ${reason}`
    });

    res.status(201).json(await loadSettings(req.user.businessId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add blocked date." });
  }
});

router.post("/blocked-dates/:id/delete", requireAuth, requireOwner, async (req, res) => {
  const { id } = req.params;
  const auditLocationId = await safeOwnerLocationId(req.user, req.body.locationId);

  try {
    const existing = await pool.query(
      `SELECT blocked_date, reason
       FROM time_off_blocked_dates
       WHERE id = $1
         AND business_id = $2`,
      [id, req.user.businessId]
    );

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
      details: existing.rows[0] ? `${String(existing.rows[0].blocked_date).slice(0, 10)} — ${existing.rows[0].reason || "No reason"}` : "Blocked date removed."
    });

    res.json(await loadSettings(req.user.businessId));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove blocked date." });
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

  if (!startDate || !endDate) {
    return res.status(400).json({ error: "Start and end dates are required." });
  }

  if (!reason) {
    return res.status(400).json({ error: "Reason is required." });
  }

  if (endDate < startDate) {
    return res.status(400).json({ error: "End date cannot be before start date." });
  }

  try {
    const settings = await loadSettings(req.user.businessId);
    if (settings.settings.requestsEnabled === false) {
      return res.status(403).json({ error: "Time off requests are currently turned off." });
    }

    const blockedDate = await hasBlockedDateInRange(req.user.businessId, startDate, endDate);
    if (blockedDate) {
      const dateText = String(blockedDate.blocked_date).slice(0, 10);
      return res.status(409).json({ error: `Time off cannot be requested for ${dateText}. ${blockedDate.reason || ""}`.trim() });
    }

    const employee = await employeeForUser(req.user);
    if (!employee) return res.status(403).json({ error: "Only employees assigned to a location can request time off." });

    const result = await pool.query(
      `INSERT INTO time_off_requests (business_id, location_id, employee_id, start_date, end_date, reason)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.businessId, employee.location_id, employee.id, startDate, endDate, reason]
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
      `SELECT id, location_id, start_date, end_date
       FROM time_off_requests
       WHERE id = $1
         AND business_id = $2`,
      [id, req.user.businessId]
    );

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ error: "Time off request not found." });
    }

    await assertManagerLocationAccess(req.user, requestResult.rows[0].location_id);

    const result = await pool.query(
      `UPDATE time_off_requests
       SET status = $1,
           decided_by = $2,
           decided_at = now(),
           decision_reason = $3,
           updated_at = now()
       WHERE id = $4
         AND business_id = $5
       RETURNING *`,
      [status, req.user.id, decisionReason, id, req.user.businessId]
    );

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
