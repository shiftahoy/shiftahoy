const express = require("express");
const pool = require("./db");
const { requireAuth, requireScheduleManager } = require("./middleware");

const router = express.Router();

async function logAudit({ businessId, actorUserId, locationId = null, action, entityType, entityId = null, details = null }) {
  if (!businessId || !actorUserId || !action || !entityType) return;

  try {
    await pool.query(
      `INSERT INTO audit_logs (business_id, actor_user_id, location_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [businessId, actorUserId, locationId || null, action, entityType, entityId, details]
    );
  } catch (err) {
    console.error("Audit log write failed:", err);
  }
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

router.get("/", requireAuth, requireScheduleManager, async (req, res) => {
  const requestedLocationId = req.query.locationId || null;
  const safePage = Math.max(1, Number(req.query.page) || 1);
  const safePageSize = Math.min(25, Math.max(1, Number(req.query.pageSize) || 5));

  try {
    let locationFilterSql = "";
    let params = [req.user.businessId];

    if (req.user.role === "owner") {
      if (!requestedLocationId || !(await ownerOwnsLocation(req.user, requestedLocationId))) {
        return res.json({ logs: [], page: 1, pageSize: safePageSize, total: 0, totalPages: 1 });
      }

      params.push(requestedLocationId);
      locationFilterSql = "AND al.location_id = $2";
    } else {
      const allowedLocationIds = await assignedLocationIds(req.user);

      if (allowedLocationIds.length === 0) {
        return res.json({ logs: [], page: 1, pageSize: safePageSize, total: 0, totalPages: 1 });
      }

      if (requestedLocationId) {
        if (!allowedLocationIds.includes(requestedLocationId)) {
          return res.status(403).json({ error: "You can only view audit entries for your assigned location." });
        }

        params.push(requestedLocationId);
        locationFilterSql = "AND al.location_id = $2";
      } else {
        params.push(allowedLocationIds);
        locationFilterSql = "AND al.location_id = ANY($2::uuid[])";
      }
    }

    const countResult = await pool.query(
      `SELECT count(*)::int AS total
       FROM audit_logs al
       WHERE al.business_id = $1
         ${locationFilterSql}`,
      params
    );

    const total = countResult.rows[0]?.total || 0;
    const totalPages = Math.max(1, Math.ceil(total / safePageSize));
    const pageToUse = Math.min(safePage, totalPages);
    const offset = (pageToUse - 1) * safePageSize;

    const result = await pool.query(
      `SELECT
         al.id,
         al.location_id,
         al.action,
         al.entity_type,
         al.entity_id,
         al.details,
         al.created_at,
         l.name AS location_name,
         u.first_name,
         u.last_name,
         u.username,
         u.full_login
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.actor_user_id
       LEFT JOIN locations l ON l.id = al.location_id
       WHERE al.business_id = $1
         ${locationFilterSql}
       ORDER BY al.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, safePageSize, offset]
    );

    res.json({ logs: result.rows, page: pageToUse, pageSize: safePageSize, total, totalPages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load audit log." });
  }
});

module.exports = router;
module.exports.logAudit = logAudit;
