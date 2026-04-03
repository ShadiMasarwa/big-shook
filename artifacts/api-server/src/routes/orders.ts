import { Router, type IRouter } from "express";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, cartItemsTable, cartCouponsTable, productsTable, usersTable, loyaltyTransactionsTable, couponsTable, couponUsagesTable } from "@workspace/db";
import { getSessionId, getUserId, buildCart } from "./cart.js";
import { getTierBySpent } from "./loyalty.js";

const router: IRouter = Router();

async function fetchItemsWithProductData(orderId: number) {
  const rawItems = await db.select().from(orderItemsTable).where(eq(orderItemsTable.orderId, orderId));
  if (rawItems.length === 0) return [];
  const productIds = [...new Set(rawItems.map(i => i.productId))];
  const products = await db.select({ id: productsTable.id, images: productsTable.images, slug: productsTable.slug })
    .from(productsTable).where(inArray(productsTable.id, productIds));
  const productMap = new Map(products.map(p => [p.id, p]));
  return rawItems.map(i => ({
    ...i,
    price: parseFloat(i.price),
    subtotal: parseFloat(i.subtotal),
    createdAt: i.createdAt.toISOString(),
    productImages: productMap.get(i.productId)?.images ?? [],
    productSlug: productMap.get(i.productId)?.slug ?? null,
  }));
}

function serializeOrder(order: typeof ordersTable.$inferSelect, items: any[], customerName?: string | null) {
  return {
    ...order,
    subtotal: parseFloat(order.subtotal),
    discount: parseFloat(order.discount),
    shipping: parseFloat(order.shipping),
    tax: parseFloat(order.tax),
    total: parseFloat(order.total),
    couponDiscount: parseFloat(order.couponDiscount),
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    customerName: customerName ?? null,
    items,
  };
}

