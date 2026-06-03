const express = require("express");
const crypto = require("crypto");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const pool = require("./db");
const { sendEmail } = require("./mailer");
const { requireAuth } = require("./middleware");

const router = express.Router();
const { normalizeAccountNumber, isValidAccountNumber, createUniqueBusinessAccountNumber } = require("./id-utils");

const ACCOUNT_ID_RULE_MESSAGE = "ID# must be exactly 9 digits.";

const PASSWORD_MIN_LENGTH = 12;
const PASSWORD_MAX_LENGTH = 128;
const PASSWORD_RULE_MESSAGE =
  `Password must be ${PASSWORD_MIN_LENGTH} to ${PASSWORD_MAX_LENGTH} characters. Spaces and symbols are allowed.`;

const TWO_FACTOR_CODE_TTL_MINUTES = 10;
const TWO_FACTOR_CODE_RESEND_SECONDS = 60;
const TWO_FACTOR_CODE_MAX_ATTEMPTS = 5;

function makeToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function hashTwoFactorCode(userId, code) {
  const secret = process.env.TWO_FACTOR_CODE_SECRET || process.env.JWT_ACCESS_SECRET || "shiftahoy-local-dev-secret";
  return crypto
    .createHmac("sha256", secret)
    .update(`${userId}:${String(code || "").replace(/\D/g, "")}`)
    .digest("hex");
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function isValidUsername(username) {
  return /^[a-z0-9]{3,30}$/.test(String(username || ""));
}

function normalizePassword(password) {
  return String(password || "").normalize("NFKC");
}

function isValidPassword(password) {
  const normalizedPassword = normalizePassword(password);
  return (
    normalizedPassword.length >= PASSWORD_MIN_LENGTH &&
    normalizedPassword.length <= PASSWORD_MAX_LENGTH
  );
}

function normalizeBusinessSlug(businessName) {
  return String(businessName || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "")
    .slice(0, 40);
}

function normalizeBusinessSlugForSignup(businessName) {
  return String(businessName || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 40);
}

function buildFullLogin(username, businessSlug) {
  return `${username}/${businessSlug}`;
}

function publicBusiness(business) {
  if (!business) return null;
  return {
    id: business.id,
    businessName: business.business_name,
    businessSlug: business.business_slug,
    businessAccountNumber: business.account_number,
    planCode: business.plan_code
  };
}

async function findBusinessByAccountNumber(value) {
  const accountNumber = normalizeAccountNumber(value);
  if (!isValidAccountNumber(accountNumber)) return null;

  const result = await pool.query(
    `SELECT id, business_name, business_slug, account_number, plan_code
     FROM businesses
     WHERE account_number = $1
     LIMIT 1`,
    [accountNumber]
  );

  return result.rows[0] || null;
}

async function createUniqueBusinessSlug(client, businessName) {
  const baseSlug = normalizeBusinessSlugForSignup(businessName);

  if (!baseSlug) {
    return "";
  }

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;

    const existing = await client.query(
      `SELECT id
       FROM businesses
       WHERE business_slug = $1
       LIMIT 1`,
      [candidate]
    );

    if (existing.rows.length === 0) {
      return candidate;
    }
  }

  return `${baseSlug}-${crypto.randomBytes(4).toString("hex")}`;
}

async function findUserForLogin(login, businessAccountNumber = null) {
  const normalizedLogin = String(login || "").toLowerCase().trim();

  if (!normalizedLogin) {
    return null;
  }

  const business = await findBusinessByAccountNumber(businessAccountNumber);

  if (!business) {
    return null;
  }

  const selectSql = `SELECT
         u.id,
         u.business_id,
         u.first_name,
         u.last_name,
         u.email,
         u.account_number,
         u.username,
         u.full_login,
         u.password_hash,
         u.role,
         u.can_manage_schedule,
         u.email_verified,
         u.two_factor_enabled,
         b.account_number AS business_account_number,
         b.business_name,
         b.business_slug
       FROM users u
       JOIN businesses b ON b.id = u.business_id
       WHERE u.active = true
         AND u.business_id = $1`;

  if (normalizedLogin.includes("@")) {
    const emailResult = await pool.query(
      `${selectSql}
         AND lower(u.email) = $2
       LIMIT 1`,
      [business.id, normalizedLogin]
    );

    return emailResult.rows[0] || null;
  }

  const accountNumber = normalizeAccountNumber(normalizedLogin);
  if (!isValidAccountNumber(accountNumber)) {
    return null;
  }

  const idResult = await pool.query(
    `${selectSql}
       AND u.account_number = $2
     LIMIT 1`,
    [business.id, accountNumber]
  );

  return idResult.rows[0] || null;
}

