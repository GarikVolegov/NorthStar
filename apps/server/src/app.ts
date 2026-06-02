import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appEnvDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: path.join(appEnvDir, ".env") });
dotenv.config({ path: path.join(appEnvDir, ".env.local"), override: true });

import "express-async-errors";
process.on("unhandledRejection", (reason) => {
  rootLogger.fatal({ err: reason }, "[fatal] Unhandled Promise rejection");
  captureServerException(reason, { source: "unhandledRejection" });
});
import express from "express";
import cors from "cors";
import helmet from "helmet";
import {
  getMetricsContentType,
  getMetrics,
} from "@workspace/ai-server/metrics";
import { requestLoggerMiddleware, rootLogger } from "./middleware/logger";
import { globalLimiter } from "./middleware/rate-limit";
import { requireRateLimitRedis } from "./lib/rate-limit-redis";
import { metricsProtection } from "./middleware/metrics-protection";
import { record } from "./lib/monitor";
import { maintenanceModeMiddleware } from "./lib/maintenance-mode";
import { executionMonitor } from "./lib/execution-monitor";
import { captureServerException, captureServerMessage } from "./sentry";
import { registerPublicRoutes } from "./route-registry-public";
import { registerAuthenticatedRoutes } from "./route-registry-authenticated";
import { registerAdminRoutes } from "./route-registry-admin";
import { logSecurityEvent } from "./lib/security-events";
import { buildCorsAllowlist, isCorsOriginAllowed } from "./lib/cors-origin";

const app = express();
app.set("trust proxy", 1);

const corsAllowlist = buildCorsAllowlist();

function getRequestOrigin(req: express.Request): string | undefined {
  const host = req.get("host");
  if (!host) return undefined;

  const forwardedProto = req.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return `${forwardedProto || req.protocol}://${host}`;
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        scriptSrc: [
          "'self'",
          "https://accounts.google.com",
          "https://clerk.com",
          "https://*.clerk.com",
          "https://*.clerk.accounts.dev",
        ],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "https:"],
        connectSrc: ["'self'", "https:", "wss:"],
        frameSrc: [
          "'self'",
          "https://accounts.google.com",
          "https://clerk.com",
          "https://*.clerk.com",
          "https://*.clerk.accounts.dev",
        ],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  }),
);
app.use((req, res, next) => {
  const requestOrigin = getRequestOrigin(req);
  return cors({
    origin: (origin, callback) => {
      if (isCorsOriginAllowed(origin, process.env, corsAllowlist, requestOrigin)) {
        return callback(null, true);
      }
      logSecurityEvent("cors_blocked", {
        origin,
        detail: `allowed=${[...corsAllowlist].join(",")}`,
      });
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })(req, res, next);
});
app.use("/api/subscription/webhook", express.raw({ type: "application/json" }));
app.use(express.json({ limit: "10mb" }));
app.use(requestLoggerMiddleware);
app.use(requireRateLimitRedis);
app.use(globalLimiter);
app.use(maintenanceModeMiddleware);

app.use((_req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    record(res.statusCode, Date.now() - start);
  });
  next();
});

registerPublicRoutes(app);
registerAuthenticatedRoutes(app);
registerAdminRoutes(app);

app.post("/api/admin/observability/test-error", (req, res) => {
  const enabled =
    process.env.OBS_TEST_ERROR_ENABLED === "true" &&
    process.env.NODE_ENV !== "production";

  if (!enabled) {
    res.status(404).json({ error: "Not Found" });
    return;
  }

  const error = new Error("Synthetic observability test error");
  captureServerException(error, {
    route: "POST /api/admin/observability/test-error",
    userId: req.user?.id,
    requestId: req.requestId,
  });
  captureServerMessage("Synthetic observability alert drill", {
    route: "POST /api/admin/observability/test-error",
    userId: req.user?.id,
    requestId: req.requestId,
  });
  res.status(500).json({
    error: "Synthetic observability test error",
    requestId: req.requestId,
  });
});

app.get("/api/metrics", metricsProtection, async (_req, res) => {
  try {
    res.setHeader("Content-Type", getMetricsContentType());
    const metrics = await getMetrics();
    res.send(metrics);
  } catch (err) {
    rootLogger.error({ err }, "failed to serve metrics");
    res.status(500).json({ error: "metrics unavailable" });
  }
});

app.get("/api", (_req, res) => {
  res.json({
    message: "NorthStar API Server",
    version: "0.1.0",
    endpoints: {
      health: "/api/health",
      metrics: "/api/metrics",
    },
  });
});

app.use("/api/*", (_req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: "The requested endpoint does not exist",
  });
});

app.use(
  (
    err: unknown,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    (req.log ?? rootLogger).error({ err }, "unhandled error");
    captureServerException(err, {
      method: req.method,
      path: req.originalUrl ?? req.url,
      requestId: req.requestId,
      userId: req.user?.id,
    });
    // Step Foundation: cattura strutturata per /api/admin/error-report
    try {
      executionMonitor.capture(err, {
        file: "app.ts",
        function: `${req.method} ${req.originalUrl ?? req.url ?? "<unknown>"}`,
      });
    } catch {
      /* fire-and-forget */
    }
    res.status(500).json({
      error: "Internal Server Error",
      message: "Something went wrong",
    });
  },
);

export default app;
