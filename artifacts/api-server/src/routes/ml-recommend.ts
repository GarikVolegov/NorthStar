/**
 * Route: POST /api/v1/ml/recommend
 *        POST /api/v1/ml/sector-similarity
 *        GET  /api/v1/ml/health
 *
 * Proxy TypeScript → Python ML service.
 * Aggiunge auth, rate limiting e logging senza duplicare logica ML.
 *
 * Integrazione in routes/index.ts:
 *   import mlRecommendRouter from './ml-recommend';
 *   v1.use('/ml', mlRecommendRouter);
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { mlClient, MlClientError } from '../lib/ml-client.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { aiLimiter } from '../lib/rate-limiters.js';
import { validateBody } from '../middlewares/validateBody.js';
import { logger } from '../lib/logger.js';

const router = Router();

// ─── Zod schemas — validazione TypeScript prima di chiamare Python ─────────────

const RiasecSchema = z.object({
  realistic:     z.number().min(0).max(1),
  investigative: z.number().min(0).max(1),
  artistic:      z.number().min(0).max(1),
  social:        z.number().min(0).max(1),
  enterprising:  z.number().min(0).max(1),
  conventional:  z.number().min(0).max(1),
});

const RecommendSchema = z.object({
  riasec:           RiasecSchema,
  preferredSectors: z.array(z.string()).max(10).default([]),
  skills:           z.array(z.string().max(100)).max(50).default([]),
  yearsExperience:  z.number().int().min(0).max(50).default(0),
  topK:             z.number().int().min(1).max(20).default(5),
});

const SimilaritySchema = z.object({
  riasec: RiasecSchema,
  topK:   z.number().int().min(1).max(28).default(10),
});

// ─── POST /recommend ──────────────────────────────────────────────────────────

router.post(
  '/recommend',
  requireAuth,
  aiLimiter,
  validateBody(RecommendSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user;
      const result = await mlClient.recommend({
        userId:           user.id,
        riasec:           req.body.riasec,
        preferredSectors: req.body.preferredSectors,
        skills:           req.body.skills,
        yearsExperience:  req.body.yearsExperience,
        isPremium:        user.isPremium,
        topK:             req.body.topK,
      });
      res.json(result);
    } catch (err) {
      if (err instanceof MlClientError) {
        logger.warn({ statusCode: err.statusCode, endpoint: err.endpoint }, 'ML service error');
        // Degrada gracefully: il frontend può mostrare raccomandazioni LLM come fallback
        res.status(err.statusCode === 408 ? 504 : 503).json({
          error: 'ML_SERVICE_UNAVAILABLE',
          message: 'Servizio di raccomandazione temporaneamente non disponibile.',
          fallback: true,
        });
        return;
      }
      next(err);
    }
  },
);

// ─── POST /sector-similarity ──────────────────────────────────────────────────

router.post(
  '/sector-similarity',
  requireAuth,
  validateBody(SimilaritySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await mlClient.sectorSimilarity({
        riasec: req.body.riasec,
        topK:   req.body.topK,
      });
      res.json(result);
    } catch (err) {
      if (err instanceof MlClientError) {
        res.status(503).json({ error: 'ML_SERVICE_UNAVAILABLE', fallback: true });
        return;
      }
      next(err);
    }
  },
);

// ─── GET /health (no auth — usato da monitoring) ─────────────────────────────

router.get('/health', async (_req: Request, res: Response) => {
  const health = await mlClient.health();
  if (!health) {
    res.status(503).json({ status: 'degraded', module: 'northstar-ml', error: 'unreachable' });
    return;
  }
  res.json({ status: 'ok', ...health });
});

export default router;
