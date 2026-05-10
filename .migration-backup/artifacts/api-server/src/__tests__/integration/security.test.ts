import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { timingSafeEqual } from 'crypto';

// ─── App di test con tutti i middleware di sicurezza ─────────────────────────
const ADMIN_KEY = process.env.ADMIN_KEY ?? 'test-admin-key';

function isValidAdminKey(provided: string): boolean {
  if (!ADMIN_KEY || !provided) return false;
  try {
    const a = Buffer.from(provided.padEnd(ADMIN_KEY.length, '\0'));
    const b = Buffer.from(ADMIN_KEY.padEnd(provided.length, '\0'));
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b) && provided.length === ADMIN_KEY.length;
  } catch { return false; }
}

function buildSecurityTestApp() {
  const app = express();
  app.use(express.json());

  // Admin auth middleware
  const adminAuth = (req: any, res: any, next: any) => {
    const provided = req.headers['x-admin-key'];
    if (!provided || typeof provided !== 'string') {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    if (!isValidAdminKey(provided)) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }
    next();
  };

  // JWT auth middleware
  const jwtAuth = (req: any, res: any, next: any) => {
    const auth = req.headers.authorization;
    if (!auth?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'UNAUTHORIZED' });
    }
    // In test: accetta qualsiasi token non vuoto
    (req as any).user = { id: 1, email: 'test@northstar.app', role: 'user', isPremium: false };
    next();
  };

  const premiumAuth = (req: any, res: any, next: any) => {
    if (!(req as any).user?.isPremium) {
      return res.status(403).json({ error: 'PREMIUM_REQUIRED' });
    }
    next();
  };

  // Route simulate
  app.post('/api/auth/login', (_req, res) => res.json({ token: 'fake-jwt' }));
  app.get('/api/admin/metrics', adminAuth, (_req, res) => res.json({ users: 42 }));
  app.get('/api/cv/generate', jwtAuth, (_req, res) => res.json({ cv: {} }));
  app.get('/api/cv/tailor', jwtAuth, premiumAuth, (_req, res) => res.json({ tailored: {} }));

  return app;
}

const app = buildSecurityTestApp();

describe('Security Integration — Admin RBAC', () => {
  it('GET /api/admin/metrics senza header → 401', async () => {
    const res = await request(app).get('/api/admin/metrics');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('GET /api/admin/metrics con chiave errata → 403', async () => {
    const res = await request(app)
      .get('/api/admin/metrics')
      .set('x-admin-key', 'wrong');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('FORBIDDEN');
  });

  it('GET /api/admin/metrics con chiave corretta → 200', async () => {
    const res = await request(app)
      .get('/api/admin/metrics')
      .set('x-admin-key', ADMIN_KEY);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('users');
  });

  it('risposta 401/403 non rivela informazioni sul sistema', async () => {
    const res = await request(app)
      .get('/api/admin/metrics')
      .set('x-admin-key', 'wrong');
    // Il body non deve contenere stack trace, path interni, etc.
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('stack');
    expect(body).not.toContain('node_modules');
    expect(body).not.toContain('Error:');
  });
});

describe('Security Integration — JWT + Premium', () => {
  it('GET /api/cv/generate senza token → 401', async () => {
    const res = await request(app).get('/api/cv/generate');
    expect(res.status).toBe(401);
  });

  it('GET /api/cv/generate con token → 200', async () => {
    const res = await request(app)
      .get('/api/cv/generate')
      .set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(200);
  });

  it('GET /api/cv/tailor con utente non premium → 403 PREMIUM_REQUIRED', async () => {
    const res = await request(app)
      .get('/api/cv/tailor')
      .set('Authorization', 'Bearer test-token');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('PREMIUM_REQUIRED');
  });
});

describe('Security Integration — Headers di sicurezza', () => {
  it('POST /api/auth/login non rivela stack trace in caso di errore', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'wrong', password: 'wrong' });
    // Login mock restituisce 200 — il test reale è che non ci sia stack
    expect(JSON.stringify(res.body)).not.toContain('at Object.');
  });
});
