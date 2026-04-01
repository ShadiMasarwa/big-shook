import { Router, type IRouter } from "express";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, cartItemsTable, cartCouponsTable, productsTable, usersTable, loyaltyTransactionsTable } from "@workspace/db";
import { getSessionId } from "./cart.js";

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

function serializeOrder(order: typeof ordersTable.$inferSelect, items: any[]) {
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
  const orders = await db.select().from(ordersTable).where(whereClause).orderBy(desc(ordersTable.createdAt)).limit(limit).offset(offset);

  const result = await Promise.all(orders.map(async (order) => {
    const items = await fetchItemsWithProductData(order.id);
    return serializeOrder(order, items);
  }));

  res.json({ orders: result, total: count, page, limit, totalPages: Math.ceil(count / limit) });
});

router.post("/orders", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req as Parameters<typeof getSessionId>[0]);
  const { shippingAddress, notes, loyaltyPointsToUse } = req.body;
  if (!shippingAddress) {
    res.status(400).json({ error: "כתובת משלוח נדרשת" });
    return;
  }

  const cartItems = await db.select().from(cartItemsTable).where(eq(cartItemsTable.sessionId, sessionId));
  if (cartItems.length === 0) {
    res.status(400).json({ error: "עגלת הקניות ריקה" });
    return;
  }

  const productIds = cartItems.map(i => i.productId);
  const products = await db.select().from(productsTable).where(
    sql`${productsTable.id} = ANY(ARRAY[${sql.join(productIds.map(id => sql`${id}`), sql`, `)}]::int[])`
  );
  const productMap = new Map(products.map(p => [p.id, p]));

  const subtotal = cartItems.reduce((sum, item) => {
    const p = productMap.get(item.productId);
    if (!p) return sum;
    const price = parseFloat(p.salePrice ?? p.price);
    return sum + price * item.quantity;
  }, 0);

  const [couponRow] = await db.select().from(cartCouponsTable).where(eq(cartCouponsTable.sessionId, sessionId));
  let couponDiscount = 0;
  let couponCode: string | null = null;

  const shipping = subtotal > 200 ? 0 : 29.9;
  const tax = 0;
  const total = Math.max(0, subtotal - couponDiscount + shipping + tax);

  const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

  const [order] = await db.insert(ordersTable).values({
    orderNumber, userId: cartItems[0].userId ?? null, sessionId,
    subtotal: String(subtotal), discount: "0", shipping: String(shipping),
    tax: "0", total: String(total),
    couponCode, couponDiscount: String(couponDiscount),
    loyaltyPointsUsed: loyaltyPointsToUse ?? 0, loyaltyPointsEarned: Math.floor(subtotal),
    shippingAddress: shippingAddress ?? {}, notes: notes ?? null,
  }).returning();

  const orderItems = await Promise.all(cartItems.map(async (item) => {
    const p = productMap.get(item.productId);
    if (!p) return null;
    const price = parseFloat(p.salePrice ?? p.price);
    const [oi] = await db.insert(orderItemsTable).values({
      orderId: order.id, productId: item.productId,
      productName: p.nameHe, productSku: p.sku ?? null,
      quantity: item.quantity, price: String(price),
      subtotal: String(price * item.quantity),
      itemStatus: "pending",
    }).returning();
    return oi;
  }));

  await Promise.all(cartItems.map(item => {
    const p = productMap.get(item.productId);
    if (!p) return Promise.resolve();
    return db.update(productsTable).set({ salesCount: p.salesCount + item.quantity }).where(eq(productsTable.id, item.productId));
  }));

  await db.delete(cartItemsTable).where(eq(cartItemsTable.sessionId, sessionId));
  await db.delete(cartCouponsTable).where(eq(cartCouponsTable.sessionId, sessionId));

  if (order.userId) {
    await db.insert(loyaltyTransactionsTable).values({
      userId: order.userId, points: order.loyaltyPointsEarned,
      type: "earned", reason: `הזמנה #${orderNumber}`, orderId: order.id,
    });
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, order.userId));
    if (user) {
      const newPoints = user.loyaltyPoints + order.loyaltyPointsEarned;
      const newSpent = parseFloat(user.totalSpent) + total;
      const tier = newPoints >= 5000 ? "vip" : newPoints >= 2000 ? "gold" : newPoints >= 500 ? "silver" : "bronze";
      await db.update(usersTable).set({
        loyaltyPoints: newPoints, loyaltyTier: tier,
        totalSpent: String(newSpent), ordersCount: user.ordersCount + 1,
      }).where(eq(usersTable.id, order.userId));
    }
  }

  const serializedItems = await fetchItemsWithProductData(order.id);
  res.status(201).json(serializeOrder(order, serializedItems));
});

router.get("/orders/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!order) {
    res.status(404).json({ error: "הזמנה לא נמצאה" });
    return;
  }
  const items = await fetchItemsWithProductData(id);
  res.json(serializeOrder(order, items));
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
