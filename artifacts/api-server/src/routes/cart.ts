import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, cartItemsTable, cartCouponsTable, productsTable, couponsTable, couponUsagesTable } from "@workspace/db";

const router: IRouter = Router();

function getSessionId(req: { headers: Record<string, string | string[] | undefined>; ip?: string }): string {
  const sessionHeader = req.headers["x-session-id"];
  return (Array.isArray(sessionHeader) ? sessionHeader[0] : sessionHeader) ?? "default-session";
}

function getUserId(req: { headers: Record<string, string | string[] | undefined> }): number | null {
  // Try to extract userId from a simple bearer token check (best-effort, not security-critical here)
  const auth = req.headers["authorization"];
  if (!auth) return null;
  try {
    const token = Array.isArray(auth) ? auth[0] : auth;
    const base64 = token.replace("Bearer ", "");
    const decoded = Buffer.from(base64, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded);
    return typeof parsed.userId === "number" ? parsed.userId : null;
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

async function buildCart(sessionId: string) {
  const items = await db.select().from(cartItemsTable).where(eq(cartItemsTable.sessionId, sessionId));
  const [couponRow] = await db.select().from(cartCouponsTable).where(eq(cartCouponsTable.sessionId, sessionId));

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

  let couponDiscount = 0;
  let couponCode: string | null = null;
  let couponScope: string | null = null; // "all" | "partial"

  if (couponRow) {
    const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, couponRow.couponCode));
    if (coupon && coupon.isActive) {
      const now = new Date();
      const isExpired = coupon.expiresAt && coupon.expiresAt < now;
      const notStarted = coupon.startsAt && coupon.startsAt > now;
      const overLimit = coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit;

      if (!isExpired && !notStarted && !overLimit) {
        couponCode = coupon.code;

        // Determine eligible items (category / brand restrictions)
        const hasCategories = (coupon.applicableCategories ?? []).length > 0;
        const hasBrands = (coupon.applicableBrands ?? []).length > 0;

        const eligibleItems = (hasCategories || hasBrands)
          ? cartItems.filter(item => {
              const categoryMatch = !hasCategories || (coupon.applicableCategories ?? []).includes(item.product.categoryId ?? -1);
              const brandMatch = !hasBrands || (coupon.applicableBrands ?? []).includes(item.product.brandId ?? -1);
              return categoryMatch && brandMatch;
            })
          : cartItems;

        couponScope = eligibleItems.length < cartItems.length ? "partial" : "all";
        const eligibleSubtotal = eligibleItems.reduce((sum, i) => sum + i.subtotal, 0);

        if (coupon.type === "percentage") {
          couponDiscount = eligibleSubtotal * (parseFloat(coupon.value) / 100);
          if (coupon.maxDiscountAmount) {
            couponDiscount = Math.min(couponDiscount, parseFloat(coupon.maxDiscountAmount));
          }
        } else if (coupon.type === "fixed") {
          couponDiscount = Math.min(parseFloat(coupon.value), eligibleSubtotal);
        } else if (coupon.type === "free_shipping") {
          couponDiscount = baseShipping; // discount equals the shipping cost
        }
      }
    }
  }

  const shipping = couponCode && couponScope !== null
    // For free_shipping coupons the discount already covers shipping; keep shipping in total so discount cancels it
    ? baseShipping
    : baseShipping;

  const total = Math.max(0, subtotal - couponDiscount + shipping);

  return {
    items: cartItems,
    subtotal,
    discount: couponDiscount,
    shipping,
    total,
    couponCode,
    couponDiscount,
    couponScope,
    loyaltyPointsUsed: 0,
    loyaltyDiscount: 0,
    itemCount: cartItems.reduce((sum, i) => sum + i.quantity, 0),
  };
}

router.get("/cart", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req as Parameters<typeof getSessionId>[0]);
  const cart = await buildCart(sessionId);
  res.json(cart);
});

router.post("/cart/items", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req as Parameters<typeof getSessionId>[0]);
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
    await db.update(cartItemsTable).set({ quantity: existing.quantity + quantity }).where(eq(cartItemsTable.id, existing.id));
  } else {
    await db.insert(cartItemsTable).values({ sessionId, productId, quantity, price: effectivePrice });
  }
  const cart = await buildCart(sessionId);
  res.json(cart);
});

router.patch("/cart/items/:productId", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req as Parameters<typeof getSessionId>[0]);
  const raw = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const productId = parseInt(raw, 10);
  const { quantity } = req.body;
  if (quantity <= 0) {
    await db.delete(cartItemsTable).where(and(eq(cartItemsTable.sessionId, sessionId), eq(cartItemsTable.productId, productId)));
  } else {
    await db.update(cartItemsTable).set({ quantity }).where(and(eq(cartItemsTable.sessionId, sessionId), eq(cartItemsTable.productId, productId)));
  }
  const cart = await buildCart(sessionId);
  res.json(cart);
});

router.delete("/cart/items/:productId", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req as Parameters<typeof getSessionId>[0]);
  const raw = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const productId = parseInt(raw, 10);
  await db.delete(cartItemsTable).where(and(eq(cartItemsTable.sessionId, sessionId), eq(cartItemsTable.productId, productId)));
  const cart = await buildCart(sessionId);
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

  await db.insert(cartCouponsTable).values({ sessionId, couponCode: upperCode })
    .onConflictDoUpdate({ target: cartCouponsTable.sessionId, set: { couponCode: upperCode } });

  const cart = await buildCart(sessionId);
  res.json(cart);
});

router.delete("/cart/coupon", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req as Parameters<typeof getSessionId>[0]);
  await db.delete(cartCouponsTable).where(eq(cartCouponsTable.sessionId, sessionId));
  const cart = await buildCart(sessionId);
  res.json(cart);
});

router.delete("/cart/clear", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req as Parameters<typeof getSessionId>[0]);
  await db.delete(cartItemsTable).where(eq(cartItemsTable.sessionId, sessionId));
  await db.delete(cartCouponsTable).where(eq(cartCouponsTable.sessionId, sessionId));
  const cart = await buildCart(sessionId);
  res.json(cart);
});

export { buildCart, getSessionId };
export default router;
