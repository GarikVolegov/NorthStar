/**
 * ML Client — NorthStar TypeScript
 * Client tipizzato per tutti gli endpoint /ml/* del microservizio Python.
 */
import { logger } from './logger.js';

const ML_BASE_URL = process.env.ML_SERVICE_URL ?? process.env.AI_AGENTS_URL ?? 'http://localhost:8000';
const ML_TIMEOUT_MS = parseInt(process.env.ML_TIMEOUT_MS ?? '10000', 10);
const ML_SECRET = process.env.ML_INTERNAL_SECRET ?? '';

export interface RiasecScores {
  realistic: number; investigative: number; artistic: number;
  social: number; enterprising: number; conventional: number;
}

// ─── Recommend ────────────────────────────────────────────────────────────────
export interface CareerRecommendationRequest {
  userId: number; riasec: RiasecScores;
  preferredSectors?: string[]; skills?: string[];
  yearsExperience?: number; isPremium?: boolean; topK?: number;
}
export interface CareerRecommendation {
  rank: number; sectorId: string; sectorName: string;
  score: number; riasecMatch: number; why: string;
}
export interface CareerRecommendationResponse {
  userId: number; recommendations: CareerRecommendation[];
  modelVersion: string; algorithm: string; processingMs: number;
}

// ─── Sector similarity ────────────────────────────────────────────────────────
export interface SectorSimilarityRequest { riasec: RiasecScores; topK?: number; }
export interface SectorSimilarity { sectorId: string; sectorName: string; cosineScore: number; }
export interface SectorSimilarityResponse { similarities: SectorSimilarity[]; processingMs: number; }

// ─── Skill gap ────────────────────────────────────────────────────────────────
export interface SkillRecommendationRequest {
  userId: number; targetSectorId: string;
  currentSkills?: string[]; topK?: number;
}
export interface SkillRecommendationItem {
  rank: number; skill: string; importance: number; reason: string;
}
export interface SkillRecommendationResponse {
  userId: number; targetSectorId: string; targetSectorName: string;
  semanticMatch: number; recommendations: SkillRecommendationItem[];
  algorithm: string; processingMs: number;
}

// ─── Similar users ────────────────────────────────────────────────────────────
export interface SimilarUsersRequest {
  userId: number; riasec: RiasecScores; skills?: string[]; topK?: number;
}
export interface SimilarUserNeighbor {
  rank: number; proxyProfileId: string;
  closestSectorId: string; closestSectorName: string;
  distance: number; similarity: number;
}
export interface SimilarUsersResponse {
  userId: number; neighbors: SimilarUserNeighbor[];
  algorithm: string; processingMs: number;
}

// ─── Profile cluster ──────────────────────────────────────────────────────────
export interface ProfileClusterRequest { riasec: RiasecScores; }
export interface ProfileClusterResponse {
  clusterId: number; clusterSize: number;
  archetypeSectorId: string; archetypeSectorName: string;
  memberSectors: Array<{ sectorId: string; sectorName: string }>;
  algorithm: string; processingMs: number;
}

// ─── Health ───────────────────────────────────────────────────────────────────
export interface MlHealthResponse {
  status: string; module: string; isTrained: boolean;
  featureCount: number; algorithm: string; version: string;
  metadata: Record<string, unknown>;
}

export class MlClientError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly endpoint: string,
  ) { super(message); this.name = 'MlClientError'; }
}

function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const k = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    if (value !== null && typeof value === 'object' && !Array.isArray(value))
      result[k] = toCamel(value as Record<string, unknown>);
    else if (Array.isArray(value))
      result[k] = value.map((i) => typeof i === 'object' && i !== null ? toCamel(i as Record<string, unknown>) : i);
    else result[k] = value;
  }
  return result;
}

function toSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const k = key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
    if (value !== null && typeof value === 'object' && !Array.isArray(value))
      result[k] = toSnake(value as Record<string, unknown>);
    else if (Array.isArray(value))
      result[k] = value.map((i) => typeof i === 'object' && i !== null ? toSnake(i as Record<string, unknown>) : i);
    else result[k] = value;
  }
  return result;
}

