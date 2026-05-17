/**
 * chunker.ts — strategie di chunking per tipi diversi di documento RAG.
 *
 * Strategie:
 *   report   → chunk per paragrafo (400-600 token, overlap 80)
 *   news     → chunk per articolo (200-400 token)
 *   job_agg  → chunk per cluster aggregato (1 chunk per snapshot)
 *
 * Non usa tokenizer preciso (troppo lento a runtime) — approssimazione
 * char/4 ≈ token per testi misti IT/EN. Margine di errore < 10%.
 */

export interface ChunkMeta {
  chunkIndex:  number;
  totalChunks: number;
  docType:     "report" | "news" | "job_agg" | "generic";
}

export interface TextChunk {
  content: string;
  meta:    ChunkMeta;
}

const CHAR_PER_TOKEN = 4; // approssimazione

function toTokens(chars: number): number { return Math.ceil(chars / CHAR_PER_TOKEN); }

// ── Chunking per report PDF (paragrafo con overlap) ────────────────────────

export function chunkReport(text: string, targetTokens = 500, overlapTokens = 80): TextChunk[] {
  const targetChars  = targetTokens * CHAR_PER_TOKEN;
  const overlapChars = overlapTokens * CHAR_PER_TOKEN;

  // Prima split per paragrafo (doppio newline)
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 30);

  const chunks: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (toTokens(current.length + para.length) > targetTokens && current.length > 0) {
      chunks.push(current.trim());
      // Overlap: prendi la coda di `current` come inizio del prossimo chunk
      current = current.slice(-overlapChars) + "\n\n" + para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }
  if (current.trim().length > 50) chunks.push(current.trim());

  // Se un paragrafo è troppo lungo, spezzalo ulteriormente per parole
  const result: TextChunk[] = [];
  for (const chunk of chunks) {
    if (toTokens(chunk.length) <= targetTokens * 1.5) {
      result.push({ content: chunk, meta: { chunkIndex: result.length, totalChunks: 0, docType: "report" } });
    } else {
      const words = chunk.split(/\s+/);
      let sub = "";
      for (const word of words) {
        if (toTokens(sub.length + word.length) > targetTokens && sub.length > 0) {
          result.push({ content: sub.trim(), meta: { chunkIndex: result.length, totalChunks: 0, docType: "report" } });
          sub = sub.slice(-overlapChars) + " " + word;
        } else {
          sub = sub ? sub + " " + word : word;
        }
      }
      if (sub.trim().length > 50) {
        result.push({ content: sub.trim(), meta: { chunkIndex: result.length, totalChunks: 0, docType: "report" } });
      }
    }
  }

  return result.map((c, i) => ({ ...c, meta: { ...c.meta, chunkIndex: i, totalChunks: result.length } }));
}

// ── Chunking per articolo news (1 chunk per articolo o spezzato a 400 token) ─

export function chunkNews(text: string): TextChunk[] {
  const MAX_CHARS = 400 * CHAR_PER_TOKEN;
  if (text.length <= MAX_CHARS) {
    return [{ content: text.trim(), meta: { chunkIndex: 0, totalChunks: 1, docType: "news" } }];
  }

  // Spezza per paragrafo
  const paragraphs = text.split(/\n{2,}/).filter((p) => p.trim().length > 30);
  const chunks: TextChunk[] = [];
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length > MAX_CHARS && current.length > 0) {
      chunks.push({ content: current.trim(), meta: { chunkIndex: chunks.length, totalChunks: 0, docType: "news" } });
      current = para;
    } else {
      current = current ? current + "\n\n" + para : para;
    }
  }
  if (current.trim().length > 50) {
    chunks.push({ content: current.trim(), meta: { chunkIndex: chunks.length, totalChunks: 0, docType: "news" } });
  }

  return chunks.map((c, i) => ({ ...c, meta: { ...c.meta, chunkIndex: i, totalChunks: chunks.length } }));
}

// ── Chunking per job aggregate (1 chunk = 1 snapshot già strutturato) ─────

export function chunkJobAggregate(text: string): TextChunk[] {
  return [{ content: text.trim(), meta: { chunkIndex: 0, totalChunks: 1, docType: "job_agg" } }];
}

// ── Dispatcher ────────────────────────────────────────────────────────────

export function chunkDocument(text: string, docType: ChunkMeta["docType"] = "generic"): TextChunk[] {
  switch (docType) {
    case "report":  return chunkReport(text);
    case "news":    return chunkNews(text);
    case "job_agg": return chunkJobAggregate(text);
    default:        return chunkReport(text, 400, 60);
  }
}
