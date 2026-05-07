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
import { jwtMiddleware } from "./middleware/jwt"; // your existing JWT middleware

// ── Growth Agent routes ────────────────────────────────────────────────────────
import ingestRouter    from "./routes/growth-agent/ingest";
import chatRouter      from "./routes/growth-agent/chat";
import knowledgeRouter from "./routes/growth-agent/knowledge";
import memoryRouter    from "./routes/growth-agent/memory";  // ← NEW

// ── (add your other existing route imports here) ──────────────────────────────
// import authRouter     from "./routes/auth";
// import userRouter     from "./routes/user";
// import sectorsRouter  from "./routes/sectors";
// ... etc.

export function createApp() {
  const app = express();

  // ── Global middleware ────────────────────────────────────────────────────────
  app.use(cors({
    origin: process.env.FRONTEND_URL ?? "http://localhost:5173",
    credentials: true,
  }));
  app.use(json({ limit: "20mb" }));  // 20mb per large document payloads

  // ── Health check (no auth) ───────────────────────────────────────────────────
  app.get("/health", (_req, res) => res.json({ ok: true }));

  // ── Auth routes (no JWT required) ────────────────────────────────────────────
  // app.use("/api/auth", authRouter);

  // ── Protected routes (JWT required for everything below) ─────────────────────
  app.use("/api", jwtMiddleware);

  // ── Growth Agent ─────────────────────────────────────────────────────────────
  //
  //   POST   /api/growth-agent/ingest          Upload docs / persona examples
  //   POST   /api/growth-agent/chat            SSE streaming chat
  //   GET    /api/growth-agent/knowledge       List ingested sources
  //   DELETE /api/growth-agent/knowledge/:id   Delete a chunk
  //   DELETE /api/growth-agent/knowledge       Bulk delete by sourceType
  //   GET    /api/growth-agent/memory          Fatti + pattern dell'utente
  //
  app.use("/api/growth-agent/ingest",    ingestRouter);
  app.use("/api/growth-agent/chat",      chatRouter);
  app.use("/api/growth-agent/knowledge", knowledgeRouter);
  app.use("/api/growth-agent/memory",    memoryRouter);   // ← NEW

  // ── Other protected routes (add yours below) ──────────────────────────────────
  // app.use("/api/user",     userRouter);
  // app.use("/api/sectors",  sectorsRouter);

  // ── 404 catch-all ─────────────────────────────────────────────────────────────
  app.use((_req, res) => res.status(404).json({ error: "Not found" }));

  // ── Error handler ─────────────────────────────────────────────────────────────
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("[api] unhandled error:", err);
    res.status(500).json({ error: err.message ?? "Internal server error" });
  });

  return app;
}
