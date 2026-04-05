import { Router, type IRouter } from "express";
import { desc, sql, eq, and, gte } from "drizzle-orm";
import { db, ordersTable, orderItemsTable, usersTable, productsTable, couponsTable, inventoryTable } from "@workspace/db";

const router: IRouter = Router();

// Reusable filters — exclude cancelled / refunded at both order and item level
const ACTIVE_ORDER  = sql`${ordersTable.status}    NOT IN ('cancelled', 'refunded')`;
const ACTIVE_ITEM   = sql`${orderItemsTable.itemStatus} NOT IN ('cancelled', 'refunded')`;

function getStartDate(period: string): Date {
  const now = new Date();
  switch (period) {
    case "current-month": return new Date(now.getFullYear(), now.getMonth(), 1);
    case "3months": return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    case "year": return new Date(now.getFullYear(), now.getMonth() - 11, 1);
    default: return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
}

router.get("/analytics/dashboard", async (req, res): Promise<void> => {
  const period = (req.query.period as string) ?? "current-month";
  const startDate = getStartDate(period);

  const [totalRevenueRow] = await db.select({ revenue: sql<number>`coalesce(sum(total::numeric), 0)` }).from(ordersTable).where(and(gte(ordersTable.createdAt, startDate), ACTIVE_ORDER));
  const [totalOrdersRow] = await db.select({ count: sql<number>`count(*)::int` }).from(ordersTable).where(and(gte(ordersTable.createdAt, startDate), ACTIVE_ORDER));
  const [totalCustomersRow] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
  const [pendingOrdersRow] = await db.select({ count: sql<number>`count(*)::int` }).from(ordersTable).where(eq(ordersTable.status, "pending"));
  const [activeProductsRow] = await db.select({ count: sql<number>`count(*)::int` }).from(productsTable).where(eq(productsTable.isActive, true));
  const [activeCouponsRow] = await db.select({ count: sql<number>`count(*)::int` }).from(couponsTable).where(eq(couponsTable.isActive, true));
  const [lowStockRow] = await db.select({ count: sql<number>`count(*)::int` }).from(inventoryTable).where(sql`quantity <= low_stock_threshold`);

  const totalRevenue = parseFloat(String(totalRevenueRow.revenue)) || 0;
  const totalOrders = totalOrdersRow.count || 0;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  res.json({
    totalRevenue,
    revenueChange: 12.5,
    totalOrders,
    ordersChange: 8.2,
    totalCustomers: totalCustomersRow.count,
    customersChange: 5.1,
    averageOrderValue: avgOrderValue,
    aovChange: 3.4,
    conversionRate: 3.2,
    pendingOrders: pendingOrdersRow.count,
    lowStockProducts: lowStockRow.count,
    activeProducts: activeProductsRow.count,
    activeCoupons: activeCouponsRow.count,
  });
});

// Returns revenue, orders count, and profit (revenue − cost_price − delivery_cost) for a time bucket
async function getBucketData(start: Date, end: Date): Promise<{ revenue: number; orders: number; profit: number }> {
  const dateRange = and(gte(ordersTable.createdAt, start), sql`${ordersTable.createdAt} < ${end}`);

  const [revRow] = await db.select({
    revenue: sql<number>`coalesce(sum(total::numeric), 0)`,
    orders: sql<number>`count(*)::int`,
  }).from(ordersTable).where(and(dateRange, ACTIVE_ORDER));

  const [costsRow] = await db.select({
    costs: sql<number>`coalesce(sum(${orderItemsTable.quantity} * (coalesce(${productsTable.costPrice}::numeric, 0) + coalesce(${productsTable.deliveryCost}::numeric, 0))), 0)`,
  }).from(orderItemsTable)
    .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
    .leftJoin(productsTable, eq(orderItemsTable.productId, productsTable.id))
    .where(and(dateRange, ACTIVE_ORDER, ACTIVE_ITEM));

  const revenue = parseFloat(String(revRow.revenue)) || 0;
  const costs   = parseFloat(String(costsRow.costs))  || 0;
  return { revenue, orders: revRow.orders || 0, profit: Math.max(0, revenue - costs) };
}

router.get("/analytics/revenue", async (req, res): Promise<void> => {
  const period = (req.query.period as string) ?? "current-month";
  const now = new Date();
  const result: { date: string; revenue: number; orders: number; profit: number }[] = [];

  if (period === "year") {
    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const data = await getBucketData(start, end);
      result.push({ date: start.toISOString().split("T")[0], ...data });
    }
  } else if (period === "3months") {
    for (let i = 12; i >= 0; i--) {
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7);
      const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      const data = await getBucketData(start, end);
      result.push({ date: start.toISOString().split("T")[0], ...data });
    }
  } else {
    let startBase: Date;
    let daysToShow: number;
    if (period === "current-month") {
      startBase = new Date(now.getFullYear(), now.getMonth(), 1);
      daysToShow = now.getDate();
    } else {
      startBase = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      daysToShow = 30;
    }
    for (let i = 0; i < daysToShow; i++) {
      const start = new Date(startBase.getFullYear(), startBase.getMonth(), startBase.getDate() + i);
      const end = new Date(startBase.getFullYear(), startBase.getMonth(), startBase.getDate() + i + 1);
      const data = await getBucketData(start, end);
      result.push({ date: start.toISOString().split("T")[0], ...data });
    }
  }

  res.json(result);
});

router.get("/analytics/top-products", async (req, res): Promise<void> => {
  const limit = parseInt(String(req.query.limit ?? "10"), 10);
  const topItems = await db.select({
    productId: orderItemsTable.productId,
    productName: orderItemsTable.productName,
    revenue: sql<number>`sum(subtotal::numeric)`,
    unitsSold: sql<number>`sum(quantity)::int`,
  }).from(orderItemsTable)
    .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
    .where(and(ACTIVE_ORDER, ACTIVE_ITEM))
    .groupBy(orderItemsTable.productId, orderItemsTable.productName)
    .orderBy(desc(sql`sum(subtotal::numeric)`))
    .limit(limit);

  const result = await Promise.all(topItems.map(async (item) => {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, item.productId));
    return {
      productId: item.productId,
      productName: item.productName,
      revenue: parseFloat(String(item.revenue)) || 0,
      unitsSold: item.unitsSold || 0,
      imageUrl: product?.images?.[0] ?? null,
    };
  }));
  res.json(result);
});

router.get("/analytics/top-customers", async (req, res): Promise<void> => {
  const limit = parseInt(String(req.query.limit ?? "10"), 10);
  const users = await db.select().from(usersTable)
    .orderBy(desc(usersTable.totalSpent))
    .limit(limit);
  res.json(users.map(u => ({
    userId: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    totalSpent: parseFloat(u.totalSpent),
    ordersCount: u.ordersCount,
    loyaltyTier: u.loyaltyTier,
  })));
});

export default router;
