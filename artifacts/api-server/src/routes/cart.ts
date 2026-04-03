import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, cartItemsTable, cartCouponsTable, cartLoyaltyTable, productsTable, couponsTable, couponUsagesTable, loyaltyRulesTable, usersTable } from "@workspace/db";
import { getShekelPerPointForTier } from "./loyalty.js";

const router: IRouter = Router();

function getSessionId(req: { headers: Record<string, string | string[] | undefined>; ip?: string }): string {
  const sessionHeader = req.headers["x-session-id"];
  return (Array.isArray(sessionHeader) ? sessionHeader[0] : sessionHeader) ?? "default-session";
}

function getUserId(req: { headers: Record<string, string | string[] | undefined> }): number | null {
  const auth = req.headers["authorization"];
  if (!auth) return null;
  try {
    const token = Array.isArray(auth) ? auth[0] : auth;
    const base64 = token.replace(/^Bearer\s+/i, "");
    const decoded = Buffer.from(base64, "base64").toString("utf-8");
    // Token format: "userId:timestamp:hash"
    const userId = parseInt(decoded.split(":")[0], 10);
    return Number.isFinite(userId) ? userId : null;
  } catch {
    return null;
  }
}

function serializeProduct(p: typeof productsTable.$inferSelect) {
  return {
    ...p,
    price: parseFloat(p.price),
    salePrice: p.salePrice ? parseFloat(p.salePrice) : null,
    costPrice: p.costPrice ? parseFloat(p.costPrice) : null,
    ratingAverage: parseFloat(p.ratingAverage),
    weight: p.weight ? parseFloat(p.weight) : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    images: p.images ?? [],
    tags: p.tags ?? [],
    specs: p.specs ?? {},
  };
}