async function mlFetch<T>(
  endpoint: string,
  options: { method: 'GET' | 'POST'; body?: Record<string, unknown> },
  attempt = 1,
): Promise<T> {
  const url = `${ML_BASE_URL}${endpoint}`;
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), ML_TIMEOUT_MS);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(ML_SECRET ? { 'X-Internal-Secret': ML_SECRET } : {}),
  };
  try {
    const response = await fetch(url, {
      method: options.method, headers,
      body: options.body ? JSON.stringify(toSnake(options.body as Record<string, unknown>)) : undefined,
      signal: controller.signal,
    });
    clearTimeout(tid);
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      if (response.status === 503 && attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000));
        return mlFetch<T>(endpoint, options, attempt + 1);
      }
      throw new MlClientError(response.status, `ML service error ${response.status}: ${text}`, endpoint);
    }
    return toCamel(await response.json()) as T;
  } catch (err) {
    clearTimeout(tid);
    if (err instanceof MlClientError) throw err;
    if ((err as Error).name === 'AbortError')
      throw new MlClientError(408, `ML service timeout dopo ${ML_TIMEOUT_MS}ms`, endpoint);
    throw new MlClientError(503, `ML service non raggiungibile: ${(err as Error).message}`, endpoint);
  }
}

export const mlClient = {
  /** Raccomandazioni carriera ibride (RIASEC + skill + experience). */
  async recommend(req: CareerRecommendationRequest): Promise<CareerRecommendationResponse> {
    const start = Date.now();
    try {
      const result = await mlFetch<CareerRecommendationResponse>('/ml/recommend', {
        method: 'POST',
        body: { userId: req.userId, riasec: req.riasec, preferredSectors: req.preferredSectors ?? [], skills: req.skills ?? [], yearsExperience: req.yearsExperience ?? 0, isPremium: req.isPremium ?? false, topK: req.topK ?? 5 },
      });
      logger.info({ userId: req.userId, processingMs: result.processingMs, elapsed: Date.now() - start }, 'ML recommend ok');
      return result;
    } catch (err) { logger.error({ err, userId: req.userId }, 'ML recommend failed'); throw err; }
  },

  /** Cosine similarity RIASEC pura tra profilo utente e tutti i settori. */
  async sectorSimilarity(req: SectorSimilarityRequest): Promise<SectorSimilarityResponse> {
    return mlFetch<SectorSimilarityResponse>('/ml/sector-similarity', { method: 'POST', body: { riasec: req.riasec, topK: req.topK ?? 10 } });
  },

  /** Gap analysis skill: quali competenze mancano per un settore target (TF-IDF). */
  async recommendSkills(req: SkillRecommendationRequest): Promise<SkillRecommendationResponse> {
    return mlFetch<SkillRecommendationResponse>('/ml/recommend-skills', {
      method: 'POST',
      body: { userId: req.userId, targetSectorId: req.targetSectorId, currentSkills: req.currentSkills ?? [], topK: req.topK ?? 8 },
    });
  },

  /** KNN: profili simili per prossimità RIASEC nello spazio normalizzato. */
  async similarUsers(req: SimilarUsersRequest): Promise<SimilarUsersResponse> {
    return mlFetch<SimilarUsersResponse>('/ml/similar-users', {
      method: 'POST',
      body: { userId: req.userId, riasec: req.riasec, skills: req.skills ?? [], topK: req.topK ?? 5 },
    });
  },

  /** KMeans: a quale cluster appartiene il profilo e qual è l'archetipo del cluster. */
  async profileCluster(req: ProfileClusterRequest): Promise<ProfileClusterResponse> {
    return mlFetch<ProfileClusterResponse>('/ml/profile-cluster', { method: 'POST', body: { riasec: req.riasec } });
  },

  /** Health check del servizio Python — null se irraggiungibile (non fatale). */
  async health(): Promise<MlHealthResponse | null> {
    try { return await mlFetch<MlHealthResponse>('/ml/health', { method: 'GET' }); }
    catch { return null; }
  },
};
