import { Router, type IRouter } from "express";
import { eq, and, gte, lte, ilike, gt, sql } from "drizzle-orm";
import { db, brandsTable, productsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/brands", async (req, res): Promise<void> => {
  const { categoryId, search, minPrice, maxPrice, inStock } = req.query;

  const hasProductFilters = categoryId || search || minPrice || maxPrice || inStock;

  if (!hasProductFilters) {
    const brands = await db.select().from(brandsTable).orderBy(brandsTable.nameHe);
    res.json(brands.map(serializeBrand));
    return;
  }

  const productConditions = [
    eq(productsTable.isActive, true),
    sql`(${productsTable.supplierId} IS NULL OR EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = ${productsTable.supplierId} AND suppliers.is_active = true))`,
  ];

  if (categoryId) {
    const catId = parseInt(String(categoryId), 10);
    if (!isNaN(catId)) productConditions.push(eq(productsTable.categoryId, catId));
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

function serializeBrand(b: typeof brandsTable.$inferSelect) {
  return {
    ...b,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  };
}

export default router;
