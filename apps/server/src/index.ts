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
 *                                               restituisce: id, name, email, avatarUrl,
 *                                               isPremium, isAffiliate, sectorName,
 *                                               sectorId, objectives[], ...
 *
 *   ── Stripe ────────────────────────────────────────────────────────────
 *   POST /api/stripe/webhook                  — webhook Stripe (raw body, no auth)
 *                                               gestisce: subscription.created/updated/deleted
 *                                               invalida cache profilo dopo ogni evento
 *
 *   ── Affiliate (Passo 5) ───────────────────────────────────────────────
 *   GET  /api/affiliate/dashboard             — dashboard dati
 *   POST /api/affiliate/withdraw              — richiesta prelievo
 *
 *   ── Profile (Passi 1-4) ───────────────────────────────────────────────
 *   GET  /api/users/me                        — profilo utente (stesso handler di /api/auth/me)
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
 * MIDDLEWARE STACK (ordine):
 *   1. helmet()          — security headers
 *   2. cors()            — CORS configurato da ALLOWED_ORIGINS
 *   3. morgan()          — HTTP logging (dev: dev, prod: combined)
 *   4. cookieParser()    — per leggere ns_token cookie
 *   5. /api/stripe/webhook — raw body (PRIMA di express.json)
 *   6. express.json()    — body parsing JSON
 *   7. saveRefCookie()   — intercetta ?ref=CODE sulle pagine signup/join
 */
import "dotenv/config";
import express            from "express";
import cors               from "cors";
import helmet             from "helmet";
import morgan             from "morgan";
import cookieParser       from "cookie-parser";

import { requireAuth, optionalAuth } from "./middleware/jwt";
import { saveRefCookie }             from "./affiliate/affiliate-tracking";
import { affiliateRouter }           from "./affiliate/affiliate-router";
import { profileRouter }             from "./profile/profile-router";
import { progressRouter }            from "./profile/progress-router";
import { publicProfileRouter }       from "./profile/public-profile-router";
import { riasecRouter }              from "./profile/riasec-router";
import { onboardingRouter }          from "./growth-agent/onboarding-router";
import { stripeWebhookRouter }       from "./stripe/stripe-webhook-router";

// ── App ──────────────────────────────────────────────────────────────────────

const app  = express();
const PORT = parseInt(process.env.PORT ?? "3001", 10);
const isProd = process.env.NODE_ENV === "production";

// ── CORS ─────────────────────────────────────────────────────────────────────

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
  exposedHeaders: ["X-Session-Id"],
}));

// ── Global middleware ────────────────────────────────────────────────────────

app.use(helmet({ contentSecurityPolicy: isProd }));
app.use(morgan(isProd ? "combined" : "dev"));
app.use(cookieParser());

// ── Stripe webhook (raw body — DEVE stare PRIMA di express.json) ─────────────
//
// Stripe richiede il body grezzo (Buffer/string non parsato) per validare
// la firma HMAC. Se express.json() fosse montato prima, il body verrebbe
// deserializzato e la verifica fallirebbe con "No signatures found matching".
// Il router gestisce internamente la lettura del body raw tramite req stream.
app.use("/api/stripe", stripeWebhookRouter);

// ── JSON body parser (dopo il webhook Stripe) ────────────────────────────────
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: false }));

// ── Health check (public) ────────────────────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({
    status:  "ok",
    version: process.env.npm_package_version ?? "0.0.0",
    ts:      new Date().toISOString(),
  });
});

// ── /api/auth/me — alias di /api/users/me ───────────────────────────────────
//
// useAuth() nel frontend chiama GET /api/auth/me per ottenere il profilo
// completo con objectives, sectorName, isPremium, isAffiliate.
// Montiamo lo stesso profileRouter anche su questo path:
//   GET /api/auth/me → profileRouter.get("/me") → risposta completa
//
// Nota: usiamo requireAuth qui (non nel router) così la catena middleware
// è identica a /api/users/me e il handler non deve duplicarsi.
app.use("/api/auth", requireAuth, profileRouter);

// ── Protected routes ─────────────────────────────────────────────────────────

app.use("/api/affiliate",              requireAuth, affiliateRouter);
app.use("/api/users/me",               requireAuth, profileRouter);
app.use("/api/users/me/progress",      requireAuth, progressRouter);
app.use("/api/riasec",                 requireAuth, riasecRouter);
app.use("/api/growth-agent/onboarding", requireAuth, onboardingRouter);

// ── Public routes (optional auth) ────────────────────────────────────────────

app.use("/api/u", optionalAuth, publicProfileRouter);

// ── 404 handler ──────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: "Route non trovata" });
});

// ── Global error handler ─────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (!isProd) console.error("[ERROR]", err);
  const message = isProd ? "Errore interno del server" : err.message;
  res.status(500).json({ error: message });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`┌────────────────────────────────────┐`);
  console.log(`│ 🚀 NorthStar API server              │`);
  console.log(`│    http://localhost:${PORT}               │`);
  console.log(`│    env: ${(process.env.NODE_ENV ?? "development").padEnd(25)} │`);
  console.log(`└────────────────────────────────────┘`);
});

export default app;
