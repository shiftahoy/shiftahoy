const express = require("express");
const pool = require("./db");
const { requireAuth, requireOwner } = require("./middleware");

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  const result = await pool.query(
    `SELECT code, name, monthly_price_cents, employee_limit
     FROM plans
     ORDER BY monthly_price_cents`
  );

  res.json({ plans: result.rows });
});

router.post("/change", requireAuth, requireOwner, async (req, res) => {
  const { planCode } = req.body;

  const planResult = await pool.query(
    `SELECT code, employee_limit FROM plans WHERE code = $1`,
    [planCode]
  );

  if (planResult.rows.length === 0) {
    return res.status(400).json({ error: "Invalid plan." });
  }

  const plan = planResult.rows[0];

  const employeeCountResult = await pool.query(
    `SELECT count(*)::int AS count
     FROM employees
     WHERE business_id = $1 AND active = true`,
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
     SET plan_code = $1, plan_employee_limit = $2, updated_at = now()
     WHERE id = $3`,
    [plan.code, plan.employee_limit, req.user.businessId]
  );

  res.json({ message: "Plan updated immediately." });
});

module.exports = router;
