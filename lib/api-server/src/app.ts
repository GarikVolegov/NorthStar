/**
 * Express application entrypoint.
 *
 * All routes are mounted here. Growth-agent routes sit behind JWT auth
 * middleware so every handler can safely read req.user.id.
 */
import express from "express";
import cors from "cors";
import { json } from "express";

// ── Middleware ───────────────────────────────────────────────────────────────────────────
import { jwtMiddleware } from "./middleware/jwt";

// ── Cron jobs (side-effect import) ─────────────────────────────────────────────────────
import "./jobs/cron";

// ── Growth Agent routes ──────────────────────────────────────────────────────────
import ingestRouter        from "./routes/growth-agent/ingest";
import chatRouter          from "./routes/growth-agent/chat";
import knowledgeRouter     from "./routes/growth-agent/knowledge";
import memoryRouter        from "./routes/growth-agent/memory";
import analyticsRouter     from "./routes/growth-agent/analytics";
import notificationsRouter from "./routes/growth-agent/notifications";
import feedbackRouter      from "./routes/growth-agent/feedback";      // Phase 7

// ── Admin routes ───────────────────────────────────────────────────────────────────
import analyzeSupervisorRouter from "./routes/admin/analyze-supervisor"; // Phase 6
import agentHealthRouter       from "./routes/admin/agent-health";        // Phase 11

export function createApp() {
  const app = express();

  app.use(cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
    credentials: true,
  }));
  app.use(json({ limit: "20mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/api", jwtMiddleware);

  // Growth Agent
  //   POST   /api/growth-agent/ingest
  //   POST   /api/growth-agent/chat
  //   GET    /api/growth-agent/knowledge
  //   DELETE /api/growth-agent/knowledge/:id
  //   GET    /api/growth-agent/memory
  //   GET    /api/growth-agent/analytics
  //   GET    /api/growth-agent/notifications
  //   POST   /api/growth-agent/notifications/:id/read
  //   POST   /api/growth-agent/feedback           (Phase 7)
  app.use("/api/growth-agent/ingest",         ingestRouter);
  app.use("/api/growth-agent/chat",           chatRouter);
  app.use("/api/growth-agent/knowledge",      knowledgeRouter);
  app.use("/api/growth-agent/memory",         memoryRouter);
  app.use("/api/growth-agent/analytics",      analyticsRouter);
  app.use("/api/growth-agent/notifications",  notificationsRouter);
  app.use("/api/growth-agent/feedback",       feedbackRouter);

  // Admin
  //   POST /api/admin/analyze-supervisor      (Phase 6)
  //   GET  /api/admin/agent-health            (Phase 11)
  app.use("/api/admin/analyze-supervisor",    analyzeSupervisorRouter);
  app.use("/api/admin/agent-health",          agentHealthRouter);

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[api] unhandled error:", err);
    res.status(500).json({ error: err.message ?? "Internal server error" });
  });

  return app;
}
