import { Router, type IRouter } from "express";
import { eq, and, isNull } from "drizzle-orm";
import { db, usersTable, passwordResetTokensTable, managersTable } from "@workspace/db";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import {
  isManagerToken,
  verifyManagerToken,
  generateManagerToken,
  generateCustomerToken,
  verifyCustomerToken,
  serializeManager,
  revokeToken,
  extractTokenIssuedAt,
} from "../lib/managerAuth.js";

const router: IRouter = Router();

// ── OTP store ──────────────────────────────────────────────────────────────
interface PendingReg {
  otp: string;
  expiresAt: number;
  attempts: number;
  userData: {
    email: string; passwordHash: string;
    firstName: string; lastName: string; phone: string;
    marketingEmails: boolean;
  };
}
const pendingRegistrations = new Map<string, PendingReg>();

const MAX_OTP_ATTEMPTS = 5;

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pendingRegistrations) {
    if (val.expiresAt < now) pendingRegistrations.delete(key);
  }
}, 10 * 60 * 1000);

// ── Helpers ──────────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/** Compare password against stored hash.
 *  Supports both new bcrypt hashes and legacy SHA-256 hashes for migration. */
async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (storedHash.startsWith("$2")) {
    return bcrypt.compare(password, storedHash);
  }
  // Legacy SHA-256 fallback — still validates but caller should re-hash
  const sha256 = crypto.createHash("sha256").update(password + "ecommerce_salt_2024").digest("hex");
  return crypto.timingSafeEqual(Buffer.from(sha256, "hex"), Buffer.from(storedHash, "hex"));
}

/** Check whether a bearer token's issued-at timestamp predates
 *  a session-invalidation event (logout, password change).
 *  Returns true if the token should be rejected. */
function isTokenInvalidatedBySession(token: string, sessionInvalidatedAt: Date | null | undefined): boolean {
  if (!sessionInvalidatedAt) return false;
  const issuedAt = extractTokenIssuedAt(token);
  if (issuedAt === null) return true; // tampered token
  return issuedAt < sessionInvalidatedAt.getTime();
}

function serializeUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id, email: u.email,
    firstName: u.firstName, lastName: u.lastName,
    phone: u.phone, city: u.city, street: u.street,
    houseNumber: u.houseNumber, zipCode: u.zipCode,
    addressNote: u.addressNote, role: u.role,
    loyaltyPoints: u.loyaltyPoints, loyaltyTier: u.loyaltyTier,
    totalSpent: parseFloat(u.totalSpent), ordersCount: u.ordersCount,
    marketingEmails: u.marketingEmails, isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
  };
}

function generateToken(userId: number): string {
  return generateCustomerToken(userId);
}

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getTransporter() {
  const smtpHost = process.env.SMTP_HOST ?? "smtp.hostinger.com";
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = parseInt(process.env.SMTP_PORT ?? "465", 10);
  if (!smtpUser || !smtpPass) return null;
  return nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: true,
    auth: { user: smtpUser, pass: smtpPass },
  });
}

async function sendOtpEmail(to: string, firstName: string, otp: string): Promise<boolean> {
  const smtpUser = process.env.SMTP_USER;
  const transporter = getTransporter();

  if (!transporter) {
    console.log(`[OTP DEV] ${to} → ${otp}`);
    return false;
  }

  await transporter.sendMail({
    from: `"ביג-שווק" <${smtpUser}>`,
    to,
    subject: "קוד האימות שלך לביג-שווק",
    html: `
      <div dir="rtl" style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#2563eb">ברוכים הבאים לביג-שווק 👋</h2>
        <p>שלום ${firstName},</p>
        <p>קוד האימות שלך להשלמת ההרשמה:</p>
        <div style="font-size:40px;font-weight:bold;letter-spacing:12px;text-align:center;
                    background:#f3f4f6;padding:24px;border-radius:12px;margin:24px 0;color:#111">
          ${otp}
        </div>
        <p style="color:#6b7280;font-size:14px">הקוד בתוקף ל-5 דקות בלבד.</p>
        <p style="color:#6b7280;font-size:14px">אם לא ביקשת להירשם, ניתן להתעלם מהודעה זו.</p>
      </div>`,
  });
  return true;
}

