require("dotenv").config();

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

const authRoutes = require("./auth");
const planRoutes = require("./plans");
const locationRoutes = require("./locations");
const employeeRoutes = require("./employees");
const shiftRoutes = require("./shifts");
const scheduleRoutes = require("./schedules");
const { requireAuth, requireRole } = require("./middleware");

const app = express();

app.disable("x-powered-by");

app.use(helmet());

app.use(
  cors({
    origin: ["null", "http://localhost:3000", "http://localhost:3001"],
    credentials: true
  })
);

app.use(express.json({ limit: "250kb" }));
app.use(cookieParser());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

app.use("/auth", authLimiter, authRoutes);
app.use("/plans", planRoutes);
app.use("/locations", locationRoutes);
app.use("/employees", employeeRoutes);
app.use("/shifts", shiftRoutes);
app.use("/schedules", scheduleRoutes);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get(
  "/admin/test",
  requireAuth,
  requireRole("owner", "manager"),
  (req, res) => {
    res.json({ message: "You have manager/owner permission." });
  }
);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Server error." });
});

const port = Number(process.env.PORT || 3001);

app.listen(port, () => {
  console.log(`Shift Ahoy API running on http://localhost:${port}`);
});
