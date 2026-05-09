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
 *   ── Affiliate (Passo 5) ───────────────────────────────
 *   GET  /api/affiliate/dashboard             — dashboard dati
 *   POST /api/affiliate/withdraw              — richiesta prelievo
 *
 *   ── Profile (Passi 1-4) ────────────────────────────
 *   GET  /api/users/me                        — profilo utente
 *   PATCH /api/users/me                       — aggiorna profilo
 *   POST /api/users/me/objectives             — aggiunge obiettivo
 *   GET  /api/users/me/progress               — XP, streak, timeline
 *   POST /api/users/me/progress/xp            — assegna XP
 *   GET  /api/u/:username                     — profilo pubblico (opzionale auth)
 *   GET  /api/riasec/session/:sessionId       — RIASEC profile
 *
 *   ── Growth Agent (Passo 6) ──────────────────────────
 *   GET  /api/growth-agent/onboarding/status  — needsOnboarding
 *   POST /api/growth-agent/onboarding         — primo msg Wendy (SSE)
 *
 * MIDDLEWARE STACK (ordine):
 *   1. helmet()          — security headers
 *   2. cors()            — CORS configurato da ALLOWED_ORIGINS
 *   3. morgan()          — HTTP logging (dev: dev, prod: combined)
 *   4. cookieParser()    — per leggere ns_token cookie
 *   5. express.json()    — body parsing JSON
 *   6. saveRefCookie()   — intercetta ?ref=CODE sulle pagine signup/join
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

// ── App ─────────────────────────────────────────────────────────────────────

const app  = express();
const PORT = parseInt(process.env.PORT ?? "3001", 10);
const isProd = process.env.NODE_ENV === "production";

// ── CORS ──────────────────────────────────────────────────────────────────

const allowedOrigins = (
  process.env.ALLOWED_ORIGINS ?? "http://localhost:3000,http://localhost:5173"
).split(",").map((s) => s.trim()).filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Permetti richieste senza origin (Postman, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origine non permessa: ${origin}`));
  },
  credentials:     true,   // necessario per cookie ns_token
  allowedHeaders:  ["Content-Type", "Authorization"],
  exposedHeaders:  ["X-Session-Id"],
}));

// ── Global middleware ────────────────────────────────────────────────────────

app.use(helmet({
  // Disabilita contentSecurityPolicy per evitare blocchi su SSE in dev
  contentSecurityPolicy: isProd,
}));
app.use(morgan(isProd ? "combined" : "dev"));
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));   // 2MB per upload CV
app.use(express.urlencoded({ extended: false }));

// ── Health check (public, nessun auth) ─────────────────────────────────────

app.get("/api/health", (_req, res) => {
  res.json({
    status:  "ok",
    version: process.env.npm_package_version ?? "0.0.0",
    ts:      new Date().toISOString(),
  });
});

// ── Referral cookie middleware (intercetta ?ref= PRIMA del JWT) ─────────────
// Montato su /signup e /join (pagine landing del frontend servite da Next.js).
// Se il tuo frontend è su un altro server puoi rimuovere questo blocco
// e gestirlo lato Next.js con clientRefTracking.save().
// app.get("/signup", saveRefCookie, (_req, res) => res.redirect("http://localhost:3000/signup"));
// app.get("/join",   saveRefCookie, (_req, res) => res.redirect("http://localhost:3000/signup"));

// ── Protected routes ───────────────────────────────────────────────────────────

// Affiliate (Passo 5)
app.use("/api/affiliate",                     requireAuth, affiliateRouter);

// Profile (Passi 1–4)
app.use("/api/users/me",                       requireAuth, profileRouter);
app.use("/api/users/me/progress",              requireAuth, progressRouter);
app.use("/api/riasec",                         requireAuth, riasecRouter);

// Growth Agent onboarding (Passo 6)
app.use("/api/growth-agent/onboarding",        requireAuth, onboardingRouter);

// ── Public routes (optional auth) ───────────────────────────────────────────

// Profilo pubblico /api/u/:username — optionalAuth per personalizzazione
app.use("/api/u",                              optionalAuth, publicProfileRouter);

// ── 404 handler ──────────────────────────────────────────────────────────────────

app.use((_req, res) => {
  res.status(404).json({ error: "Route non trovata" });
});

// ── Global error handler ───────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (!isProd) console.error("[ERROR]", err);
  // Non esporre stack trace in produzione
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

export default app; // per i test
