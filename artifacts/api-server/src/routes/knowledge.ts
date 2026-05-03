import { Router, type IRouter } from "express";
import { z } from "zod";
import { and, eq, inArray, or } from "drizzle-orm";
import { db, knowledgeNodesTable, knowledgeEdgesTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { authMiddleware } from "../lib/auth-jwt.js";

const router: IRouter = Router();

const NODE_TYPES = [
  "note",
  "skill",
  "document",
  "sector",
  "role",
  "tool",
  "certification",
  "concept",
  "link",
] as const;

const CreateNodeBody = z.object({
  type: z.enum(NODE_TYPES).default("note"),
  title: z.string().trim().min(1).max(200),
  content: z.string().max(20_000).optional(),
  color: z.string().max(16).optional(),
  url: z.string().max(2000).optional(),
  sectorId: z.number().int().positive().nullable().optional(),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
});

const UpdateNodeBody = z.object({
  type: z.enum(NODE_TYPES).optional(),
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().max(20_000).optional(),
  color: z.string().max(16).nullable().optional(),
  url: z.string().max(2000).nullable().optional(),
  sectorId: z.number().int().positive().nullable().optional(),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
});

const CreateEdgeBody = z.object({
  sourceId: z.number().int().positive(),
  targetId: z.number().int().positive(),
  label: z.string().max(100).optional(),
});

const BulkPositionsBody = z.object({
  positions: z
    .array(
      z.object({
        id: z.number().int().positive(),
        x: z.number().finite(),
        y: z.number().finite(),
      }),
    )
    .min(1)
    .max(500),
});

const AskBody = z.object({
  question: z.string().trim().min(1).max(2000),
  topK: z.number().int().min(1).max(20).optional(),
});

// ─── Embedding helpers ──────────────────────────────────────────────────────

const EMBED_MODEL = "text-embedding-3-small";

function nodeText(n: { title: string; content: string; type?: string; url?: string | null }): string {
  const parts = [n.title];
  if (n.type) parts.push(`[${n.type}]`);
  if (n.url) parts.push(n.url);
  if (n.content) parts.push(n.content);
  return parts.join("\n");
}

async function embedText(text: string): Promise<number[] | null> {
  const trimmed = text.slice(0, 8000);
  if (!trimmed.trim()) return null;
  try {
    const r = await openai.embeddings.create({ model: EMBED_MODEL, input: trimmed });
    return r.data[0]?.embedding ?? null;
  } catch (err) {
    console.error("[knowledge] embedText failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

async function embedAndStore(nodeId: number, userId: number, text: string): Promise<void> {
  const vec = await embedText(text);
  if (!vec) return;
  await db
    .update(knowledgeNodesTable)
    .set({ embedding: vec, embeddedText: text, updatedAt: new Date() })
    .where(and(eq(knowledgeNodesTable.id, nodeId), eq(knowledgeNodesTable.userId, userId)));
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

router.get("/knowledge/graph", authMiddleware, async (_req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const [nodes, edges] = await Promise.all([
    db.select().from(knowledgeNodesTable).where(eq(knowledgeNodesTable.userId, userId)),
    db.select().from(knowledgeEdgesTable).where(eq(knowledgeEdgesTable.userId, userId)),
  ]);
  // Strip embeddings from response (heavy + not needed client-side)
  const cleanNodes = nodes.map(({ embedding: _e, embeddedText: _t, ...rest }) => ({
    ...rest,
    hasEmbedding: !!_e && Array.isArray(_e) && _e.length > 0,
  }));
  res.json({ nodes: cleanNodes, edges });
});

router.post("/knowledge/nodes", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const parsed = CreateNodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi" });
    return;
  }
  const v = parsed.data;
  const [created] = await db
    .insert(knowledgeNodesTable)
    .values({
      userId,
      type: v.type,
      title: v.title,
      content: v.content ?? "",
      color: v.color ?? null,
      url: v.url ?? null,
      sectorId: v.sectorId ?? null,
      x: v.x ?? 0,
      y: v.y ?? 0,
    })
    .returning();
  // Fire-and-forget embedding generation
  void embedAndStore(created.id, userId, nodeText(created));
  const { embedding: _e, embeddedText: _t, ...clean } = created;
  res.status(201).json({ ...clean, hasEmbedding: false });
});

router.patch("/knowledge/nodes/:id", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const id = Number.parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }
  const parsed = UpdateNodeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi" });
    return;
  }
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) updates[k] = v;
  }
  const [updated] = await db
    .update(knowledgeNodesTable)
    .set(updates)
    .where(and(eq(knowledgeNodesTable.id, id), eq(knowledgeNodesTable.userId, userId)))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "Nodo non trovato" });
    return;
  }
  // If title/content/url/type changed and produces different embedded text, re-embed in background
  const newText = nodeText(updated);
  if (newText !== updated.embeddedText) {
    void embedAndStore(updated.id, userId, newText);
  }
  const { embedding: _e, embeddedText: _t, ...clean } = updated;
  res.json({ ...clean, hasEmbedding: !!_e && Array.isArray(_e) && _e.length > 0 });
});

