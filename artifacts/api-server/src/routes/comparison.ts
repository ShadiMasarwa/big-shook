import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, comparisonTable, productsTable } from "@workspace/db";

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

router.get("/comparison", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req as Parameters<typeof getSessionId>[0]);
  const entries = await db.select().from(comparisonTable).where(eq(comparisonTable.sessionId, sessionId));
  if (entries.length === 0) { res.json([]); return; }
  const productIds = entries.map(e => e.productId);
  const products = await db.select().from(productsTable).where(
    sql`${productsTable.id} = ANY(ARRAY[${sql.join(productIds.map(id => sql`${id}`), sql`, `)}]::int[])`
  );
  res.json(products.map(serializeProduct));
});

router.post("/comparison", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req as Parameters<typeof getSessionId>[0]);
  const { productId } = req.body;
  if (!productId) { res.status(400).json({ error: "productId is required" }); return; }
  const count = await db.select({ count: sql<number>`count(*)::int` }).from(comparisonTable).where(eq(comparisonTable.sessionId, sessionId));
  if (count[0].count >= 4) { res.status(400).json({ error: "ניתן להשוות עד 4 מוצרים" }); return; }
  const [existing] = await db.select().from(comparisonTable).where(and(eq(comparisonTable.sessionId, sessionId), eq(comparisonTable.productId, productId)));
  if (!existing) {
    await db.insert(comparisonTable).values({ sessionId, productId });
  }
  res.json({ success: true });
});

router.delete("/comparison", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req as Parameters<typeof getSessionId>[0]);
  await db.delete(comparisonTable).where(eq(comparisonTable.sessionId, sessionId));
  res.sendStatus(204);
});

router.delete("/comparison/:productId", async (req, res): Promise<void> => {
  const sessionId = getSessionId(req as Parameters<typeof getSessionId>[0]);
  const raw = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const productId = parseInt(raw, 10);
  await db.delete(comparisonTable).where(and(eq(comparisonTable.sessionId, sessionId), eq(comparisonTable.productId, productId)));
  res.sendStatus(204);
});

export default router;