async function buildCart(sessionId: string, callerUserId?: number | null) {
  const items = await db.select().from(cartItemsTable).where(eq(cartItemsTable.sessionId, sessionId));
  const [couponRow] = await db.select().from(cartCouponsTable).where(eq(cartCouponsTable.sessionId, sessionId));
  const [loyaltyRow] = await db.select().from(cartLoyaltyTable).where(eq(cartLoyaltyTable.sessionId, sessionId));

  const productIds = items.map(i => i.productId);
  let products: typeof productsTable.$inferSelect[] = [];
  if (productIds.length > 0) {
    products = await db.select().from(productsTable).where(
      sql`${productsTable.id} = ANY(ARRAY[${sql.join(productIds.map(id => sql`${id}`), sql`, `)}]::int[])`
    );
  }

  const productMap = new Map(products.map(p => [p.id, p]));
  const cartItems = items.map(item => {
    const product = productMap.get(item.productId);
    return {
      productId: item.productId,
      product: product ? serializeProduct(product) : null,
      quantity: item.quantity,
      price: parseFloat(item.price),
      subtotal: parseFloat(item.price) * item.quantity,
    };
  }).filter(i => i.product !== null) as {
    productId: number;
    product: ReturnType<typeof serializeProduct>;
    quantity: number;
    price: number;
    subtotal: number;
  }[];

  const subtotal = cartItems.reduce((sum, i) => sum + i.subtotal, 0);
  const baseShipping = subtotal > 200 ? 0 : 29.9;

  // ── Coupons (supports stacking) ─────────────────────────────────────────────
  const couponRows = await db.select().from(cartCouponsTable).where(eq(cartCouponsTable.sessionId, sessionId));
  type AppliedCoupon = { code: string; discount: number; type: string; scope: string };
  const appliedCoupons: AppliedCoupon[] = [];
  let couponDiscount = 0;

  for (const row of couponRows) {
    const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, row.couponCode));
    if (!coupon || !coupon.isActive) continue;
    const now = new Date();
    if (coupon.expiresAt && coupon.expiresAt < now) continue;
    if (coupon.startsAt && coupon.startsAt > now) continue;
    if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) continue;

    const hasCategories = (coupon.applicableCategories ?? []).length > 0;
    const hasBrands = (coupon.applicableBrands ?? []).length > 0;
    const eligibleItems = (hasCategories || hasBrands)
      ? cartItems.filter(item => {
          const catMatch = !hasCategories || (coupon.applicableCategories ?? []).includes(item.product.categoryId ?? -1);
          const brandMatch = !hasBrands || (coupon.applicableBrands ?? []).includes(item.product.brandId ?? -1);
          return catMatch && brandMatch;
        })
      : cartItems;

    const scope = eligibleItems.length < cartItems.length ? "partial" : "all";
    const eligibleSubtotal = eligibleItems.reduce((sum, i) => sum + i.subtotal, 0);

    let discount = 0;
    if (coupon.type === "percentage") {
      discount = eligibleSubtotal * (parseFloat(coupon.value) / 100);
      if (coupon.maxDiscountAmount) discount = Math.min(discount, parseFloat(coupon.maxDiscountAmount));
    } else if (coupon.type === "fixed") {
      discount = Math.min(parseFloat(coupon.value), eligibleSubtotal);
    } else if (coupon.type === "free_shipping") {
      discount = baseShipping;
    }

    couponDiscount += discount;
    appliedCoupons.push({ code: coupon.code, discount, type: coupon.type, scope });
  }

  // Back-compat single-coupon fields
  const couponCode = appliedCoupons.length > 0 ? appliedCoupons.map(c => c.code).join(", ") : null;
  const couponScope = appliedCoupons.length === 1 ? appliedCoupons[0].scope : (appliedCoupons.length > 1 ? "partial" : null);
  const couponType = appliedCoupons.length === 1 ? appliedCoupons[0].type : null;

  const shipping = baseShipping;

  // ── Loyalty points ──────────────────────────────────────────────────────────
  let loyaltyPointsUsed = 0;
  let loyaltyDiscount = 0;
  let userAvailablePoints = 0;
  let maxRedeemablePoints = 0;
  let shekelPerPoint = 0.01;
  let minRedemptionPoints = 100;

  const effectiveUserId = loyaltyRow?.userId ?? callerUserId ?? null;
  if (effectiveUserId) {
    const [rules] = await db.select().from(loyaltyRulesTable);
    minRedemptionPoints = rules?.minRedemptionPoints ?? 100;
    const maxRedemptionPercent = rules ? parseFloat(rules.maxRedemptionPercent) : 20;

    const [user] = await db.select({ loyaltyPoints: usersTable.loyaltyPoints, loyaltyTier: usersTable.loyaltyTier })
      .from(usersTable).where(eq(usersTable.id, effectiveUserId));

    if (user) {
      userAvailablePoints = user.loyaltyPoints;
      // Use the per-tier exchange rate for this user's tier
      shekelPerPoint = await getShekelPerPointForTier(user.loyaltyTier ?? "bronze");

      // Max points allowed by the 20% rule (capped also by what user actually has)
      const maxDiscountFromPercent = (subtotal - couponDiscount) * (maxRedemptionPercent / 100);
      maxRedeemablePoints = Math.min(user.loyaltyPoints, Math.floor(maxDiscountFromPercent / shekelPerPoint));

      if (loyaltyRow) {
        const requestedPoints = Math.min(loyaltyRow.pointsToUse, user.loyaltyPoints);
        const clampedPoints = Math.min(requestedPoints, maxRedeemablePoints);
        loyaltyPointsUsed = clampedPoints;
        loyaltyDiscount = Math.round(clampedPoints * shekelPerPoint * 100) / 100;
      }
    }
  }

  const total = Math.max(0, subtotal - couponDiscount - loyaltyDiscount + shipping);

  return {
    items: cartItems,
    subtotal,
    discount: couponDiscount,
    shipping,
    total,
    couponCode,
    couponDiscount,
    couponScope,
    couponType,
    appliedCoupons,
    loyaltyPointsUsed,
    loyaltyDiscount,
    userAvailablePoints,
    maxRedeemablePoints,
    shekelPerPoint,
    minRedemptionPoints,
    itemCount: cartItems.reduce((sum, i) => sum + i.quantity, 0),
  };
}

router.get("/cart", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req as Parameters<typeof getSessionId>[0]);
  const userId = getUserId(req as Parameters<typeof getUserId>[0]);
  const cart = await buildCart(sessionId, userId);
  res.json(cart);
});

router.post("/cart/items", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req as Parameters<typeof getSessionId>[0]);
  const userId = getUserId(req as Parameters<typeof getUserId>[0]);
  const { productId, quantity } = req.body;
  if (!productId || !quantity) {
    res.status(400).json({ error: "productId and quantity are required" });
    return;
  }
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) {
    res.status(404).json({ error: "מוצר לא נמצא" });
    return;
  }
  const [existing] = await db.select().from(cartItemsTable)
    .where(and(eq(cartItemsTable.sessionId, sessionId), eq(cartItemsTable.productId, productId)));

  const effectivePrice = product.salePrice ?? product.price;

  if (existing) {
    await db.update(cartItemsTable)
      .set({ quantity: existing.quantity + quantity, ...(userId ? { userId } : {}) })
      .where(eq(cartItemsTable.id, existing.id));
  } else {
    await db.insert(cartItemsTable).values({ sessionId, productId, quantity, price: effectivePrice, ...(userId ? { userId } : {}) });
  }
  const cart = await buildCart(sessionId, userId);
  res.json(cart);
});

