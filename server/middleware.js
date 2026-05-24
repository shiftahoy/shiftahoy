const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authenticated." });
  }

  const token = header.slice("Bearer ".length);

  try {
    req.user = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

function requireScheduleManager(req, res, next) {
  if (
    !req.user ||
    !["owner", "manager"].includes(req.user.role) ||
    !req.user.canManageSchedule
  ) {
    return res.status(403).json({ error: "Manage Schedule permission required." });
  }

  next();
}

function requireOwner(req, res, next) {
  if (!req.user || req.user.role !== "owner") {
    return res.status(403).json({ error: "Owner permission required." });
  }

  next();
}

function requireRole(...roles) {
  return function (req, res, next) {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Permission denied." });
    }

    next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
  requireScheduleManager,
  requireOwner
};
