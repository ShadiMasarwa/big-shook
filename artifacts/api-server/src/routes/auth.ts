import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import crypto from "crypto";
import nodemailer from "nodemailer";

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

async function sendOtpEmail(to: string, firstName: string, otp: string): Promise<boolean> {
  const smtpHost = process.env.SMTP_HOST ?? "smtp.hostinger.com";
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpPort = parseInt(process.env.SMTP_PORT ?? "465", 10);

  if (!smtpUser || !smtpPass) {
    console.log(`[OTP DEV] ${to} → ${otp}`);
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: true,
    auth: { user: smtpUser, pass: smtpPass },
    tls: { rejectUnauthorized: false },
  });

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
  if (!user || user.passwordHash !== hashPassword(password)) {
    res.status(401).json({ error: "פרטי התחברות שגויים" }); return;
  }
  if (!user.isActive) { res.status(401).json({ error: "החשבון אינו פעיל" }); return; }
  const token = generateToken(user.id);
  res.json({ user: serializeUser(user), token });
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  res.json({ success: true });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader) { res.status(401).json({ error: "לא מחובר" }); return; }
  try {
    const token = authHeader.replace("Bearer ", "");
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const userId = parseInt(decoded.split(":")[0], 10);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) { res.status(401).json({ error: "משתמש לא נמצא" }); return; }
    res.json(serializeUser(user));
  } catch {
    res.status(401).json({ error: "טוקן לא תקין" });
  }
});

export { serializeUser };
export default router;
