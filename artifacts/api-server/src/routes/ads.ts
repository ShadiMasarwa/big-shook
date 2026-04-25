import { Router, type IRouter, type Request, type Response } from "express";
import { db, adsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAdminOrManager } from "../lib/managerAuth.js";

const router: IRouter = Router();

router.get("/ads", async (_req: Request, res: Response): Promise<void> => {
  const ads = await db
    .select()
    .from(adsTable)
    .where(eq(adsTable.isActive, true));
  res.json(ads);
});

router.get("/admin/ads", async (req: Request, res: Response): Promise<void> => {
  if (!await requireAdminOrManager(req, res)) return;
  const ads = await db.select().from(adsTable);
  res.json(ads);
});

router.put("/admin/ads/:position", async (req: Request, res: Response): Promise<void> => {
  if (!await requireAdminOrManager(req, res)) return;
  const position = parseInt(req.params.position, 10);
  if (isNaN(position) || position < 1 || position > 4) {
    res.status(400).json({ error: "מיקום לא תקין (1-4)" });
    return;
  }
  const { imageUrl, linkUrl, title, isActive } = req.body;
  if (!imageUrl) {
    res.status(400).json({ error: "imageUrl הוא שדה חובה" });
    return;
  }

  const [existing] = await db.select().from(adsTable).where(eq(adsTable.position, position));

  if (existing) {
    const [updated] = await db
      .update(adsTable)
      .set({ imageUrl, linkUrl: linkUrl || null, title: title || null, isActive: isActive ?? true, updatedAt: new Date() })
      .where(eq(adsTable.position, position))
      .returning();
    res.json(updated);
  } else {
    const [created] = await db
      .insert(adsTable)
      .values({ position, imageUrl, linkUrl: linkUrl || null, title: title || null, isActive: isActive ?? true })
      .returning();
    res.json(created);
  }
});

router.delete("/admin/ads/:position", async (req: Request, res: Response): Promise<void> => {
  if (!await requireAdminOrManager(req, res)) return;
  const position = parseInt(req.params.position, 10);
  if (isNaN(position)) { res.status(400).json({ error: "מיקום לא תקין" }); return; }
  await db.delete(adsTable).where(eq(adsTable.position, position));
  res.sendStatus(204);
});

export default router;
