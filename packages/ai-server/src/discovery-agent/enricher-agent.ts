/**
 * DiscoveryEnricherAgent — arricchisce gli item raw con GPT-4o-mini.
 *
 * ── PIPELINE ─────────────────────────────────────────────────────────────────
 *
 *  1. PRIORITY QUEUE
 *     Gli item vengono prelevati in ordine di priorità:
 *       a) Type weight: opportunity > formation > sector_trend > news > growth
 *       b) Freschi prima: publishedAt DESC
 *       c) Retry cap: enrichRetries < MAX_RETRIES (3)
 *
 *  2. CONCURRENCY CONTROLLATA
 *     Processa CONCURRENCY item in parallelo (default 5).
 *     Con gpt-4o-mini il rate limit è 500 RPM → 5 paralleli = safe.
 *
 *  3. GPT PROMPT (JSON mode)
 *     Per ogni item invia titolo + sommario + tipo + settori.
 *     Risposta attesa (JSON):
 *       relevanceScore  float 0-1
 *       skillTags       string[] (max 5)
 *       insightText     string (1-2 frasi, italiano)
 *       journeyTypes    string[]
 *       difficulty      "easy"|"medium"|"advanced"|null
 *
 *  4. RETRY CON BACKOFF ESPONENZIALE
 *     Se GPT fallisce o risponde JSON malformato:
 *       - incrementa enrichRetries nel DB
 *       - skip fino al prossimo run
 *       - dopo MAX_RETRIES (3) → marca isEnriched=true con score=0
 *         per non riprocessare all'infinito
 *
 *  5. BASSA RILEVANZA → FILTRO
 *     Se relevanceScore < MIN_SCORE (0.25) → non verrà mostrato nel feed
 *     ma viene comunque marcato enriched per non riprocessare.
 *
 * ── COSTO ────────────────────────────────────────────────────────────────────
 *   ~20 item × ~200 token input + ~100 output = ~6000 token/run
 *   gpt-4o-mini: $0.15/1M input + $0.60/1M output
 *   → ~$0.0009/run, ~$0.004/h con cron ogni 2h = ~$0.10/mese
 *
 * ── SCHEDULE ─────────────────────────────────────────────────────────────────
 *   Chiamato ogni 2h dal cron (jobs/cron.ts).
 *   Può essere triggerato manualmente via POST /api/admin/discovery/enrich.
 */
import { logger } from "../logger";
import { openai } from "../client";
import { db }     from "@workspace/db";
import { discoveryItemsTable } from "@workspace/db";
import { eq, and, lt, isNull, or, asc, desc, sql } from "drizzle-orm";
import type { DiscoveryItem } from "@workspace/db";
import { selectModelFor } from "../model-router";

// ── Constants ─────────────────────────────────────────────────────────────────

const MAX_RETRIES  = 3;    // dopo 3 fallimenti → skip definitivo
const MIN_SCORE    = 0.25; // sotto questa soglia l'item non appare nel feed
const CONCURRENCY  = 5;    // chiamate GPT parallele
const BATCH_SIZE   = 20;   // item per run

// Priorità per tipo: più alto = processato prima
const TYPE_PRIORITY: Record<string, number> = {
  opportunity:  5,
  formation:    4,
  sector_trend: 3,
  news:         2,
  growth:       1,
};

// ── System prompt ─────────────────────────────────────────────────────────────

