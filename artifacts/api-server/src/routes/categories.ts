import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, categoriesTable, productsTable } from "@workspace/db";
import { requireManagerPrivilegeCheck } from "../lib/managerAuth.js";

const router: IRouter = Router();
const PRIV_DENIED = "אין לך הרשאה לבצע פעולה זו";

router.get("/categories", async (req, res): Promise<void> => {
  const parentIdParam = req.query.parentId;
  const onlyWithProducts = req.query.onlyWithProducts === "true";

  const hasProductsCondition = sql`EXISTS (
    SELECT 1 FROM ${productsTable}
    WHERE ${productsTable.categoryId} = ${categoriesTable.id}
      AND ${productsTable.isActive} = true
      AND ${productsTable.stockQuantity} > 0
  )`;

  let categories;
  if (parentIdParam !== undefined && parentIdParam !== null) {
    const parentId = parseInt(String(parentIdParam), 10);
    const condition = onlyWithProducts
      ? and(eq(categoriesTable.parentId, parentId), hasProductsCondition)
      : eq(categoriesTable.parentId, parentId);
    categories = await db.select().from(categoriesTable).where(condition);
  } else {
    categories = await db
      .select()
      .from(categoriesTable)
      .where(onlyWithProducts ? hasProductsCondition : undefined)
      .orderBy(categoriesTable.sortOrder);
  }
  res.json(categories.map(serializeCategory));
});

router.post("/categories", async (req, res): Promise<void> => {
  const { allowed } = await requireManagerPrivilegeCheck(req, "categories", "write");
  if (!allowed) { res.status(403).json({ error: PRIV_DENIED }); return; }
  const { nameHe, nameEn, slug, description, imageUrl, parentId, sortOrder, isActive, metaTitle, metaDescription } = req.body;
  if (!nameHe || !slug) {
    res.status(400).json({ error: "nameHe and slug are required" });
    return;
  }
  const [category] = await db.insert(categoriesTable).values({
    nameHe, nameEn: nameEn ?? null, slug, description: description ?? null,
    imageUrl: imageUrl ?? null, parentId: parentId ?? null,
    sortOrder: sortOrder ?? 0, isActive: isActive ?? true,
    metaTitle: metaTitle ?? null, metaDescription: metaDescription ?? null,
  }).returning();
  res.status(201).json(serializeCategory(category));
});

router.get("/categories/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [category] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, id));
  if (!category) {
    res.status(404).json({ error: "קטגוריה לא נמצאה" });
    return;
  }
  res.json(serializeCategory(category));
});

router.patch("/categories/:id", async (req, res): Promise<void> => {
  const { allowed } = await requireManagerPrivilegeCheck(req, "categories", "write");
  if (!allowed) { res.status(403).json({ error: PRIV_DENIED }); return; }
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { nameHe, nameEn, slug, description, imageUrl, parentId, sortOrder, isActive, metaTitle, metaDescription } = req.body;
  const [category] = await db.update(categoriesTable).set({
    ...(nameHe && { nameHe }),
    ...(nameEn !== undefined && { nameEn }),
    ...(slug && { slug }),
    ...(description !== undefined && { description }),
    ...(imageUrl !== undefined && { imageUrl }),
    ...(parentId !== undefined && { parentId }),
    ...(sortOrder !== undefined && { sortOrder }),
    ...(isActive !== undefined && { isActive }),
    ...(metaTitle !== undefined && { metaTitle }),
    ...(metaDescription !== undefined && { metaDescription }),
  }).where(eq(categoriesTable.id, id)).returning();
  if (!category) {
    res.status(404).json({ error: "קטגוריה לא נמצאה" });
    return;
  }
  res.json(serializeCategory(category));
});

router.delete("/categories/:id", async (req, res): Promise<void> => {
  const { allowed } = await requireManagerPrivilegeCheck(req, "categories", "delete");
  if (!allowed) { res.status(403).json({ error: PRIV_DENIED }); return; }
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(categoriesTable).where(eq(categoriesTable.id, id));
  res.sendStatus(204);
});

function serializeCategory(c: typeof categoriesTable.$inferSelect) {
  return {
    ...c,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export default router;