router.post("/knowledge/nodes/positions", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const parsed = BulkPositionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi" });
    return;
  }
  const now = new Date();
  await Promise.all(
    parsed.data.positions.map((p) =>
      db
        .update(knowledgeNodesTable)
        .set({ x: p.x, y: p.y, updatedAt: now })
        .where(and(eq(knowledgeNodesTable.id, p.id), eq(knowledgeNodesTable.userId, userId))),
    ),
  );
  res.json({ ok: true, count: parsed.data.positions.length });
});

router.delete("/knowledge/nodes/:id", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const id = Number.parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }
  await db
    .delete(knowledgeEdgesTable)
    .where(
      and(
        eq(knowledgeEdgesTable.userId, userId),
        or(eq(knowledgeEdgesTable.sourceId, id), eq(knowledgeEdgesTable.targetId, id)),
      ),
    );
  const [deleted] = await db
    .delete(knowledgeNodesTable)
    .where(and(eq(knowledgeNodesTable.id, id), eq(knowledgeNodesTable.userId, userId)))
    .returning({ id: knowledgeNodesTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Nodo non trovato" });
    return;
  }
  res.json({ ok: true });
});

router.post("/knowledge/edges", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const parsed = CreateEdgeBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi" });
    return;
  }
  const { sourceId, targetId, label } = parsed.data;
  if (sourceId === targetId) {
    res.status(400).json({ error: "Un nodo non può collegarsi a sé stesso" });
    return;
  }
  const owned = await db
    .select({ id: knowledgeNodesTable.id })
    .from(knowledgeNodesTable)
    .where(
      and(
        eq(knowledgeNodesTable.userId, userId),
        inArray(knowledgeNodesTable.id, [sourceId, targetId]),
      ),
    );
  if (owned.length !== 2) {
    res.status(404).json({ error: "Nodi non trovati" });
    return;
  }
  const [created] = await db
    .insert(knowledgeEdgesTable)
    .values({ userId, sourceId, targetId, label: label ?? null })
    .returning();
  res.status(201).json(created);
});

router.delete("/knowledge/edges/:id", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const id = Number.parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }
  const [deleted] = await db
    .delete(knowledgeEdgesTable)
    .where(and(eq(knowledgeEdgesTable.id, id), eq(knowledgeEdgesTable.userId, userId)))
    .returning({ id: knowledgeEdgesTable.id });
  if (!deleted) {
    res.status(404).json({ error: "Arco non trovato" });
    return;
  }
  res.json({ ok: true });
});

// ─── Backfill embeddings for existing nodes ─────────────────────────────────

router.post(
  "/knowledge/embeddings/backfill",
  authMiddleware,
  async (_req, res): Promise<void> => {
    const userId = res.locals.userId as number;
    const nodes = await db
      .select()
      .from(knowledgeNodesTable)
      .where(eq(knowledgeNodesTable.userId, userId));
    let processed = 0;
    let skipped = 0;
    for (const n of nodes) {
      const text = nodeText(n);
      const hasEmbedding = Array.isArray(n.embedding) && n.embedding.length > 0;
      if (hasEmbedding && n.embeddedText === text) {
        skipped++;
        continue;
      }
      const vec = await embedText(text);
      if (vec) {
        await db
          .update(knowledgeNodesTable)
          .set({ embedding: vec, embeddedText: text })
          .where(eq(knowledgeNodesTable.id, n.id));
        processed++;
      }
    }
    res.json({ ok: true, processed, skipped, total: nodes.length });
  },
);

// ─── RAG: Ask the graph ─────────────────────────────────────────────────────

