import { Router, type IRouter, type Request, type Response } from "express";
import { db, mediaTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, "../../uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /^(image|video)\//;
    cb(null, allowed.test(file.mimetype));
  },
});

const router: IRouter = Router();

router.get("/media", async (_req: Request, res: Response): Promise<void> => {
  const items = await db.select().from(mediaTable).orderBy(desc(mediaTable.createdAt));
  res.json(items);
});

router.post("/media/upload", upload.single("file"), async (req: Request, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "קובץ לא נמצא" });
    return;
  }
  const [item] = await db
    .insert(mediaTable)
    .values({
      objectPath: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    })
    .returning();
  res.status(201).json(item);
});

router.put("/media/:id", async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "מזהה לא תקין" }); return; }
  const { altText, title } = req.body;
  const [updated] = await db
    .update(mediaTable)
    .set({ altText: altText ?? null, title: title ?? null })
    .where(eq(mediaTable.id, id))
    .returning();
  if (!updated) { res.status(404).json({ error: "לא נמצא" }); return; }
  res.json(updated);
});

router.delete("/media/:id", async (req: Request, res: Response): Promise<void> => {
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "מזהה לא תקין" }); return; }
  const [item] = await db.select().from(mediaTable).where(eq(mediaTable.id, id));
  if (!item) { res.status(404).json({ error: "לא נמצא" }); return; }
  const filePath = path.join(UPLOADS_DIR, item.objectPath);
  try { fs.unlinkSync(filePath); } catch { /* file may already be gone */ }
  await db.delete(mediaTable).where(eq(mediaTable.id, id));
  res.json({ success: true });
});

export default router;
