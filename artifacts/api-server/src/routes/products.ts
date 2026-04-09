import { Router, type IRouter } from "express";
import { eq, and, gte, lte, ilike, desc, asc, gt, sql, inArray } from "drizzle-orm";
import { db, productsTable, suppliersTable, categoriesTable, productCategoriesTable } from "@workspace/db";
import { requireManagerPrivilegeCheck } from "../lib/managerAuth.js";

const router: IRouter = Router();
const PRIV_DENIED = "אין לך הרשאה לבצע פעולה זו";

function serializeProduct(
  p: typeof productsTable.$inferSelect,
  extra?: { supplierName?: string | null; categoryIds?: number[] }
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
    categoryIds: extra?.categoryIds ?? (p.categoryId ? [p.categoryId] : []),
  };
}

/** Sync product_categories join table for a product */
async function syncProductCategories(productId: number, categoryIds: number[]) {
  await db.delete(productCategoriesTable).where(eq(productCategoriesTable.productId, productId));
  if (categoryIds.length > 0) {
    await db.insert(productCategoriesTable).values(
      categoryIds.map((cid) => ({ productId, categoryId: cid }))
    ).onConflictDoNothing();
  }
}

router.get("/products/featured", async (req, res): Promise<void> => {
  const limit = parseInt(String(req.query.limit ?? "12"), 10);
  const products = await db.select().from(productsTable)
    .where(and(eq(productsTable.isActive, true), eq(productsTable.isFeatured, true)))
    .orderBy(desc(productsTable.createdAt))
    .limit(limit);
  res.json(products.map(p => serializeProduct(p)));
});

router.get("/products/top-selling", async (req, res): Promise<void> => {
  const limit = parseInt(String(req.query.limit ?? "12"), 10);
  const products = await db.select().from(productsTable)
    .where(eq(productsTable.isActive, true))
    .orderBy(desc(productsTable.salesCount))
    .limit(limit);
  res.json(products.map(p => serializeProduct(p)));
});

router.get("/products/slug/:slug", async (req, res): Promise<void> => {
  const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
  const [product] = await db.select().from(productsTable).where(eq(productsTable.slug, slug));
  if (!product) {
    res.status(404).json({ error: "מוצר לא נמצא" });
    return;
  }
  await db.update(productsTable).set({ viewsCount: product.viewsCount + 1 }).where(eq(productsTable.id, product.id));
  const catRows = await db.select({ categoryId: productCategoriesTable.categoryId })
    .from(productCategoriesTable).where(eq(productCategoriesTable.productId, product.id));
  const categoryIds = catRows.map(r => r.categoryId);
  res.json(serializeProduct({ ...product, viewsCount: product.viewsCount + 1 }, { categoryIds }));
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
  res.json(related.filter(p => p.id !== id).slice(0, limit).map(p => serializeProduct(p)));
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
  const catRows = await db.select({ categoryId: productCategoriesTable.categoryId })
    .from(productCategoriesTable).where(eq(productCategoriesTable.productId, id));
  const categoryIds = catRows.map(r => r.categoryId);
  res.json(serializeProduct({ ...product, viewsCount: product.viewsCount + 1 }, { supplierName, categoryIds }));
});

