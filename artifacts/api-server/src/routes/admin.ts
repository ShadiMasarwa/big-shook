import { Router, type IRouter } from "express";
import { sql, eq } from "drizzle-orm";
import { db, ordersTable, usersTable, productsTable, couponsTable, inventoryTable, loyaltyTransactionsTable } from "@workspace/db";

const router: IRouter = Router();

function serializeProduct(p: typeof productsTable.$inferSelect) {
  return {
    ...p, price: parseFloat(p.price), salePrice: p.salePrice ? parseFloat(p.salePrice) : null,
    costPrice: p.costPrice ? parseFloat(p.costPrice) : null, ratingAverage: parseFloat(p.ratingAverage),
    weight: p.weight ? parseFloat(p.weight) : null, createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(), images: p.images ?? [], tags: p.tags ?? [], specs: p.specs ?? {},
  };
}

router.get("/admin/summary", async (_req, res): Promise<void> => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [todayRevRow] = await db.select({ revenue: sql<number>`coalesce(sum(total::numeric), 0)` }).from(ordersTable).where(sql`created_at >= ${today}`);
  const [todayOrdRow] = await db.select({ count: sql<number>`count(*)::int` }).from(ordersTable).where(sql`created_at >= ${today}`);
  const [totalProductsRow] = await db.select({ count: sql<number>`count(*)::int` }).from(productsTable).where(eq(productsTable.isActive, true));
  const [totalCustomersRow] = await db.select({ count: sql<number>`count(*)::int` }).from(usersTable);
  const [pendingOrdersRow] = await db.select({ count: sql<number>`count(*)::int` }).from(ordersTable).where(eq(ordersTable.status, "pending"));
  const [lowStockRow] = await db.select({ count: sql<number>`count(*)::int` }).from(inventoryTable).where(sql`quantity <= low_stock_threshold`);
  const [activeCouponsRow] = await db.select({ count: sql<number>`count(*)::int` }).from(couponsTable).where(eq(couponsTable.isActive, true));
  const [loyaltyRow] = await db.select({ total: sql<number>`coalesce(sum(points), 0)` }).from(loyaltyTransactionsTable).where(eq(loyaltyTransactionsTable.type, "earned"));

  res.json({
    todayRevenue: parseFloat(String(todayRevRow.revenue)) || 0,
    todayOrders: todayOrdRow.count || 0,
    totalProducts: totalProductsRow.count,
    totalCustomers: totalCustomersRow.count,
    pendingOrders: pendingOrdersRow.count,
    lowStockProducts: lowStockRow.count,
    activeCoupons: activeCouponsRow.count,
    totalLoyaltyPoints: loyaltyRow.total || 0,
  });
});

router.post("/admin/import/products", async (req, res): Promise<void> => {
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

router.get("/admin/export/products", async (_req, res): Promise<void> => {
  const products = await db.select().from(productsTable);
  res.json(products.map(serializeProduct));
});

router.get("/admin/export/orders", async (req, res): Promise<void> => {
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
