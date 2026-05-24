const express = require("express");
const crypto = require("crypto");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const pool = require("./db");
const { sendEmail } = require("./mailer");
const { requireAuth } = require("./middleware");

const router = express.Router();

function makeToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function normalizeUsername(username) {
  return String(username || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "");
}

function normalizeBusinessSlug(businessName) {
  return String(businessName || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 40);
}

function createAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      businessId: user.business_id,
      email: user.email,
      username: user.username,
      fullLogin: user.full_login,
      role: user.role,
      canManageSchedule: user.can_manage_schedule,
      emailVerified: user.email_verified
    },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "15m" }
  );
}

function createRefreshToken(user) {
  return jwt.sign(
    {
      id: user.id
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );
}

function setRefreshCookie(res, token) {
  res.cookie("shiftahoy_refresh", token, {
    httpOnly: true,
    secure: false,
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

router.post("/signup", async (req, res) => {
  const { firstName, lastName, businessName, email, username, password } = req.body;

  if (!firstName || !lastName || !businessName || !email || !username || !password || password.length < 12) {
    return res.status(400).json({
      error: "First name, last name, business name, email, username, and a 12+ character password are required."
    });
  }

  const businessSlug = normalizeBusinessSlug(businessName);
  const normalizedUsername = normalizeUsername(username);

  if (!businessSlug) {
    return res.status(400).json({ error: "Business name must contain letters or numbers." });
  }

  if (!normalizedUsername) {
    return res.status(400).json({ error: "Username must contain letters or numbers." });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const fullLogin = `${normalizedUsername}.${businessSlug}`;

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const businessResult = await client.query(
      `INSERT INTO businesses (business_name, business_slug, plan_code, plan_employee_limit)
       VALUES ($1, $2, 'free', 1)
       RETURNING id, business_name, business_slug, plan_code, plan_employee_limit`,
      [businessName.trim(), businessSlug]
    );

    const business = businessResult.rows[0];

    const userResult = await client.query(
      `INSERT INTO users (
         business_id, first_name, last_name, email, username, full_login,
         password_hash, role, can_manage_schedule
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'owner', true)
       RETURNING id, business_id, email, username, full_login, role, can_manage_schedule, email_verified`,
      [
        business.id,
        firstName.trim(),
        lastName.trim(),
        normalizedEmail,
        normalizedUsername,
        fullLogin,
        passwordHash
      ]
    );

    const user = userResult.rows[0];

    await client.query(
      `INSERT INTO locations (business_id, name)
       VALUES ($1, 'Main Location')`,
      [business.id]
    );

    const rawToken = makeToken();
    const tokenHash = hashToken(rawToken);

    await client.query(
      `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, now() + interval '1 day')`,
      [user.id, tokenHash]
    );

    await client.query("COMMIT");

    const verifyUrl = `${process.env.APP_URL}/auth/verify-email?token=${rawToken}`;

    await sendEmail({
      to: user.email,
      subject: "Verify your Shift Ahoy email",
      html: `<p>Verify your email:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`
    });

    res.status(201).json({
      message: "Owner account created. Check your email for the verification link.",
      fullLogin
    });
  } catch (err) {
    await client.query("ROLLBACK");

    if (err.code === "23505") {
      return res.status(409).json({
        error: "That business name, email, or username is already taken."
      });
    }

    console.error(err);
    res.status(500).json({ error: "Signup failed." });
  } finally {
    client.release();
  }
});

router.get("/verify-email", async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).send("Missing token.");
  }

  const tokenHash = hashToken(token);

  const result = await pool.query(
    `SELECT evt.id, evt.user_id
     FROM email_verification_tokens evt
     WHERE evt.token_hash = $1
       AND evt.expires_at > now()
     LIMIT 1`,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    return res.status(400).send("Invalid or expired verification token.");
  }

  const row = result.rows[0];

  await pool.query(`UPDATE users SET email_verified = true WHERE id = $1`, [
    row.user_id
  ]);

  await pool.query(`DELETE FROM email_verification_tokens WHERE id = $1`, [
    row.id
  ]);

  res.send("Email verified. You can now return to Shift Ahoy.");
});

router.post("/login", async (req, res) => {
  const { login, password } = req.body;

  if (!login || !password) {
    return res.status(400).json({ error: "Login and password are required." });
  }

  const normalizedLogin = login.toLowerCase().trim();

  const result = await pool.query(
    `SELECT id, business_id, email, username, full_login, password_hash, role, can_manage_schedule, email_verified
     FROM users
     WHERE active = true
       AND (full_login = $1 OR lower(email) = $1)
     LIMIT 1`,
    [normalizedLogin]
  );

  if (result.rows.length === 0) {
    return res.status(401).json({ error: "Invalid login or password." });
  }

  const user = result.rows[0];
  const valid = await argon2.verify(user.password_hash, password);

  if (!valid) {
    return res.status(401).json({ error: "Invalid login or password." });
  }

  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user);
  const refreshTokenHash = hashToken(refreshToken);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + interval '7 days')`,
    [user.id, refreshTokenHash]
  );

  setRefreshCookie(res, refreshToken);

  res.json({
    accessToken,
    user: {
      id: user.id,
      businessId: user.business_id,
      email: user.email,
      username: user.username,
      fullLogin: user.full_login,
      role: user.role,
      canManageSchedule: user.can_manage_schedule,
      emailVerified: user.email_verified
    }
  });
});

router.post("/refresh", async (req, res) => {
  const refreshToken = req.cookies.shiftahoy_refresh;

  if (!refreshToken) {
    return res.status(401).json({ error: "No refresh token." });
  }

  let payload;

  try {
    payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
  } catch {
    return res.status(401).json({ error: "Invalid refresh token." });
  }

  const tokenHash = hashToken(refreshToken);

  const tokenResult = await pool.query(
    `SELECT id, user_id
     FROM refresh_tokens
     WHERE token_hash = $1
       AND expires_at > now()
     LIMIT 1`,
    [tokenHash]
  );

  if (tokenResult.rows.length === 0) {
    return res.status(401).json({ error: "Refresh token expired or revoked." });
  }

  const userResult = await pool.query(
    `SELECT id, business_id, email, username, full_login, password_hash, role, can_manage_schedule, email_verified
     FROM users
     WHERE id = $1
       AND active = true`,
    [payload.id]
  );

  if (userResult.rows.length === 0) {
    return res.status(401).json({ error: "User not found." });
  }

  const user = userResult.rows[0];

  await pool.query(`DELETE FROM refresh_tokens WHERE id = $1`, [
    tokenResult.rows[0].id
  ]);

  const newRefreshToken = createRefreshToken(user);
  const newRefreshTokenHash = hashToken(newRefreshToken);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + interval '7 days')`,
    [user.id, newRefreshTokenHash]
  );

  setRefreshCookie(res, newRefreshToken);

  res.json({
    accessToken: createAccessToken(user),
    user: {
      id: user.id,
      businessId: user.business_id,
      email: user.email,
      username: user.username,
      fullLogin: user.full_login,
      role: user.role,
      canManageSchedule: user.can_manage_schedule,
      emailVerified: user.email_verified
    }
  });
});

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  const genericMessage =
    "If that email exists, a password reset link has been sent.";

  if (!email) {
    return res.json({ message: genericMessage });
  }

  const result = await pool.query(
    `SELECT id, email
     FROM users
     WHERE lower(email) = $1
       AND active = true
     LIMIT 1`,
    [email.toLowerCase().trim()]
  );

  if (result.rows.length === 0) {
    return res.json({ message: genericMessage });
  }

  const user = result.rows[0];
  const rawToken = makeToken();
  const tokenHash = hashToken(rawToken);

  await pool.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, now() + interval '30 minutes')`,
    [user.id, tokenHash]
  );

  const resetUrl = `${process.env.APP_URL}/reset-password.html?token=${rawToken}`;

  await sendEmail({
    to: user.email,
    subject: "Reset your Shift Ahoy password",
    html: `<p>Reset your password:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`
  });

  res.json({ message: genericMessage });
});

router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword || newPassword.length < 12) {
    return res.status(400).json({
      error: "Token and a new password of at least 12 characters are required."
    });
  }

  const tokenHash = hashToken(token);

  const result = await pool.query(
    `SELECT id, user_id
     FROM password_reset_tokens
     WHERE token_hash = $1
       AND expires_at > now()
       AND used_at IS NULL
     LIMIT 1`,
    [tokenHash]
  );

  if (result.rows.length === 0) {
    return res.status(400).json({ error: "Invalid or expired reset token." });
  }

  const row = result.rows[0];
  const passwordHash = await argon2.hash(newPassword, {
    type: argon2.argon2id
  });

  await pool.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [
    passwordHash,
    row.user_id
  ]);

  await pool.query(`UPDATE password_reset_tokens SET used_at = now() WHERE id = $1`, [
    row.id
  ]);

  await pool.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [
    row.user_id
  ]);

  res.json({ message: "Password reset successful. Please log in again." });
});

router.post("/logout", async (req, res) => {
  const refreshToken = req.cookies.shiftahoy_refresh;

  if (refreshToken) {
    await pool.query(`DELETE FROM refresh_tokens WHERE token_hash = $1`, [
      hashToken(refreshToken)
    ]);
  }

  res.clearCookie("shiftahoy_refresh");
  res.json({ message: "Logged out." });
});

router.get("/me", requireAuth, async (req, res) => {
  res.json({
    user: req.user
  });
});

module.exports = router;
