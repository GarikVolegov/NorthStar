/**
 * Test unitari per il modulo health.ts
 *
 * Strategia:
 *   - Mock di `db.execute` (Drizzle) per simulare DB healthy/unhealthy
 *   - Mock di `fetch` globale per simulare AI/ML service
 *   - Verifica logica di aggregazione status senza toccare rete o DB reale
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock dipendenze esterne prima dell'import del modulo ──────────────────────
const mockDbExecute = vi.fn();
vi.mock('@workspace/db', () => ({
  db: { execute: mockDbExecute },
  sql: new Proxy({}, { get: () => () => 'SELECT 1' }),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { runHealthChecks } from '../../lib/health.js';

// ─── Helper: mock fetch per uno specifico URL ──────────────────────────────────

function mockOkFetch(body = { status: 'ok' }) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response);
}

function mockErrorFetch(status = 503) {
  return Promise.resolve({ ok: false, status, json: () => Promise.resolve({}) } as Response);
}

function mockNetworkError() {
  return Promise.reject(new Error('ECONNREFUSED'));
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

// ─── Test ────────────────────────────────────────────────────────────────────────

describe('runHealthChecks — tutto healthy', () => {
  it('DB ok + AI ok + ML ok → status healthy', async () => {
    mockDbExecute.mockResolvedValueOnce([{ '?column?': 1 }]);
    mockFetch
      .mockResolvedValueOnce(mockOkFetch({ status: 'ok' }))          // AI /health
      .mockResolvedValueOnce(mockOkFetch({ status: 'ok', version: '1.0.0' })); // ML /ml/health

    const result = await runHealthChecks();
    expect(result.status).toBe('healthy');
    expect(result.checks.database.status).toBe('healthy');
    expect(result.checks.aiService.status).toBe('healthy');
    expect(result.checks.mlService.status).toBe('healthy');
  });

  it('risposta include timestamp, uptimeSeconds, version', async () => {
    mockDbExecute.mockResolvedValueOnce([]);
    mockFetch.mockResolvedValue(mockOkFetch());
    const result = await runHealthChecks();
    expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(typeof result.uptimeSeconds).toBe('number');
    expect(result.version).toBeDefined();
  });
});

describe('runHealthChecks — DB unhealthy', () => {
  it('DB unreachable → status unhealthy', async () => {
    mockDbExecute.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    mockFetch.mockResolvedValue(mockOkFetch());

    const result = await runHealthChecks();
    expect(result.status).toBe('unhealthy');
    expect(result.checks.database.status).toBe('unhealthy');
    expect(result.checks.database.detail).toContain('unreachable');
  });

  it('DB timeout → status unhealthy con detail timeout', async () => {
    mockDbExecute.mockImplementationOnce(
      () => new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout dopo 2000ms')), 10)),
    );
    mockFetch.mockResolvedValue(mockOkFetch());

    const result = await runHealthChecks();
    expect(result.status).toBe('unhealthy');
    expect(result.checks.database.detail).toContain('timeout');
  });
});

describe('runHealthChecks — AI/ML degraded', () => {
  it('AI service giù → status degraded (non unhealthy)', async () => {
    mockDbExecute.mockResolvedValueOnce([]);
    mockFetch
      .mockResolvedValueOnce(mockNetworkError())   // AI /health fallisce
      .mockResolvedValueOnce(mockOkFetch());        // ML /ml/health ok

    const result = await runHealthChecks();
    expect(result.status).toBe('degraded');
    expect(result.checks.database.status).toBe('healthy');   // DB ok
    expect(result.checks.aiService.status).toBe('degraded'); // AI giù
    expect(result.checks.mlService.status).toBe('healthy');  // ML ok
  });

  it('ML service giù + DB ok → status degraded', async () => {
    mockDbExecute.mockResolvedValueOnce([]);
    mockFetch
      .mockResolvedValueOnce(mockOkFetch())         // AI ok
      .mockResolvedValueOnce(mockNetworkError());   // ML giù

    const result = await runHealthChecks();
    expect(result.status).toBe('degraded');
  });

  it('AI service HTTP 503 → degraded', async () => {
    mockDbExecute.mockResolvedValueOnce([]);
    mockFetch
      .mockResolvedValueOnce(mockErrorFetch(503))
      .mockResolvedValueOnce(mockOkFetch());

    const result = await runHealthChecks();
    expect(result.status).toBe('degraded');
    expect(result.checks.aiService.detail).toContain('503');
  });

  it('DB unhealthy + AI degraded → status unhealthy (DB batte AI)', async () => {
    mockDbExecute.mockRejectedValueOnce(new Error('Connection refused'));
    mockFetch.mockResolvedValue(mockErrorFetch(503));

    const result = await runHealthChecks();
    expect(result.status).toBe('unhealthy'); // DB ha precedenza
  });
});

describe('runHealthChecks — struttura risposta', () => {
  it('ogni sub-check ha status + latencyMs', async () => {
    mockDbExecute.mockResolvedValueOnce([]);
    mockFetch.mockResolvedValue(mockOkFetch());

    const result = await runHealthChecks();
    for (const check of Object.values(result.checks)) {
      expect(check).toHaveProperty('status');
      expect(typeof check.latencyMs).toBe('number');
      expect(check.latencyMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('nessun stack trace nel detail in caso di errore', async () => {
    mockDbExecute.mockRejectedValueOnce(new Error('at Pool.connect (/node_modules/pg/...): ECONNREFUSED'));
    mockFetch.mockResolvedValue(mockOkFetch());

    const result = await runHealthChecks();
    // detail non deve contenere path di node_modules o stack frames
    expect(result.checks.database.detail).not.toContain('node_modules');
    expect(result.checks.database.detail).not.toContain('at Pool');
  });
});
