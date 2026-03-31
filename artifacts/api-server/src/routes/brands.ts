import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, brandsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/brands", async (_req, res): Promise<void> => {
  const brands = await db.select().from(brandsTable).orderBy(brandsTable.nameHe);
  res.json(brands.map(serializeBrand));
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
