/**
 * NorthStar ML Client — TypeScript wrapper per il Python ML Service.
 *
 * Espone metodi tipizzati per:
 *   - Embeddings gratuiti (sentence-transformers via Python)
 *   - Analisi trend job posting (time series + regressione)
 *   - Classificazione weak signals emergenti (ML composito)
 *
 * Usa il microservizio Python su ML_SERVICE_URL (default: http://localhost:8000).
 * Il server Express lo importa tramite:
 *   import { mlClient } from "@workspace/ml-client";
 */

import { z } from "zod";

// ── Schemas Zod ───────────────────────────────────────────────────────────────

export const EmbedResponseSchema = z.object({
  embedding:  z.array(z.number()),
  dimensions: z.number(),
  model:      z.string(),
});

export const EmbedBatchResponseSchema = z.object({
  embeddings: z.array(z.array(z.number())),
  dimensions: z.number(),
  count:      z.number(),
  model:      z.string(),
});

export const TrendResultSchema = z.object({
  role_title:          z.string(),
  geography:           z.string(),
  periods:             z.array(z.string()),
  counts:              z.array(z.number()),
  growth_rate_mom:     z.number(),
  growth_rate_total:   z.number(),
  cagr:                z.number().nullable(),
  trend_direction:     z.enum(["up", "stable", "down"]),
  velocity:            z.number(),
  projected_next:      z.number().nullable(),
  confidence:          z.number(),
});

export const WeakSignalResultSchema = z.object({
  role_title:   z.string(),
  is_emerging:  z.boolean(),
  strength:     z.number(),
  status:       z.string(),
  factors:      z.record(z.number()),
});

export const WeakSignalResponseSchema = z.object({
  signals:         z.array(WeakSignalResultSchema),
  total_analyzed:  z.number(),
  emerging_count:  z.number(),
});

export const HealthSchema = z.object({
  service:          z.string(),
  version:          z.string(),
  status:           z.string(),
  db:               z.string().optional(),
  embedding_model:  z.string().optional(),
  embedding_dims:   z.number().optional(),
});

export type EmbedResponse        = z.infer<typeof EmbedResponseSchema>;
export type EmbedBatchResponse   = z.infer<typeof EmbedBatchResponseSchema>;
export type TrendResult          = z.infer<typeof TrendResultSchema>;
export type WeakSignalResult     = z.infer<typeof WeakSignalResultSchema>;
export type WeakSignalResponse   = z.infer<typeof WeakSignalResponseSchema>;
export type MLHealth             = z.infer<typeof HealthSchema>;

export interface SnapshotData {
  period:         string;
  count:          number;
  geography:      string;
  top_skills?:    string[];
  avg_salary_min?: number;
  avg_salary_max?: number;
}

// ── Client ────────────────────────────────────────────────────────────────────

export interface MLClientOptions {
  baseUrl?: string;
  timeout?: number;
}

/**
 * NorthStar ML API Client.
 *
 * Usa come singleton tramite l'export `mlClient` (bottom of file).
 *
 * @example
 *   const { embedding } = await mlClient.embedText("Data Engineer");
 *   const trend         = await mlClient.analyzeTrendInline("Data Engineer", "IT", snapshots);
 *   const signals       = await mlClient.classifyWeakSignals({ geography: "IT", persist: true });
 */
export class MLClient {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(options: MLClientOptions = {}) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.baseUrl = options.baseUrl ?? (typeof process !== "undefined" ? (process as any).env?.PYTHON_ML_URL : undefined) ?? "http://localhost:8000";
    this.timeout = options.timeout ?? 30_000;
  }

  private async request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), this.timeout);
    try {
      const res = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal:  controller.signal,
        headers: { "Content-Type": "application/json", ...init.headers },
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({})) as { detail?: string };
        throw new Error(`ML Service ${res.status}: ${detail.detail ?? res.statusText}`);
      }
      return res.json() as Promise<T>;
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Embeddings ─────────────────────────────────────────────────────────────

  /**
   * Genera un embedding per un singolo testo.
   * Usa sentence-transformers (gratis, multilingual IT/EN).
   * Alternativa a `generateEmbedding` di ai-server (che usa OpenAI).
   */
  async embedText(text: string): Promise<EmbedResponse> {
    const raw = await this.request<unknown>("/embeddings/generate", {
      method: "POST",
      body:   JSON.stringify({ text }),
    });
    return EmbedResponseSchema.parse(raw);
  }

  /**
   * Batch embeddings — fino a 200 testi per chiamata.
   * Ottimizzato per l'ingestione RAG.
   */
  async embedBatch(texts: string[]): Promise<EmbedBatchResponse> {
    const raw = await this.request<unknown>("/embeddings/batch", {
      method: "POST",
      body:   JSON.stringify({ texts }),
    });
    return EmbedBatchResponseSchema.parse(raw);
  }

  // ── Trend Analysis ─────────────────────────────────────────────────────────

  /**
   * Analizza trend leggendo dal DB NorthStar (richiede DB accessibile al ML service).
   */
  async analyzeTrend(roleTitle: string, geography = "IT", limitPeriods = 12): Promise<TrendResult> {
    const raw = await this.request<unknown>("/analyze/trend", {
      method: "POST",
      body:   JSON.stringify({ role_title: roleTitle, geography, limit_periods: limitPeriods }),
    });
    return TrendResultSchema.parse(raw);
  }

  /**
   * Analisi trend con dati forniti nel body — utile quando il server Node.js
   * ha già i dati in memoria (job_posting_snapshots letti via Drizzle).
   */
  async analyzeTrendInline(
    roleTitle: string,
    geography: string,
    snapshots: SnapshotData[],
  ): Promise<TrendResult> {
    const raw = await this.request<unknown>("/analyze/trend/inline", {
      method: "POST",
      body:   JSON.stringify({ role_title: roleTitle, geography, snapshots }),
    });
    return TrendResultSchema.parse(raw);
  }

  // ── Weak Signal Classification ─────────────────────────────────────────────

  /**
   * Classifica i job title emergenti con ML composito.
   * Se persist=true, aggiorna i weak_signals nel DB in background.
   *
   * Complementa `runWeakSignalDetector` (Node.js, euristico) con
   * analisi ML più sofisticata (regressione lineare, velocity, R²).
   */
  async classifyWeakSignals(opts: {
    geography?: string;
    minCount?:  number;
    limit?:     number;
    persist?:   boolean;
  } = {}): Promise<WeakSignalResponse> {
    const raw = await this.request<unknown>("/analyze/weak-signals", {
      method: "POST",
      body:   JSON.stringify({
        geography: opts.geography ?? "IT",
        min_count: opts.minCount  ?? 30,
        limit:     opts.limit     ?? 50,
        persist:   opts.persist   ?? false,
      }),
    });
    return WeakSignalResponseSchema.parse(raw);
  }

  // ── Health ─────────────────────────────────────────────────────────────────

  async health(): Promise<MLHealth> {
    const raw = await this.request<unknown>("/health");
    return HealthSchema.parse(raw);
  }

  /** Restituisce true se il servizio ML è raggiungibile. */
  async isAvailable(): Promise<boolean> {
    try {
      await this.health();
      return true;
    } catch {
      return false;
    }
  }
}

// ── Singleton export ───────────────────────────────────────────────────────────

/** Singleton pre-configurato — pronto all'uso nel server Express. */
export const mlClient = new MLClient();
