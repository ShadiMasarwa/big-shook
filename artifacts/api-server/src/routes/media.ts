import { Router, type IRouter, type Request, type Response } from "express";
import { db, mediaTable } from "@workspace/db";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage.js";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();
const storage = new ObjectStorageService();

router.get("/media", async (_req: Request, res: Response): Promise<void> => {
  const items = await db.select().from(mediaTable).orderBy(desc(mediaTable.createdAt));
  res.json(items);
});

router.post("/media", async (req: Request, res: Response): Promise<void> => {
  const { objectPath, originalName, mimeType, size, altText } = req.body;
  if (!objectPath || !originalName || !mimeType || !size) {
    res.status(400).json({ error: "שדות חסרים" });
    return;
  }
  const [item] = await db
    .insert(mediaTable)
    .values({ objectPath, originalName, mimeType, size: Number(size), altText })
    .returning();
  res.status(201).json(item);
});

router.delete("/media/:id", async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "מזהה לא תקין" }); return; }

  const [item] = await db.select().from(mediaTable).where(eq(mediaTable.id, id));
  if (!item) { res.status(404).json({ error: "לא נמצא" }); return; }

  try {
    const file = await storage.getObjectEntityFile(item.objectPath);
    await file.delete();
  } catch (e) {
    if (!(e instanceof ObjectNotFoundError)) {
      req.log.error({ err: e }, "Failed to delete from GCS");
    }
  }

  await db.delete(mediaTable).where(eq(mediaTable.id, id));
  res.json({ success: true });
});

export default router;