router.patch("/cart/items/:productId", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req as Parameters<typeof getSessionId>[0]);
  const userId = getUserId(req as Parameters<typeof getUserId>[0]);
  const raw = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const productId = parseInt(raw, 10);
  const { quantity } = req.body;
  if (quantity <= 0) {
    await db.delete(cartItemsTable).where(and(eq(cartItemsTable.sessionId, sessionId), eq(cartItemsTable.productId, productId)));
  } else {
    await db.update(cartItemsTable).set({ quantity }).where(and(eq(cartItemsTable.sessionId, sessionId), eq(cartItemsTable.productId, productId)));
  }
  // If cart is now empty, reset coupons and loyalty so they don't linger
  const remaining = await db.select().from(cartItemsTable).where(eq(cartItemsTable.sessionId, sessionId));
  if (remaining.length === 0) {
    await db.delete(cartCouponsTable).where(eq(cartCouponsTable.sessionId, sessionId));
    await db.delete(cartLoyaltyTable).where(eq(cartLoyaltyTable.sessionId, sessionId));
  }
  const cart = await buildCart(sessionId, userId);
  res.json(cart);
});

router.delete("/cart/items/:productId", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req as Parameters<typeof getSessionId>[0]);
  const userId = getUserId(req as Parameters<typeof getUserId>[0]);
  const raw = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const productId = parseInt(raw, 10);
  await db.delete(cartItemsTable).where(and(eq(cartItemsTable.sessionId, sessionId), eq(cartItemsTable.productId, productId)));
  // If cart is now empty, reset coupons and loyalty
  const remaining = await db.select().from(cartItemsTable).where(eq(cartItemsTable.sessionId, sessionId));
  if (remaining.length === 0) {
    await db.delete(cartCouponsTable).where(eq(cartCouponsTable.sessionId, sessionId));
    await db.delete(cartLoyaltyTable).where(eq(cartLoyaltyTable.sessionId, sessionId));
  }
  const cart = await buildCart(sessionId, userId);
  res.json(cart);
});

router.post("/cart/coupon", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req as Parameters<typeof getSessionId>[0]);
  const userId = getUserId(req as Parameters<typeof getUserId>[0]);
  const { code } = req.body;
  if (!code) {
    res.status(400).json({ error: "קוד קופון נדרש" });
    return;
  }

  const upperCode = String(code).toUpperCase().trim();
  const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, upperCode));

  if (!coupon) {
    res.status(400).json({ error: "קוד קופון לא קיים" });
    return;
  }
  if (!coupon.isActive) {
    res.status(400).json({ error: "קוד הקופון אינו פעיל" });
    return;
  }

  const now = new Date();

  if (coupon.startsAt && coupon.startsAt > now) {
    const startDate = coupon.startsAt.toLocaleDateString("he-IL");
    res.status(400).json({ error: `הקופון יהיה פעיל החל מ-${startDate}` });
    return;
  }

  if (coupon.expiresAt && coupon.expiresAt < now) {
    res.status(400).json({ error: "תוקף הקופון פג" });
    return;
  }

  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
    res.status(400).json({ error: "הקופון הגיע למגבלת השימוש המקסימלית" });
    return;
  }

  // Per-user usage limit
  if (coupon.usageLimitPerUser != null && userId != null) {
    const [usageRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(couponUsagesTable)
      .where(and(eq(couponUsagesTable.couponId, coupon.id), eq(couponUsagesTable.userId, userId)));
    if ((usageRow?.count ?? 0) >= coupon.usageLimitPerUser) {
      res.status(400).json({ error: "הגעת למגבלת השימוש האישית בקופון זה" });
      return;
    }
  }

  // Min order amount — check against current cart subtotal
  if (coupon.minOrderAmount != null) {
    const items = await db.select().from(cartItemsTable).where(eq(cartItemsTable.sessionId, sessionId));
    const cartSubtotal = items.reduce((sum, i) => sum + parseFloat(i.price) * i.quantity, 0);
    if (cartSubtotal < parseFloat(coupon.minOrderAmount)) {
      res.status(400).json({ error: `סכום מינימלי להזמנה עם קופון זה: ₪${parseFloat(coupon.minOrderAmount).toFixed(0)}` });
      return;
    }
  }

  // Stackability check — if there are already coupons applied, both must be stackable
  const existingCouponRows = await db.select().from(cartCouponsTable).where(eq(cartCouponsTable.sessionId, sessionId));
  if (existingCouponRows.length > 0) {
    // Reject if this coupon is not stackable
    if (!coupon.isStackable) {
      res.status(400).json({ error: "קופון זה אינו ניתן לשילוב עם קופונים אחרים" });
      return;
    }
    // Reject if any existing coupon is not stackable
    for (const row of existingCouponRows) {
      if (row.couponCode === upperCode) {
        res.status(400).json({ error: "קופון זה כבר מופעל בעגלה" });
        return;
      }
      const [existing] = await db.select({ isStackable: couponsTable.isStackable })
        .from(couponsTable).where(eq(couponsTable.code, row.couponCode));
      if (existing && !existing.isStackable) {
        res.status(400).json({ error: `הקופון ${row.couponCode} אינו ניתן לשילוב עם קופונים נוספים` });
        return;
      }
    }
  }

  await db.insert(cartCouponsTable).values({ sessionId, couponCode: upperCode })
    .onConflictDoNothing();

  const cart = await buildCart(sessionId, userId);
  res.json(cart);
});

