import express, { type Express } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { securityHeaders } from "./lib/security-headers.js";
import { globalRateLimiter } from "./lib/global-rate-limiter.js";

const app: Express = express();

app.set("trust proxy", 1);

// ─── 1. Security headers (first — before any response is sent) ────────────────
app.use(securityHeaders);

// ─── 2. Request logging ───────────────────────────────────────────────────────
app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req: Record<string, any>) {
        return { id: req["id"], method: req["method"], url: req["url"]?.split("?")[0] };
      },
      res(res: Record<string, any>) {
        return { statusCode: res["statusCode"] };
      },
    },
  }),
);

// ─── 3. Body parsing (1mb limit prevents DoS via large payloads) ──────────────
// CORS: restrict to frontend origin in production via CORS_ORIGIN env var
const allowedOrigin = process.env.CORS_ORIGIN ?? "http://localhost:5000";
app.use(cors({
  origin: allowedOrigin,
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ─── 4. Global rate limiting (200 req/min per IP, all routes) ────────────────
app.use(globalRateLimiter);

// ─── 5. Health check (no auth, exempt from rate limit) ───────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "northstar-api", timestamp: new Date().toISOString() });
});

// ─── 6. API routes ────────────────────────────────────────────────────────────
app.use("/api", router);

export default app;
