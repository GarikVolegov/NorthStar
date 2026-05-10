/**
 * Test di integrazione per gli endpoint health.
 * Usa Supertest con app Express minimale che include le route health reali.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';

// Mock Drizzle e fetch PRIMA dell'import delle route
const mockDbExecute = vi.fn();
vi.mock('@workspace/db', () => ({
  db: { execute: mockDbExecute },
  sql: new Proxy({}, { get: () => () => 'SELECT 1' }),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import healthRouter from '../../routes/health.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/health', healthRouter);
  return app;
}

const app = buildApp();

function okFetch() {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ status: 'ok' }) } as Response);
}
function failFetch() {
  return Promise.reject(new Error('ECONNREFUSED'));
}

beforeAll(() => vi.clearAllMocks());

describe('GET /api/health/live', () => {
  it('sempre 200, anche senza DB', async () => {
    const res = await request(app).get('/api/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('alive');
    expect(res.body.service).toBe('northstar-api');
    expect(res.body.timestamp).toBeDefined();
  });
});

describe('GET /api/health/ready', () => {
  it('DB ok + servizi ok → 200 healthy', async () => {
    mockDbExecute.mockResolvedValueOnce([]);
    mockFetch.mockResolvedValue(okFetch());

    const res = await request(app).get('/api/health/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('DB giù → 503 unhealthy', async () => {
    mockDbExecute.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    mockFetch.mockResolvedValue(okFetch());

    const res = await request(app).get('/api/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.checks.database.status).toBe('unhealthy');
  });

  it('AI giù + DB ok → 503 degraded', async () => {
    mockDbExecute.mockResolvedValueOnce([]);
    mockFetch
      .mockResolvedValueOnce(failFetch())
      .mockResolvedValueOnce(okFetch());

    const res = await request(app).get('/api/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.aiService.status).toBe('degraded');
    expect(res.body.checks.database.status).toBe('healthy');
  });

  it('risposta include latencyMs per ogni check', async () => {
    mockDbExecute.mockResolvedValueOnce([]);
    mockFetch.mockResolvedValue(okFetch());

    const res = await request(app).get('/api/health/ready');
    const { checks } = res.body;
    expect(typeof checks.database.latencyMs).toBe('number');
    expect(typeof checks.aiService.latencyMs).toBe('number');
    expect(typeof checks.mlService.latencyMs).toBe('number');
  });
});

describe('GET /api/health', () => {
  it('backward compat — stessa logica di /ready', async () => {
    mockDbExecute.mockResolvedValueOnce([]);
    mockFetch.mockResolvedValue(okFetch());

    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('checks');
    expect(res.body).toHaveProperty('uptimeSeconds');
  });
});