router.post("/knowledge/ask", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const parsed = AskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Domanda non valida" });
    return;
  }
  const { question } = parsed.data;
  const topK = parsed.data.topK ?? 6;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const send = (payload: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    // 1. Load all user's nodes + edges
    const [allNodes, allEdges] = await Promise.all([
      db.select().from(knowledgeNodesTable).where(eq(knowledgeNodesTable.userId, userId)),
      db.select().from(knowledgeEdgesTable).where(eq(knowledgeEdgesTable.userId, userId)),
    ]);

    if (allNodes.length === 0) {
      send({
        error: "Il tuo grafo è vuoto. Aggiungi qualche nodo prima di interrogarlo.",
      });
      send({ done: true });
      res.end();
      return;
    }

    // 2. Ensure embeddings: backfill missing ones inline (best effort, capped)
    const missing = allNodes.filter(
      (n) => !Array.isArray(n.embedding) || n.embedding.length === 0,
    );
    const toBackfill = missing.slice(0, 30);
    if (toBackfill.length > 0) {
      send({ status: "embedding", count: toBackfill.length });
      await Promise.all(
        toBackfill.map(async (n) => {
          const text = nodeText(n);
          const vec = await embedText(text);
          if (vec) {
            n.embedding = vec;
            n.embeddedText = text;
            await db
              .update(knowledgeNodesTable)
              .set({ embedding: vec, embeddedText: text })
              .where(eq(knowledgeNodesTable.id, n.id));
          }
        }),
      );
    }

    // 3. Embed the question
    send({ status: "retrieving" });
    const qVec = await embedText(question);
    if (!qVec) {
      send({ error: "Impossibile elaborare la domanda. Riprova." });
      send({ done: true });
      res.end();
      return;
    }

    // 4. Cosine similarity ranking
    const scored = allNodes
      .map((n) => ({
        node: n,
        score:
          Array.isArray(n.embedding) && n.embedding.length > 0
            ? cosineSimilarity(qVec, n.embedding as number[])
            : -1,
      }))
      .filter((s) => s.score >= 0)
      .sort((a, b) => b.score - a.score);

    const top = scored.slice(0, topK);

    // 5. Expand with direct neighbors of the top nodes for graph context
    const topIds = new Set(top.map((s) => s.node.id));
    const neighborIds = new Set<number>();
    for (const e of allEdges) {
      if (topIds.has(e.sourceId)) neighborIds.add(e.targetId);
      if (topIds.has(e.targetId)) neighborIds.add(e.sourceId);
    }
    const neighborNodes = allNodes.filter(
      (n) => neighborIds.has(n.id) && !topIds.has(n.id),
    );
    const contextIds = new Set<number>([...topIds, ...neighborIds]);
    const contextEdges = allEdges.filter(
      (e) => contextIds.has(e.sourceId) && contextIds.has(e.targetId),
    );

    // 6. Build the context block
    const truncate = (s: string, n: number) =>
      s.length > n ? s.slice(0, n) + "…" : s;

    const formatNode = (n: typeof allNodes[number], score?: number) => {
      const head = `#${n.id} [${n.type}] "${n.title}"${
        score !== undefined ? ` (rilevanza: ${Math.round(score * 100)}%)` : ""
      }${n.url ? ` <${n.url}>` : ""}`;
      const body = n.content ? `\n${truncate(n.content, 800)}` : "";
      return head + body;
    };

    const topBlock = top
      .map((s) => formatNode(s.node, s.score))
      .join("\n\n──\n\n");

    const neighborBlock = neighborNodes
      .map((n) => formatNode(n))
      .join("\n\n──\n\n");

    const edgeLines = contextEdges
      .map((e) => {
        const a = allNodes.find((n) => n.id === e.sourceId)?.title ?? `#${e.sourceId}`;
        const b = allNodes.find((n) => n.id === e.targetId)?.title ?? `#${e.targetId}`;
        return `- "${a}" → "${b}"${e.label ? ` (${e.label})` : ""}`;
      })
      .join("\n");

    // 7. Send citations metadata first
    send({
      citations: top.map((s) => ({
        id: s.node.id,
        title: s.node.title,
        type: s.node.type,
        score: s.score,
      })),
      neighbors: neighborNodes.map((n) => ({
        id: n.id,
        title: n.title,
        type: n.type,
      })),
    });

    // 8. Stream the LLM answer
    const prompt = `Sei un assistente che risponde alle domande dell'utente basandoti ESCLUSIVAMENTE sul suo grafo personale di conoscenza (note, competenze, documenti, ruoli, strumenti, certificazioni, concetti, link che lui stesso ha aggiunto).

Regole tassative:
- Rispondi SOLO con informazioni presenti nei nodi del grafo qui sotto. Se l'informazione non c'è, dillo onestamente ("Non ho trovato questa informazione nel tuo grafo") e suggerisci quali nodi potrebbe aggiungere.
- Quando citi un'informazione, indica l'id del nodo tra parentesi quadre, es. [#${top[0]?.node.id ?? 12}].
- Sintetizza, non copiare. Sii chiaro e conciso (max ~250 parole).
- Rispondi in italiano.
- Se utile, suggerisci collegamenti mancanti tra nodi che potrebbe creare.

═══ NODI PIÙ RILEVANTI (selezionati per similarità semantica con la domanda) ═══
${topBlock || "(nessuno)"}

${
  neighborBlock
    ? `═══ NODI COLLEGATI (vicini nel grafo, per contesto) ═══\n${neighborBlock}\n`
    : ""
}${
  edgeLines
    ? `═══ COLLEGAMENTI TRA QUESTI NODI ═══\n${edgeLines}\n`
    : ""
}
═══ DOMANDA DELL'UTENTE ═══
${question}

Rispondi ora, citando gli id [#N] dei nodi usati.`;

    send({ status: "answering" });
    const stream = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) send({ content });
    }
  } catch (err) {
    console.error("[knowledge/ask] error:", err);
    send({
      error: "Errore nella risposta. Riprova.",
      detail: err instanceof Error ? err.message : "unknown",
    });
  }

  send({ done: true });
  res.end();
});

export default router;