const ENRICHER_SYSTEM = `
Sei un agente che valuta la rilevanza di contenuti per utenti di NorthStar,
un'app italiana di coaching per carriera, crescita personale e formazione.

Gli utenti NorthStar sono: studenti universitari, giovani professionisti (18-35),
chiunque voglia crescere nella carriera, migliorare le proprie skill o fare
un cambio di percorso professionale. Contesto principalmente italiano.

Dato un item (tipo + titolo + sommario + settori), rispondi SOLO con JSON valido:
{
  "relevanceScore": 0.85,
  "skillTags": ["TypeScript", "React"],
  "insightText": "Questo articolo ti interessa perché...",
  "journeyTypes": ["developer", "career_changer"],
  "difficulty": "medium"
}

REGOLE:
- relevanceScore: 0-1, onesto. Contenuti irrilevanti per NorthStar → < 0.3.
- skillTags: max 5 tag, competenze concrete menzionate o implicate.
- insightText: 1-2 frasi in italiano. Spiega PERCHÉ è utile per l'utente NorthStar. Tono diretto.
- journeyTypes: array da [developer, designer, marketer, career_changer, entrepreneur, student, general].
- difficulty: "easy"|"medium"|"advanced" solo per type=formation, null altrimenti.

Non inventare informazioni non presenti nel testo. Sii conciso e preciso.
`.trim();

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EnrichmentResult {
  relevanceScore: number;
  skillTags:      string[];
  insightText:    string;
  journeyTypes:   string[];
  difficulty:     "easy" | "medium" | "advanced" | null;
}

export interface EnricherResult {
  processed:  number;
  enriched:   number;
  skipped:    number;
  filtered:   number;   // score < MIN_SCORE
  retried:    number;   // incremento retry counter
  durationMs: number;
  errors:     string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

/**
 * Esegue fn() con retry esponenziale.
 * Lancia l'errore solo dopo maxAttempts tentativi.
 */
async function withRetry<T>(
  fn:          () => Promise<T>,
  maxAttempts: number = 2,
  baseDelayMs: number = 1000,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxAttempts - 1) {
        await sleep(baseDelayMs * Math.pow(2, attempt));
      }
    }
  }
  throw lastErr;
}

/**
 * Esegue un array di async task con concorrenza massima `concurrency`.
 * Simile a p-limit ma senza dipendenze esterne.
 */
