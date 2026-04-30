import { Router, type IRouter, type Request, type Response } from "express";
import { db, mediaTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { requireManagerPrivilegeCheck } from "../lib/managerAuth";
import { objectStorageClient, ObjectStorageService } from "../lib/objectStorage";

function matchesBytes(buf: Buffer, offset: number, bytes: number[]): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

function verifyBufferSignature(buf: Buffer, mime: string): boolean {
  if (buf.length < 4) return false;
  switch (mime) {
    case "image/jpeg":
      return matchesBytes(buf, 0, [0xFF, 0xD8, 0xFF]);
    case "image/png":
      return matchesBytes(buf, 0, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    case "image/gif":
      return matchesBytes(buf, 0, [0x47, 0x49, 0x46, 0x38]);
    case "image/webp":
      return matchesBytes(buf, 0, [0x52, 0x49, 0x46, 0x46]) &&
             matchesBytes(buf, 8, [0x57, 0x45, 0x42, 0x50]);
    case "image/avif":
    case "image/heic":
      return matchesBytes(buf, 4, [0x66, 0x74, 0x79, 0x70]);
    case "video/mp4":
    case "video/quicktime":
      return matchesBytes(buf, 4, [0x66, 0x74, 0x79, 0x70]);
    case "video/webm":
      return matchesBytes(buf, 0, [0x1A, 0x45, 0xDF, 0xA3]);
    case "video/ogg":
      return matchesBytes(buf, 0, [0x4F, 0x67, 0x67, 0x53]);
    case "video/x-msvideo":
      return matchesBytes(buf, 0, [0x52, 0x49, 0x46, 0x46]) &&
             matchesBytes(buf, 8, [0x41, 0x56, 0x49, 0x20]);
    default:
      return false;
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, "../uploads");

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/avif": ".avif",
  "image/heic": ".heic",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/ogg": ".ogv",
  "video/quicktime": ".mov",
  "video/x-msvideo": ".avi",
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = Object.prototype.hasOwnProperty.call(MIME_TO_EXT, file.mimetype);
    cb(null, allowed);
  },
});

function getPublicUploadsBase(): { bucketName: string; prefix: string } {
  const svc = new ObjectStorageService();
  const searchPaths = svc.getPublicObjectSearchPaths();
  const base = searchPaths[0]; // e.g. "/replit-objstore-xxx/public"
  const trimmed = base.startsWith("/") ? base.slice(1) : base;
  const parts = trimmed.split("/");
  const bucketName = parts[0];
  const prefix = parts.slice(1).join("/");
  return { bucketName, prefix };
}

function objectNameFor(filename: string, prefix: string): string {
  const base = prefix ? `${prefix}/uploads` : "uploads";
  return `${base}/${filename}`;
}

const router: IRouter = Router();

async function gate(
  req: Request,
  res: Response,
  action: "read" | "write" | "delete",
): Promise<boolean> {
  const { allowed } = await requireManagerPrivilegeCheck(req, "media", action);
  if (!allowed) {
    res.status(401).json({ error: "אין הרשאה" });
    return false;
  }
  return true;
}

router.get("/media", async (req: Request, res: Response): Promise<void> => {
  if (!(await gate(req, res, "read"))) return;
  const items = await db.select().from(mediaTable).orderBy(desc(mediaTable.createdAt));
  res.json(items);
});

router.post(
  "/media/upload",
  async (req: Request, res: Response, next): Promise<void> => {
    if (!(await gate(req, res, "write"))) return;
    next();
  },
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    if (!req.file) {
      res.status(400).json({ error: "קובץ לא נמצא" });
      return;
    }
    const buf = req.file.buffer;
    if (!verifyBufferSignature(buf, req.file.mimetype)) {
      res.status(400).json({ error: "סוג הקובץ אינו תואם לתוכן" });
      return;
    }

    const ext = MIME_TO_EXT[req.file.mimetype] ?? "";
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

    try {
      const { bucketName, prefix } = getPublicUploadsBase();
      const objectName = objectNameFor(uniqueName, prefix);
      const file = objectStorageClient.bucket(bucketName).file(objectName);
      await file.save(buf, {
        contentType: req.file.mimetype,
        resumable: false,
        metadata: { contentType: req.file.mimetype },
      });
    } catch (err) {
      req.log?.error({ err }, "Failed to upload media to object storage");
      res.status(500).json({ error: "כשל בהעלאת הקובץ" });
      return;
    }

    const [item] = await db
      .insert(mediaTable)
      .values({
        objectPath: uniqueName,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      })
      .returning();
    res.status(201).json(item);
  },
);

router.put("/media/:id", async (req: Request, res: Response): Promise<void> => {
  if (!(await gate(req, res, "write"))) return;
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
  if (!(await gate(req, res, "delete"))) return;
  const id = Number(req.params.id);
  if (!id) { res.status(400).json({ error: "מזהה לא תקין" }); return; }
  const [item] = await db.select().from(mediaTable).where(eq(mediaTable.id, id));
  if (!item) { res.status(404).json({ error: "לא נמצא" }); return; }

  // Try delete from object storage (new uploads)
  try {
    const { bucketName, prefix } = getPublicUploadsBase();
    const objectName = objectNameFor(item.objectPath, prefix);
    await objectStorageClient.bucket(bucketName).file(objectName).delete({ ignoreNotFound: true });
  } catch (err) {
    req.log?.warn({ err }, "Failed to delete media from object storage (continuing)");
  }

  // Also try delete from local disk (legacy uploads)
  const filePath = path.join(UPLOADS_DIR, item.objectPath);
  try { fs.unlinkSync(filePath); } catch { /* file may already be gone */ }

  await db.delete(mediaTable).where(eq(mediaTable.id, id));
  res.json({ success: true });
});

export default router;