router.delete("/cart/coupon", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req as Parameters<typeof getSessionId>[0]);
  const userId = getUserId(req as Parameters<typeof getUserId>[0]);
  const code = (req.query.code ?? req.body?.code) as string | undefined;
  if (code) {
    const upperCode = String(code).toUpperCase().trim();
    await db.delete(cartCouponsTable).where(
      and(eq(cartCouponsTable.sessionId, sessionId), eq(cartCouponsTable.couponCode, upperCode))
    );
  } else {
    await db.delete(cartCouponsTable).where(eq(cartCouponsTable.sessionId, sessionId));
  }
  const cart = await buildCart(sessionId, userId);
  res.json(cart);
});

router.delete("/cart/clear", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req as Parameters<typeof getSessionId>[0]);
  const userId = getUserId(req as Parameters<typeof getUserId>[0]);
  await db.delete(cartItemsTable).where(eq(cartItemsTable.sessionId, sessionId));
  await db.delete(cartCouponsTable).where(eq(cartCouponsTable.sessionId, sessionId));
  await db.delete(cartLoyaltyTable).where(eq(cartLoyaltyTable.sessionId, sessionId));
  const cart = await buildCart(sessionId, userId);
  res.json(cart);
});

// ── Loyalty points redemption ────────────────────────────────────────────────
router.post("/cart/loyalty", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req as Parameters<typeof getSessionId>[0]);
  const userId = getUserId(req as Parameters<typeof getUserId>[0]);

  if (!userId) {
    res.status(401).json({ error: "יש להתחבר כדי לממש נקודות" });
    return;
  }

  const points = Number(req.body?.points);
  if (!Number.isInteger(points) || points < 1) {
    res.status(400).json({ error: "מספר נקודות לא תקין" });
    return;
  }

  const [rules] = await db.select().from(loyaltyRulesTable);
  const minRedemptionPoints = rules?.minRedemptionPoints ?? 100;

  if (points < minRedemptionPoints) {
    res.status(400).json({ error: `מינימום ${minRedemptionPoints} נקודות למימוש` });
    return;
  }

  const [user] = await db.select({ loyaltyPoints: usersTable.loyaltyPoints })
    .from(usersTable).where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ error: "משתמש לא נמצא" });
    return;
  }

  if (points > user.loyaltyPoints) {
    res.status(400).json({ error: `יתרת הנקודות שלך: ${user.loyaltyPoints}` });
    return;
  }

  await db.insert(cartLoyaltyTable)
    .values({ sessionId, userId, pointsToUse: points })
    .onConflictDoUpdate({ target: cartLoyaltyTable.sessionId, set: { pointsToUse: points, userId } });

  const cart = await buildCart(sessionId, userId);
  res.json(cart);
});

router.delete("/cart/loyalty", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req as Parameters<typeof getSessionId>[0]);
  const userId = getUserId(req as Parameters<typeof getUserId>[0]);
  await db.delete(cartLoyaltyTable).where(eq(cartLoyaltyTable.sessionId, sessionId));
  const cart = await buildCart(sessionId, userId);
  res.json(cart);
});

export { buildCart, getSessionId, getUserId };
export default router;