router.get("/products", async (req, res): Promise<void> => {
  const { categoryId, parentCategoryId, brandId, search, minPrice, maxPrice, inStock, sort, tags, admin, supplierId, sku, outOfStock, isActive } = req.query;
  const page = parseInt(String(req.query.page ?? "1"), 10);
  const limit = parseInt(String(req.query.limit ?? "20"), 10);
  const offset = (page - 1) * limit;
  const isAdmin = admin === "true";

  const conditions: any[] = [];

  if (!isAdmin) {
    conditions.push(eq(productsTable.isActive, true));
    conditions.push(sql`(${productsTable.supplierId} IS NULL OR EXISTS (SELECT 1 FROM suppliers WHERE suppliers.id = ${productsTable.supplierId} AND suppliers.is_active = true))`);
  }

  if (isAdmin && isActive !== undefined && isActive !== "") {
    conditions.push(eq(productsTable.isActive, isActive === "true"));
  }

  if (categoryId) {
    const catId = parseInt(String(categoryId), 10);
    if (!isNaN(catId)) {
      // Search both category_id (primary) and the join table
      conditions.push(sql`(${productsTable.categoryId} = ${catId} OR EXISTS (SELECT 1 FROM product_categories pc WHERE pc.product_id = ${productsTable.id} AND pc.category_id = ${catId}))`);
    }
  }
  if (parentCategoryId) {
    const parentId = parseInt(String(parentCategoryId), 10);
    if (!isNaN(parentId)) {
      // Use subqueries so the array never needs to be serialised by Drizzle
      conditions.push(sql`(
        ${productsTable.categoryId} IN (SELECT id FROM categories WHERE parent_id = ${parentId})
        OR EXISTS (
          SELECT 1 FROM product_categories pc
          JOIN categories c ON pc.category_id = c.id
          WHERE pc.product_id = ${productsTable.id} AND c.parent_id = ${parentId}
        )
      )`);
    }
  }
  if (brandId) {
    const bId = parseInt(String(brandId), 10);
    if (!isNaN(bId)) conditions.push(eq(productsTable.brandId, bId));
  }
  if (supplierId) {
    const sId = parseInt(String(supplierId), 10);
    if (!isNaN(sId)) conditions.push(eq(productsTable.supplierId, sId));
  }
  if (search) {
    conditions.push(ilike(productsTable.nameHe, `%${search}%`));
  }
  if (sku) {
    conditions.push(ilike(productsTable.sku, `%${sku}%`));
  }
  if (minPrice && !isNaN(parseFloat(String(minPrice)))) conditions.push(gte(productsTable.price, String(minPrice)));
  if (maxPrice && !isNaN(parseFloat(String(maxPrice)))) conditions.push(lte(productsTable.price, String(maxPrice)));
  if (inStock === "true") conditions.push(gt(productsTable.stockQuantity, 0));
  if (outOfStock === "true") conditions.push(eq(productsTable.stockQuantity, 0));

  let orderBy;
  switch (sort) {
    case "price_asc": orderBy = asc(productsTable.price); break;
    case "price_desc": orderBy = desc(productsTable.price); break;
    case "popular": orderBy = desc(productsTable.salesCount); break;
    case "rating": orderBy = desc(productsTable.ratingAverage); break;
    default: orderBy = desc(productsTable.createdAt);
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(productsTable).where(whereClause);
  const products = await db.select().from(productsTable).where(whereClause).orderBy(orderBy).limit(limit).offset(offset);

  res.json({
    products: products.map(p => serializeProduct(p)),
    total: count,
    page,
    limit,
    totalPages: Math.ceil(count / limit),
  });
});

router.post("/products/bulk-update", async (req, res): Promise<void> => {
  const { allowed } = await requireManagerPrivilegeCheck(req, "products", "write");
  if (!allowed) { res.status(403).json({ error: PRIV_DENIED }); return; }
  const { ids, patch } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: "לא סופקו מוצרים" }); return;
  }

  const NUMERIC = ["price", "salePrice", "costPrice", "deliveryCost", "stockQuantity"] as const;
  const INT_REL  = ["brandId", "supplierId", "categoryId"] as const;
  const BOOL    = ["isActive", "isFeatured"] as const;

  const updateData: Record<string, any> = {};

  for (const f of NUMERIC) {
    if (patch[f] !== undefined && patch[f] !== "" && patch[f] !== null) {
      const v = parseFloat(String(patch[f]));
      if (!isNaN(v)) updateData[f] = String(v);
    }
  }
  for (const f of INT_REL) {
    if (patch[f] !== undefined && patch[f] !== "" && patch[f] !== null) {
      const v = parseInt(String(patch[f]), 10);
      if (!isNaN(v)) updateData[f] = v;
    }
  }
  for (const f of BOOL) {
    if (patch[f] !== undefined && patch[f] !== "" && patch[f] !== null) {
      updateData[f] = patch[f] === true || patch[f] === "true";
    }
  }

  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "אין שדות לעדכון" }); return;
  }

  const numericIds = ids.map(Number).filter(n => !isNaN(n));
  await db
    .update(productsTable)
    .set({ ...updateData, updatedAt: new Date() })
    .where(inArray(productsTable.id, numericIds));

  res.json({ updated: numericIds.length });
});

router.post("/products/:id/duplicate", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [original] = await db.select().from(productsTable).where(eq(productsTable.id, id));
  if (!original) { res.status(404).json({ error: "מוצר לא נמצא" }); return; }

  const baseSlug = `${original.slug}-copy`;
  const [existing] = await db.select({ id: productsTable.id }).from(productsTable).where(eq(productsTable.slug, baseSlug));
  const newSlug = existing ? `${baseSlug}-${Date.now()}` : baseSlug;

  const [newProduct] = await db.insert(productsTable).values({
    nameHe: `${original.nameHe} (copy)`,
    nameEn: original.nameEn ?? null,
    slug: newSlug,
    descriptionHe: original.descriptionHe ?? null,
    sku: null,
    price: original.price,
    salePrice: original.salePrice ?? null,
    costPrice: original.costPrice ?? null,
    categoryId: original.categoryId ?? null,
    brandId: original.brandId ?? null,
    supplierId: original.supplierId ?? null,
    images: [],
    videos: [],
    tags: original.tags ?? [],
    specs: original.specs ?? {},
    stockQuantity: 0,
    isActive: false,
    isFeatured: false,
    weight: original.weight ?? null,
    metaTitle: original.metaTitle ?? null,
    metaDescription: original.metaDescription ?? null,
    viewsCount: 0,
    salesCount: 100,
    ratingAverage: "0",
    ratingCount: 0,
    deliveryCost: original.deliveryCost ?? null,
  }).returning();

  // Copy categories from original
  const origCats = await db.select({ categoryId: productCategoriesTable.categoryId })
    .from(productCategoriesTable).where(eq(productCategoriesTable.productId, id));
  if (origCats.length > 0) {
    await db.insert(productCategoriesTable).values(
      origCats.map(r => ({ productId: newProduct.id, categoryId: r.categoryId }))
    ).onConflictDoNothing();
  }

  res.status(201).json(serializeProduct(newProduct));
});

