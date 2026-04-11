import { Router, type IRouter } from "express";
import { eq, and, gte, lte, ilike, gt, sql } from "drizzle-orm";
import { db, brandsTable, productsTable } from "@workspace/db";
import { requireManagerPrivilegeCheck } from "../lib/managerAuth.js";

const router: IRouter = Router();
const PRIV_DENIED = "אין לך הרשאה לבצע פעולה זו";

router.get("/brands", async (req, res): Promise<void> => {
  const { categoryId, parentCategoryId, search, minPrice, maxPrice, inStock } = req.query;

  const productConditions = [
    eq(productsTable.isActive, true),
    sql`(${productsTable.supplierId} IS NULL OR EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = ${productsTable.supplierId} AND suppliers.is_active = true))`,
    sql`(
      ${productsTable.categoryId} IS NULL
      OR EXISTS (
        SELECT 1 FROM categories cat
        WHERE cat.id = ${productsTable.categoryId}
          AND cat.is_active = true
          AND (
            cat.parent_id IS NULL
            OR EXISTS (
              SELECT 1 FROM categories parent
              WHERE parent.id = cat.parent_id AND parent.is_active = true
            )
          )
      )
    )`,
  ];

  if (categoryId) {
    const catId = parseInt(String(categoryId), 10);
    if (!isNaN(catId)) {
      // Check both primary column and join table
      productConditions.push(sql`(
        ${productsTable.categoryId} = ${catId}
        OR EXISTS (SELECT 1 FROM product_categories pc WHERE pc.product_id = ${productsTable.id} AND pc.category_id = ${catId})
      )`);
    }
  }

  if (parentCategoryId) {
    const parentId = parseInt(String(parentCategoryId), 10);
    if (!isNaN(parentId)) {
      // Match products whose category is any child of this parent (primary col or join table)
      productConditions.push(sql`(
        ${productsTable.categoryId} IN (SELECT id FROM categories WHERE parent_id = ${parentId})
        OR EXISTS (
          SELECT 1 FROM product_categories pc
          JOIN categories c ON pc.category_id = c.id
          WHERE pc.product_id = ${productsTable.id} AND c.parent_id = ${parentId}
        )
      )`);
    }
  }

  if (search) productConditions.push(ilike(productsTable.nameHe, `%${search}%`));
  if (minPrice && !isNaN(parseFloat(String(minPrice)))) productConditions.push(gte(productsTable.price, String(minPrice)));
  if (maxPrice && !isNaN(parseFloat(String(maxPrice)))) productConditions.push(lte(productsTable.price, String(maxPrice)));
  if (inStock === "true") productConditions.push(gt(productsTable.stockQuantity, 0));

  const brands = await db
    .selectDistinct({ brand: brandsTable })
    .from(brandsTable)
    .innerJoin(productsTable, and(
      eq(productsTable.brandId, brandsTable.id),
      ...productConditions
    ))
    .orderBy(brandsTable.nameHe);

  res.json(brands.map(r => serializeBrand(r.brand)));
});

router.post("/brands", async (req, res): Promise<void> => {
  const { allowed } = await requireManagerPrivilegeCheck(req, "brands", "write");
  if (!allowed) { res.status(403).json({ error: PRIV_DENIED }); return; }
  const { nameHe, nameEn, slug, logoUrl, description, isActive } = req.body;
  if (!nameHe || !slug) {
    res.status(400).json({ error: "nameHe and slug are required" });
    return;
  }
  const [brand] = await db.insert(brandsTable).values({
    nameHe, nameEn: nameEn ?? null, slug,
    logoUrl: logoUrl ?? null, description: description ?? null,
    isActive: isActive ?? true,
  }).returning();
  res.status(201).json(serializeBrand(brand));
});

router.put("/brands/:id", async (req, res): Promise<void> => {
  const { allowed } = await requireManagerPrivilegeCheck(req, "brands", "write");
  if (!allowed) { res.status(403).json({ error: PRIV_DENIED }); return; }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { nameHe, nameEn, slug, logoUrl, description, isActive } = req.body;
  if (!nameHe || !slug) { res.status(400).json({ error: "nameHe and slug are required" }); return; }
  const [brand] = await db.update(brandsTable).set({
    nameHe, nameEn: nameEn ?? null, slug,
    logoUrl: logoUrl ?? null, description: description ?? null,
    isActive: isActive ?? true,
  }).where(eq(brandsTable.id, id)).returning();
  if (!brand) { res.status(404).json({ error: "Brand not found" }); return; }
  res.json(serializeBrand(brand));
});

router.delete("/brands/:id", async (req, res): Promise<void> => {
  const { allowed } = await requireManagerPrivilegeCheck(req, "brands", "delete");
  if (!allowed) { res.status(403).json({ error: PRIV_DENIED }); return; }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(brandsTable).where(eq(brandsTable.id, id));
  res.status(204).end();
});

function serializeBrand(b: typeof brandsTable.$inferSelect) {
  return {
    ...b,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

export default router;
