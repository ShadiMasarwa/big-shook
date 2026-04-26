import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import { rateLimit } from "express-rate-limit";
import router from "./routes";
import { logger } from "./lib/logger";
import { validateSession } from "./middlewares/validateSession.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.resolve(__dirname, "../uploads");

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

app.use("/api/uploads", (_req, res, next) => {
  res.setHeader("Content-Disposition", "attachment");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "default-src 'none'");
  next();
}, express.static(UPLOADS_DIR, { maxAge: "7d" }));

// Global bearer-session validation: enforces isActive and sessionInvalidatedAt
// for ALL API routes. Requests without Authorization headers pass through.
app.use("/api", validateSession);

app.use("/api", router);

export default app;
