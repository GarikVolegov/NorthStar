/**
 * wendy-rag — Retrieval-Augmented Generation per Wendy
 *
 * Responsabilità:
 *   - Data una domanda utente, recupera i nodi più rilevanti dal grafo
 *     di knowledge del progetto NorthStar (corsi, risorse, concetti, ruoli…)
 *   - Costruisce il blocco "KNOWLEDGE BASE" da iniettare nel system prompt
 *   - Ritorna anche le citations per il frontend (icone fonte sotto il messaggio)
 *
 * Strategia di retrieval (3 livelli):
 *   1. SEMANTIC — coseno tra embedding domanda e embedding nodi (top-K)
 *   2. GRAPH EXPANSION — nodi direttamente collegati ai top-K tramite edges
 *   3. SCORE FILTER — scarta nodi con similarità < MIN_SCORE (rumore)
 *
 * Differenza da /knowledge/ask:
 *   Quella route è un endpoint standalone con UI grafo personale dell'utente.
 *   Questo modulo è un servizio interno per Wendy: legge la knowledge base
 *   GLOBALE di NorthStar (userId = NORTHSTAR_KB_USER_ID dal env) più
 *   eventualmente i nodi privati dell'utente corrente.
 *
 * Configurazione env:
 *   NORTHSTAR_KB_USER_ID   — ID utente che possiede la KB istituzionale
 *                            (corsi, career paths, guide). Se assente,
 *                            Wendy usa solo i nodi privati dell'utente.
 *   WENDY_RAG_TOP_K        — default 6
 *   WENDY_RAG_MIN_SCORE    — default 0.25 (0-1)
 *   WENDY_RAG_ENABLED      — default "true"; impostare "false" per disabilitare
 */

import { and, eq, inArray, or } from 'drizzle-orm';
import { db, knowledgeNodesTable, knowledgeEdgesTable } from '@workspace/db';
import { ai } from './ai/index.js';
import { logger } from './logger.js';

// ─── Configurazione ──────────────────────────────────────────────────────────

const RAG_ENABLED    = process.env.WENDY_RAG_ENABLED !== 'false';
const TOP_K          = parseInt(process.env.WENDY_RAG_TOP_K    ?? '6',    10);
const MIN_SCORE      = parseFloat(process.env.WENDY_RAG_MIN_SCORE ?? '0.25');
const KB_USER_ID_RAW = process.env.NORTHSTAR_KB_USER_ID;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RAGChunk {
  nodeId:  number;
  title:   string;
  type:    string;
  score:   number;            // similarità coseno 0-1
  content: string;            // estratto testuale (max 600 caratteri)
  url?:    string | null;
}

export interface RAGResult {
  chunks:          RAGChunk[];   // top-K + vicini rilevanti
  contextBlock:    string;       // blocco pronto per il system prompt
  durationMs:      number;
  fromCache:       boolean;      // future: cache embedding domanda
}

// ─── Helpers interni ─────────────────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

