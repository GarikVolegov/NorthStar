import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { z } from 'zod';

// ─── Utility: validateBody (stessa logica del middleware reale) ───────────────
function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: any, _res: any, next: any) => {
    const result = schema.safeParse(req.body);
    if (!result.success) { next(result.error); return; }
    req.body = result.data;
    next();
  };
}

// ─── Error handler (stessa logica del middleware reale) ───────────────────────
function errorHandler(err: any, _req: any, res: any, _next: any) {
  if (err?.issues) {
    return res.status(400).json({ error: 'VALIDATION_ERROR', issues: err.issues });
  }
  res.status(err?.statusCode ?? 500).json({ error: err?.code ?? 'INTERNAL_ERROR', message: err?.message });
}

// ─── Schema Zod per tailor ────────────────────────────────────────────────────
const TailorSchema = z.object({
  jobTitle: z.string().min(1).max(200),
  jobDescription: z.string().min(10).max(5000),
  targetCompany: z.string().max(200).optional(),
});

// ─── Mock AI ──────────────────────────────────────────────────────────────────
const mockAiChat = vi.fn();
vi.mock('../../lib/ai', () => ({ ai: { chat: mockAiChat } }));

// ─── App di test con route CV ─────────────────────────────────────────────────
function buildCvTestApp() {
  const app = express();
  app.use(express.json());

  // Simula auth middleware — accetta Bearer token qualsiasi in test
  const auth = (req: any, res: any, next: any) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'UNAUTHORIZED' });
    req.userId = 42;  // userId test
    next();
  };

  const cvRouter = express.Router();

  cvRouter.post('/mine/generate', auth, async (req, res, next) => {
    try {
      const generated = await mockAiChat({ useCase: 'json_extraction', messages: [] });
      res.json({ generated, savedAt: new Date().toISOString() });
    } catch (err) {
      next(err);
    }
  });

  cvRouter.post('/:userId/tailor', auth, validateBody(TailorSchema), async (req, res, next) => {
    try {
      const tailored = await mockAiChat({ useCase: 'json_extraction', messages: [], body: req.body });
      res.json({ tailored });
    } catch (err) {
      next(err);
    }
  });

  app.use('/api/cv', cvRouter);
  app.use(errorHandler);
  return app;
}

const app = buildCvTestApp();
const AUTH = 'Bearer test-token';

describe('Integration — CV generate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST /api/cv/mine/generate senza auth → 401', async () => {
    const res = await request(app).post('/api/cv/mine/generate');
    expect(res.status).toBe(401);
  });

  it('POST /api/cv/mine/generate con auth → 200 con generated', async () => {
    mockAiChat.mockResolvedValueOnce({ name: 'Mario Rossi', experience: [] });
    const res = await request(app)
      .post('/api/cv/mine/generate')
      .set('Authorization', AUTH);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('generated');
    expect(res.body).toHaveProperty('savedAt');
    expect(mockAiChat).toHaveBeenCalledTimes(1);
    expect(mockAiChat).toHaveBeenCalledWith(
      expect.objectContaining({ useCase: 'json_extraction' }),
    );
  });

  it('POST /api/cv/mine/generate — errore AI → 500', async () => {
    mockAiChat.mockRejectedValueOnce(new Error('AI provider down'));
    const res = await request(app)
      .post('/api/cv/mine/generate')
      .set('Authorization', AUTH);
    expect(res.status).toBe(500);
  });
});

describe('Integration — CV tailor con validateBody', () => {
  beforeEach(() => vi.clearAllMocks());

  it('POST /api/cv/42/tailor con body valido → 200', async () => {
    mockAiChat.mockResolvedValueOnce({ name: 'Mario', tailored: true });
    const res = await request(app)
      .post('/api/cv/42/tailor')
      .set('Authorization', AUTH)
      .send({
        jobTitle: 'Backend Engineer',
        jobDescription: 'Build scalable APIs for our European SaaS platform',
      });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('tailored');
  });

  it('POST /api/cv/42/tailor con jobDescription troppo corta → 400 VALIDATION_ERROR', async () => {
    const res = await request(app)
      .post('/api/cv/42/tailor')
      .set('Authorization', AUTH)
      .send({ jobTitle: 'Dev', jobDescription: 'corto' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('POST /api/cv/42/tailor senza jobTitle → 400', async () => {
    const res = await request(app)
      .post('/api/cv/42/tailor')
      .set('Authorization', AUTH)
      .send({ jobDescription: 'A very good job description that is long enough' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('VALIDATION_ERROR');
  });

  it('POST /api/cv/42/tailor senza auth → 401', async () => {
    const res = await request(app)
      .post('/api/cv/42/tailor')
      .send({ jobTitle: 'Dev', jobDescription: 'A valid job description that is long enough to pass' });
    expect(res.status).toBe(401);
  });
});
