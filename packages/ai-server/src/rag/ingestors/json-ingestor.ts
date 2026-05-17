/**
 * json-ingestor.ts — ingesta dati JSON strutturati (ONET, CEDEFOP, Lightcast)
 * nel knowledge base RAG.
 *
 * Ogni record JSON viene trasformato in testo descrittivo e indicizzato
 * come singolo chunk. Nessuna libreria esterna necessaria.
 *
 * Formati supportati:
 *   'onet'    — array di oggetti con code, title, description, tasks, skills
 *   'generic' — array di oggetti con title, description (fallback)
 */
import { indexChunks } from "../indexer";
import { logger }      from "../../logger";

export type JsonFormat = "onet" | "generic";

export interface JsonIngestOptions {
  sourceId:    number;
  format:      JsonFormat;
  geography?:  string[];
  sectors?:    string[];
  publishedAt?: Date;
  maxRecords?: number;
}

export interface JsonIngestResult {
  chunksIndexed: number;
  recordsFound:  number;
  durationMs:    number;
}

function onetToText(record: Record<string, unknown>): string {
  const parts: string[] = [];
  if (record.title)       parts.push(`Professione: ${record.title}`);
  if (record.code)        parts.push(`Codice ONET: ${record.code}`);
  if (record.description) parts.push(`Descrizione: ${record.description}`);
  if (Array.isArray(record.tasks) && record.tasks.length) {
    parts.push(`Attività principali: ${(record.tasks as string[]).slice(0, 5).join("; ")}`);
  }
  if (Array.isArray(record.skills) && record.skills.length) {
    parts.push(`Skill richieste: ${(record.skills as string[]).slice(0, 10).join(", ")}`);
  }
  if (Array.isArray(record.knowledgeAreas) && record.knowledgeAreas.length) {
    parts.push(`Aree di conoscenza: ${(record.knowledgeAreas as string[]).slice(0, 5).join(", ")}`);
  }
  return parts.join("\n");
}

function genericToText(record: Record<string, unknown>): string {
  const parts: string[] = [];
  if (record.title)       parts.push(`Titolo: ${record.title}`);
  if (record.description) parts.push(String(record.description));
  if (record.summary)     parts.push(String(record.summary));
  if (record.skills)      parts.push(`Skill: ${Array.isArray(record.skills) ? record.skills.join(", ") : record.skills}`);
  return parts.join("\n");
}

export async function ingestJsonToRag(
  records: Record<string, unknown>[],
  opts: JsonIngestOptions,
): Promise<JsonIngestResult> {
  const t0         = Date.now();
  const maxRecords = opts.maxRecords ?? 500;
  const limited    = records.slice(0, maxRecords);

  logger.info({ sourceId: opts.sourceId, format: opts.format, count: limited.length }, "[json-ingestor] converting records");

  const texts: string[] = [];
  for (const record of limited) {
    let text: string;
    switch (opts.format) {
      case "onet":    text = onetToText(record); break;
      default:        text = genericToText(record);
    }
    if (text.trim().length > 50) texts.push(text.trim());
  }

  if (texts.length === 0) {
    return { chunksIndexed: 0, recordsFound: limited.length, durationMs: Date.now() - t0 };
  }

  const indexed = await indexChunks(texts, {
    sourceId:    opts.sourceId,
    docType:     "generic",
    geography:   opts.geography,
    sectors:     opts.sectors,
    publishedAt: opts.publishedAt,
  });

  return {
    chunksIndexed: indexed.chunksIndexed,
    recordsFound:  limited.length,
    durationMs:    Date.now() - t0,
  };
}