router.get("/orders", async (req, res): Promise<void> => {
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = parseInt(String(req.query.limit ?? "20"), 10);
  const offset = (page - 1) * limit;

  const conditions: ReturnType<typeof eq>[] = [];
  if (req.query.userId) conditions.push(eq(ordersTable.userId, parseInt(String(req.query.userId), 10)));
  if (req.query.status) conditions.push(eq(ordersTable.status, req.query.status as string));

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(ordersTable).where(whereClause);
  const rows = await db
    .select({ order: ordersTable, firstName: usersTable.firstName, lastName: usersTable.lastName })
    .from(ordersTable)
    .leftJoin(usersTable, eq(ordersTable.userId, usersTable.id))
    .where(whereClause)
    .orderBy(desc(ordersTable.createdAt))
    .limit(limit)
    .offset(offset);

  const result = await Promise.all(rows.map(async (row) => {
    const items = await fetchItemsWithProductData(row.order.id);
    const customerName = (row.firstName || row.lastName)
      ? `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim()
      : null;
    return serializeOrder(row.order, items, customerName);
  }));

  res.json({ orders: result, total: count, page, limit, totalPages: Math.ceil(count / limit) });
});

router.post("/orders", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req as Parameters<typeof getSessionId>[0]);
  const userId = getUserId(req as Parameters<typeof getUserId>[0]);
  const { shippingAddress, notes, loyaltyPointsToUse } = req.body;
  if (!shippingAddress) {
    res.status(400).json({ error: "כתובת משלוח נדרשת" });
    return;
  }

  // Use buildCart to get the authoritative totals (coupon + loyalty already calculated)
  const cart = await buildCart(sessionId, userId);
  if (cart.items.length === 0) {
    res.status(400).json({ error: "עגלת הקניות ריקה" });
    return;
  }

  const cartItems = await db.select().from(cartItemsTable).where(eq(cartItemsTable.sessionId, sessionId));

  const { subtotal, shipping, total, couponCode, couponDiscount, loyaltyPointsUsed, loyaltyDiscount, appliedCoupons } = cart as any;
  // Points earned are based on the final amount paid (after all discounts)
  const loyaltyPointsEarned = Math.floor(total);

  const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

  const [order] = await db.insert(ordersTable).values({
    orderNumber, userId: userId ?? cartItems[0]?.userId ?? null, sessionId,
    subtotal: String(subtotal),
    discount: String(loyaltyDiscount),
    shipping: String(shipping),
    tax: "0",
    total: String(total),
    couponCode: couponCode ?? null,
    couponDiscount: String(couponDiscount),
    loyaltyPointsUsed, loyaltyPointsEarned,
    shippingAddress: shippingAddress ?? {}, notes: notes ?? null,
  }).returning();

  // Insert order items
  const productIds = cartItems.map(i => i.productId);
  const products = productIds.length > 0
    ? await db.select().from(productsTable).where(
        sql`${productsTable.id} = ANY(ARRAY[${sql.join(productIds.map(id => sql`${id}`), sql`, `)}]::int[])`
      )
    : [];
  const productMap = new Map(products.map(p => [p.id, p]));

  await Promise.all(cartItems.map(async (item) => {
    const p = productMap.get(item.productId);
    if (!p) return;
    const price = parseFloat(p.salePrice ?? p.price);
    await db.insert(orderItemsTable).values({
      orderId: order.id, productId: item.productId,
      productName: p.nameHe, productSku: p.sku ?? null,
      quantity: item.quantity, price: String(price),
      subtotal: String(price * item.quantity),
      itemStatus: "pending",
    });
  }));

  // Update product sales counts
  await Promise.all(cartItems.map(item => {
    const p = productMap.get(item.productId);
    if (!p) return Promise.resolve();
    return db.update(productsTable).set({ salesCount: p.salesCount + item.quantity }).where(eq(productsTable.id, item.productId));
  }));

  // Clear cart
  await db.delete(cartItemsTable).where(eq(cartItemsTable.sessionId, sessionId));
  await db.delete(cartCouponsTable).where(eq(cartCouponsTable.sessionId, sessionId));

  // Loyalty: record earned, deduct used, update user balance; detect tier upgrade
  let tierUpgrade: { from: string; to: string } | null = null;
  if (order.userId) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, order.userId));
    if (user) {
      // Record points earned
      if (loyaltyPointsEarned > 0) {
        await db.insert(loyaltyTransactionsTable).values({
          userId: order.userId, points: loyaltyPointsEarned,
          type: "earned", reason: `הזמנה #${orderNumber}`, orderId: order.id,
        });
      }
      // Record points redeemed (as negative)
      if (loyaltyPointsUsed > 0) {
        await db.insert(loyaltyTransactionsTable).values({
          userId: order.userId, points: -loyaltyPointsUsed,
          type: "redeemed", reason: `מימוש נקודות בהזמנה #${orderNumber}`, orderId: order.id,
        });
      }
      const netPoints = user.loyaltyPoints + loyaltyPointsEarned - loyaltyPointsUsed;
      const newPoints = Math.max(0, netPoints);
      const newSpent = parseFloat(user.totalSpent) + total;
      const oldTier = await getTierBySpent(parseFloat(user.totalSpent));
      const newTier = await getTierBySpent(newSpent);
      tierUpgrade = oldTier !== newTier ? { from: oldTier, to: newTier } : null;
      await db.update(usersTable).set({
        loyaltyPoints: newPoints, loyaltyTier: newTier,
        totalSpent: String(newSpent), ordersCount: user.ordersCount + 1,
      }).where(eq(usersTable.id, order.userId));
    }
  }

  // Record coupon usage for each applied coupon
  const couponsToRecord: string[] = Array.isArray(appliedCoupons) && appliedCoupons.length > 0
    ? appliedCoupons.map((c: any) => c.code)
    : couponCode ? couponCode.split(", ").map((c: string) => c.trim()).filter(Boolean) : [];
  for (const code of couponsToRecord) {
    const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, code));
    if (coupon) {
      await db.update(couponsTable).set({ usedCount: coupon.usedCount + 1 }).where(eq(couponsTable.id, coupon.id));
      await db.insert(couponUsagesTable).values({ couponId: coupon.id, userId: order.userId ?? null, orderId: order.id });
    }
  }

  const serializedItems = await fetchItemsWithProductData(order.id);
  res.status(201).json({ ...serializeOrder(order, serializedItems), tierUpgrade });
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [row] = await db
    .select({ order: ordersTable, firstName: usersTable.firstName, lastName: usersTable.lastName })
    .from(ordersTable)
    .leftJoin(usersTable, eq(ordersTable.userId, usersTable.id))
    .where(eq(ordersTable.id, id));
  if (!row) {
    res.status(404).json({ error: "הזמנה לא נמצאה" });
    return;
  }
  const items = await fetchItemsWithProductData(id);
  const customerName = (row.firstName || row.lastName)
    ? `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim()
    : null;
  res.json(serializeOrder(row.order, items, customerName));
});

router.patch("/orders/:id/status", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { status, notes } = req.body;
  const updateData: Record<string, unknown> = { status };
  if (notes !== undefined) updateData.notes = notes;
  const [order] = await db.update(ordersTable).set(updateData).where(eq(ordersTable.id, id)).returning();
  if (!order) {
    res.status(404).json({ error: "הזמנה לא נמצאה" });
    return;
  }
  const items = await fetchItemsWithProductData(id);
  res.json(serializeOrder(order, items));
});

router.patch("/orders/:orderId/items/:itemId/status", async (req, res): Promise<void> => {
  const orderId = parseInt(req.params.orderId, 10);
  const itemId = parseInt(req.params.itemId, 10);
  const { itemStatus } = req.body;
  if (!itemStatus) {
    res.status(400).json({ error: "itemStatus נדרש" });
    return;
  }
  const [item] = await db.update(orderItemsTable)
    .set({ itemStatus })
    .where(and(eq(orderItemsTable.id, itemId), eq(orderItemsTable.orderId, orderId)))
    .returning();
  if (!item) {
    res.status(404).json({ error: "פריט הזמנה לא נמצא" });
    return;
  }
  res.json({ ...item, price: parseFloat(item.price), subtotal: parseFloat(item.subtotal), createdAt: item.createdAt.toISOString() });
});

export default router;
