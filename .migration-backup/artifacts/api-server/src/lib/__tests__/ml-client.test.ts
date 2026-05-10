/**
 * Test unitari per ml-client.ts
 * Mock di fetch nativo — nessun server Python necessario.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch prima dell'import del modulo
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { mlClient, MlClientError } from '../ml-client.js';

const VALID_RIASEC = {
  realistic: 0.3, investigative: 0.9, artistic: 0.4,
  social: 0.3, enterprising: 0.5, conventional: 0.8,
};

function mockOkResponse(body: Record<string, unknown>) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
  } as Response);
}

function mockErrorResponse(status: number, body = '') {
  return Promise.resolve({
    ok: false,
    status,
    text: () => Promise.resolve(body),
  } as unknown as Response);
}

beforeEach(() => vi.clearAllMocks());

describe('mlClient.recommend', () => {
  it('chiamata riuscita → restituisce raccomandazioni in camelCase', async () => {
    mockFetch.mockResolvedValueOnce(mockOkResponse({
      user_id: 1,
      recommendations: [{
        rank: 1, sector_id: 'data_science', sector_name: 'Data Science',
        score: 0.92, riasec_match: 0.90, why: 'Ottimo match analitico.',
      }],
      model_version: '1.0.0-cosine',
      algorithm: 'KNearestNeighbors-cosine',
      processing_ms: 3,
    }));

    const result = await mlClient.recommend({ userId: 1, riasec: VALID_RIASEC });
    expect(result.recommendations[0].sectorId).toBe('data_science');
    expect(result.modelVersion).toBe('1.0.0-cosine');
    expect(result.processingMs).toBe(3);
  });

  it('body inviato al server Python in snake_case', async () => {
    mockFetch.mockResolvedValueOnce(mockOkResponse({
      user_id: 1, recommendations: [], model_version: '1.0.0',
      algorithm: 'test', processing_ms: 1,
    }));

    await mlClient.recommend({ userId: 1, riasec: VALID_RIASEC, topK: 3 });
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(body.top_k).toBe(3);
    expect(body.riasec.investigative).toBeDefined();
    expect(body.user_id).toBe(1);
  });

  it('HTTP 503 → lancia MlClientError', async () => {
    mockFetch.mockResolvedValueOnce(mockErrorResponse(503, 'Service Unavailable'));
    // secondo tentativo (retry su 503)
    mockFetch.mockResolvedValueOnce(mockErrorResponse(503, 'Service Unavailable'));
    await expect(mlClient.recommend({ userId: 1, riasec: VALID_RIASEC })).rejects.toThrow(MlClientError);
  });

  it('timeout → lancia MlClientError con statusCode 408', async () => {
    // Simula abort
    mockFetch.mockRejectedValueOnce(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
    await expect(mlClient.recommend({ userId: 1, riasec: VALID_RIASEC })).rejects.toMatchObject({
      statusCode: 408,
    });
  });
});

describe('mlClient.health', () => {
  it('servizio ok → restituisce health response', async () => {
    mockFetch.mockResolvedValueOnce(mockOkResponse({
      status: 'ok', module: 'northstar-ml', is_trained: true,
      feature_count: 6, algorithm: 'KNN', version: '1.0.0', metadata: {},
    }));
    const result = await mlClient.health();
    expect(result?.status).toBe('ok');
  });

  it('servizio non raggiungibile → ritorna null (non lancia)', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const result = await mlClient.health();
    expect(result).toBeNull();
  });
});

describe('mlClient.sectorSimilarity', () => {
  it('risposta corretta → camelCase', async () => {
    mockFetch.mockResolvedValueOnce(mockOkResponse({
      similarities: [{ sector_id: 'data_science', sector_name: 'Data Science', cosine_score: 0.95 }],
      processing_ms: 2,
    }));
    const result = await mlClient.sectorSimilarity({ riasec: VALID_RIASEC });
    expect(result.similarities[0].sectorId).toBe('data_science');
    expect(result.similarities[0].cosineScore).toBe(0.95);
  });
});
