const express = require("express");
const pool = require("./db");
const { requireAuth, requireOwner } = require("./middleware");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, address
       FROM locations
       WHERE business_id = $1
       ORDER BY name`,
      [req.user.businessId]
    );

    res.json({ locations: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load locations." });
  }
});

router.post("/", requireAuth, requireOwner, async (req, res) => {
  const { name, address } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Location name is required." });
  }

  try {
    const result = await pool.query(
      `INSERT INTO locations (business_id, name, address)
       VALUES ($1, $2, $3)
       RETURNING id, name, address`,
      [req.user.businessId, name.trim(), address || null]
    );

    res.status(201).json({ location: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Location creation failed." });
  }
});

module.exports = router;
