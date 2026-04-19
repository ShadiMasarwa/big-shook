import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, productVariationsTable, productsTable } from "@workspace/db";
import { requireManagerPrivilegeCheck } from "../lib/managerAuth.js";

const router: IRouter = Router();
const PRIV_DENIED = "אין לך הרשאה לבצע פעולה זו";

export function serializeVariation(v: typeof productVariationsTable.$inferSelect) {
  return {
    ...v,
    price: parseFloat(v.price),
    salePrice: v.salePrice ? parseFloat(v.salePrice) : null,
    costPrice: v.costPrice ? parseFloat(v.costPrice) : null,
    weight: v.weight ? parseFloat(v.weight) : null,
    attributes: (v.attributes ?? {}) as Record<string, string>,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
  };
}

router.get("/products/:productId/variations", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const productId = parseInt(raw, 10);
  if (isNaN(productId)) { res.json([]); return; }

  const rows = await db.select().from(productVariationsTable)
    .where(eq(productVariationsTable.productId, productId))
    .orderBy(asc(productVariationsTable.sortOrder), asc(productVariationsTable.id));

  res.json(rows.map(serializeVariation));
});

router.post("/products/:productId/variations", async (req, res): Promise<void> => {
  const { allowed } = await requireManagerPrivilegeCheck(req, "products", "write");
  if (!allowed) { res.status(403).json({ error: PRIV_DENIED }); return; }

  const raw = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const productId = parseInt(raw, 10);
  if (isNaN(productId)) { res.status(400).json({ error: "Invalid productId" }); return; }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  if (!product) { res.status(404).json({ error: "מוצר לא נמצא" }); return; }

  const { sku, price, salePrice, costPrice, stockQuantity, image, attributes, weight, isActive, sortOrder } = req.body;

  if (price === undefined || price === null) {
    res.status(400).json({ error: "מחיר נדרש" }); return;
  }
  if (!attributes || typeof attributes !== "object") {
    res.status(400).json({ error: "תכונות נדרשות" }); return;
  }

  const [created] = await db.insert(productVariationsTable).values({
    productId,
    sku: sku ?? null,
    price: String(price),
    salePrice: salePrice != null && salePrice !== "" ? String(salePrice) : null,
    costPrice: costPrice != null && costPrice !== "" ? String(costPrice) : null,
    stockQuantity: stockQuantity ?? 0,
    image: image ?? null,
    attributes,
    weight: weight != null && weight !== "" ? String(weight) : null,
    isActive: isActive ?? true,
    sortOrder: sortOrder ?? 0,
  }).returning();

  res.status(201).json(serializeVariation(created));
});

router.patch("/variations/:id", async (req, res): Promise<void> => {
  const { allowed } = await requireManagerPrivilegeCheck(req, "products", "write");
  if (!allowed) { res.status(403).json({ error: PRIV_DENIED }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const body = req.body;
  const updateData: Record<string, unknown> = {};
  const passthrough = ["sku", "stockQuantity", "image", "attributes", "isActive", "sortOrder"];
  for (const f of passthrough) {
    if (body[f] !== undefined) updateData[f] = body[f];
  }
  if (body.price !== undefined) updateData.price = String(body.price);
  if (body.salePrice !== undefined) updateData.salePrice = body.salePrice != null && body.salePrice !== "" ? String(body.salePrice) : null;
  if (body.costPrice !== undefined) updateData.costPrice = body.costPrice != null && body.costPrice !== "" ? String(body.costPrice) : null;
  if (body.weight !== undefined) updateData.weight = body.weight != null && body.weight !== "" ? String(body.weight) : null;

  const [updated] = await db.update(productVariationsTable)
    .set(updateData)
    .where(eq(productVariationsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "וריאציה לא נמצאה" }); return; }
  res.json(serializeVariation(updated));
});

router.delete("/variations/:id", async (req, res): Promise<void> => {
  const { allowed } = await requireManagerPrivilegeCheck(req, "products", "delete");
  if (!allowed) { res.status(403).json({ error: PRIV_DENIED }); return; }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(productVariationsTable).where(eq(productVariationsTable.id, id));
  res.sendStatus(204);
});

router.post("/products/:productId/variations/bulk", async (req, res): Promise<void> => {
  const { allowed } = await requireManagerPrivilegeCheck(req, "products", "write");
  if (!allowed) { res.status(403).json({ error: PRIV_DENIED }); return; }

  const raw = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const productId = parseInt(raw, 10);
  if (isNaN(productId)) { res.status(400).json({ error: "Invalid productId" }); return; }

  const variations = req.body?.variations;
  if (!Array.isArray(variations)) { res.status(400).json({ error: "variations must be an array" }); return; }

  await db.delete(productVariationsTable).where(eq(productVariationsTable.productId, productId));

  if (variations.length > 0) {
    await db.insert(productVariationsTable).values(
      variations.map((v: any, idx: number) => ({
        productId,
        sku: v.sku ?? null,
        price: String(v.price ?? "0"),
        salePrice: v.salePrice != null && v.salePrice !== "" ? String(v.salePrice) : null,
        costPrice: v.costPrice != null && v.costPrice !== "" ? String(v.costPrice) : null,
        stockQuantity: v.stockQuantity ?? 0,
        image: v.image ?? null,
        attributes: v.attributes ?? {},
        weight: v.weight != null && v.weight !== "" ? String(v.weight) : null,
        isActive: v.isActive ?? true,
        sortOrder: v.sortOrder ?? idx,
      })),
    );
  }

  const rows = await db.select().from(productVariationsTable)
    .where(eq(productVariationsTable.productId, productId))
    .orderBy(asc(productVariationsTable.sortOrder), asc(productVariationsTable.id));

  res.json(rows.map(serializeVariation));
});

export default router;