function buildContextBlock(chunks: RAGChunk[]): string {
  if (chunks.length === 0) return '';

  const lines: string[] = [
    '═══ KNOWLEDGE BASE NORTHSTAR ═══',
    'Le seguenti informazioni provengono dalla knowledge base ufficiale.',
    'Usale per rispondere con precisione. Cita [#N] quando usi un nodo.',
    '',
  ];

  for (const c of chunks) {
    lines.push(
      `[#${c.nodeId}] [${c.type}] "${c.title}"` +
      (c.url ? ` — ${c.url}` : '') +
      ` (rilevanza: ${Math.round(c.score * 100)}%)`
    );
    if (c.content) lines.push(c.content);
    lines.push('');
  }

  lines.push(
    'Se l\'informazione richiesta NON è presente qui sopra, dillo esplicitamente',
    'e non inventare. Puoi suggerire all\'utente dove trovare l\'informazione.',
    '═══════════════════════════════',
  );

  return lines.join('\n');
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Recupera i nodi più rilevanti per la domanda dell'utente.
 *
 * @param question   - Testo della domanda (usato per generare l'embedding)
 * @param forUserId  - ID utente corrente (per includere i suoi nodi privati)
 * @returns RAGResult con chunks e contextBlock già formattato
 */
export async function retrieveKnowledge(
  question: string,
  forUserId: string,
): Promise<RAGResult> {
  const t0 = Date.now();

  if (!RAG_ENABLED) {
    return { chunks: [], contextBlock: '', durationMs: 0, fromCache: false };
  }

  try {
    // ── 1. Determina quali userId leggere ──────────────────────────────────
    //    - Sempre: nodi privati dell'utente corrente (note personali, CV, skills)
    //    - Se configurato: nodi della KB istituzionale di NorthStar
    const kbUserId = KB_USER_ID_RAW ? parseInt(KB_USER_ID_RAW, 10) : null;
    const userIdNum = parseInt(forUserId, 10);

    const targetUserIds = [userIdNum];
    if (kbUserId && !isNaN(kbUserId) && kbUserId !== userIdNum) {
      targetUserIds.push(kbUserId);
    }

    // ── 2. Carica nodi con embedding ──────────────────────────────────────
    const allNodes = await db
      .select()
      .from(knowledgeNodesTable)
      .where(
        targetUserIds.length === 1
          ? eq(knowledgeNodesTable.userId, targetUserIds[0])
          : inArray(knowledgeNodesTable.userId, targetUserIds),
      );

    const embeddedNodes = allNodes.filter(
      (n) => Array.isArray(n.embedding) && (n.embedding as number[]).length > 0,
    );

    if (embeddedNodes.length === 0) {
      logger.debug({ forUserId }, '[wendy-rag] nessun nodo con embedding — skip RAG');
      return { chunks: [], contextBlock: '', durationMs: Date.now() - t0, fromCache: false };
    }

    // ── 3. Embedding della domanda ────────────────────────────────────────
    const [qVec] = await ai.embed(question.slice(0, 8000));
    if (!qVec) {
      logger.warn({ forUserId }, '[wendy-rag] embed domanda fallito — skip RAG');
      return { chunks: [], contextBlock: '', durationMs: Date.now() - t0, fromCache: false };
    }

    // ── 4. Ranking coseno ─────────────────────────────────────────────────
    const scored = embeddedNodes
      .map((n) => ({
        node:  n,
        score: cosineSimilarity(qVec, n.embedding as number[]),
      }))
      .filter((s) => s.score >= MIN_SCORE)
      .sort((a, b) => b.score - a.score);

    const topHits = scored.slice(0, TOP_K);
    if (topHits.length === 0) {
      logger.debug({ forUserId, question: question.slice(0, 60) }, '[wendy-rag] nessun nodo sopra MIN_SCORE');
      return { chunks: [], contextBlock: '', durationMs: Date.now() - t0, fromCache: false };
    }

    // ── 5. Graph expansion — recupera vicini dei top nodi ─────────────────
    const topIds = topHits.map((s) => s.node.id);
    const allEdges = await db
      .select()
      .from(knowledgeEdgesTable)
      .where(
        and(
          inArray(knowledgeEdgesTable.userId, targetUserIds),
          or(
            inArray(knowledgeEdgesTable.sourceId, topIds),
            inArray(knowledgeEdgesTable.targetId, topIds),
          ),
        ),
      );

    const neighborIds = new Set<number>();
    for (const e of allEdges) {
      if (!topIds.includes(e.sourceId)) neighborIds.add(e.sourceId);
      if (!topIds.includes(e.targetId)) neighborIds.add(e.targetId);
    }

    // Aggiungi vicini solo se hanno score decente (almeno MIN_SCORE / 2)
    const halfMin = MIN_SCORE / 2;
    const neighborChunks: RAGChunk[] = scored
      .filter((s) => neighborIds.has(s.node.id) && s.score >= halfMin)
      .slice(0, 3)  // max 3 vicini extra per non gonfiare il context
      .map((s) => ({
        nodeId:  s.node.id,
        title:   s.node.title,
        type:    s.node.type,
        score:   s.score,
        content: truncate(s.node.content ?? '', 600),
        url:     s.node.url,
      }));

    // ── 6. Assembla chunks finali ─────────────────────────────────────────
    const topChunks: RAGChunk[] = topHits.map((s) => ({
      nodeId:  s.node.id,
      title:   s.node.title,
      type:    s.node.type,
      score:   s.score,
      content: truncate(s.node.content ?? '', 600),
      url:     s.node.url,
    }));

    // Dedup (un vicino potrebbe già essere nei top)
    const seen = new Set(topChunks.map((c) => c.nodeId));
    const finalChunks = [
      ...topChunks,
      ...neighborChunks.filter((c) => !seen.has(c.nodeId)),
    ];

    const contextBlock = buildContextBlock(finalChunks);
    const durationMs   = Date.now() - t0;

    logger.info({
      forUserId,
      chunksCount: finalChunks.length,
      topScore: topHits[0]?.score.toFixed(3),
      durationMs,
    }, '[wendy-rag] retrieval completato');

    return { chunks: finalChunks, contextBlock, durationMs, fromCache: false };

  } catch (err) {
    logger.error({ err, forUserId }, '[wendy-rag] retrieval fallito — Wendy risponde senza KB');
    // Graceful degradation: Wendy risponde ugualmente, solo senza la KB
    return { chunks: [], contextBlock: '', durationMs: Date.now() - t0, fromCache: false };
  }
}