async function sendPasswordResetEmail(to: string, firstName: string, resetLink: string): Promise<boolean> {
  const smtpUser = process.env.SMTP_USER;
  const transporter = getTransporter();

  if (!transporter) {
    console.log(`[RESET LINK DEV] ${to} → ${resetLink}`);
    return false;
  }

  await transporter.sendMail({
    from: `"ביג-שווק" <${smtpUser}>`,
    to,
    subject: "איפוס סיסמה – ביג-שווק",
    html: `
      <div dir="rtl" style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#2563eb">איפוס סיסמה</h2>
        <p>שלום ${firstName},</p>
        <p>קיבלנו בקשה לאיפוס הסיסמה לחשבון ביג-שווק שלך.</p>
        <p>לחץ על הכפתור כדי לבחור סיסמה חדשה:</p>
        <div style="text-align:center;margin:32px 0">
          <a href="${resetLink}"
             style="background:#2563eb;color:#fff;padding:14px 32px;border-radius:8px;
                    text-decoration:none;font-size:16px;font-weight:bold;display:inline-block">
            איפוס סיסמה
          </a>
        </div>
        <p style="color:#6b7280;font-size:14px">הקישור בתוקף ל-24 שעות בלבד.</p>
        <p style="color:#6b7280;font-size:14px">אם לא ביקשת לאפס את הסיסמה, ניתן להתעלם מהודעה זו.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
        <p style="color:#9ca3af;font-size:12px">
          אם הכפתור לא עובד, העתק את הקישור הבא לדפדפן:<br>
          <a href="${resetLink}" style="color:#2563eb;word-break:break-all">${resetLink}</a>
        </p>
      </div>`,
  });
  return true;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// /auth/check-email is intentionally removed to prevent account enumeration.
// send-otp always returns {success:true} regardless of whether the email already exists.

router.post("/auth/send-otp", async (req, res): Promise<void> => {
  const { email, password, firstName, lastName, phone, marketingEmails } = req.body;
  if (!email || !password || !firstName || !lastName || !phone) {
    res.status(400).json({ error: "כל השדות נדרשים" }); return;
  }
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
  // Always hash the password regardless of account existence to prevent timing-based
  // enumeration (bcrypt is the dominant cost; skipping it would create a measurable
  // latency difference between the "email exists" and "email available" code paths).
  const passwordHash = await hashPassword(password);
  // Always return the same response to prevent account enumeration.
  // OTP is logged to server console in dev (see sendOtpEmail).
  if (existing) {
    res.json({ success: true }); return;
  }
  const otp = generateOtp();
  pendingRegistrations.set(email, {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000,
    attempts: 0,
    userData: {
      email, passwordHash,
      firstName, lastName, phone,
      marketingEmails: marketingEmails !== false,
    },
  });
  await sendOtpEmail(email, firstName, otp).catch(() => false);
  // Uniform response — dev OTP is available in server console logs only
  res.json({ success: true });
});

router.post("/auth/verify-otp", async (req, res): Promise<void> => {
  const { email, otp } = req.body;
  if (!email || !otp) { res.status(400).json({ error: "אימייל וקוד נדרשים" }); return; }
  const pending = pendingRegistrations.get(email);
  if (!pending) {
    res.status(400).json({ error: "לא נמצאה בקשת הרשמה. אנא התחל מחדש." }); return;
  }
  if (Date.now() > pending.expiresAt) {
    pendingRegistrations.delete(email);
    res.status(400).json({ error: "קוד האימות פג תוקף. אנא שלח מחדש." }); return;
  }
  // Enforce maximum OTP attempts to prevent brute-force guessing
  pending.attempts += 1;
  if (pending.attempts > MAX_OTP_ATTEMPTS) {
    pendingRegistrations.delete(email);
    res.status(429).json({ error: "חרגת ממספר הניסיונות המותרים. אנא התחל מחדש." }); return;
  }
  if (pending.otp !== String(otp).trim()) {
    res.status(400).json({ error: "קוד האימות שגוי" }); return;
  }
  pendingRegistrations.delete(email);
  const { passwordHash, firstName, lastName, phone, marketingEmails } = pending.userData;
  const [user] = await db.insert(usersTable).values({
    email, passwordHash, firstName, lastName, phone, role: "customer",
    loyaltyPoints: 1000, marketingEmails,
  }).returning();
  const token = generateToken(user.id);
  res.status(201).json({ user: serializeUser(user), token, welcomePoints: 1000 });
});

// /auth/register is intentionally removed — all customer accounts must be
// created through the OTP-verified send-otp → verify-otp flow.

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400).json({ error: "אימייל וסיסמה נדרשים" }); return; }

  const genericError = { error: "פרטי התחברות שגויים" };

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (user) {
    if (!await verifyPassword(password, user.passwordHash ?? "")) {
      res.status(401).json(genericError); return;
    }
    if (!user.isActive) { res.status(403).json({ error: "account_inactive" }); return; }
    // Re-hash with bcrypt if the stored hash is still legacy SHA-256
    if (user.passwordHash && !user.passwordHash.startsWith("$2")) {
      const newHash = await hashPassword(password);
      await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, user.id));
    }
    const token = generateToken(user.id);
    res.json({ user: serializeUser(user), token }); return;
  }

  const [manager] = await db.select().from(managersTable).where(eq(managersTable.email, String(email).toLowerCase()));
  if (manager) {
    // Use a generic error for managers without passwords to avoid enumeration
    if (!manager.passwordHash) {
      res.status(401).json(genericError); return;
    }
    if (!await verifyPassword(password, manager.passwordHash)) {
      res.status(401).json(genericError); return;
    }
    if (!manager.isActive) { res.status(403).json({ error: "account_inactive" }); return; }
    // Re-hash with bcrypt if the stored hash is still legacy SHA-256
    if (!manager.passwordHash.startsWith("$2")) {
      const newHash = await hashPassword(password);
      await db.update(managersTable).set({ passwordHash: newHash }).where(eq(managersTable.id, manager.id));
    }
    const token = generateManagerToken(manager.id);
    res.json({ user: serializeManager(manager), token }); return;
  }

  res.status(401).json(genericError);
});

