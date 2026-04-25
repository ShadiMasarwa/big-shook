import { Router, type IRouter } from "express";
import { eq, and, desc, isNotNull } from "drizzle-orm";
import {
  db,
  productReviewsTable,
  ordersTable,
  orderItemsTable,
  usersTable,
} from "@workspace/db";
import { verifyCustomerToken } from "../lib/managerAuth.js";

const router: IRouter = Router();

function getUserId(req: { headers: Record<string, string | string[] | undefined> }): number | null {
  const auth = req.headers["authorization"];
  if (!auth) return null;
  try {
    const token = Array.isArray(auth) ? auth[0] : auth;
    const base64 = token.replace(/^Bearer\s+/i, "");
    return verifyCustomerToken(base64);
  } catch {
    return null;
  }
}

// GET /api/reviews/product/:productId — public list of reviews with comments
router.get("/reviews/product/:productId", async (req, res) => {
  const productId = parseInt(req.params.productId, 10);
  if (!productId) return res.status(400).json({ error: "מזהה מוצר לא תקין" });

  const rows = await db
    .select({
      id: productReviewsTable.id,
      rating: productReviewsTable.rating,
      comment: productReviewsTable.comment,
      createdAt: productReviewsTable.createdAt,
      firstName: usersTable.firstName,
      lastName: usersTable.lastName,
    })
    .from(productReviewsTable)
    .innerJoin(usersTable, eq(usersTable.id, productReviewsTable.userId))
    .where(
      and(
        eq(productReviewsTable.productId, productId),
        isNotNull(productReviewsTable.comment),
      ),
    )
    .orderBy(desc(productReviewsTable.createdAt));

  const reviews = rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt,
    reviewerName: `${r.firstName} ${r.lastName.charAt(0)}.`,
  }));

  return res.json(reviews);
});

// GET /api/reviews/order/:orderId — fetch all reviews for an order (auth required)
router.get("/reviews/order/:orderId", async (req, res) => {
  const userId = getUserId(req as any);
  if (!userId) return res.status(401).json({ error: "נדרשת התחברות" });

  const orderId = parseInt(req.params.orderId, 10);
  if (!orderId) return res.status(400).json({ error: "מזהה הזמנה לא תקין" });

  const order = await db
    .select({ id: ordersTable.id, userId: ordersTable.userId })
    .from(ordersTable)
    .where(eq(ordersTable.id, orderId))
    .limit(1);

  if (!order.length || order[0].userId !== userId) {
    return res.status(404).json({ error: "הזמנה לא נמצאה" });
  }

  const reviews = await db
    .select()
    .from(productReviewsTable)
    .where(
      and(
        eq(productReviewsTable.userId, userId),
        eq(productReviewsTable.orderId, orderId),
      ),
    );

  return res.json(reviews);
});

// POST /api/reviews — submit a rating (auth required, order must be delivered)
router.post("/reviews", async (req, res) => {
  const userId = getUserId(req as any);
  if (!userId) return res.status(401).json({ error: "נדרשת התחברות" });

  const { orderItemId, rating, comment } = req.body ?? {};

  if (!orderItemId || typeof rating !== "number" || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "נתונים לא תקינים" });
  }

  // Verify the order item belongs to a delivered order owned by this user
  const items = await db
    .select({
      itemId: orderItemsTable.id,
      productId: orderItemsTable.productId,
      orderId: orderItemsTable.orderId,
      orderStatus: ordersTable.status,
      orderUserId: ordersTable.userId,
    })
    .from(orderItemsTable)
    .innerJoin(ordersTable, eq(ordersTable.id, orderItemsTable.orderId))
    .where(eq(orderItemsTable.id, orderItemId))
    .limit(1);

  if (!items.length) return res.status(404).json({ error: "פריט לא נמצא" });

  const item = items[0];
  if (item.orderUserId !== userId) return res.status(403).json({ error: "אין הרשאה" });
  if (item.orderStatus !== "delivered") {
    return res.status(400).json({ error: "ניתן לדרג רק הזמנות שנמסרו" });
  }

  // Upsert: update if already exists (same userId + orderItemId)
  const existing = await db
    .select({ id: productReviewsTable.id })
    .from(productReviewsTable)
    .where(
      and(
        eq(productReviewsTable.userId, userId),
        eq(productReviewsTable.orderItemId, orderItemId),
      ),
    )
    .limit(1);

  if (existing.length) {
    const [updated] = await db
      .update(productReviewsTable)
      .set({ rating, comment: comment || null })
      .where(eq(productReviewsTable.id, existing[0].id))
      .returning();
    return res.json(updated);
  }

  const [review] = await db
    .insert(productReviewsTable)
    .values({
      userId,
      productId: item.productId,
      orderId: item.orderId,
      orderItemId,
      rating,
      comment: comment || null,
    })
    .returning();

  return res.status(201).json(review);
});

export default router;
