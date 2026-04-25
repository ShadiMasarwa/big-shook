import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, couponsTable } from "@workspace/db";
import { requireManagerPrivilegeCheck, requireAdminOrManager } from "../lib/managerAuth.js";

const router: IRouter = Router();
const PRIV_DENIED = "אין לך הרשאה לבצע פעולה זו";

function serializeCoupon(c: typeof couponsTable.$inferSelect) {
  return {
    ...c,
    value: parseFloat(c.value),
    minOrderAmount: c.minOrderAmount ? parseFloat(c.minOrderAmount) : null,
    maxDiscountAmount: c.maxDiscountAmount ? parseFloat(c.maxDiscountAmount) : null,
    applicableCategories: c.applicableCategories ?? [],
    applicableBrands: c.applicableBrands ?? [],
    startsAt: c.startsAt?.toISOString() ?? null,
    expiresAt: c.expiresAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

router.get("/coupons", async (req, res): Promise<void> => {
  if (!await requireAdminOrManager(req, res)) return;
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = parseInt(String(req.query.limit ?? "50"), 10);
  const offset = (page - 1) * limit;
  const coupons = await db.select().from(couponsTable).limit(limit).offset(offset);
  res.json(coupons.map(serializeCoupon));
});

router.post("/coupons", async (req, res): Promise<void> => {
  const { allowed } = await requireManagerPrivilegeCheck(req, "coupons", "write");
  if (!allowed) { res.status(403).json({ error: PRIV_DENIED }); return; }
  const { code, type, value, minOrderAmount, maxDiscountAmount, applicableCategories,
    applicableBrands, usageLimit, usageLimitPerUser, isActive, isStackable, startsAt, expiresAt } = req.body;
  if (!code || !type || value === undefined) {
    res.status(400).json({ error: "code, type, value are required" });
    return;
  }
  const [coupon] = await db.insert(couponsTable).values({
    code: code.toUpperCase(), type, value: String(value),
    minOrderAmount: minOrderAmount != null ? String(minOrderAmount) : null,
    maxDiscountAmount: maxDiscountAmount != null ? String(maxDiscountAmount) : null,
    applicableCategories: applicableCategories ?? [],
    applicableBrands: applicableBrands ?? [],
    usageLimit: usageLimit ?? null, usageLimitPerUser: usageLimitPerUser ?? null,
    isActive: isActive ?? true, isStackable: isStackable ?? false,
    startsAt: startsAt ? new Date(startsAt) : null,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  }).returning();
  res.status(201).json(serializeCoupon(coupon));
});

router.patch("/coupons/:id", async (req, res): Promise<void> => {
  const { allowed } = await requireManagerPrivilegeCheck(req, "coupons", "write");
  if (!allowed) { res.status(403).json({ error: PRIV_DENIED }); return; }
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const body = req.body;
  const updateData: Record<string, unknown> = {};
  const stringFields = ["code", "type", "isActive", "isStackable", "applicableCategories", "applicableBrands", "usageLimit", "usageLimitPerUser"];
  for (const f of stringFields) {
    if (body[f] !== undefined) updateData[f] = body[f];
  }
  if (body.value !== undefined) updateData.value = String(body.value);
  if (body.minOrderAmount !== undefined) updateData.minOrderAmount = body.minOrderAmount != null ? String(body.minOrderAmount) : null;
  if (body.maxDiscountAmount !== undefined) updateData.maxDiscountAmount = body.maxDiscountAmount != null ? String(body.maxDiscountAmount) : null;
  if (body.startsAt !== undefined) updateData.startsAt = body.startsAt ? new Date(body.startsAt) : null;
  if (body.expiresAt !== undefined) updateData.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
  const [coupon] = await db.update(couponsTable).set(updateData).where(eq(couponsTable.id, id)).returning();
  if (!coupon) { res.status(404).json({ error: "קופון לא נמצא" }); return; }
  res.json(serializeCoupon(coupon));
});

router.delete("/coupons/:id", async (req, res): Promise<void> => {
  const { allowed } = await requireManagerPrivilegeCheck(req, "coupons", "delete");
  if (!allowed) { res.status(403).json({ error: PRIV_DENIED }); return; }
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(couponsTable).where(eq(couponsTable.id, id));
  res.sendStatus(204);
});

router.post("/coupons/validate", async (req, res): Promise<void> => {
  const { code, cartTotal, userId } = req.body;
  if (!code || cartTotal === undefined) {
    res.status(400).json({ error: "code and cartTotal are required" });
    return;
  }
  const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, code.toUpperCase()));
  if (!coupon || !coupon.isActive) {
    res.json({ valid: false, discountAmount: 0, message: "קוד קופון לא תקין" });
    return;
  }
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    res.json({ valid: false, discountAmount: 0, message: "תוקף הקופון פג" });
    return;
  }
  if (coupon.minOrderAmount && cartTotal < parseFloat(coupon.minOrderAmount)) {
    res.json({ valid: false, discountAmount: 0, message: `סכום מינימלי להזמנה: ₪${coupon.minOrderAmount}` });
    return;
  }
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    res.json({ valid: false, discountAmount: 0, message: "הקופון הגיע למגבלת השימוש" });
    return;
  }
  let discountAmount = 0;
  if (coupon.type === "percentage") {
    discountAmount = cartTotal * (parseFloat(coupon.value) / 100);
    if (coupon.maxDiscountAmount) discountAmount = Math.min(discountAmount, parseFloat(coupon.maxDiscountAmount));
  } else if (coupon.type === "fixed") {
    discountAmount = Math.min(parseFloat(coupon.value), cartTotal);
  }
  res.json({ valid: true, coupon: serializeCoupon(coupon), discountAmount, message: null });
});

export default router;