router.post("/auth/logout", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    // Persist session invalidation in DB FIRST (before revoking token so verify still works)
    try {
      const now = new Date();
      if (isManagerToken(token)) {
        const managerId = verifyManagerToken(token);
        if (managerId) {
          await db.update(managersTable)
            .set({ sessionInvalidatedAt: now })
            .where(eq(managersTable.id, managerId));
        }
      } else {
        const userId = verifyCustomerToken(token);
        if (userId !== null) {
          await db.update(usersTable)
            .set({ sessionInvalidatedAt: now })
            .where(eq(usersTable.id, userId));
        }
      }
    } catch {
      // Non-fatal: fall through to in-process revocation below
    }
    // Add to in-process revocation set for fast same-process rejection
    revokeToken(token);
  }
  res.json({ success: true });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader) { res.status(401).json({ error: "לא מחובר" }); return; }
  try {
    const token = authHeader.replace("Bearer ", "");
    if (isManagerToken(token)) {
      const managerId = verifyManagerToken(token);
      if (!managerId) { res.status(401).json({ error: "טוקן לא תקין" }); return; }
      const [manager] = await db.select().from(managersTable).where(eq(managersTable.id, managerId));
      if (!manager) { res.status(401).json({ error: "מנהל לא נמצא" }); return; }
      if (!manager.isActive) { res.status(403).json({ error: "account_inactive" }); return; }
      if (isTokenInvalidatedBySession(token, manager.sessionInvalidatedAt)) {
        res.status(401).json({ error: "טוקן לא תקין" }); return;
      }
      res.json(serializeManager(manager)); return;
    }
    const userId = verifyCustomerToken(token);
    if (userId === null) { res.status(401).json({ error: "טוקן לא תקין" }); return; }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) { res.status(401).json({ error: "משתמש לא נמצא" }); return; }
    if (!user.isActive) { res.status(403).json({ error: "account_inactive" }); return; }
    if (isTokenInvalidatedBySession(token, user.sessionInvalidatedAt)) {
      res.status(401).json({ error: "טוקן לא תקין" }); return;
    }
    res.json(serializeUser(user));
  } catch {
    res.status(401).json({ error: "טוקן לא תקין" });
  }
});

