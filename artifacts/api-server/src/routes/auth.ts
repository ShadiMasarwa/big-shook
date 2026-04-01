import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import crypto from "crypto";

const router: IRouter = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "ecommerce_salt_2024").digest("hex");
}

function serializeUser(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    city: u.city,
    street: u.street,
    houseNumber: u.houseNumber,
    zipCode: u.zipCode,
    addressNote: u.addressNote,
    role: u.role,
    loyaltyPoints: u.loyaltyPoints,
    loyaltyTier: u.loyaltyTier,
    totalSpent: parseFloat(u.totalSpent),
    ordersCount: u.ordersCount,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
  };
}

function generateToken(userId: number): string {
  return Buffer.from(`${userId}:${Date.now()}:${crypto.randomBytes(16).toString("hex")}`).toString("base64");
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const { email, password, firstName, lastName, phone } = req.body;
  if (!email || !password || !firstName || !lastName) {
    res.status(400).json({ error: "כל השדות הנדרשים חסרים" });
    return;
  }
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(400).json({ error: "כתובת האימייל כבר קיימת במערכת" });
    return;
  }
  const [user] = await db.insert(usersTable).values({
    email, passwordHash: hashPassword(password),
    firstName, lastName, phone: phone ?? null,
    role: "customer",
  }).returning();
  const token = generateToken(user.id);
  res.status(201).json({ user: serializeUser(user), token });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "אימייל וסיסמה נדרשים" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user || user.passwordHash !== hashPassword(password)) {
    res.status(401).json({ error: "פרטי התחברות שגויים" });
    return;
  }
  if (!user.isActive) {
    res.status(401).json({ error: "החשבון אינו פעיל" });
    return;
  }
  const token = generateToken(user.id);
  res.json({ user: serializeUser(user), token });
});

router.post("/auth/logout", async (_req, res): Promise<void> => {
  res.json({ success: true, message: "התנתקת בהצלחה" });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ error: "לא מחובר" });
    return;
  }
  try {
    const token = authHeader.replace("Bearer ", "");
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const userId = parseInt(decoded.split(":")[0], 10);
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!user) {
      res.status(401).json({ error: "משתמש לא נמצא" });
      return;
    }
    res.json(serializeUser(user));
  } catch {
    res.status(401).json({ error: "טוקן לא תקין" });
  }
});

export { serializeUser };
export default router;
