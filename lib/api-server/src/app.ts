/**
 * Express application entrypoint.
 */
import express from "express";
import cors from "cors";
import { json } from "express";
import requestID from "express-request-id";

import { loggingMiddleware, logger } from "./middleware/loggingMiddleware";
import { jwtMiddleware } from "./middleware/jwt";
import {
  loginLimiter,
  aiChatLimiter,
  apiLimiter,
  publicLimiter,
  adminLimiter,
} from "./middleware/rate-limiters";
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
import pageContextRouter   from "./routes/growth-agent/page-context";

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

  // ── Observability ───────────────────────────────────────────────────────────
  app.use(requestID({ headerName: "X-Request-Id" }));
  app.use(loggingMiddleware);

  app.use(cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
    credentials: true,
  }));
  app.use(json({ limit: "20mb" }));

  // ── Public routes (no auth, IP-keyed rate limit) ────────────────────────────
  app.get("/health", publicLimiter, (_req, res) => res.json({ ok: true }));
  app.use(publicLimiter, ogProfileRouter);

  // ── Auth routes (brute-force protected) ─────────────────────────────────────
  // loginLimiter is applied before jwtMiddleware so it runs pre-authentication.
  // Mount any future /api/auth/* routes here with loginLimiter prepended.
  app.use("/api/auth", loginLimiter);

  // ── JWT authentication — all /api/* routes require a valid token ────────────
  app.use("/api", jwtMiddleware);

  // ── Growth Agent ─────────────────────────────────────────────────
  // SSE chat gets its own strict limiter (OpenAI cost guard)
  app.use("/api/growth-agent/chat",          aiChatLimiter, chatRouter);
  // All other growth-agent routes share the generic api limiter
  app.use("/api/growth-agent/ingest",        apiLimiter, ingestRouter);
  app.use("/api/growth-agent/knowledge",     apiLimiter, knowledgeRouter);
  app.use("/api/growth-agent/memory",        apiLimiter, memoryRouter);
  app.use("/api/growth-agent/analytics",     apiLimiter, analyticsRouter);
  app.use("/api/growth-agent/notifications", apiLimiter, notificationsRouter);
  app.use("/api/growth-agent/feedback",      apiLimiter, feedbackRouter);
  app.use("/api/growth-agent/page-context",  apiLimiter, pageContextRouter);

  // ── Discovery Agent ───────────────────────────────────────────────
  app.use("/api/discovery/feed",   apiLimiter, discoveryFeedRouter);
  app.use("/api/discovery/saved",  apiLimiter, discoverySavedRouter);
  app.use("/api/discovery/seen",   apiLimiter, seenRouter);

  // ── Admin (dedicated limiter protects expensive DB queries) ─────────────────
  app.use("/api/admin/discovery/collect",    adminLimiter, discoveryCollectRouter);
  app.use("/api/admin/discovery/sources",    adminLimiter, discoverySourcesRouter);
  app.use("/api/admin/discovery/items",      adminLimiter, discoveryItemsRouter);
  app.use("/api/admin/discovery/enrich",     adminLimiter, discoveryEnrichRouter);
  app.use("/api/admin/analyze-supervisor",   adminLimiter, analyzeSupervisorRouter);
  app.use("/api/admin/agent-health",         adminLimiter, agentHealthRouter);
  app.use("/api/admin/stats",                adminLimiter, adminStatsRouter);
  app.use("/api/admin/users",                adminLimiter, adminUsersRouter);
  app.use("/api/admin/revenue",              adminLimiter, adminRevenueRouter);

  // ── Gamification ─────────────────────────────────────────────────────
  app.use("/api/voice",       apiLimiter, voiceRouter);
  app.use("/api/leaderboard", apiLimiter, leaderboardRouter);

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));

  app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const log = (req as any).log ?? logger;
    log.error({ err }, "unhandled error");
    res.status(500).json({ error: err.message ?? "Internal server error" });
  });

  return app;
}
