/**
 * DiscoveryEnricherAgent — arricchisce gli item raccolti con GPT-4o-mini.
 *
 * COSA FA:
 *   Per ogni item con isEnriched=false:
 *   1. Chiede a GPT-4o-mini di produrre:
 *      - relevanceScore (0-1): quanto è rilevante per un utente NorthStar
 *      - skillTags (string[]): competenze menzionate o richieste
 *      - insightText (string): "perché ti riguarda" in 1-2 frasi
 *      - journeyTypes (string[]): per quali journeyType è rilevante
 *      - difficulty (easy|medium|advanced): per i formation item
 *   2. Aggiorna il record nel DB con is_enriched=true
 *
 * BATCHING:
 *   Processa 20 item per run in batch sequenziali.
 *   Chiamato dopo ogni collector run e ogni 30min dal cron.
 *
 * COSTO:
 *   ~20 item × ~200 token = ~4000 token/run ≈ $0.001/run con gpt-4o-mini.
 */
import { openai } from "../client";
import { db } from "@workspace/db";
import { discoveryItemsTable } from "@workspace/db";
import { eq, and, isNull, or } from "drizzle-orm";
import type { DiscoveryItem } from "@workspace/db";

const ENRICHER_SYSTEM = `
Sei un agente che valuta la rilevanza di contenuti per utenti di NorthStar,
un'app italiana di coaching per carriera, crescita personale e formazione.

Gli utenti di NorthStar sono: studenti universitari, giovani professionisti,
chiunque voglia crescere nella carriera, migliorare le proprie abitudini,
o fare un cambio di percorso.

Dato un item (titolo + sommario + tipo), rispondi SOLO con JSON valido:
{
  "relevanceScore": 0.85,        // 0-1: quanto è utile per gli utenti NorthStar
  "skillTags": ["TypeScript", "React"],  // competenze menzionate/richieste (max 5)
  "insightText": "Questo articolo...",    // 1-2 frasi: perché ti riguarda (in italiano)
  "journeyTypes": ["developer", "career_changer"],  // a chi si rivolge
  "difficulty": "medium"           // easy|medium|advanced (solo per formation, null altrimenti)
}

journey_types validi: developer, designer, marketer, career_changer, entrepreneur, student, general

Non includere item irrilevanti (score < 0.3) per NorthStar — assegna score onesto.
`.trim();

interface EnrichmentResult {
  relevanceScore: number;
  skillTags:      string[];
  insightText:    string;
  journeyTypes:   string[];
  difficulty?:    "easy" | "medium" | "advanced" | null;
}

async function enrichItem(item: DiscoveryItem): Promise<EnrichmentResult | null> {
  const prompt = `
Tipo: ${item.type}
Titolo: ${item.title}
Fonte: ${item.source}
Sommario: ${item.summary?.slice(0, 400) ?? "(nessun sommario)"}
Settori: ${item.sectorNames?.join(", ") ?? ""}
`.trim();

  try {
    const res = await openai.chat.completions.create({
      model:           "gpt-4o-mini",
      messages: [
        { role: "system", content: ENRICHER_SYSTEM },
        { role: "user",   content: prompt },
      ],
      temperature:     0.1,
      max_tokens:      250,
      response_format: { type: "json_object" },
    });

    const raw    = res.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Partial<EnrichmentResult>;

    return {
      relevanceScore: typeof parsed.relevanceScore === "number"
        ? Math.max(0, Math.min(1, parsed.relevanceScore))
        : 0.5,
      skillTags:    Array.isArray(parsed.skillTags) ? parsed.skillTags.slice(0, 5) : [],
      insightText:  typeof parsed.insightText === "string" ? parsed.insightText.slice(0, 400) : "",
      journeyTypes: Array.isArray(parsed.journeyTypes) ? parsed.journeyTypes : ["general"],
      difficulty:   (["easy", "medium", "advanced"] as const).includes(parsed.difficulty as any)
                      ? (parsed.difficulty as "easy" | "medium" | "advanced")
                      : null,
    };
  } catch (err) {
    console.warn(`[enricher] failed for item ${item.id}:`, err);
    return null;
  }
}

export interface EnricherResult {
  processed: number;
  enriched:  number;
  skipped:   number;
  durationMs: number;
}

export async function runEnricher(batchSize = 20): Promise<EnricherResult> {
  const startedAt = Date.now();

  // Fetch unenriched items
  const items = await db
    .select()
    .from(discoveryItemsTable)
    .where(
      and(
        eq(discoveryItemsTable.isEnriched, false),
        or(
          isNull(discoveryItemsTable.relevanceScore),
          eq(discoveryItemsTable.relevanceScore, 0),
        ),
      ),
    )
    .orderBy(discoveryItemsTable.createdAt)
    .limit(batchSize);

  let enriched = 0;
  let skipped  = 0;

  for (const item of items) {
    const result = await enrichItem(item);
    if (!result) { skipped++; continue; }

    await db
      .update(discoveryItemsTable)
      .set({
        relevanceScore: result.relevanceScore,
        skillTags:      result.skillTags,
        insightText:    result.insightText,
        journeyTypes:   result.journeyTypes,
        difficulty:     result.difficulty ?? undefined,
        isEnriched:     true,
        updatedAt:      new Date(),
      })
      .where(eq(discoveryItemsTable.id, item.id));

    enriched++;
  }

  const res: EnricherResult = {
    processed:  items.length,
    enriched,
    skipped,
    durationMs: Date.now() - startedAt,
  };
  console.log(`[enricher] run complete:`, res);
  return res;
}
