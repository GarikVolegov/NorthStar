/**
 * ML Client — NorthStar TypeScript
 *
 * Client tipizzato per chiamare gli endpoint /ml/* del microservizio Python.
 * 
 * Design:
 *   - Nessuna dipendenza aggiuntiva: usa fetch nativo (Node 18+)
 *   - Timeout configurabile (default 10s) — il modello è in-memory < 5ms
 *   - Retry automatico su 503 (servizio temporaneamente non disponibile)
 *   - Tutti gli errori sono wrapped in MlClientError per logging strutturato
 *   - L'URL base è configurabile via ML_SERVICE_URL env var
 *
 * Uso:
 *   import { mlClient } from '../lib/ml-client';
 *   const result = await mlClient.recommend({ userId: 42, riasec: {...}, topK: 5 });
 */
import { logger } from './logger.js';

const ML_BASE_URL = process.env.ML_SERVICE_URL ?? process.env.AI_AGENTS_URL ?? 'http://localhost:8000';
const ML_TIMEOUT_MS = parseInt(process.env.ML_TIMEOUT_MS ?? '10000', 10);
const ML_SECRET = process.env.ML_INTERNAL_SECRET ?? '';

// ─── Tipi (specchio degli schemi Pydantic Python) ──────────────────────────────

export interface RiasecScores {
  realistic:     number;  // [0, 1]
  investigative: number;
  artistic:      number;
  social:        number;
  enterprising:  number;
  conventional:  number;
}

export interface CareerRecommendationRequest {
  userId:            number;
  riasec:            RiasecScores;
  preferredSectors?: string[];
  skills?:           string[];
  yearsExperience?:  number;
  isPremium?:        boolean;
  topK?:             number;  // default 5
}

export interface CareerRecommendation {
  rank:        number;
  sectorId:    string;
  sectorName:  string;
  score:       number;  // [0, 1] — score finale con bonus
  riasecMatch: number;  // [0, 1] — cosine similarity pura
  why:         string;  // spiegazione leggibile
}

export interface CareerRecommendationResponse {
  userId:          number;
  recommendations: CareerRecommendation[];
  modelVersion:    string;
  algorithm:       string;
  processingMs:    number;
}

export interface SectorSimilarityRequest {
  riasec: RiasecScores;
  topK?:  number;  // default 10
}

export interface SectorSimilarity {
  sectorId:    string;
  sectorName:  string;
  cosineScore: number;
}

export interface SectorSimilarityResponse {
  similarities: SectorSimilarity[];
  processingMs: number;
}

export interface MlHealthResponse {
  status:      string;
  module:      string;
  isTraied:    boolean;
  featureCount: number;
  algorithm:   string;
  version:     string;
  metadata:    Record<string, unknown>;
}

// ─── Errore tipizzato ──────────────────────────────────────────────────────────

export class MlClientError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly endpoint: string,
  ) {
    super(message);
    this.name = 'MlClientError';
  }
}

// ─── Conversione snake_case → camelCase (Python → TypeScript) ─────────────────

function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[camelKey] = toCamel(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[camelKey] = value.map((item) =>
        typeof item === 'object' && item !== null ? toCamel(item as Record<string, unknown>) : item,
      );
    } else {
      result[camelKey] = value;
    }
  }
  return result;
}

// Converte camelCase → snake_case per inviare al server Python
function toSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[snakeKey] = toSnake(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[snakeKey] = value.map((item) =>
        typeof item === 'object' && item !== null ? toSnake(item as Record<string, unknown>) : item,
      );
    } else {
      result[snakeKey] = value;
    }
  }
  return result;
}

// ─── HTTP helper con timeout + retry ──────────────────────────────────────────

async function mlFetch<T>(
  endpoint: string,
  options: { method: 'GET' | 'POST'; body?: Record<string, unknown> },
  attempt = 1,
): Promise<T> {
  const url = `${ML_BASE_URL}${endpoint}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(ML_SECRET ? { 'X-Internal-Secret': ML_SECRET } : {}),
  };

  try {
    const response = await fetch(url, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(toSnake(options.body as Record<string, unknown>)) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      // Retry su 503 (servizio in avvio) — max 2 tentativi
      if (response.status === 503 && attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000));
        return mlFetch<T>(endpoint, options, attempt + 1);
      }
      throw new MlClientError(response.status, `ML service error ${response.status}: ${text}`, endpoint);
    }

    const json = await response.json();
    return toCamel(json) as T;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof MlClientError) throw err;
    if ((err as Error).name === 'AbortError') {
      throw new MlClientError(408, `ML service timeout dopo ${ML_TIMEOUT_MS}ms`, endpoint);
    }
    throw new MlClientError(503, `ML service non raggiungibile: ${(err as Error).message}`, endpoint);
  }
}

// ─── Client pubblico ───────────────────────────────────────────────────────────

export const mlClient = {
  /**
   * Genera raccomandazioni di carriera personalizzate.
   * Il modello ML usa cosine similarity RIASEC + bonus skill + settori preferiti.
   *
   * @example
   * const result = await mlClient.recommend({
   *   userId: req.user.id,
   *   riasec: userProfile.riasecScores,
   *   skills: userProfile.skills,
   *   topK: 5,
   * });
   */
  async recommend(req: CareerRecommendationRequest): Promise<CareerRecommendationResponse> {
    const start = Date.now();
    try {
      const result = await mlFetch<CareerRecommendationResponse>('/ml/recommend', {
        method: 'POST',
        body: {
          userId: req.userId,
          riasec: req.riasec,
          preferredSectors: req.preferredSectors ?? [],
          skills: req.skills ?? [],
          yearsExperience: req.yearsExperience ?? 0,
          isPremium: req.isPremium ?? false,
          topK: req.topK ?? 5,
        },
      });
      logger.info({ userId: req.userId, processingMs: result.processingMs, elapsed: Date.now() - start }, 'ML recommend ok');
      return result;
    } catch (err) {
      logger.error({ err, userId: req.userId }, 'ML recommend failed');
      throw err;
    }
  },

  /**
   * Calcola similarità coseno pura tra profilo RIASEC e tutti i settori.
   * Utile per visualizzare radar chart o debug del profilo.
   */
  async sectorSimilarity(req: SectorSimilarityRequest): Promise<SectorSimilarityResponse> {
    return mlFetch<SectorSimilarityResponse>('/ml/sector-similarity', {
      method: 'POST',
      body: { riasec: req.riasec, topK: req.topK ?? 10 },
    });
  },

  /**
   * Stato del modello ML — usato da health check Express.
   * In caso di errore ritorna null (servizio non disponibile, non fatale).
   */
  async health(): Promise<MlHealthResponse | null> {
    try {
      return await mlFetch<MlHealthResponse>('/ml/health', { method: 'GET' });
    } catch {
      return null;
    }
  },
};
