import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, suppliersTable, productsTable } from "@workspace/db";

const router: IRouter = Router();

function serializeSupplier(s: typeof suppliersTable.$inferSelect) {
  return {
    ...s,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

router.get("/suppliers", async (_req, res): Promise<void> => {
  const suppliers = await db.select().from(suppliersTable).orderBy(desc(suppliersTable.createdAt));
  res.json(suppliers.map(serializeSupplier));
});

router.get("/suppliers/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "מזהה לא תקין" }); return; }
  const [supplier] = await db.select().from(suppliersTable).where(eq(suppliersTable.id, id));
  if (!supplier) { res.status(404).json({ error: "ספק לא נמצא" }); return; }
  res.json(serializeSupplier(supplier));
});

router.get("/suppliers/:id/products", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "מזהה לא תקין" }); return; }
  const products = await db.select().from(productsTable)
    .where(eq(productsTable.supplierId, id))
    .orderBy(desc(productsTable.createdAt));
  res.json(products.map(p => ({
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
  })));
});

router.post("/suppliers", async (req, res): Promise<void> => {
  const { companyName, contactPerson, taxId, phone1, phone2, address, city, email, website, notes, isActive } = req.body;
  if (!companyName) { res.status(400).json({ error: "שם חברה הוא שדה חובה" }); return; }
  const [supplier] = await db.insert(suppliersTable).values({
    companyName, contactPerson: contactPerson || null, taxId: taxId || null,
    phone1: phone1 || null, phone2: phone2 || null, address: address || null,
    city: city || null, email: email || null, website: website || null,
    notes: notes || null, isActive: isActive !== false,
  }).returning();
  res.status(201).json(serializeSupplier(supplier));
});

router.put("/suppliers/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "מזהה לא תקין" }); return; }
  const { companyName, contactPerson, taxId, phone1, phone2, address, city, email, website, notes, isActive } = req.body;
  if (!companyName) { res.status(400).json({ error: "שם חברה הוא שדה חובה" }); return; }
  const [supplier] = await db.update(suppliersTable).set({
    companyName, contactPerson: contactPerson || null, taxId: taxId || null,
    phone1: phone1 || null, phone2: phone2 || null, address: address || null,
    city: city || null, email: email || null, website: website || null,
    notes: notes || null, isActive: isActive !== false,
  }).where(eq(suppliersTable.id, id)).returning();
  if (!supplier) { res.status(404).json({ error: "ספק לא נמצא" }); return; }
  res.json(serializeSupplier(supplier));
});

router.delete("/suppliers/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "מזהה לא תקין" }); return; }
  await db.update(productsTable).set({ supplierId: null }).where(eq(productsTable.supplierId, id));
  await db.delete(suppliersTable).where(eq(suppliersTable.id, id));
  res.json({ success: true });
});

export default router;
