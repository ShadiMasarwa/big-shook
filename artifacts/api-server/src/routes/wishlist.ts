import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, wishlistTable, productsTable } from "@workspace/db";

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

router.get("/wishlist", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req as Parameters<typeof getSessionId>[0]);
  const entries = await db.select().from(wishlistTable).where(eq(wishlistTable.sessionId, sessionId));
  if (entries.length === 0) { res.json([]); return; }
  const productIds = entries.map(e => e.productId);
  const products = await db.select().from(productsTable).where(
    sql`${productsTable.id} = ANY(ARRAY[${sql.join(productIds.map(id => sql`${id}`), sql`, `)}]::int[])`
  );
  const productMap = new Map(products.map(p => [p.id, p]));
  const result = entries.map(e => {
    const p = productMap.get(e.productId);
    if (!p) return null;
    return { id: e.id, productId: e.productId, product: serializeProduct(p), addedAt: e.addedAt.toISOString() };
  }).filter(Boolean);
  res.json(result);
});

router.post("/wishlist", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req as Parameters<typeof getSessionId>[0]);
  const { productId } = req.body;
  if (!productId) { res.status(400).json({ error: "productId is required" }); return; }
  const [existing] = await db.select().from(wishlistTable).where(and(eq(wishlistTable.sessionId, sessionId), eq(wishlistTable.productId, productId)));
  if (existing) { res.json(existing); return; }
  const [entry] = await db.insert(wishlistTable).values({ sessionId, productId }).returning();
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  res.json({ id: entry.id, productId: entry.productId, product: product ? serializeProduct(product) : null, addedAt: entry.addedAt.toISOString() });
});

router.delete("/wishlist/:productId", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req as Parameters<typeof getSessionId>[0]);
  const raw = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const productId = parseInt(raw, 10);
  await db.delete(wishlistTable).where(and(eq(wishlistTable.sessionId, sessionId), eq(wishlistTable.productId, productId)));
  res.sendStatus(204);
});

export default router;
