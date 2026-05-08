/**
 * Express application entrypoint.
 */
import express from "express";
import cors from "cors";
import { json } from "express";
import requestID from "express-request-id";

import { loggingMiddleware, logger } from "./middleware/loggingMiddleware";
import { jwtMiddleware } from "./middleware/jwt";
import "./jobs/cron";

// OG Image (public — no auth)
import { ogProfileRouter } from "./routes/og";

// Growth Agent
import ingestRouter        from "./routes/growth-agent/ingest";
import chatRouter          from "./routes/growth-agent/chat";
import knowledgeRouter     from "./routes/growth-agent/knowledge";
import memoryRouter        from "./routes/growth-agent/memory";
import analyticsRouter     from "./routes/growth-agent/analytics";
import notificationsRouter from "./routes/growth-agent/notifications";
import feedbackRouter      from "./routes/growth-agent/feedback";

// Discovery Agent System
import discoveryFeedRouter                  from "./routes/discovery/feed";
import discoverySavedRouter, { seenRouter } from "./routes/discovery/saved";

// Admin
import analyzeSupervisorRouter  from "./routes/admin/analyze-supervisor";
import agentHealthRouter        from "./routes/admin/agent-health";
import discoveryCollectRouter   from "./routes/admin/discovery-collect";
import discoverySourcesRouter   from "./routes/admin/discovery-sources";
import discoveryItemsRouter     from "./routes/admin/discovery-items";
import discoveryEnrichRouter    from "./routes/admin/discovery-enrich";
import adminStatsRouter         from "./routes/admin/stats";
import adminUsersRouter         from "./routes/admin/users";
import adminRevenueRouter       from "./routes/admin/revenue";

// Phase 3 — Gamification
import voiceRouter       from "./routes/voice";
import leaderboardRouter from "./routes/leaderboard";

export function createApp() {
  const app = express();

  // ── Observability ──────────────────────────────────────────────────────────
  // 1. Assign X-Request-Id UUID to req.id (or propagate from incoming header).
  app.use(requestID({ headerName: "X-Request-Id" }));
  // 2. Mount pino child logger on req.log and set X-Request-Id response header.
  app.use(loggingMiddleware);
  // ───────────────────────────────────────────────────────────────────────────

  app.use(cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
    credentials: true,
  }));
  app.use(json({ limit: "20mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use(ogProfileRouter);

  app.use("/api", jwtMiddleware);

  // Growth Agent
  app.use("/api/growth-agent/ingest",        ingestRouter);
  app.use("/api/growth-agent/chat",          chatRouter);
  app.use("/api/growth-agent/knowledge",     knowledgeRouter);
  app.use("/api/growth-agent/memory",        memoryRouter);
  app.use("/api/growth-agent/analytics",     analyticsRouter);
  app.use("/api/growth-agent/notifications", notificationsRouter);
  app.use("/api/growth-agent/feedback",      feedbackRouter);

  // Discovery Agent System
  app.use("/api/discovery/feed",   discoveryFeedRouter);
  app.use("/api/discovery/saved",  discoverySavedRouter);
  app.use("/api/discovery/seen",   seenRouter);

  // Admin — Discovery
  app.use("/api/admin/discovery/collect",    discoveryCollectRouter);
  app.use("/api/admin/discovery/sources",    discoverySourcesRouter);
  app.use("/api/admin/discovery/items",      discoveryItemsRouter);
  app.use("/api/admin/discovery/enrich",     discoveryEnrichRouter);

  // Admin — System
  app.use("/api/admin/analyze-supervisor",   analyzeSupervisorRouter);
  app.use("/api/admin/agent-health",         agentHealthRouter);

  // Admin — Dashboard KPI + Users + Revenue
  app.use("/api/admin/stats",   adminStatsRouter);
  app.use("/api/admin/users",   adminUsersRouter);
  app.use("/api/admin/revenue", adminRevenueRouter);

  // Phase 3 — Gamification
  app.use("/api/voice",       voiceRouter);
  app.use("/api/leaderboard", leaderboardRouter);

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));

  // Global error handler — uses req.log for structured output with requestId.
  app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const log = (req as any).log ?? logger;
    log.error({ err }, "unhandled error");
    res.status(500).json({ error: err.message ?? "Internal server error" });
  });

  return app;
}
