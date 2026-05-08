/**
 * Route ML — NorthStar Express
 *
 * Proxy TypeScript → Python ML service.
 * Aggiunge auth, rate limiting e validazione Zod senza duplicare logica ML.
 *
 * Endpoint esposti:
 *   POST /api/v1/ml/recommend           — raccomandazioni carriera ibride
 *   POST /api/v1/ml/sector-similarity   — cosine similarity RIASEC
 *   POST /api/v1/ml/recommend-skills    — gap skill via TF-IDF
 *   POST /api/v1/ml/similar-users       — profili simili via KNN
 *   POST /api/v1/ml/profile-cluster     — cluster profilo via KMeans
 *   GET  /api/v1/ml/health              — stato servizio Python
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { mlClient, MlClientError } from '../lib/ml-client.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { aiLimiter } from '../lib/rate-limiters.js';
import { validateBody } from '../middlewares/validateBody.js';
import { getRequestLogger } from '../lib/logger.js';

const router = Router();

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const RiasecSchema = z.object({
  realistic: z.number().min(0).max(1), investigative: z.number().min(0).max(1),
  artistic: z.number().min(0).max(1),  social: z.number().min(0).max(1),
  enterprising: z.number().min(0).max(1), conventional: z.number().min(0).max(1),
});

const RecommendSchema = z.object({
  riasec: RiasecSchema,
  preferredSectors: z.array(z.string()).max(10).default([]),
  skills: z.array(z.string().max(100)).max(50).default([]),
  yearsExperience: z.number().int().min(0).max(50).default(0),
  topK: z.number().int().min(1).max(20).default(5),
});

const SimilaritySchema = z.object({
  riasec: RiasecSchema,
  topK: z.number().int().min(1).max(28).default(10),
});

const RecommendSkillsSchema = z.object({
  targetSectorId: z.string().min(1).max(100),
  currentSkills: z.array(z.string().max(100)).max(50).default([]),
  topK: z.number().int().min(1).max(20).default(8),
});

const SimilarUsersSchema = z.object({
  riasec: RiasecSchema,
  skills: z.array(z.string().max(100)).max(50).default([]),
  topK: z.number().int().min(1).max(20).default(5),
});

const ClusterSchema = z.object({ riasec: RiasecSchema });

// ─── Helper: error handler ML uniforme ───────────────────────────────────────

function handleMlError(err: unknown, res: Response, next: NextFunction) {
  if (err instanceof MlClientError) {
    const log = getRequestLogger();
    log.warn({ statusCode: err.statusCode, endpoint: err.endpoint }, '[ml] service error');
    res.status(err.statusCode === 408 ? 504 : 503).json({
      error: 'ML_SERVICE_UNAVAILABLE',
      message: 'Servizio ML temporaneamente non disponibile.',
      fallback: true,
    });
    return;
  }
  next(err);
}

// ─── POST /recommend ──────────────────────────────────────────────────────────

router.post('/recommend', requireAuth, aiLimiter, validateBody(RecommendSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.json(await mlClient.recommend({
        userId: user.id, riasec: req.body.riasec,
        preferredSectors: req.body.preferredSectors, skills: req.body.skills,
        yearsExperience: req.body.yearsExperience, isPremium: user.isPremium,
        topK: req.body.topK,
      }));
    } catch (err) { handleMlError(err, res, next); }
  },
);

// ─── POST /sector-similarity ──────────────────────────────────────────────────

router.post('/sector-similarity', requireAuth, validateBody(SimilaritySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await mlClient.sectorSimilarity({ riasec: req.body.riasec, topK: req.body.topK }));
    } catch (err) { handleMlError(err, res, next); }
  },
);

// ─── POST /recommend-skills ───────────────────────────────────────────────────

router.post('/recommend-skills', requireAuth, aiLimiter, validateBody(RecommendSkillsSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.json(await mlClient.recommendSkills({
        userId: user.id,
        targetSectorId: req.body.targetSectorId,
        currentSkills: req.body.currentSkills,
        topK: req.body.topK,
      }));
    } catch (err) { handleMlError(err, res, next); }
  },
);

// ─── POST /similar-users ──────────────────────────────────────────────────────

router.post('/similar-users', requireAuth, validateBody(SimilarUsersSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      res.json(await mlClient.similarUsers({
        userId: user.id, riasec: req.body.riasec,
        skills: req.body.skills, topK: req.body.topK,
      }));
    } catch (err) { handleMlError(err, res, next); }
  },
);

// ─── POST /profile-cluster ────────────────────────────────────────────────────

router.post('/profile-cluster', requireAuth, validateBody(ClusterSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await mlClient.profileCluster({ riasec: req.body.riasec }));
    } catch (err) { handleMlError(err, res, next); }
  },
);

// ─── GET /health ──────────────────────────────────────────────────────────────

router.get('/health', async (_req: Request, res: Response) => {
  const health = await mlClient.health();
  if (!health) {
    res.status(503).json({ status: 'degraded', module: 'northstar-ml', error: 'unreachable' });
    return;
  }
  res.json({ status: 'ok', ...health });
});

export default router;
