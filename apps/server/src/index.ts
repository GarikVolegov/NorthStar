/**
 * ⚠️  REGOLA 0 — Prima di modificare questo file leggi:
 *   → API_RULES.md  (route, auth, middleware, SSE, Stripe, error handling)
 *   → DB_RULES.md   (se tocchi accesso al DB, Drizzle, migrations, seed)
 *   → AI_RULES.md   (se aggiungi o modifichi endpoint AI / Wendy / streaming)
 *
 * index.ts — Entry point Express server NorthStar.
 *
 * PORTA: process.env.PORT ?? 3001
 *
 * ROUTE MAP:
 *   GET  /api/health                          — healthcheck (public)
 *
 *   ── Auth ──────────────────────────────────────────────────────────────
 *   GET  /api/auth/me                         — profilo completo (alias /api/users/me)
 *
 *   ── Stripe ────────────────────────────────────────────────────────────
 *   POST /api/stripe/webhook                  — webhook Stripe (raw body, no auth)
 *
 *   ── Affiliate (Passo 5) ───────────────────────────────────────────────
 *   GET  /api/affiliate/dashboard             — dashboard dati
 *   POST /api/affiliate/withdraw              — richiesta prelievo
 *
 *   ── Profile (Passi 1-4) ───────────────────────────────────────────────
 *   GET  /api/users/me                        — profilo utente
 *   PATCH /api/users/me                       — aggiorna profilo
 *   POST /api/users/me/objectives             — aggiunge obiettivo
 *   GET  /api/users/me/progress               — XP, streak, timeline
 *   POST /api/users/me/progress/xp            — assegna XP
 *   GET  /api/u/:username                     — profilo pubblico (opzionale auth)
 *   GET  /api/riasec/session/:sessionId       — RIASEC profile
 *
 *   ── Growth Agent (Passo 6) ────────────────────────────────────────────
 *   GET  /api/growth-agent/onboarding/status  — needsOnboarding
 *   POST /api/growth-agent/onboarding         — primo msg Wendy (SSE)
 *
 *   ── Network (Step 1) ──────────────────────────────────────────────────
 *   GET    /api/friends                       — lista amici accettati
 *   GET    /api/friends/requests              — richieste ricevute
 *   GET    /api/friends/suggestions           — utenti suggeriti
 *   POST   /api/friends/request/:id           — invia richiesta
 *   PUT    /api/friends/:id/accept            — accetta richiesta
 *   DELETE /api/friends/:id                   — rimuovi / rifiuta
 *
 * MIDDLEWARE STACK (ordine):
 *   1. helmet()           — security headers
 *   2. cors()             — CORS configurato da ALLOWED_ORIGINS
 *   3. cookieParser()     — per leggere ns_token cookie
 *   4. requestLogger()    — requestId + log strutturati (pino)
 *   5. /api/stripe/webhook — raw body (PRIMA di express.json)
 *   6. express.json()     — body parsing JSON
 *   7. saveRefCookie()    — intercetta ?ref=CODE sulle pagine signup/join
 *
 * ENV:
 *   LOG_LEVEL  — trace|debug|info|warn|error|fatal (default: info in prod, debug in dev)
 */
import "dotenv/config";
import express         from "express";
import cors            from "cors";
import helmet          from "helmet";
import cookieParser    from "cookie-parser";

import { logger }                      from "./lib/logger";
import { requestLogger }               from "./middleware/request-logger";
import { requireAuth, optionalAuth }   from "./middleware/jwt";
import { saveRefCookie }               from "./affiliate/affiliate-tracking";
import { affiliateRouter }             from "./affiliate/affiliate-router";
import { profileRouter }               from "./profile/profile-router";
import { progressRouter }              from "./profile/progress-router";
import { publicProfileRouter }         from "./profile/public-profile-router";
import { riasecRouter }                from "./profile/riasec-router";
import { onboardingRouter }            from "./growth-agent/onboarding-router";
import { stripeWebhookRouter }         from "./stripe/stripe-webhook-router";
import { networkRouter }               from "./network/network-router";

// ── App ───────────────────────────────────────────────────────────────────────

const app    = express();
const PORT   = parseInt(process.env.PORT ?? "3001", 10);
const isProd = process.env.NODE_ENV === "production";

// ── CORS ──────────────────────────────────────────────────────────────────────

const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ?? "http://localhost:3000,http://localhost:5173"
).split(",").map((s) => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origine non permessa: ${origin}`));
  },
  credentials:    true,
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["X-Session-Id", "X-Request-Id"],
}));

// ── Global middleware ─────────────────────────────────────────────────────────

app.use(helmet({ contentSecurityPolicy: isProd }));
app.use(cookieParser());

// requestLogger: genera requestId, inietta req.log, logga req/res
// Montato subito dopo i security middleware, prima di tutto il resto.
app.use(requestLogger);

// ── Stripe webhook (raw body — DEVE stare PRIMA di express.json) ──────────────
app.use("/api/stripe", stripeWebhookRouter);

// ── JSON body parser ──────────────────────────────────────────────────────────
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));

// ── Health check (public) ─────────────────────────────────────────────────────

app.get("/api/health", (req, res) => {
  const log = (req as import("./middleware/request-logger").RequestWithLog).log ?? logger;
  log.debug("healthcheck");
  res.json({
    status:  "ok",
    version: process.env.npm_package_version ?? "0.0.0",
    ts:      new Date().toISOString(),
  });
});

// ── /api/auth/me — alias di /api/users/me ────────────────────────────────────
app.use("/api/auth", requireAuth, profileRouter);

// ── Protected routes ──────────────────────────────────────────────────────────

app.use("/api/affiliate",               requireAuth, affiliateRouter);
app.use("/api/users/me",                requireAuth, profileRouter);
app.use("/api/users/me/progress",       requireAuth, progressRouter);
app.use("/api/riasec",                  requireAuth, riasecRouter);
app.use("/api/growth-agent/onboarding", requireAuth, onboardingRouter);
app.use("/api/friends",                 requireAuth, networkRouter);

// ── Public routes (optional auth) ─────────────────────────────────────────────

app.use("/api/u", optionalAuth, publicProfileRouter);

// ── 404 handler ───────────────────────────────────────────────────────────────

app.use((req: express.Request, res: express.Response) => {
  const log = (req as import("./middleware/request-logger").RequestWithLog).log ?? logger;
  log.warn({ url: req.originalUrl }, "route non trovata");
  res.status(404).json({ error: "Route non trovata" });
});

// ── Global error handler ──────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const log = (req as import("./middleware/request-logger").RequestWithLog).log ?? logger;
  log.error(
    {
      err,
      url:    req.originalUrl,
      method: req.method,
    },
    "unhandled error",
  );
  const message = isProd ? "Errore interno del server" : err.message;
  res.status(500).json({ error: message });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  logger.info(
    {
      port: PORT,
      env:  process.env.NODE_ENV ?? "development",
      logLevel: process.env.LOG_LEVEL ?? (isProd ? "info" : "debug"),
    },
    "🚀 NorthStar API server avviato",
  );
});

export default app;
