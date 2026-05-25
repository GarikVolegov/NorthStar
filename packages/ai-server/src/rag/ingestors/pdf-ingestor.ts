/**
 * pdf-ingestor.ts — ingesta un PDF nel knowledge base RAG.
 *
 * Flusso:
 *   1. Estrae testo grezzo dal PDF (pdf-parse)
 *   2. Chunking per sezione/paragrafo (chunkReport)
 *   3. Embedding + scrittura in rag_chunks (indexer)
 *
 * Uso tipico (admin upload o script CLI):
 *   const result = await ingestPdfToRag(buffer, {
 *     sourceId: 1,     // rag_sources.id già creato
 *     geography: ['Global'],
 *     sectors: ['2', '7'],
 *     publishedAt: new Date('2025-01-01'),
 *   });
 */
import { chunkReport }  from "../chunker";
import { indexChunks }  from "../indexer";
import { logger }       from "../../logger";

export interface PdfIngestOptions {
  sourceId:    number;
  geography?:  string[];
  sectors?:    string[];
  roles?:      string[];
  publishedAt?: Date;
}

export interface PdfIngestResult {
  chunksIndexed: number;
  pages:         number;
  durationMs:    number;
}

type PdfParse = (buf: Buffer) => Promise<{ text: string; numpages: number }>;
type PdfParseModule = { default?: PdfParse } | PdfParse;

function resolvePdfParse(module: PdfParseModule): PdfParse {
  return typeof module === "function" ? module : module.default ?? (() => Promise.reject(new Error("pdf-parse default export missing")));
}

export async function ingestPdfToRag(
  buffer: Buffer,
  opts: PdfIngestOptions,
): Promise<PdfIngestResult> {
  const t0 = Date.now();

  // Dynamic import per non caricare pdf-parse a freddo
  const pdfParse = resolvePdfParse(await import("pdf-parse") as unknown as PdfParseModule);

  let rawText: string;
  let numPages = 0;

  try {
    const parsed = await pdfParse(buffer);
    rawText   = parsed.text;
    numPages  = parsed.numpages;
  } catch (e) {
    throw new Error(`[pdf-ingestor] parse fallito per sourceId=${opts.sourceId}: ${String(e)}`, { cause: e });
  }

  // Pulizia testo
  const text = rawText
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  if (text.length < 100) {
    throw new Error(`[pdf-ingestor] PDF troppo corto o scansionato (no OCR). sourceId=${opts.sourceId}`);
  }

  logger.info({ sourceId: opts.sourceId, textLen: text.length, numPages }, "[pdf-ingestor] testo estratto");

  const chunks   = chunkReport(text);
  const texts    = chunks.map((c) => c.content);
  const indexed  = await indexChunks(texts, {
    sourceId:    opts.sourceId,
    docType:     "report",
    geography:   opts.geography,
    sectors:     opts.sectors,
    roles:       opts.roles,
    publishedAt: opts.publishedAt,
  });

  return { chunksIndexed: indexed.chunksIndexed, pages: numPages, durationMs: Date.now() - t0 };
}