async function verifyActorPassword(userId, password) {
  if (!password) return false;

  const result = await pool.query(
    `SELECT password_hash
     FROM users u
     JOIN businesses b ON b.id = u.business_id
     WHERE u.id = $1
       AND u.active = true`,
    [userId]
  );

  if (result.rows.length === 0) return false;
  return argon2.verify(result.rows[0].password_hash, normalizePassword(password));
}

function createAccessToken(user) {
  return jwt.sign(
    {
      id: user.id,
      businessId: user.business_id,
      email: user.email,
      username: user.username,
      fullLogin: user.full_login,
      accountNumber: user.account_number,
      role: user.role,
      canManageSchedule: user.can_manage_schedule,
      emailVerified: user.email_verified,
      twoFactorEnabled: user.two_factor_enabled === true,
      businessAccountNumber: user.business_account_number
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
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

function publicUser(user) {
  return {
    id: user.id,
    businessId: user.business_id,
    email: user.email,
    username: user.username,
    fullLogin: user.full_login,
    accountNumber: user.account_number,
    role: user.role,
    canManageSchedule: user.can_manage_schedule,
    emailVerified: user.email_verified,
    firstName: user.first_name,
    lastName: user.last_name,
    businessAccountNumber: user.business_account_number,
    businessName: user.business_name,
    twoFactorEnabled: user.two_factor_enabled === true
  };
}

router.post("/signup", async (req, res) => {
  const { firstName, lastName, businessName, email, password } = req.body;

  if (!firstName || !lastName || !businessName || !email || !password) {
    return res.status(400).json({
      error: "First name, last name, business, email, and password are required."
    });
  }

  const normalizedPassword = normalizePassword(password);

  if (!isValidPassword(normalizedPassword)) {
    return res.status(400).json({ error: PASSWORD_RULE_MESSAGE });
  }

  const normalizedEmail = String(email).toLowerCase().trim();

  const passwordHash = await argon2.hash(normalizedPassword, {
    type: argon2.argon2id
  });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const businessSlug = await createUniqueBusinessSlug(client, businessName);

    if (!businessSlug) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "Business must contain letters or numbers."
      });
    }

    const businessAccountNumber = await createUniqueBusinessAccountNumber(client, "business");
    const fullLogin = `owner/${businessAccountNumber}`;

    const businessResult = await client.query(
      `INSERT INTO businesses (business_name, business_slug, account_number, plan_code, plan_employee_limit)
       VALUES ($1, $2, $3, 'free', 1)
       RETURNING id, business_name, business_slug, account_number, plan_code, plan_employee_limit`,
      [businessName.trim(), businessSlug, businessAccountNumber]
    );

    const business = businessResult.rows[0];

    const userResult = await client.query(
      `INSERT INTO users (
         business_id,
         first_name,
         last_name,
         email,
         account_number,
         username,
         full_login,
         password_hash,
         role,
         can_manage_schedule
       )
       VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, 'owner', true)
       RETURNING
         id,
         business_id,
         first_name,
         last_name,
         email,
         account_number,
         username,
         full_login,
         role,
         can_manage_schedule,
         email_verified`,
      [
        business.id,
        firstName.trim(),
        lastName.trim(),
        normalizedEmail,
        businessAccountNumber,
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

    await client.query(
      `INSERT INTO payroll_settings (business_id)
       VALUES ($1)
       ON CONFLICT (business_id) DO NOTHING`,
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
      html: `<p>Verify your email:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p><p>Your permanent Shift Ahoy Business ID# is <strong>${businessAccountNumber}</strong>.</p>`
    });

    res.status(201).json({
      message: `Owner account created. Your permanent Business ID# is ${businessAccountNumber}. Check your email for the verification link.`,
      businessAccountNumber,
      accountNumber: businessAccountNumber,
      fullLogin,
      businessName: business.business_name,
      businessSlug: business.business_slug
    });
  } catch (err) {
    await client.query("ROLLBACK");

    if (err.code === "23505") {
      return res.status(409).json({
        error:
          "That email, ID#, or business login slug was just taken. Please try signing up again."
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

  await pool.query(
    `UPDATE users
     SET email_verified = true,
         updated_at = now()
     WHERE id = $1`,
    [row.user_id]
  );

  await pool.query(`DELETE FROM email_verification_tokens WHERE id = $1`, [
    row.id
  ]);

  res.send("Email verified. You can now return to Shift Ahoy.");
});

router.post("/business/lookup", async (req, res) => {
  const business = await findBusinessByAccountNumber(req.body.businessAccountNumber || req.body.businessId);

  if (!business) {
    return res.status(404).json({ error: "No business was found for that Business ID#." });
  }

  res.json({ business: publicBusiness(business) });
});

router.post("/login", async (req, res) => {
  const { login, password, businessAccountNumber, twoFactorCode } = req.body;

  if (!businessAccountNumber || !login || !password) {
    return res.status(400).json({ error: "Business ID#, login, and password are required." });
  }

  const user = await findUserForLogin(login, businessAccountNumber);

  if (!user) {
    return res.status(401).json({ error: "Invalid Business ID#, login, or password." });
  }

  const normalizedPassword = normalizePassword(password);
  const valid = await argon2.verify(user.password_hash, normalizedPassword);

  if (!valid) {
    return res.status(401).json({ error: "Invalid Business ID#, login, or password." });
  }

  if (user.two_factor_enabled === true) {
    const cleanCode = String(twoFactorCode || "").replace(/\D/g, "").slice(0, 6);

    if (!cleanCode) {
      const recentCode = await pool.query(
        `SELECT id, created_at
         FROM two_factor_login_codes
         WHERE user_id = $1
           AND used_at IS NULL
           AND expires_at > now()
           AND created_at > now() - ($2::int * interval '1 second')
         ORDER BY created_at DESC
         LIMIT 1`,
        [user.id, TWO_FACTOR_CODE_RESEND_SECONDS]
      );

      if (recentCode.rows.length > 0) {
        return res.status(429).json({
          twoFactorRequired: true,
          error: `A verification code was already sent. Please wait ${TWO_FACTOR_CODE_RESEND_SECONDS} seconds before requesting another one.`
        });
      }

      const rawCode = String(crypto.randomInt(100000, 1000000));
      await pool.query(
        `UPDATE two_factor_login_codes
         SET used_at = now()
         WHERE user_id = $1
           AND used_at IS NULL`,
        [user.id]
      );
      await pool.query(
        `INSERT INTO two_factor_login_codes (user_id, code_hash, expires_at, sent_to)
         VALUES ($1, $2, now() + ($3::int * interval '1 minute'), $4)`,
        [user.id, hashTwoFactorCode(user.id, rawCode), TWO_FACTOR_CODE_TTL_MINUTES, user.email || null]
      );

      if (user.email) {
        await sendEmail({
          to: user.email,
          subject: "Your Shift Ahoy verification code",
          html: `<p>Your Shift Ahoy verification code is <strong>${rawCode}</strong>.</p><p>This code expires in ${TWO_FACTOR_CODE_TTL_MINUTES} minutes. Shift Ahoy will never ask for this code outside the login screen.</p>`
        });
      }

      return res.status(202).json({
        twoFactorRequired: true,
        message: "A verification code was sent to the email on this profile."
      });
    }

    const codeResult = await pool.query(
      `SELECT id, code_hash, attempts_count
       FROM two_factor_login_codes
       WHERE user_id = $1
         AND expires_at > now()
         AND used_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.id]
    );

    if (codeResult.rows.length === 0) {
      return res.status(401).json({ error: "Invalid or expired verification code." });
    }

    const codeRow = codeResult.rows[0];
    if (Number(codeRow.attempts_count || 0) >= TWO_FACTOR_CODE_MAX_ATTEMPTS) {
      await pool.query(`UPDATE two_factor_login_codes SET used_at = now() WHERE id = $1`, [codeRow.id]);
      return res.status(401).json({ error: "Too many verification attempts. Request a new code." });
    }

    if (codeRow.code_hash !== hashTwoFactorCode(user.id, cleanCode)) {
      const attempts = Number(codeRow.attempts_count || 0) + 1;
      await pool.query(
        `UPDATE two_factor_login_codes
         SET attempts_count = $2,
             used_at = CASE WHEN $2 >= $3 THEN now() ELSE used_at END
         WHERE id = $1`,
        [codeRow.id, attempts, TWO_FACTOR_CODE_MAX_ATTEMPTS]
      );
      return res.status(401).json({ error: "Invalid or expired verification code." });
    }

    await pool.query(
      `UPDATE two_factor_login_codes SET used_at = now() WHERE id = $1`,
      [codeRow.id]
    );
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
    user: publicUser(user)
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
    `SELECT
       u.id,
       u.business_id,
       u.first_name,
       u.last_name,
       u.email,
       u.account_number,
       u.username,
       u.full_login,
       u.password_hash,
       u.role,
       u.can_manage_schedule,
       u.email_verified,
       u.two_factor_enabled,
       b.account_number AS business_account_number,
       b.business_name,
       b.business_slug
     FROM users u
     JOIN businesses b ON b.id = u.business_id
     WHERE u.id = $1
       AND u.active = true`,
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
    user: publicUser(user)
  });
});

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

async function sendIdReminder(req, res) {
  const email = normalizeEmail(req.body.email);
  const genericMessage = "If that email exists, an ID# reminder has been sent.";

  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: "A valid email is required." });
  }

  const result = await pool.query(
    `SELECT email, account_number, first_name, last_name, role
     FROM users
     WHERE lower(email) = $1
       AND active = true
     ORDER BY created_at ASC`,
    [email]
  );

  if (result.rows.length === 0) {
    return res.json({ message: genericMessage });
  }

  const idList = result.rows
    .map((user) => {
      const name = `${user.first_name || ""} ${user.last_name || ""}`.trim() || "Shift Ahoy user";
      const roleLabel = user.role ? ` (${user.role})` : "";
      return `<li><strong>${user.account_number}</strong> — ${name}${roleLabel}</li>`;
    })
    .join("");

  await sendEmail({
    to: result.rows[0].email,
    subject: "Your Shift Ahoy ID#",
    html: `
      <p>You requested the Shift Ahoy ID# associated with this email address.</p>
      <p>Your ID# value${result.rows.length === 1 ? " is" : "s are"}:</p>
      <ul>${idList}</ul>
      <p>You can use your ID# or email with your password to log in.</p>
      <p>If you did not request this reminder, you can ignore this email.</p>
    `
  });

  res.json({ message: genericMessage });
}

router.post("/forgot-id", sendIdReminder);
router.post("/forgot-username", sendIdReminder);

router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  const genericMessage =
    "If that email exists, a password reset link has been sent.";

  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
    return res.status(400).json({ error: "A valid email is required." });
  }

  const result = await pool.query(
    `SELECT id, email
     FROM users
     WHERE lower(email) = $1
       AND active = true
     LIMIT 1`,
    [normalizedEmail]
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

  if (!token || !newPassword) {
    return res.status(400).json({
      error: "Token and new password are required."
    });
  }

  const normalizedPassword = normalizePassword(newPassword);

  if (!isValidPassword(normalizedPassword)) {
    return res.status(400).json({ error: PASSWORD_RULE_MESSAGE });
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
  const passwordHash = await argon2.hash(normalizedPassword, {
    type: argon2.argon2id
  });

  await pool.query(
    `UPDATE users
     SET password_hash = $1,
         updated_at = now()
     WHERE id = $2`,
    [passwordHash, row.user_id]
  );

  await pool.query(
    `UPDATE password_reset_tokens
     SET used_at = now()
     WHERE id = $1`,
    [row.id]
  );

  await pool.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [
    row.user_id
  ]);

  res.json({ message: "Password reset successful. Please log in again." });
});

router.put("/profile", requireAuth, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const currentPassword = req.body.currentPassword;

  if (!currentPassword) {
    return res.status(400).json({ error: "Current password is required." });
  }

  if (email && !isValidEmail(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  const passwordOk = await verifyActorPassword(req.user.id, currentPassword);
  if (!passwordOk) {
    return res.status(403).json({ error: "Wrong password." });
  }

  const result = await pool.query(
    `UPDATE users
     SET email = $1,
         email_verified = CASE WHEN lower(COALESCE(email, '')) = lower(COALESCE($1, '')) THEN email_verified ELSE false END,
         updated_at = now()
     WHERE id = $2
       AND business_id = $3
     RETURNING id, business_id, first_name, last_name, email, account_number, username, full_login, role, can_manage_schedule, email_verified, two_factor_enabled`,
    [email || null, req.user.id, req.user.businessId]
  );

  res.json({ user: publicUser({ ...result.rows[0], business_account_number: req.user.businessAccountNumber }) });
});

router.put("/profile/password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: "Current password and new password are required." });
  }

  const normalizedPassword = normalizePassword(newPassword);
  if (!isValidPassword(normalizedPassword)) {
    return res.status(400).json({ error: PASSWORD_RULE_MESSAGE });
  }

  const passwordOk = await verifyActorPassword(req.user.id, currentPassword);
  if (!passwordOk) {
    return res.status(403).json({ error: "Wrong password." });
  }

  const passwordHash = await argon2.hash(normalizedPassword, { type: argon2.argon2id });
  await pool.query(
    `UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2 AND business_id = $3`,
    [passwordHash, req.user.id, req.user.businessId]
  );
  await pool.query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [req.user.id]);

  res.json({ message: "Password changed. Please log in again." });
});

router.put("/profile/2fa", requireAuth, async (req, res) => {
  const enabled = req.body.twoFactorEnabled === true;
  const passwordOk = await verifyActorPassword(req.user.id, req.body.currentPassword);

  if (!passwordOk) {
    return res.status(403).json({ error: "Wrong password." });
  }

  if (enabled) {
    const emailResult = await pool.query(`SELECT email FROM users WHERE id = $1`, [req.user.id]);
    if (!emailResult.rows[0]?.email) {
      return res.status(400).json({ error: "Add an email address before enabling 2FA." });
    }
  }

  await pool.query(
    `UPDATE users SET two_factor_enabled = $1, updated_at = now() WHERE id = $2 AND business_id = $3`,
    [enabled, req.user.id, req.user.businessId]
  );

  res.json({ settings: { twoFactorEnabled: enabled } });
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

router.get("/settings", requireAuth, async (req, res) => {
  if (req.user.role !== "owner") {
    return res.status(403).json({ error: "Owner permission required." });
  }

  try {
    const result = await pool.query(
      `SELECT owner_2fa_enabled
       FROM businesses
       WHERE id = $1`,
      [req.user.businessId]
    );

    res.json({ settings: { twoFactorEnabled: result.rows[0]?.owner_2fa_enabled === true } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load security settings." });
  }
});

router.put("/settings", requireAuth, async (req, res) => {
  if (req.user.role !== "owner") {
    return res.status(403).json({ error: "Owner permission required." });
  }

  try {
    const passwordOk = await verifyActorPassword(req.user.id, req.body.actorPassword);
    if (!passwordOk) {
      return res.status(403).json({ error: "Wrong password." });
    }

    const twoFactorEnabled = req.body.twoFactorEnabled === true;

    await pool.query(
      `UPDATE businesses
       SET owner_2fa_enabled = $1,
           updated_at = now()
       WHERE id = $2`,
      [twoFactorEnabled, req.user.businessId]
    );

    res.json({ settings: { twoFactorEnabled } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save security settings." });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  res.json({
    user: req.user
  });
});

module.exports = router;
