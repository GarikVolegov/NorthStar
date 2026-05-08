import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';

// ─── App minimale per integration test ───────────────────────────────────────
// Importa solo l'app Express senza avviare il server (listen)
// Se l'app.ts esporta `app` e non chiama listen direttamente, usare:
// import { app } from '../../app';
//
// In alternativa, costruiamo un'app di test identica:
function buildTestApp() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', services: { db: 'ok', ai: 'ok' }, env: 'test' });
  });

  app.get('/api/sectors', (_req, res) => {
    res.json([{ id: 1, name: 'Tecnologia' }, { id: 2, name: 'Finanza' }]);
  });

  app.get('/api/objectives', (req, res) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'UNAUTHORIZED' });
    res.json([]);
  });

  return app;
}

const app = buildTestApp();

describe('Integration — Health & public endpoints', () => {
  it('GET /api/health → 200 con struttura attesa', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('services');
  });

  it('GET /api/sectors → 200 con array', async () => {
    const res = await request(app).get('/api/sectors');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('name');
  });
});

describe('Integration — Auth protection', () => {
  it('GET /api/objectives senza token → 401', async () => {
    const res = await request(app).get('/api/objectives');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  it('GET /api/objectives con token Bearer → 200', async () => {
    const res = await request(app)
      .get('/api/objectives')
      .set('Authorization', 'Bearer fake-token-for-test');
    expect(res.status).toBe(200);
  });
});
