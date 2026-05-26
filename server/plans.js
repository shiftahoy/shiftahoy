const express = require("express");
const pool = require("./db");
const argon2 = require("argon2");
const { logAudit } = require("./audit");
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

router.get("/", requireAuth, async (req, res) => {
  try {
    const plansResult = await pool.query(
      `SELECT code, name, monthly_price_cents, employee_limit
       FROM plans
       ORDER BY monthly_price_cents`
    );

    const businessResult = await pool.query(
      `SELECT plan_code
       FROM businesses
       WHERE id = $1`,
      [req.user.businessId]
    );

    res.json({
      plans: plansResult.rows,
      currentPlan: businessResult.rows[0]?.plan_code || "free"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load plans." });
  }
});

router.post("/change", requireAuth, requireOwner, async (req, res) => {
  const { planCode, actorPassword } = req.body;

  if (!planCode) {
    return res.status(400).json({ error: "Plan code is required." });
  }

  try {
    const passwordOk = await verifyActorPassword(req.user.id, actorPassword);
    if (!passwordOk) {
      return res.status(403).json({ error: "Wrong owner password." });
    }

    const planResult = await pool.query(
      `SELECT code, name, monthly_price_cents, employee_limit
       FROM plans
       WHERE code = $1`,
      [planCode]
    );

    if (planResult.rows.length === 0) {
      return res.status(400).json({ error: "Invalid plan." });
    }

    const plan = planResult.rows[0];

    const currentResult = await pool.query(
      `SELECT plan_code
       FROM businesses
       WHERE id = $1`,
      [req.user.businessId]
    );
    const previousPlanCode = currentResult.rows[0]?.plan_code || "free";

    await pool.query(
      `UPDATE businesses
       SET plan_code = $1,
           plan_employee_limit = $2,
           updated_at = now()
       WHERE id = $3`,
      [plan.code, plan.employee_limit, req.user.businessId]
    );

    await logAudit({
      businessId: req.user.businessId,
      actorUserId: req.user.id,
      action: "plan_changed",
      entityType: "plan",
      entityId: plan.code,
      details: { summary: `Plan changed from ${previousPlanCode} to ${plan.code}. Employee records were preserved; display and scheduling limits are applied by plan.` }
    });

    res.json({
      message: "Plan updated immediately. Employee records were not deleted.",
      currentPlan: plan.code,
      employeeLimit: plan.employee_limit
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Plan change failed." });
  }
});

module.exports = router;
