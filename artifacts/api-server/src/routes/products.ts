import { Router, type IRouter } from "express";
import { eq, and, gte, lte, ilike, desc, asc, gt, sql } from "drizzle-orm";
import { db, productsTable, suppliersTable } from "@workspace/db";

const router: IRouter = Router();

function serializeProduct(
  p: typeof productsTable.$inferSelect,
  extra?: { supplierName?: string | null }
) {
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
    supplierName: extra?.supplierName ?? null,
  };
}

router.get("/products/featured", async (req, res): Promise<void> => {
  const limit = parseInt(String(req.query.limit ?? "12"), 10);
  const products = await db.select().from(productsTable)
    .where(and(eq(productsTable.isActive, true), eq(productsTable.isFeatured, true)))
    .orderBy(desc(productsTable.createdAt))
    .limit(limit);
  res.json(products.map(serializeProduct));
});

router.get("/products/top-selling", async (req, res): Promise<void> => {
  const limit = parseInt(String(req.query.limit ?? "12"), 10);
  const products = await db.select().from(productsTable)
    .where(eq(productsTable.isActive, true))
    .orderBy(desc(productsTable.salesCount))
    .limit(limit);
  res.json(products.map(serializeProduct));
});

router.get("/products/slug/:slug", async (req, res): Promise<void> => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const [product] = await db.select().from(productsTable).where(eq(productsTable.slug, slug));
  if (!product) {
    res.status(404).json({ error: "מוצר לא נמצא" });
    return;
  }
  await db.update(productsTable).set({ viewsCount: product.viewsCount + 1 }).where(eq(productsTable.id, product.id));
  res.json(serializeProduct({ ...product, viewsCount: product.viewsCount + 1 }));
});

router.get("/products/:id/related", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.json([]); return; }
  const limit = parseInt(String(req.query.limit ?? "8"), 10);
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!product) {
    res.json([]);
    return;
  }
  const conditions = [eq(productsTable.isActive, true)];
  if (product.categoryId) conditions.push(eq(productsTable.categoryId, product.categoryId));
  const related = await db.select().from(productsTable)
    .where(and(...conditions))
    .orderBy(desc(productsTable.salesCount))
    .limit(limit + 1);
  res.json(related.filter(p => p.id !== id).slice(0, limit).map(serializeProduct));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [row] = await db
    .select({ product: productsTable, supplierName: suppliersTable.companyName })
    .from(productsTable)
    .leftJoin(suppliersTable, eq(productsTable.supplierId, suppliersTable.id))
    .where(eq(productsTable.id, id));
  if (!row) {
    res.status(404).json({ error: "מוצר לא נמצא" });
    return;
  }
  const { product, supplierName } = row;
  await db.update(productsTable).set({ viewsCount: product.viewsCount + 1 }).where(eq(productsTable.id, id));
  res.json(serializeProduct({ ...product, viewsCount: product.viewsCount + 1 }, { supplierName }));
});

router.get("/products", async (req, res): Promise<void> => {
  const { categoryId, brandId, search, minPrice, maxPrice, inStock, sort, tags } = req.query;
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = parseInt(String(req.query.limit ?? "20"), 10);
  const offset = (page - 1) * limit;

  const conditions = [
    eq(productsTable.isActive, true),
    sql`(${productsTable.supplierId} IS NULL OR EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = ${productsTable.supplierId} AND suppliers.is_active = true))`,
  ];

  if (categoryId) {
    const catId = parseInt(String(categoryId), 10);
    if (!isNaN(catId)) conditions.push(eq(productsTable.categoryId, catId));
  }
  if (brandId) {
    const bId = parseInt(String(brandId), 10);
    if (!isNaN(bId)) conditions.push(eq(productsTable.brandId, bId));
  }
  if (search) conditions.push(ilike(productsTable.nameHe, `%${search}%`));
  if (minPrice && !isNaN(parseFloat(String(minPrice)))) conditions.push(gte(productsTable.price, String(minPrice)));
  if (maxPrice && !isNaN(parseFloat(String(maxPrice)))) conditions.push(lte(productsTable.price, String(maxPrice)));
  if (inStock === "true") conditions.push(gt(productsTable.stockQuantity, 0));

  let orderBy;
  switch (sort) {
    case "price_asc": orderBy = asc(productsTable.price); break;
    case "price_desc": orderBy = desc(productsTable.price); break;
    case "popular": orderBy = desc(productsTable.salesCount); break;
    case "rating": orderBy = desc(productsTable.ratingAverage); break;
    default: orderBy = desc(productsTable.createdAt);
  }

  const whereClause = and(...conditions);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(productsTable).where(whereClause);
  const products = await db.select().from(productsTable).where(whereClause).orderBy(orderBy).limit(limit).offset(offset);

  res.json({
    products: products.map(serializeProduct),
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
  });
});

router.post("/products", async (req, res): Promise<void> => {
  const {
    nameHe, nameEn, slug, descriptionHe, sku, price, salePrice, costPrice,
    categoryId, brandId, supplierId, images, tags, specs, stockQuantity, isActive, isFeatured,
    weight, metaTitle, metaDescription,
  } = req.body;
  if (!nameHe || !slug || price === undefined || price === null) {
    res.status(400).json({ error: "nameHe, slug and price are required" });
    return;
  }
  const [product] = await db.insert(productsTable).values({
    nameHe, nameEn: nameEn ?? null, slug, descriptionHe: descriptionHe ?? null,
    sku: sku ?? null, price: String(price),
    salePrice: salePrice != null ? String(salePrice) : null,
    costPrice: costPrice != null ? String(costPrice) : null,
    categoryId: categoryId ?? null, brandId: brandId ?? null, supplierId: supplierId ?? null,
    images: images ?? [], tags: tags ?? [], specs: specs ?? {},
    stockQuantity: stockQuantity ?? 0, isActive: isActive ?? true,
    isFeatured: isFeatured ?? false, weight: weight != null ? String(weight) : null,
    metaTitle: metaTitle ?? null, metaDescription: metaDescription ?? null,
  }).returning();
  res.status(201).json(serializeProduct(product));
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const body = req.body;
  const updateData: Record<string, unknown> = {};
  const fields = ["nameHe", "nameEn", "slug", "descriptionHe", "sku", "categoryId", "brandId", "supplierId",
    "images", "tags", "specs", "stockQuantity", "isActive", "isFeatured", "weight", "metaTitle", "metaDescription"];
  for (const f of fields) {
    if (body[f] !== undefined) updateData[f] = body[f];
  }
  if (body.price !== undefined) updateData.price = String(body.price);
  if (body.salePrice !== undefined) updateData.salePrice = body.salePrice != null ? String(body.salePrice) : null;
  if (body.costPrice !== undefined) updateData.costPrice = body.costPrice != null ? String(body.costPrice) : null;

  const [product] = await db.update(productsTable).set(updateData).where(eq(productsTable.id, id)).returning();
  if (!product) {
    res.status(404).json({ error: "מוצר לא נמצא" });
    return;
  }
  res.json(serializeProduct(product));
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.sendStatus(204);
});

export default router;