async function pLimit<T>(
  tasks:       Array<() => Promise<T>>,
  concurrency: number,
): Promise<Array<T | Error>> {
  const results: Array<T | Error> = new Array(tasks.length);
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const i = index++;
      try {
        results[i] = await tasks[i]!();
      } catch (err) {
        results[i] = err instanceof Error ? err : new Error(String(err));
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ── GPT enrichment call ───────────────────────────────────────────────────────

async function callGPT(item: DiscoveryItem): Promise<EnrichmentResult> {
  const userPrompt = [
    `Tipo: ${item.type}`,
    `Titolo: ${item.title}`,
    `Fonte: ${item.source}`,
    `Sommario: ${(item.summary ?? "").slice(0, 500)}`,
    `Settori: ${(item.sectorNames ?? []).join(", ")}`,
  ].join("\n");

  const route = selectModelFor("discovery-enrich");
  const res = await withRetry(() =>
    openai.chat.completions.create({
      model:           route.model,
      messages: [
        { role: "system", content: ENRICHER_SYSTEM },
        { role: "user",   content: userPrompt },
      ],
      temperature:     0.1,
      max_tokens:      300,
      response_format: { type: "json_object" },
    })
  );

  const raw    = res.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as Partial<EnrichmentResult>;

  return {
    relevanceScore: typeof parsed.relevanceScore === "number"
      ? Math.max(0, Math.min(1, parsed.relevanceScore))
      : 0.5,
    skillTags: Array.isArray(parsed.skillTags)
      ? parsed.skillTags.slice(0, 5).map(String)
      : [],
    insightText: typeof parsed.insightText === "string"
      ? parsed.insightText.slice(0, 500)
      : "",
    journeyTypes: Array.isArray(parsed.journeyTypes)
      ? parsed.journeyTypes.map(String)
      : ["general"],
    difficulty: (["easy", "medium", "advanced"] as const).includes(parsed.difficulty!)
      ? (parsed.difficulty as "easy" | "medium" | "advanced")
      : null,
  };
}

// ── Priority queue fetch ──────────────────────────────────────────────────────

async function fetchItemsToEnrich(limit: number): Promise<DiscoveryItem[]> {
  // Prendi tutti i candidati (unenriched, retry < MAX)
  const rows = await db
    .select()
    .from(discoveryItemsTable)
    .where(
      and(
        eq(discoveryItemsTable.isEnriched, false),
        lt(discoveryItemsTable.enrichRetries, MAX_RETRIES),
      )
    )
    .orderBy(
      // Ordina: più fresco prima (proxy per priorità temporale)
      // Il tipo-peso lo gestiamo in JS dopo perché Drizzle non ha CASE ORDER BY nativo
      desc(discoveryItemsTable.createdAt)
    )
    .limit(limit * 3); // prendi più candidati per poter riordinare

  // Ordina per tipo-peso DESC, poi per publishedAt DESC
  rows.sort((a, b) => {
    const wA = TYPE_PRIORITY[a.type] ?? 0;
    const wB = TYPE_PRIORITY[b.type] ?? 0;
    if (wB !== wA) return wB - wA;
    const tA = a.publishedAt?.getTime() ?? 0;
    const tB = b.publishedAt?.getTime() ?? 0;
    return tB - tA;
  });

  return rows.slice(0, limit);
}

// ── Write enrichment to DB ────────────────────────────────────────────────────

async function saveEnrichment(id: number, result: EnrichmentResult): Promise<void> {
  await db
    .update(discoveryItemsTable)
    .set({
      relevanceScore: result.relevanceScore,
      skillTags:      result.skillTags,
      insightText:    result.insightText,
      journeyTypes:   result.journeyTypes,
      difficulty:     result.difficulty ?? undefined,
      isEnriched:     true,
      enrichedAt:     new Date(),
      updatedAt:      new Date(),
    })
    .where(eq(discoveryItemsTable.id, id));
}

async function incrementRetry(id: number, currentRetries: number): Promise<void> {
  const newRetries = currentRetries + 1;
  await db
    .update(discoveryItemsTable)
    .set({
      enrichRetries: newRetries,
      // Se raggiunge MAX_RETRIES, marca come enriched con score=0 per evitare loop
      ...(newRetries >= MAX_RETRIES ? {
        isEnriched:    true,
        enrichedAt:    new Date(),
        relevanceScore: 0,
        insightText:   "[enrichment fallito dopo 3 tentativi]",
      } : {}),
      updatedAt: new Date(),
    })
    .where(eq(discoveryItemsTable.id, id));
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function runEnricher(
  batchSize:   number = BATCH_SIZE,
  concurrency: number = CONCURRENCY,
): Promise<EnricherResult> {
  const startedAt = Date.now();
  const errors:    string[] = [];
  let enriched = 0;
  let skipped  = 0;
  let filtered = 0;
  let retried  = 0;

  const items = await fetchItemsToEnrich(batchSize);

  if (!items.length) {
    return { processed: 0, enriched: 0, skipped: 0, filtered: 0, retried: 0, durationMs: 0, errors: [] };
  }

  // Costruisci task array per pLimit
  const tasks = items.map((item) => async () => {
    try {
      const result = await callGPT(item);

      if (result.relevanceScore < MIN_SCORE) {
        // Salva comunque (non riprocessare) ma conta come filtrato
        await saveEnrichment(item.id, result);
        filtered++;
        return;
      }

      await saveEnrichment(item.id, result);
      enriched++;
    } catch (err) {
      const msg = String(err);
      errors.push(`item ${item.id}: ${msg.slice(0, 100)}`);
      await incrementRetry(item.id, item.enrichRetries ?? 0).catch(() => {});
      retried++;
      skipped++;
    }
  });

  await pLimit(tasks, concurrency);

  const result: EnricherResult = {
    processed:  items.length,
    enriched,
    skipped,
    filtered,
    retried,
    durationMs: Date.now() - startedAt,
    errors,
  };

  logger.info({ processed: result.processed, enriched: result.enriched, skipped: result.skipped, filtered: result.filtered, durationMs: result.durationMs }, "[enricher] run complete");
  return result;
}
