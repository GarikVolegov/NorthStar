/**
 * Express application entrypoint.
 *
 * All routes are mounted here. Growth-agent routes sit behind JWT auth
 * middleware so every handler can safely read req.user.id.
 *
 * Usage (in your server entrypoint / index.ts):
 *
 *   import { assertEnv } from "./startup-env-check";
 *   import { createApp } from "./app";
 *
 *   assertEnv();
 *   const app = createApp();
 *   app.listen(Number(process.env.PORT ?? 3000), () =>
 *     console.log("[api] listening on", process.env.PORT ?? 3000)
 *   );
 */
import express from "express";
import cors from "cors";
import { json } from "express";

// ── Middleware ─────────────────────────────────────────────────────────────────
import { jwtMiddleware } from "./middleware/jwt";

// ── Cron jobs (side-effect import — registers schedules on startup) ─────────────
import "./jobs/cron";  // ← NEW: weekly digest scheduler

// ── Growth Agent routes ────────────────────────────────────────────────────────
import ingestRouter        from "./routes/growth-agent/ingest";
import chatRouter          from "./routes/growth-agent/chat";
import knowledgeRouter     from "./routes/growth-agent/knowledge";
import memoryRouter        from "./routes/growth-agent/memory";
import analyticsRouter     from "./routes/growth-agent/analytics";
import notificationsRouter from "./routes/growth-agent/notifications";  // ← NEW

export function createApp() {
  const app = express();

  // ── Global middleware ────────────────────────────────────────────────────────
  app.use(cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
    credentials: true,
  }));
  app.use(json({ limit: "20mb" }));

  // ── Health check (no auth) ───────────────────────────────────────────────────
  app.get("/health", (_req, res) => res.json({ ok: true }));

  // ── Protected routes (JWT required for everything below) ─────────────────────
  app.use("/api", jwtMiddleware);

  // ── Growth Agent ─────────────────────────────────────────────────────────────
  //
  //   POST   /api/growth-agent/ingest
  //   POST   /api/growth-agent/chat
  //   GET    /api/growth-agent/knowledge
  //   DELETE /api/growth-agent/knowledge/:id
  //   GET    /api/growth-agent/memory
  //   GET    /api/growth-agent/analytics
  //   GET    /api/growth-agent/notifications
  //   POST   /api/growth-agent/notifications/:id/read
  //
  app.use("/api/growth-agent/ingest",         ingestRouter);
  app.use("/api/growth-agent/chat",           chatRouter);
  app.use("/api/growth-agent/knowledge",      knowledgeRouter);
  app.use("/api/growth-agent/memory",         memoryRouter);
  app.use("/api/growth-agent/analytics",      analyticsRouter);
  app.use("/api/growth-agent/notifications",  notificationsRouter);  // ← NEW

  // ── 404 catch-all ─────────────────────────────────────────────────────────────
  app.use((_req, res) => res.status(404).json({ error: "Not found" }));

  // ── Error handler ─────────────────────────────────────────────────────────────
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[api] unhandled error:", err);
    res.status(500).json({ error: err.message ?? "Internal server error" });
  });

  return app;
}
