import { Router, type IRouter } from "express";
import { eq, and, lte, sql } from "drizzle-orm";
import { db, warehousesTable, inventoryTable, stockHistoryTable, productsTable } from "@workspace/db";

const router: IRouter = Router();

function serializeWarehouse(w: typeof warehousesTable.$inferSelect) {
  return { ...w, createdAt: w.createdAt.toISOString(), updatedAt: w.updatedAt.toISOString() };
}

function serializeProduct(p: typeof productsTable.$inferSelect) {
  return {
    ...p, price: parseFloat(p.price), salePrice: p.salePrice ? parseFloat(p.salePrice) : null,
    costPrice: p.costPrice ? parseFloat(p.costPrice) : null, ratingAverage: parseFloat(p.ratingAverage),
    weight: p.weight ? parseFloat(p.weight) : null, createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(), images: p.images ?? [], tags: p.tags ?? [], specs: p.specs ?? {},
  };
}

router.get("/inventory/warehouses", async (_req, res): Promise<void> => {
  const warehouses = await db.select().from(warehousesTable);
  res.json(warehouses.map(serializeWarehouse));
});

router.post("/inventory/warehouses", async (req, res): Promise<void> => {
  const { nameHe, location, isActive } = req.body;
  if (!nameHe) { res.status(400).json({ error: "nameHe is required" }); return; }
  const [warehouse] = await db.insert(warehousesTable).values({ nameHe, location: location ?? null, isActive: isActive ?? true }).returning();
  res.status(201).json(serializeWarehouse(warehouse));
});

router.get("/inventory/stock", async (req, res): Promise<void> => {
  const conditions: ReturnType<typeof eq>[] = [];
  if (req.query.warehouseId) conditions.push(eq(inventoryTable.warehouseId, parseInt(String(req.query.warehouseId), 10)));
  if (req.query.productId) conditions.push(eq(inventoryTable.productId, parseInt(String(req.query.productId), 10)));
  if (req.query.lowStock === "true") conditions.push(lte(inventoryTable.quantity, inventoryTable.lowStockThreshold));

  const stocks = await db.select().from(inventoryTable).where(conditions.length > 0 ? and(...conditions) : undefined);
  const result = await Promise.all(stocks.map(async (s) => {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, s.productId));
    const [warehouse] = await db.select().from(warehousesTable).where(eq(warehousesTable.id, s.warehouseId));
    const available = s.quantity - s.reservedQuantity;
    return {
      id: s.id, productId: s.productId, product: product ? serializeProduct(product) : null,
      warehouseId: s.warehouseId, warehouse: warehouse ? serializeWarehouse(warehouse) : null,
      quantity: s.quantity, reservedQuantity: s.reservedQuantity,
      availableQuantity: Math.max(0, available),
      lowStockThreshold: s.lowStockThreshold, isLowStock: s.quantity <= s.lowStockThreshold,
      updatedAt: s.updatedAt.toISOString(),
    };
  }));
  res.json(result);
});

router.patch("/inventory/stock", async (req, res): Promise<void> => {
  const { productId, warehouseId, quantity, reason } = req.body;
  if (!productId || !warehouseId || quantity === undefined || !reason) {
    res.status(400).json({ error: "productId, warehouseId, quantity, reason required" }); return;
  }
  const [existing] = await db.select().from(inventoryTable).where(and(eq(inventoryTable.productId, productId), eq(inventoryTable.warehouseId, warehouseId)));
  const before = existing?.quantity ?? 0;
  const after = quantity;

  await db.insert(stockHistoryTable).values({ productId, warehouseId, quantityBefore: before, quantityAfter: after, change: after - before, reason });

  let stock;
  if (existing) {
    [stock] = await db.update(inventoryTable).set({ quantity: after }).where(eq(inventoryTable.id, existing.id)).returning();
  } else {
    [stock] = await db.insert(inventoryTable).values({ productId, warehouseId, quantity: after }).returning();
  }
  await db.update(productsTable).set({ stockQuantity: after }).where(eq(productsTable.id, productId));

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
  const [warehouse] = await db.select().from(warehousesTable).where(eq(warehousesTable.id, warehouseId));
  res.json({
    id: stock.id, productId: stock.productId, product: product ? serializeProduct(product) : null,
    warehouseId: stock.warehouseId, warehouse: warehouse ? serializeWarehouse(warehouse) : null,
    quantity: stock.quantity, reservedQuantity: stock.reservedQuantity,
    availableQuantity: Math.max(0, stock.quantity - stock.reservedQuantity),
    lowStockThreshold: stock.lowStockThreshold, isLowStock: stock.quantity <= stock.lowStockThreshold,
    updatedAt: stock.updatedAt.toISOString(),
  });
});

router.get("/inventory/stock/:productId/history", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.productId) ? req.params.productId[0] : req.params.productId;
  const productId = parseInt(raw, 10);
  const history = await db.select().from(stockHistoryTable).where(eq(stockHistoryTable.productId, productId));
  res.json(history.map(h => ({ ...h, createdAt: h.createdAt.toISOString() })));
});

export default router;
