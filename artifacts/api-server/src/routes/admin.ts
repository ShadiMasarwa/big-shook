import { Router, type IRouter } from "express";
import { sql, eq, gte, lte } from "drizzle-orm";
import { db, ordersTable, usersTable, productsTable, couponsTable, inventoryTable, loyaltyTransactionsTable } from "@workspace/db";
import { requireAdminOrManager } from "../lib/managerAuth.js";

const router: IRouter = Router();

function serializeProduct(p: typeof productsTable.$inferSelect) {
  return {
    ...p, price: parseFloat(p.price), salePrice: p.salePrice ? parseFloat(p.salePrice) : null,
    costPrice: p.costPrice ? parseFloat(p.costPrice) : null, ratingAverage: parseFloat(p.ratingAverage),
    weight: p.weight ? parseFloat(p.weight) : null, createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(), images: p.images ?? [], tags: p.tags ?? [], specs: p.specs ?? {},
  };
}

router.get("/admin/summary", async (req, res): Promise<void> => {
  if (!await requireAdminOrManager(req, res)) return;
  const now = new Date();

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  weekAgo.setHours(0, 0, 0, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todayRevRow] = await db.select({ revenue: sql<number>`coalesce(sum(total::numeric), 0)` }).from(ordersTable).where(sql`created_at >= ${today}`);
  const [todayOrdRow] = await db.select({ count: sql<number>`count(*)::int` }).from(ordersTable).where(sql`created_at >= ${today}`);

  const [weekRevRow] = await db.select({ revenue: sql<number>`coalesce(sum(total::numeric), 0)` }).from(ordersTable).where(gte(ordersTable.createdAt, weekAgo));
  const [weekOrdRow] = await db.select({ count: sql<number>`count(*)::int` }).from(ordersTable).where(gte(ordersTable.createdAt, weekAgo));

  const [monthRevRow] = await db.select({ revenue: sql<number>`coalesce(sum(total::numeric), 0)` }).from(ordersTable).where(gte(ordersTable.createdAt, monthStart));
  const [monthOrdRow] = await db.select({ count: sql<number>`count(*)::int` }).from(ordersTable).where(gte(ordersTable.createdAt, monthStart));

  const [totalProductsRow] = await db.select({ count: sql<number>`count(*)::int` }).from(productsTable).where(eq(productsTable.isActive, true));
  const [totalCustomersRow] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
  const [pendingOrdersRow] = await db.select({ count: sql<number>`count(*)::int` }).from(ordersTable).where(eq(ordersTable.status, "pending"));
  const [lowStockRow] = await db.select({ count: sql<number>`count(*)::int` }).from(productsTable).where(lte(productsTable.stockQuantity, 10));

  const couponFields = {
    id: couponsTable.id,
    code: couponsTable.code,
    type: couponsTable.type,
    value: couponsTable.value,
    usedCount: couponsTable.usedCount,
    usageLimit: couponsTable.usageLimit,
    expiresAt: couponsTable.expiresAt,
  };

  const activeCouponsList = await db
    .select(couponFields)
    .from(couponsTable)
    .where(eq(couponsTable.isActive, true))
    .orderBy(couponsTable.code);

  const inactiveCouponsList = await db
    .select(couponFields)
    .from(couponsTable)
    .where(eq(couponsTable.isActive, false))
    .orderBy(couponsTable.code);

  const [balanceRow]  = await db.select({
    total: sql<number>`coalesce(sum(loyalty_points), 0)`,
  }).from(usersTable);

  const [redeemedRow] = await db.select({
    total: sql<number>`coalesce(abs(sum(points) filter (where points < 0)), 0)`,
  }).from(loyaltyTransactionsTable);

  const currentBalance = Math.round(Number(balanceRow.total)  || 0);
  const totalRedeemed  = Math.round(Number(redeemedRow.total) || 0);
  const totalEarned    = currentBalance + totalRedeemed;

  res.json({
    todayRevenue: parseFloat(String(todayRevRow.revenue)) || 0,
    todayOrders: todayOrdRow.count || 0,
    weekRevenue: parseFloat(String(weekRevRow.revenue)) || 0,
    weekOrders: weekOrdRow.count || 0,
    monthRevenue: parseFloat(String(monthRevRow.revenue)) || 0,
    monthOrders: monthOrdRow.count || 0,
    totalProducts: totalProductsRow.count,
    totalCustomers: totalCustomersRow.count,
    pendingOrders: pendingOrdersRow.count,
    lowStockProducts: lowStockRow.count,
    activeCoupons: activeCouponsList.length,
    activeCouponsList: activeCouponsList.map(c => ({
      id: c.id,
      code: c.code,
      type: c.type,
      value: parseFloat(String(c.value)),
      usageCount: c.usedCount ?? 0,
      usageLimit: c.usageLimit ?? null,
      expiresAt: c.expiresAt?.toISOString() ?? null,
    })),
    inactiveCouponsList: inactiveCouponsList.map(c => ({
      id: c.id,
      code: c.code,
      type: c.type,
      value: parseFloat(String(c.value)),
      usageCount: c.usedCount ?? 0,
      usageLimit: c.usageLimit ?? null,
      expiresAt: c.expiresAt?.toISOString() ?? null,
    })),
    totalLoyaltyPoints: currentBalance,
    totalLoyaltyPointsEarned: totalEarned,
    totalLoyaltyPointsRedeemed: totalRedeemed,
  });
});

router.post("/admin/import/products", async (req, res): Promise<void> => {
  if (!await requireAdminOrManager(req, res)) return;
  const { products } = req.body;
  if (!products || !Array.isArray(products)) {
    res.status(400).json({ error: "products array is required" });
    return;
  }
  let imported = 0;
  const errors: string[] = [];
  for (const p of products) {
    if (!p.nameHe || !p.slug || p.price === undefined) {
      errors.push(`Missing required fields for product: ${p.nameHe ?? "unknown"}`);
      continue;
    }
    try {
      await db.insert(productsTable).values({
        nameHe: p.nameHe, nameEn: p.nameEn ?? null, slug: p.slug,
        descriptionHe: p.descriptionHe ?? null, sku: p.sku ?? null,
        price: String(p.price), salePrice: p.salePrice != null ? String(p.salePrice) : null,
        costPrice: p.costPrice != null ? String(p.costPrice) : null,
        categoryId: p.categoryId ?? null, brandId: p.brandId ?? null,
        images: p.images ?? [], tags: p.tags ?? [], specs: p.specs ?? {},
        stockQuantity: p.stockQuantity ?? 0, isActive: p.isActive ?? true,
        isFeatured: p.isFeatured ?? false,
      });
      imported++;
    } catch (e) {
      errors.push(`Failed to import ${p.nameHe}: ${String(e)}`);
    }
  }
  res.json({ imported, failed: errors.length, errors });
});

router.get("/admin/export/products", async (req, res): Promise<void> => {
  if (!await requireAdminOrManager(req, res)) return;
  const products = await db.select().from(productsTable);
  res.json(products.map(serializeProduct));
});

router.get("/admin/export/orders", async (req, res): Promise<void> => {
  if (!await requireAdminOrManager(req, res)) return;
  const orders = await db.select().from(ordersTable);
  res.json(orders.map(o => ({
    ...o,
    subtotal: parseFloat(o.subtotal), discount: parseFloat(o.discount),
    shipping: parseFloat(o.shipping), tax: parseFloat(o.tax), total: parseFloat(o.total),
    couponDiscount: parseFloat(o.couponDiscount),
    createdAt: o.createdAt.toISOString(), updatedAt: o.updatedAt.toISOString(),
    items: [],
  })));
});

export default router;