router.put("/auth/profile", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader) { res.status(401).json({ error: "לא מחובר" }); return; }
  try {
    const token = authHeader.replace("Bearer ", "");
    const userId = verifyCustomerToken(token);
    if (userId === null) { res.status(401).json({ error: "טוקן לא תקין" }); return; }
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!existing) { res.status(401).json({ error: "משתמש לא נמצא" }); return; }
    if (!existing.isActive) { res.status(403).json({ error: "account_inactive" }); return; }
    if (isTokenInvalidatedBySession(token, existing.sessionInvalidatedAt)) {
      res.status(401).json({ error: "טוקן לא תקין" }); return;
    }

    const { firstName, lastName, phone, city, street, houseNumber, zipCode, addressNote } = req.body;
    if (!firstName || !lastName || !phone || !city || !street || !houseNumber) {
      res.status(400).json({ error: "יש למלא את כל השדות הנדרשים" }); return;
    }

    const [updated] = await db.update(usersTable).set({
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      phone: String(phone).trim(),
      city: String(city).trim(),
      street: String(street).trim(),
      houseNumber: String(houseNumber).trim(),
      zipCode: zipCode ? String(zipCode).trim() : null,
      addressNote: addressNote ? String(addressNote).trim() : null,
    }).where(eq(usersTable.id, userId)).returning();

    res.json(serializeUser(updated));
  } catch {
    res.status(500).json({ error: "שגיאה בשמירת הפרטים" });
  }
});

// ── Forgot password ──────────────────────────────────────────────────────────

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body;
  if (!email) { res.status(400).json({ error: "אימייל נדרש" }); return; }

  // Always return the same response to prevent account enumeration.
  // A minimum jittered delay is applied for non-existent accounts to reduce
  // timing-based enumeration (existing accounts do more DB work naturally).
  const genericOk = { success: true, emailSent: true };

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || !user.isActive) {
    // Add a random 100–400 ms delay to match the typical work done for real accounts
    await new Promise((r) => setTimeout(r, 100 + Math.random() * 300));
    res.json(genericOk); return;
  }

  // Invalidate any existing unused reset tokens for this user before issuing a new one
  await db
    .update(passwordResetTokensTable)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(passwordResetTokensTable.userId, user.id),
        isNull(passwordResetTokensTable.usedAt)
      )
    );

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.insert(passwordResetTokensTable).values({ userId: user.id, token, expiresAt });

  const rawAppUrl = process.env.APP_URL;
  if (!rawAppUrl) {
    console.error("[auth] APP_URL env var is not set; cannot generate password-reset link");
    res.json(genericOk); return;
  }
  const appUrl = rawAppUrl.replace(/\/$/, "");
  const resetLink = `${appUrl}/reset-password?token=${token}`;

  const emailSent = await sendPasswordResetEmail(user.email, user.firstName, resetLink).catch(() => false);

  // devLink is intentionally excluded from the response to prevent token leakage.
  // In development (no SMTP), the reset link is already logged to the server console
  // by sendPasswordResetEmail (see [RESET LINK DEV] log line).
  res.json({ success: true, emailSent });
});

// ── Reset password ──────────────────────────────────────────────────────────

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword) {
    res.status(400).json({ error: "נתונים חסרים" }); return;
  }

  const [resetToken] = await db
    .select()
    .from(passwordResetTokensTable)
    .where(eq(passwordResetTokensTable.token, token));

  if (!resetToken) {
    res.status(400).json({ error: "קישור לא תקין" }); return;
  }
  if (resetToken.usedAt) {
    res.status(400).json({ error: "קישור זה כבר שומש. אנא בקש קישור חדש" }); return;
  }
  if (new Date() > resetToken.expiresAt) {
    res.status(400).json({ error: "קישור פג תוקף. אנא בקש קישור חדש" }); return;
  }

  const newHash = await hashPassword(newPassword);
  const now = new Date();

  // Update password and invalidate all existing bearer sessions for this user
  await db
    .update(usersTable)
    .set({ passwordHash: newHash, sessionInvalidatedAt: now })
    .where(eq(usersTable.id, resetToken.userId));

  // Mark this token as used AND invalidate all other unused tokens for the same user
  await db
    .update(passwordResetTokensTable)
    .set({ usedAt: now })
    .where(
      and(
        eq(passwordResetTokensTable.userId, resetToken.userId),
        isNull(passwordResetTokensTable.usedAt)
      )
    );

  res.json({ success: true });
});

export { serializeUser };
export default router;
