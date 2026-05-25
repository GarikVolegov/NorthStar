/**
 * ml.ts — proxy leggero al Python ML Service.
 *
 * Espone al frontend (e ad altri servizi interni) gli endpoint del
 * microservizio Python su porta 8000, aggiungendo:
 *   - Autenticazione JWT (requireAuth)
 *   - Rate limiting standard
 *   - Logging strutturato con requestId
 *   - Graceful degradation se ML service non è disponibile
 *
 * Endpoints:
 *   POST /api/ml/embeddings/generate  — embedding singolo
 *   POST /api/ml/embeddings/batch     — batch embeddings
 *   POST /api/ml/analyze/trend        — trend job posting (dati nel body)
 *   POST /api/ml/analyze/weak-signals — classificazione weak signals (admin)
 *   GET  /api/ml/health               — health check ML service
 */
import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { rootLogger } from "../middleware/logger";
import { mlClient } from "@northstar/ml-client";

const router = Router();
const log    = rootLogger.child({ module: "ml-proxy" });

// ── Embed singolo (per uso interno — es. RAG con embedder gratuito) ─────────

const EmbedBodySchema = z.object({
  text: z.string().min(1).max(8000),
});

router.post("/embeddings/generate", requireAuth, async (req, res) => {
  const parsed = EmbedBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const result = await mlClient.embedText(parsed.data.text);
    res.json(result);
  } catch (e) {
    log.warn({ e }, "[ml/embeddings] service unavailable");
    res.status(503).json({ error: "ML service temporaneamente non disponibile" });
  }
});

// ── Batch embeddings ─────────────────────────────────────────────────────────

const EmbedBatchBodySchema = z.object({
  texts: z.array(z.string().min(1).max(8000)).min(1).max(200),
});

router.post("/embeddings/batch", requireAuth, async (req, res) => {
  const parsed = EmbedBatchBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const result = await mlClient.embedBatch(parsed.data.texts);
    res.json(result);
  } catch (e) {
    log.warn({ e }, "[ml/embeddings/batch] service unavailable");
    res.status(503).json({ error: "ML service temporaneamente non disponibile" });
  }
});

// ── Analisi trend (inline — dati nel body) ───────────────────────────────────

const TrendInlineBodySchema = z.object({
  role_title: z.string().min(1),
  geography:  z.string().default("IT"),
  snapshots:  z.array(z.object({
    period:         z.string(),
    count:          z.number().int().positive(),
    geography:      z.string(),
    top_skills:     z.array(z.string()).optional(),
    avg_salary_min: z.number().int().optional(),
    avg_salary_max: z.number().int().optional(),
  })).min(2),
});

router.post("/analyze/trend", requireAuth, async (req, res) => {
  const parsed = TrendInlineBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const { role_title, geography, snapshots } = parsed.data;
    const normalizedSnapshots = snapshots.map((snapshot) => ({
      period: snapshot.period,
      geography: snapshot.geography,
      count: snapshot.count,
      ...(snapshot.top_skills ? { top_skills: snapshot.top_skills } : {}),
      ...(snapshot.avg_salary_min !== undefined ? { avg_salary_min: snapshot.avg_salary_min } : {}),
      ...(snapshot.avg_salary_max !== undefined ? { avg_salary_max: snapshot.avg_salary_max } : {}),
    }));
    const result = await mlClient.analyzeTrendInline(role_title, geography, normalizedSnapshots);
    res.json(result);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("422") || msg.includes("404")) {
      res.status(422).json({ error: "Dati insufficienti per l'analisi trend" });
    } else {
      log.warn({ e }, "[ml/analyze/trend] service unavailable");
      res.status(503).json({ error: "ML service temporaneamente non disponibile" });
    }
  }
});

// ── Classificazione weak signals (solo admin) ────────────────────────────────

const WeakSignalBodySchema = z.object({
  geography: z.string().default("IT"),
  min_count: z.number().int().min(1).default(30),
  limit:     z.number().int().min(1).max(200).default(50),
  persist:   z.boolean().default(false),
});

router.post("/analyze/weak-signals", requireAuth, requireAdmin, async (req, res) => {
  const parsed = WeakSignalBodySchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    const { geography, min_count, limit, persist } = parsed.data;
    const result = await mlClient.classifyWeakSignals({ geography, minCount: min_count, limit, persist });
    log.info({
      geography, emerging: result.emerging_count, total: result.total_analyzed,
      persist, adminId: req.user?.id,
    }, "[ml/weak-signals] classification complete");
    res.json(result);
  } catch (e) {
    log.warn({ e }, "[ml/analyze/weak-signals] service unavailable");
    res.status(503).json({ error: "ML service temporaneamente non disponibile" });
  }
});

// ── Health check ─────────────────────────────────────────────────────────────

router.get("/health", async (_req, res) => {
  try {
    const health = await mlClient.health();
    res.json(health);
  } catch {
    res.status(503).json({ status: "unavailable", service: "northstar-ml" });
  }
});

export default router;
