const express = require("express");
const argon2 = require("argon2");
const pool = require("./db");
const { requireAuth, requireOwner } = require("./middleware");

const router = express.Router();

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

async function userAssignedLocationIds(userId, businessId) {
  const result = await pool.query(
    `SELECT DISTINCT location_id
     FROM employees
     WHERE user_id = $1
       AND business_id = $2
       AND active = true`,
    [userId, businessId]
  );

  return result.rows.map((row) => row.location_id);
}

router.get("/", requireAuth, async (req, res) => {
  try {
    if (req.user.role === "owner") {
      const result = await pool.query(
        `SELECT id, name, address
         FROM locations
         WHERE business_id = $1
         ORDER BY name`,
        [req.user.businessId]
      );

      return res.json({ locations: result.rows });
    }

    const assignedLocationIds = await userAssignedLocationIds(req.user.id, req.user.businessId);

    if (assignedLocationIds.length === 0) {
      return res.json({ locations: [] });
    }

    const result = await pool.query(
      `SELECT id, name, address
       FROM locations
       WHERE business_id = $1
         AND id = ANY($2::uuid[])
       ORDER BY name`,
      [req.user.businessId, assignedLocationIds]
    );

    res.json({ locations: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load locations." });
  }
});

router.post("/", requireAuth, requireOwner, async (req, res) => {
  const { name, address } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Location name is required." });
  }

  try {
    const result = await pool.query(
      `INSERT INTO locations (business_id, name, address)
       VALUES ($1, $2, $3)
       RETURNING id, name, address`,
      [req.user.businessId, String(name).trim(), address ? String(address).trim() : null]
    );

    res.status(201).json({ location: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Location creation failed." });
  }
});

router.put("/:id", requireAuth, requireOwner, async (req, res) => {
  const { id } = req.params;
  const { name, address } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "Location name is required." });
  }

  try {
    const result = await pool.query(
      `UPDATE locations
       SET name = $1,
           address = $2,
           updated_at = now()
       WHERE id = $3
         AND business_id = $4
       RETURNING id, name, address`,
      [String(name).trim(), address ? String(address).trim() : null, id, req.user.businessId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Location not found." });
    }

    res.json({ location: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Location update failed." });
  }
});

async function deleteLocationWithCredentials(req, res) {
  const { id } = req.params;
  const { actorPassword } = req.body;

  const verified = await verifyActorPassword(req.user.id, actorPassword);
  if (!verified) {
    return res.status(401).json({ error: "Owner credentials are required to delete a location." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const locationResult = await client.query(
      `SELECT id
       FROM locations
       WHERE id = $1
         AND business_id = $2
       FOR UPDATE`,
      [id, req.user.businessId]
    );

    if (locationResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Location not found." });
    }

    const employeeUserResult = await client.query(
      `SELECT user_id
       FROM employees
       WHERE business_id = $1
         AND location_id = $2`,
      [req.user.businessId, id]
    );

    const employeeUserIds = employeeUserResult.rows
      .map((row) => row.user_id)
      .filter(Boolean);

    await client.query(
      `DELETE FROM schedule_cells sc
       USING schedules s
       WHERE sc.schedule_id = s.id
         AND s.business_id = $1
         AND s.location_id = $2`,
      [req.user.businessId, id]
    );

    await client.query(
      `DELETE FROM schedules
       WHERE business_id = $1
         AND location_id = $2`,
      [req.user.businessId, id]
    );

    await client.query(
      `DELETE FROM employee_days_off edo
       USING employees e
       WHERE edo.employee_id = e.id
         AND e.business_id = $1
         AND e.location_id = $2`,
      [req.user.businessId, id]
    );

    await client.query(
      `DELETE FROM employee_availability ea
       USING employees e
       WHERE ea.employee_id = e.id
         AND e.business_id = $1
         AND e.location_id = $2`,
      [req.user.businessId, id]
    );

    await client.query(
      `DELETE FROM employees
       WHERE business_id = $1
         AND location_id = $2`,
      [req.user.businessId, id]
    );

    if (employeeUserIds.length) {
      await client.query(
        `UPDATE users
         SET active = false,
             updated_at = now()
         WHERE business_id = $1
           AND role <> 'owner'
           AND id = ANY($2::uuid[])`,
        [req.user.businessId, employeeUserIds]
      );
    }

    await client.query(
      `DELETE FROM shift_days sd
       USING shifts s
       WHERE sd.shift_id = s.id
         AND s.business_id = $1
         AND s.location_id = $2`,
      [req.user.businessId, id]
    );

    await client.query(
      `DELETE FROM shifts
       WHERE business_id = $1
         AND location_id = $2`,
      [req.user.businessId, id]
    );

    await client.query(
      `DELETE FROM locations
       WHERE id = $1
         AND business_id = $2`,
      [id, req.user.businessId]
    );

    await client.query("COMMIT");
    res.json({ message: "Location deleted." });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err);
    res.status(500).json({ error: "Location deletion failed." });
  } finally {
    client.release();
  }

}

router.post("/:id/delete", requireAuth, requireOwner, deleteLocationWithCredentials);
router.delete("/:id", requireAuth, requireOwner, deleteLocationWithCredentials);

module.exports = router;
