/**
 * PDF Parser — extracts plain text from a PDF buffer and ingests it.
 *
 * Requires:  pnpm add pdf-parse @types/pdf-parse  (in this package)
 *
 * Usage:
 *   const result = await ingestPdf(buffer, {
 *     userId,
 *     sourceName: "meditations-aurelio.pdf",
 *   });
 *   // result.chunksInserted → number of chunks stored
 *
 * For multi-page books (>100 pages) this can produce 200-400 chunks;
 * that is fine — retrieval is O(chunks) with JS cosine fallback,
 * or O(log chunks) once pgvector index is active.
 */
import type { IngestOptions, IngestResult } from "./ingest";
import { ingestText } from "./ingest";

/**
 * Extracts text from a PDF buffer and ingests it into the knowledge graph.
 *
 * @param buffer   Raw PDF file bytes (from multer req.file.buffer)
 * @param opts     Same options as ingestText: userId, sourceName, sourceType, metadata
 */
export async function ingestPdf(
  buffer: Buffer,
  opts: Omit<IngestOptions, "sourceType"> & { sourceType?: IngestOptions["sourceType"] },
): Promise<IngestResult> {
  // Dynamic import so the module is only loaded when actually needed
  // (pdf-parse has a large dependency tree)
  const { PDFParse } = await import("pdf-parse");

  let text: string;
  let numpages = 0;
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    text = result.text;
    numpages = result.total;
    await parser.destroy();
  } catch (err) {
    throw new Error(
      `[pdf-parser] Failed to parse PDF "${opts.sourceName}": ${
        err instanceof Error ? err.message : String(err)
      }`,
      { cause: err },
    );
  }

  const rawText = text
    // pdf-parse often inserts excessive whitespace/newlines
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();

  if (rawText.length < 50) {
    throw new Error(
      `[pdf-parser] PDF "${opts.sourceName}" produced almost no text. ` +
        "It may be a scanned image PDF (not supported without OCR).",
    );
  }

  return ingestText(rawText, {
    sourceType: "document",
    ...opts,
    metadata: {
      pdfPages: numpages,
      ...opts.metadata,
    },
  });
}
