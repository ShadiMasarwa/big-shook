import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { rateLimit } from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";
import { validateSession } from "./middlewares/validateSession.js";
import { ObjectStorageService } from "./lib/objectStorage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, "../uploads");

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".heic": "image/heic",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogv": "video/ogg",
  ".mov": "video/quicktime",
  ".avi": "video/x-msvideo",
};

function safeFilename(name: string): string | null {
  if (!name || name.includes("/") || name.includes("\\") || name.includes("..")) return null;
  return name;
}

async function streamUpload(req: Request, res: Response): Promise<void> {
  const raw = req.params.filename;
  const filename = safeFilename(typeof raw === "string" ? raw : "");
  if (!filename) { res.status(400).end(); return; }

  const ext = path.extname(filename).toLowerCase();
  const contentType = MIME_BY_EXT[ext] ?? "application/octet-stream";
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'");
  res.setHeader("Content-Type", contentType);

  // 1) Try Replit Object Storage (where new uploads land)
  try {
    const svc = new ObjectStorageService();
    const file = await svc.searchPublicObject(`uploads/${filename}`);
    if (file) {
      const [metadata] = await file.getMetadata();
      if (metadata.size) res.setHeader("Content-Length", String(metadata.size));
      res.setHeader("Cache-Control", "public, max-age=604800");
      file.createReadStream()
        .on("error", (err) => {
          req.log?.error({ err }, "Object storage stream error");
          if (!res.headersSent) res.status(500).end();
          else res.destroy();
        })
        .pipe(res);
      return;
    }
  } catch (err) {
    req.log?.warn({ err, filename }, "Object storage lookup failed; trying disk");
  }

  // 2) Fallback to local disk (legacy uploads shipped with the deploy)
  const diskPath = path.join(UPLOADS_DIR, filename);
  if (fs.existsSync(diskPath)) {
    const stat = fs.statSync(diskPath);
    res.setHeader("Content-Length", String(stat.size));
    res.setHeader("Cache-Control", "public, max-age=604800");
    fs.createReadStream(diskPath)
      .on("error", () => { if (!res.headersSent) res.status(500).end(); else res.destroy(); })
      .pipe(res);
    return;
  }

  res.setHeader("Cache-Control", "no-store");
  res.status(404).end();
}

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Broad auth limiter: protects all /api/auth/* endpoints from scraping/spam
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "יותר מדי בקשות. נסה שוב מאוחר יותר." },
});

// Strict limiter for sensitive credential endpoints (login, OTP verify, password reset)
const strictAuthRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "יותר מדי ניסיונות. נסה שוב מאוחר יותר." },
});

app.use("/api/auth", authRateLimit);
app.use("/api/auth/login", strictAuthRateLimit);
app.use("/api/auth/verify-otp", strictAuthRateLimit);
app.use("/api/auth/reset-password", strictAuthRateLimit);
app.use("/api/auth/send-otp", strictAuthRateLimit);

app.get("/api/uploads/:filename", streamUpload);

// Global bearer-session validation: enforces isActive and sessionInvalidatedAt
// for ALL API routes. Requests without Authorization headers pass through.
app.use("/api", validateSession);

app.use("/api", router);

export default app;
