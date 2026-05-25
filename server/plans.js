const express = require("express");
const pool = require("./db");
const { requireAuth, requireOwner } = require("./middleware");

const router = express.Router();

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
  const { planCode } = req.body;

  if (!planCode) {
    return res.status(400).json({ error: "Plan code is required." });
  }

  try {
    const planResult = await pool.query(
      `SELECT code, employee_limit
       FROM plans
       WHERE code = $1`,
      [planCode]
    );

    if (planResult.rows.length === 0) {
      return res.status(400).json({ error: "Invalid plan." });
    }

    const plan = planResult.rows[0];

    const employeeCountResult = await pool.query(
      `SELECT count(*)::int AS count
       FROM employees
       WHERE business_id = $1
         AND active = true`,
      [req.user.businessId]
    );

    const employeeCount = employeeCountResult.rows[0].count;

    if (plan.employee_limit !== null && employeeCount > plan.employee_limit) {
      return res.status(409).json({
        error: `You currently have ${employeeCount} employees. This plan only allows ${plan.employee_limit}.`
      });
    }

    await pool.query(
      `UPDATE businesses
       SET plan_code = $1,
           plan_employee_limit = $2,
           updated_at = now()
       WHERE id = $3`,
      [plan.code, plan.employee_limit, req.user.businessId]
    );

    res.json({ message: "Plan updated immediately.", currentPlan: plan.code });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Plan change failed." });
  }
});

module.exports = router;
