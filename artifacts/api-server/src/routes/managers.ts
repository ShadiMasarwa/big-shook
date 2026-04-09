import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, managersTable } from "@workspace/db";
import crypto from "crypto";
import nodemailer from "nodemailer";
import {
  generateManagerToken,
  isManagerToken,
  serializeManager,
  DEFAULT_MANAGER_PRIVILEGES,
} from "../lib/managerAuth.js";
import type { ManagerPrivileges } from "../lib/managerAuth.js";

const router: IRouter = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "ecommerce_salt_2024").digest("hex");
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

async function sendManagerSetupEmail(to: string, firstName: string, setupLink: string): Promise<boolean> {
  const smtpUser = process.env.SMTP_USER;
  const transporter = getTransporter();
  if (!transporter) {
    console.log(`[MANAGER SETUP DEV] ${to} → ${setupLink}`);
    return false;
  }
  await transporter.sendMail({
    from: `"ביג-שווק" <${smtpUser}>`,
    to,
    subject: "הגדרת סיסמה – פורטל מנהלים ביג-שווק",
    html: `
      <div dir="rtl" style="font-family:sans-serif;max-width:480px;margin:auto;padding:24px">
        <h2 style="color:#2563eb">ברוכים הבאים למנהלי ביג-שווק</h2>
        <p>שלום ${firstName},</p>
        <p>הוספת כמנהל מערכת. לחץ על הכפתור כדי להגדיר את הסיסמה שלך:</p>
        <div style="text-align:center;margin:32px 0">
          <a href="${setupLink}"
             style="background:#2563eb;color:#fff;padding:14px 32px;border-radius:8px;
                    text-decoration:none;font-size:16px;font-weight:bold;display:inline-block">
            הגדרת סיסמה
          </a>
        </div>
        <p style="color:#6b7280;font-size:14px">הקישור בתוקף ל-48 שעות בלבד.</p>
        <p style="color:#6b7280;font-size:14px">אם לא ציפית להודעה זו, ניתן להתעלם ממנה.</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
        <p style="color:#9ca3af;font-size:12px">
          אם הכפתור לא עובד, העתק את הקישור הבא:<br>
          <a href="${setupLink}" style="color:#2563eb;word-break:break-all">${setupLink}</a>
        </p>
      </div>`,
  });
  return true;
}

async function requireAdmin(req: Request, res: Response): Promise<boolean> {
  const authHeader = req.headers.authorization;
  if (!authHeader) { res.status(401).json({ error: "לא מחובר" }); return false; }
  try {
    const token = authHeader.replace("Bearer ", "");
    if (isManagerToken(token)) { res.status(403).json({ error: "מנהלים אינם מורשים לבצע פעולה זו" }); return false; }
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const userId = parseInt(decoded.split(":")[0], 10);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user || user.role !== "admin") { res.status(403).json({ error: "אין הרשאה" }); return false; }
    return true;
  } catch {
    res.status(401).json({ error: "טוקן לא תקין" }); return false;
  }
}

router.get("/managers", async (req, res): Promise<void> => {
  if (!await requireAdmin(req, res)) return;
  const managers = await db.select().from(managersTable).orderBy(managersTable.createdAt);
  res.json(managers.map(serializeManager));
});

router.get("/managers/:id", async (req, res): Promise<void> => {
  if (!await requireAdmin(req, res)) return;
  const [manager] = await db.select().from(managersTable).where(eq(managersTable.id, Number(req.params.id)));
  if (!manager) { res.status(404).json({ error: "מנהל לא נמצא" }); return; }
  res.json(serializeManager(manager));
});

router.post("/managers", async (req, res): Promise<void> => {
  if (!await requireAdmin(req, res)) return;
  const { firstName, lastName, email } = req.body;
  if (!firstName || !lastName || !email) {
    res.status(400).json({ error: "יש למלא שם פרטי, שם משפחה ואימייל" }); return;
  }
  const [existing] = await db.select({ id: managersTable.id }).from(managersTable).where(eq(managersTable.email, email));
  if (existing) { res.status(409).json({ error: "כתובת האימייל כבר קיימת" }); return; }

  const [existingUser] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email));
  if (existingUser) { res.status(409).json({ error: "כתובת האימייל כבר קיימת למשתמש" }); return; }

  const setupToken = crypto.randomBytes(32).toString("hex");
  const setupTokenExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const [manager] = await db.insert(managersTable).values({
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    email: String(email).trim().toLowerCase(),
    isActive: true,
    privileges: { ...DEFAULT_MANAGER_PRIVILEGES },
    setupToken,
    setupTokenExpiry,
  }).returning();

  const origin = req.get("origin") ?? `http://${req.get("host")}`;
  const setupLink = `${origin}/setup-manager-password?token=${setupToken}`;
  const emailSent = await sendManagerSetupEmail(manager.email, manager.firstName, setupLink).catch(() => false);

  res.status(201).json({
    manager: serializeManager(manager),
    emailSent,
    ...(!emailSent ? { devLink: setupLink } : {}),
  });
});

