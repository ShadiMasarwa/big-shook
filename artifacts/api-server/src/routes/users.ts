import { Router, type IRouter } from "express";
import { eq, ilike, or, sql } from "drizzle-orm";
import { db, usersTable, loyaltyTransactionsTable } from "@workspace/db";
import { serializeUser } from "./auth.js";

const router: IRouter = Router();

router.get("/users", async (req, res): Promise<void> => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = parseInt(String(req.query.limit ?? "20"), 10);
  const offset = (page - 1) * limit;
  const search = req.query.search as string | undefined;

  let query = db.select().from(usersTable);
  if (search) {
    query = query.where(or(
      ilike(usersTable.email, `%${search}%`),
      ilike(usersTable.firstName, `%${search}%`),
      ilike(usersTable.lastName, `%${search}%`),
    )) as typeof query;
  }

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
  const users = await query.limit(limit).offset(offset);

  res.json({
    users: users.map(serializeUser),
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
  });
});

router.get("/users/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(404).json({ error: "משתמש לא נמצא" });
    return;
  }
  res.json(serializeUser(user));
});

router.patch("/users/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { firstName, lastName, phone, city, street, houseNumber, zipCode, addressNote, isActive } = req.body;
  const updateData: Record<string, unknown> = {};
  if (firstName !== undefined) updateData.firstName = firstName;
  if (lastName !== undefined) updateData.lastName = lastName;
  if (phone !== undefined) updateData.phone = phone;
  if (city !== undefined) updateData.city = city;
  if (street !== undefined) updateData.street = street;
  if (houseNumber !== undefined) updateData.houseNumber = houseNumber;
  if (zipCode !== undefined) updateData.zipCode = zipCode;
  if (addressNote !== undefined) updateData.addressNote = addressNote;
  if (isActive !== undefined) updateData.isActive = isActive;

  const [user] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, id)).returning();
  if (!user) {
    res.status(404).json({ error: "משתמש לא נמצא" });
    return;
  }
  res.json(serializeUser(user));
});

router.patch("/users/:id/loyalty", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { points, reason } = req.body;
  if (points === undefined || !reason) {
    res.status(400).json({ error: "points and reason are required" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(404).json({ error: "משתמש לא נמצא" });
    return;
  }
  const newPoints = user.loyaltyPoints + points;
  const tier = calcTier(newPoints);
  await db.insert(loyaltyTransactionsTable).values({
    userId: id, points, type: "adjusted", reason, orderId: null,
  });
  const [updated] = await db.update(usersTable).set({ loyaltyPoints: newPoints, loyaltyTier: tier }).where(eq(usersTable.id, id)).returning();
  res.json(serializeUser(updated));
});

function calcTier(points: number): "bronze" | "silver" | "gold" | "vip" {
  if (points >= 5000) return "vip";
  if (points >= 2000) return "gold";
  if (points >= 500) return "silver";
  return "bronze";
}

export default router;
