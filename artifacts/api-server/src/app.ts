import express, { type Express } from "express";
import cors from "cors";
import { pinoHttp } from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { securityHeaders } from "./lib/security-headers.js";

const app: Express = express();

app.set("trust proxy", 1);

// ─── Security headers (before everything else) ────────────────────────────────
app.use(securityHeaders);

// ─── Request logging ─────────────────────────────────────────────────────────
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

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json({ limit: "1mb" }));        // FIX: limit body size to prevent DoS
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// ─── Health check (no auth, no rate limit) ───────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "northstar-api" });
});

app.use("/api", router);

export default app;