router.patch("/managers/:id", async (req, res): Promise<void> => {
  if (!await requireAdmin(req, res)) return;
  const managerId = Number(req.params.id);
  const [existing] = await db.select().from(managersTable).where(eq(managersTable.id, managerId));
  if (!existing) { res.status(404).json({ error: "מנהל לא נמצא" }); return; }

  const { firstName, lastName, email, isActive, privileges } = req.body;
  const patch: Partial<typeof managersTable.$inferInsert> = { updatedAt: new Date() };
  if (firstName !== undefined) patch.firstName = String(firstName).trim();
  if (lastName !== undefined) patch.lastName = String(lastName).trim();
  if (email !== undefined) patch.email = String(email).trim().toLowerCase();
  if (isActive !== undefined) patch.isActive = Boolean(isActive);
  if (privileges !== undefined) patch.privileges = privileges as ManagerPrivileges;

  const [updated] = await db.update(managersTable).set(patch).where(eq(managersTable.id, managerId)).returning();
  res.json(serializeManager(updated));
});

router.delete("/managers/:id", async (req, res): Promise<void> => {
  if (!await requireAdmin(req, res)) return;
  const managerId = Number(req.params.id);
  const [existing] = await db.select({ id: managersTable.id }).from(managersTable).where(eq(managersTable.id, managerId));
  if (!existing) { res.status(404).json({ error: "מנהל לא נמצא" }); return; }
  await db.delete(managersTable).where(eq(managersTable.id, managerId));
  res.json({ success: true });
});

router.post("/auth/manager-setup", async (req, res): Promise<void> => {
  const { token, password } = req.body;
  if (!token || !password) { res.status(400).json({ error: "נתונים חסרים" }); return; }
  if (password.length < 8) { res.status(400).json({ error: "הסיסמה חייבת להיות לפחות 8 תווים" }); return; }

  const [manager] = await db.select().from(managersTable).where(eq(managersTable.setupToken, String(token)));
  if (!manager) { res.status(400).json({ error: "קישור לא תקין או שכבר שומש" }); return; }
  if (manager.setupTokenExpiry && new Date() > manager.setupTokenExpiry) {
    res.status(400).json({ error: "קישור פג תוקף. בקש מהאדמין לשלוח שוב" }); return;
  }

  const [updated] = await db.update(managersTable).set({
    passwordHash: hashPassword(password),
    setupToken: null,
    setupTokenExpiry: null,
    updatedAt: new Date(),
  }).where(eq(managersTable.id, manager.id)).returning();

  const authToken = generateManagerToken(updated.id);
  res.json({ user: serializeManager(updated), token: authToken });
});

router.post("/managers/:id/resend-setup", async (req, res): Promise<void> => {
  if (!await requireAdmin(req, res)) return;
  const managerId = Number(req.params.id);
  const [manager] = await db.select().from(managersTable).where(eq(managersTable.id, managerId));
  if (!manager) { res.status(404).json({ error: "מנהל לא נמצא" }); return; }

  const setupToken = crypto.randomBytes(32).toString("hex");
  const setupTokenExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);
  await db.update(managersTable).set({ setupToken, setupTokenExpiry, updatedAt: new Date() }).where(eq(managersTable.id, managerId));

  const origin = req.get("origin") ?? `http://${req.get("host")}`;
  const setupLink = `${origin}/setup-manager-password?token=${setupToken}`;
  const emailSent = await sendManagerSetupEmail(manager.email, manager.firstName, setupLink).catch(() => false);
  res.json({ success: true, emailSent, ...(!emailSent ? { devLink: setupLink } : {}) });
});

export default router;
