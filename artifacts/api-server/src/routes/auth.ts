import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, passwordResetTokensTable, managersTable } from "@workspace/db";
import crypto from "crypto";
import nodemailer from "nodemailer";
import {
  isManagerToken,
  parseManagerTokenId,
  generateManagerToken,
  serializeManager,
} from "../lib/managerAuth.js";

const router: IRouter = Router();

// ── OTP store ──────────────────────────────────────────────────────────────
interface PendingReg {
  otp: string;
  expiresAt: number;
  userData: {
    email: string; passwordHash: string;
    firstName: string; lastName: string; phone: string;
    marketingEmails: boolean;
  };
}
const pendingRegistrations = new Map<string, PendingReg>();

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pendingRegistrations) {
    if (val.expiresAt < now) pendingRegistrations.delete(key);
  }
}, 10 * 60 * 1000);

// ── Helpers ──────────────────────────────────────────────────────────────────
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "ecommerce_salt_2024").digest("hex");
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
  return Buffer.from(`${userId}:${Date.now()}:${crypto.randomBytes(16).toString("hex")}`).toString("base64");
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
    tls: { rejectUnauthorized: false },
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

router.post("/auth/check-email", async (req, res): Promise<void> => {
  const { email } = req.body;
  if (!email) { res.status(400).json({ error: "אימייל נדרש" }); return; }
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
  res.json({ available: !existing });
});

router.post("/auth/send-otp", async (req, res): Promise<void> => {
  const { email, password, firstName, lastName, phone, marketingEmails } = req.body;
  if (!email || !password || !firstName || !lastName || !phone) {
    res.status(400).json({ error: "כל השדות נדרשים" }); return;
  }
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(409).json({ error: "כתובת האימייל כבר קיימת במערכת" }); return;
  }
  const otp = generateOtp();
  pendingRegistrations.set(email, {
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000,
    userData: {
      email, passwordHash: hashPassword(password),
      firstName, lastName, phone,
      marketingEmails: marketingEmails !== false,
    },
  });
  const emailSent = await sendOtpEmail(email, firstName, otp).catch(() => false);
  res.json({ success: true, emailSent, ...(!emailSent ? { devOtp: otp } : {}) });
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

router.post("/auth/register", async (req, res): Promise<void> => {
  const { email, password, firstName, lastName, phone, marketingEmails } = req.body;
  if (!email || !password || !firstName || !lastName) {
    res.status(400).json({ error: "כל השדות הנדרשים חסרים" }); return;
  }
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(400).json({ error: "כתובת האימייל כבר קיימת במערכת" }); return;
  }
  const [user] = await db.insert(usersTable).values({
    email, passwordHash: hashPassword(password),
    firstName, lastName, phone: phone ?? null, role: "customer",
    loyaltyPoints: 1000, marketingEmails: marketingEmails !== false,
  }).returning();
  const token = generateToken(user.id);
  res.status(201).json({ user: serializeUser(user), token, welcomePoints: 1000 });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400).json({ error: "אימייל וסיסמה נדרשים" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (user) {
    if (user.passwordHash !== hashPassword(password)) {
      res.status(401).json({ error: "פרטי התחברות שגויים" }); return;
    }
    if (!user.isActive) { res.status(403).json({ error: "account_inactive" }); return; }
    const token = generateToken(user.id);
    res.json({ user: serializeUser(user), token }); return;
  }

  const [manager] = await db.select().from(managersTable).where(eq(managersTable.email, String(email).toLowerCase()));
  if (manager) {
    if (!manager.passwordHash) {
      res.status(403).json({ error: "password_not_set" }); return;
    }
    if (manager.passwordHash !== hashPassword(password)) {
      res.status(401).json({ error: "פרטי התחברות שגויים" }); return;
    }
    if (!manager.isActive) { res.status(403).json({ error: "account_inactive" }); return; }
    const token = generateManagerToken(manager.id);
    res.json({ user: serializeManager(manager), token }); return;
  }

  res.status(401).json({ error: "פרטי התחברות שגויים" });
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  res.json({ success: true });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader) { res.status(401).json({ error: "לא מחובר" }); return; }
  try {
    const token = authHeader.replace("Bearer ", "");
    if (isManagerToken(token)) {
      const managerId = parseManagerTokenId(token);
      if (!managerId) { res.status(401).json({ error: "טוקן לא תקין" }); return; }
      const [manager] = await db.select().from(managersTable).where(eq(managersTable.id, managerId));
      if (!manager) { res.status(401).json({ error: "מנהל לא נמצא" }); return; }
      if (!manager.isActive) { res.status(403).json({ error: "account_inactive" }); return; }
      res.json(serializeManager(manager)); return;
    }
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const userId = parseInt(decoded.split(":")[0], 10);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) { res.status(401).json({ error: "משתמש לא נמצא" }); return; }
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
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const userId = parseInt(decoded.split(":")[0], 10);
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!existing) { res.status(401).json({ error: "משתמש לא נמצא" }); return; }

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

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  if (!user) {
    res.status(404).json({ error: "לא נמצא חשבון עם כתובת אימייל זו" });
    return;
  }
  if (!user.isActive) {
    res.status(403).json({ error: "החשבון מושהה. לסיוע פנה לשירות הלקוחות" });
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await db.insert(passwordResetTokensTable).values({ userId: user.id, token, expiresAt });

  const origin = req.get("origin") ?? `http://${req.get("host")}`;
  const resetLink = `${origin}/reset-password?token=${token}`;

  const emailSent = await sendPasswordResetEmail(user.email, user.firstName, resetLink).catch(() => false);

  res.json({ success: true, emailSent, ...(!emailSent ? { devLink: resetLink } : {}) });
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

  await db
    .update(usersTable)
    .set({ passwordHash: hashPassword(newPassword) })
    .where(eq(usersTable.id, resetToken.userId));

  await db
    .update(passwordResetTokensTable)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokensTable.id, resetToken.id));

  res.json({ success: true });
});

export { serializeUser };
export default router;
