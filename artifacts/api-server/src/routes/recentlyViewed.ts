import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import { db, recentlyViewedTable, productsTable } from "@workspace/db";

const router: IRouter = Router();

function getSessionId(req: { headers: Record<string, string | string[] | undefined> }): string {
  const h = req.headers["x-session-id"];
  return (Array.isArray(h) ? h[0] : h) ?? "default-session";
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

router.get("/recently-viewed", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req as Parameters<typeof getSessionId>[0]);
  const limit = parseInt(String(req.query.limit ?? "10"), 10);
  const entries = await db.select().from(recentlyViewedTable)
    .where(eq(recentlyViewedTable.sessionId, sessionId))
    .orderBy(desc(recentlyViewedTable.viewedAt))
    .limit(limit);
  if (entries.length === 0) { res.json([]); return; }
  const productIds = [...new Set(entries.map(e => e.productId))];
  const products = await db.select().from(productsTable).where(
    sql`${productsTable.id} = ANY(ARRAY[${sql.join(productIds.map(id => sql`${id}`), sql`, `)}]::int[])`
  );
  const productMap = new Map(products.map(p => [p.id, p]));
  const seen = new Set<number>();
  const result = entries
    .map(e => productMap.get(e.productId))
    .filter((p): p is typeof productsTable.$inferSelect => {
      if (!p || seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    })
    .map(serializeProduct);
  res.json(result);
});

router.post("/recently-viewed", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req as Parameters<typeof getSessionId>[0]);
  const { productId } = req.body;
  if (!productId) { res.status(400).json({ error: "productId is required" }); return; }
  await db.insert(recentlyViewedTable).values({ sessionId, productId });
  await db.update(productsTable)
    .set({ viewsCount: sql`${productsTable.viewsCount} + 1` })
    .where(eq(productsTable.id, productId));
  // Keep only last 20
  const entries = await db.select().from(recentlyViewedTable)
    .where(eq(recentlyViewedTable.sessionId, sessionId))
    .orderBy(desc(recentlyViewedTable.viewedAt));
  if (entries.length > 20) {
    const toDelete = entries.slice(20).map(e => e.id);
    await db.delete(recentlyViewedTable).where(
      sql`${recentlyViewedTable.id} = ANY(ARRAY[${sql.join(toDelete.map(id => sql`${id}`), sql`, `)}]::int[])`
    );
  }
  res.json({ success: true });
});

export default router;