router.post("/products", async (req, res): Promise<void> => {
  const { allowed } = await requireManagerPrivilegeCheck(req, "products", "write");
  if (!allowed) { res.status(403).json({ error: PRIV_DENIED }); return; }
  const {
    nameHe, nameEn, slug, descriptionHe, sku, price, salePrice, costPrice,
    categoryId, categoryIds, brandId, supplierId, images, videos, tags, specs,
    stockQuantity, isActive, isFeatured, weight, metaTitle, metaDescription,
    deliveryCost,
  } = req.body;
  if (!nameHe || !slug || price === undefined || price === null) {
    res.status(400).json({ error: "nameHe, slug and price are required" });
    return;
  }

  // Determine primary categoryId: first from categoryIds[], else from categoryId
  const resolvedCategoryIds: number[] = Array.isArray(categoryIds) && categoryIds.length > 0
    ? categoryIds.map(Number)
    : categoryId ? [Number(categoryId)] : [];
  const primaryCategoryId = resolvedCategoryIds[0] ?? null;

  const [product] = await db.insert(productsTable).values({
    nameHe, nameEn: nameEn ?? null, slug, descriptionHe: descriptionHe ?? null,
    sku: sku ?? null, price: String(price),
    salePrice: salePrice != null && salePrice !== 0 ? String(salePrice) : null,
    costPrice: costPrice != null && costPrice !== 0 ? String(costPrice) : null,
    categoryId: primaryCategoryId, brandId: brandId ?? null, supplierId: supplierId ?? null,
    images: images ?? [], videos: videos ?? [], tags: tags ?? [], specs: specs ?? {},
    stockQuantity: stockQuantity ?? 0, isActive: isActive ?? true,
    isFeatured: isFeatured ?? false, weight: weight != null ? String(weight) : null,
    metaTitle: metaTitle ?? null, metaDescription: metaDescription ?? null,
    deliveryCost: deliveryCost != null && deliveryCost !== 0 ? String(deliveryCost) : null,
  }).returning();

  await syncProductCategories(product.id, resolvedCategoryIds);
  res.status(201).json(serializeProduct(product, { categoryIds: resolvedCategoryIds }));
});

router.patch("/products/:id", async (req, res): Promise<void> => {
  const { allowed } = await requireManagerPrivilegeCheck(req, "products", "write");
  if (!allowed) { res.status(403).json({ error: PRIV_DENIED }); return; }
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const body = req.body;
  const updateData: Record<string, unknown> = {};
  const fields = ["nameHe", "nameEn", "slug", "descriptionHe", "sku", "brandId", "supplierId",
    "images", "videos", "tags", "specs", "stockQuantity", "isActive", "isFeatured", "weight", "metaTitle", "metaDescription"];
  for (const f of fields) {
    if (body[f] !== undefined) updateData[f] = body[f];
  }
  if (body.price !== undefined) updateData.price = String(body.price);
  if (body.salePrice !== undefined) updateData.salePrice = body.salePrice != null ? String(body.salePrice) : null;
  if (body.costPrice !== undefined) updateData.costPrice = body.costPrice != null ? String(body.costPrice) : null;
  if (body.deliveryCost !== undefined) updateData.deliveryCost = body.deliveryCost != null ? String(body.deliveryCost) : null;

  // Handle multi-category: categoryIds[] takes priority, else fall back to categoryId
  let resolvedCategoryIds: number[] | null = null;
  if (Array.isArray(body.categoryIds)) {
    resolvedCategoryIds = body.categoryIds.map(Number);
    updateData.categoryId = resolvedCategoryIds[0] ?? null;
  } else if (body.categoryId !== undefined) {
    updateData.categoryId = body.categoryId;
    resolvedCategoryIds = body.categoryId ? [Number(body.categoryId)] : [];
  }

  const [product] = await db.update(productsTable).set(updateData).where(eq(productsTable.id, id)).returning();
  if (!product) {
    res.status(404).json({ error: "מוצר לא נמצא" });
    return;
  }

  if (resolvedCategoryIds !== null) {
    await syncProductCategories(id, resolvedCategoryIds);
  }

  const catRows = await db.select({ categoryId: productCategoriesTable.categoryId })
    .from(productCategoriesTable).where(eq(productCategoriesTable.productId, id));
  const categoryIds = catRows.map(r => r.categoryId);

  res.json(serializeProduct(product, { categoryIds }));
});

router.delete("/products/:id", async (req, res): Promise<void> => {
  const { allowed } = await requireManagerPrivilegeCheck(req, "products", "delete");
  if (!allowed) { res.status(403).json({ error: PRIV_DENIED }); return; }
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.sendStatus(204);
});

export default router;
