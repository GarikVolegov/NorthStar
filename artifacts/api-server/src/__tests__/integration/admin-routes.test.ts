import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const ADMIN_KEY = process.env.ADMIN_KEY ?? 'test-admin-key';

// ─── Middleware admin key (stessa logica del reale) ───────────────────────────
function adminAuth(req: any, res: any, next: any) {
  const key = req.headers['x-admin-key'];
  if (key !== ADMIN_KEY) return res.status(401).json({ error: 'UNAUTHORIZED' });
  next();
}

function buildAdminTestApp() {
  const app = express();
  app.use(express.json());

  app.get('/api/admin/metrics', adminAuth, (_req, res) => {
    res.json({ users: 42, tests: 120, premiumConversions: 8 });
  });

  app.get('/api/admin/agent-health', adminAuth, (_req, res) => {
    res.json({
      agents: [
        { name: 'collector', status: 'ok', lastRun: new Date().toISOString() },
        { name: 'enricher', status: 'ok', lastRun: new Date().toISOString() },
      ],
      daily: { collected: 50, enriched: 45, failed: 2 },
    });
  });

  app.get('/api/admin/growth-queue', adminAuth, (_req, res) => {
    res.json({ queue: [], stats: { pending: 0, processed: 10 } });
  });

  return app;
}

const app = buildAdminTestApp();

describe('Integration — Admin auth', () => {
  it('GET /api/admin/metrics senza header → 401', async () => {
    const res = await request(app).get('/api/admin/metrics');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  it('GET /api/admin/metrics con chiave errata → 401', async () => {
    const res = await request(app)
      .get('/api/admin/metrics')
      .set('x-admin-key', 'wrong-key');
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/metrics con chiave corretta → 200', async () => {
    const res = await request(app)
      .get('/api/admin/metrics')
      .set('x-admin-key', ADMIN_KEY);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('users');
    expect(res.body).toHaveProperty('tests');
    expect(typeof res.body.users).toBe('number');
  });
});

describe('Integration — Admin agent-health', () => {
  it('GET /api/admin/agent-health con chiave → struttura agents + daily', async () => {
    const res = await request(app)
      .get('/api/admin/agent-health')
      .set('x-admin-key', ADMIN_KEY);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('agents');
    expect(res.body).toHaveProperty('daily');
    expect(Array.isArray(res.body.agents)).toBe(true);
    expect(res.body.agents[0]).toHaveProperty('name');
    expect(res.body.agents[0]).toHaveProperty('status');
    expect(res.body.agents[0]).toHaveProperty('lastRun');
  });

  it('GET /api/admin/growth-queue con chiave → queue + stats', async () => {
    const res = await request(app)
      .get('/api/admin/growth-queue')
      .set('x-admin-key', ADMIN_KEY);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('queue');
    expect(res.body).toHaveProperty('stats');
  });
});
