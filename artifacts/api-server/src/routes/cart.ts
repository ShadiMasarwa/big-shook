import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, cartItemsTable, cartCouponsTable, productsTable, couponsTable } from "@workspace/db";

const router: IRouter = Router();

function getSessionId(req: { headers: Record<string, string | string[] | undefined>; ip?: string }): string {
  const sessionHeader = req.headers["x-session-id"];
  return (Array.isArray(sessionHeader) ? sessionHeader[0] : sessionHeader) ?? "default-session";
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
  }).filter(i => i.product !== null);

  const subtotal = cartItems.reduce((sum, i) => sum + i.subtotal, 0);
  let couponDiscount = 0;
  let couponCode: string | null = null;

  if (couponRow) {
    const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, couponRow.couponCode));
    if (coupon && coupon.isActive) {
      couponCode = coupon.code;
      if (coupon.type === "percentage") {
        couponDiscount = subtotal * (parseFloat(coupon.value) / 100);
        if (coupon.maxDiscountAmount) couponDiscount = Math.min(couponDiscount, parseFloat(coupon.maxDiscountAmount));
      } else if (coupon.type === "fixed") {
        couponDiscount = Math.min(parseFloat(coupon.value), subtotal);
      }
    }
  }

  const shipping = subtotal > 200 ? 0 : 29.9;
  const total = Math.max(0, subtotal - couponDiscount + shipping);

  return {
    items: cartItems,
    subtotal,
    discount: couponDiscount,
    shipping,
    total,
    couponCode,
    couponDiscount,
    loyaltyPointsUsed: 0,
    loyaltyDiscount: 0,
    itemCount: cartItems.reduce((sum, i) => sum + i.quantity, 0),
  };
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
  const { code } = req.body;
  if (!code) {
    res.status(400).json({ error: "קוד קופון נדרש" });
    return;
  }
  const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, code));
  if (!coupon || !coupon.isActive) {
    res.status(400).json({ error: "קוד קופון לא תקין או פג תוקף" });
    return;
  }
  await db.insert(cartCouponsTable).values({ sessionId, couponCode: code })
    .onConflictDoUpdate({ target: cartCouponsTable.sessionId, set: { couponCode: code } });
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
