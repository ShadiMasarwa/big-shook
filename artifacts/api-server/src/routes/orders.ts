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
    loyaltyPointsUsedAmount: parseFloat(order.loyaltyPointsUsedAmount),
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

  const initialHistory = [{ status: "pending", changedAt: new Date().toISOString() }];
  const [order] = await db.insert(ordersTable).values({
    orderNumber, userId: userId ?? cartItems[0]?.userId ?? null, sessionId,
    subtotal: String(subtotal),
    discount: String(loyaltyDiscount),
    shipping: String(shipping),
    tax: "0",
    total: String(total),
    couponCode: couponCode ?? null,
    couponDiscount: String(couponDiscount),
    loyaltyPointsUsed, loyaltyPointsUsedAmount: loyaltyDiscount.toFixed(2), loyaltyPointsEarned,
    shippingAddress: shippingAddress ?? {}, notes: notes ?? null,
    statusHistory: initialHistory,
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
  const [current] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
  if (!current) { res.status(404).json({ error: "הזמנה לא נמצאה" }); return; }

  // ── Loyalty & spent reversal on cancel / refund ──────────────────────────
  const isNewlyCancelled =
    ["cancelled", "refunded"].includes(status) &&
    !["cancelled", "refunded"].includes(current.status) &&
    current.userId != null;

  if (isNewlyCancelled) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, current.userId!));
    if (user) {
      const orderTotal   = parseFloat(current.total);
      const pointsUsed   = current.loyaltyPointsUsed;   // used when buying → refund
      const pointsEarned = current.loyaltyPointsEarned; // earned from order → reverse
      const newSpent     = Math.max(0, parseFloat(user.totalSpent) - orderTotal);
      const newTier      = await getTierBySpent(newSpent);
      const newPoints    = Math.max(0, user.loyaltyPoints + pointsUsed - pointsEarned);

      if (pointsUsed > 0) {
        await db.insert(loyaltyTransactionsTable).values({
          userId: current.userId!, points: pointsUsed,
          type: "earned",
          reason: `זיכוי נקודות ששומשו בהזמנה #${current.orderNumber} (${status === "cancelled" ? "ביטול" : "זיכוי"})`,
          orderId: current.id,
        });
      }
      if (pointsEarned > 0) {
        await db.insert(loyaltyTransactionsTable).values({
          userId: current.userId!, points: -pointsEarned,
          type: "redeemed",
          reason: `ביטול נקודות שנצברו בהזמנה #${current.orderNumber}`,
          orderId: current.id,
        });
      }
      await db.update(usersTable).set({
        loyaltyPoints: newPoints,
        loyaltyTier: newTier,
        totalSpent: String(newSpent),
        ordersCount: Math.max(0, user.ordersCount - 1),
      }).where(eq(usersTable.id, current.userId!));
    }
  }

  const history = (Array.isArray(current.statusHistory) ? current.statusHistory : []) as { status: string; changedAt: string }[];
  const newHistory = [...history, { status, changedAt: new Date().toISOString() }];
  const updateData: Record<string, unknown> = { status, statusHistory: newHistory };
  if (notes !== undefined) updateData.notes = notes;
  const [order] = await db.update(ordersTable).set(updateData).where(eq(ordersTable.id, id)).returning();
  const items = await fetchItemsWithProductData(id);
  res.json(serializeOrder(order, items));
});

router.patch("/orders/:orderId/items/:itemId/status", async (req, res): Promise<void> => {
  const orderId = parseInt(req.params.orderId, 10);
  const itemId = parseInt(req.params.itemId, 10);
  const { itemStatus } = req.body;
  if (!itemStatus) { res.status(400).json({ error: "itemStatus נדרש" }); return; }

  const [current] = await db.select().from(orderItemsTable)
    .where(and(eq(orderItemsTable.id, itemId), eq(orderItemsTable.orderId, orderId)));
  if (!current) { res.status(404).json({ error: "פריט הזמנה לא נמצא" }); return; }

  // ── Partial loyalty & spent reversal on item cancel / refund ─────────────
  const isNewlyCancelled =
    ["cancelled", "refunded"].includes(itemStatus) &&
    !["cancelled", "refunded"].includes(current.itemStatus);

  if (isNewlyCancelled) {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    if (order && order.userId) {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, order.userId));
      if (user) {
        const itemSubtotal  = parseFloat(current.subtotal);
        const orderSubtotal = parseFloat(order.subtotal);
        const orderTotal    = parseFloat(order.total);

        // Proportion of this item relative to the pre-discount subtotal
        const proportion = orderSubtotal > 0 ? itemSubtotal / orderSubtotal : 0;

        // Actual amount this item contributed to the paid total (post-discount)
        const itemPaidValue = proportion * orderTotal;

        // Proportional loyalty points to reverse
        const pointsUsedRefund   = Math.round(order.loyaltyPointsUsed   * proportion);
        const pointsEarnedRevert = Math.round(order.loyaltyPointsEarned * proportion);

        const newPoints = Math.max(0, user.loyaltyPoints + pointsUsedRefund - pointsEarnedRevert);
        const newSpent  = Math.max(0, parseFloat(user.totalSpent) - itemPaidValue);
        const newTier   = await getTierBySpent(newSpent);

        if (pointsUsedRefund > 0) {
          await db.insert(loyaltyTransactionsTable).values({
            userId: order.userId, points: pointsUsedRefund,
            type: "earned",
            reason: `זיכוי נקודות ששומשו עבור פריט #${itemId} בהזמנה #${order.orderNumber}`,
            orderId: order.id,
          });
        }
        if (pointsEarnedRevert > 0) {
          await db.insert(loyaltyTransactionsTable).values({
            userId: order.userId, points: -pointsEarnedRevert,
            type: "redeemed",
            reason: `ביטול נקודות שנצברו עבור פריט #${itemId} בהזמנה #${order.orderNumber}`,
            orderId: order.id,
          });
        }
        await db.update(usersTable).set({
          loyaltyPoints: newPoints,
          loyaltyTier: newTier,
          totalSpent: String(newSpent),
        }).where(eq(usersTable.id, order.userId));
      }
    }
  }

  const history = (Array.isArray(current.itemStatusHistory) ? current.itemStatusHistory : []) as { status: string; changedAt: string }[];
  const newHistory = [...history, { status: itemStatus, changedAt: new Date().toISOString() }];
  const [item] = await db.update(orderItemsTable)
    .set({ itemStatus, itemStatusHistory: newHistory })
    .where(and(eq(orderItemsTable.id, itemId), eq(orderItemsTable.orderId, orderId)))
    .returning();
  res.json({ ...item, price: parseFloat(item.price), subtotal: parseFloat(item.subtotal), createdAt: item.createdAt.toISOString() });
});

export default router;
