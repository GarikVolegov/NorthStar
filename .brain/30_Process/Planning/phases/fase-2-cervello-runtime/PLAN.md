# PLAN — Fase 2: Cervello Runtime

**Branch suggerito:** `feature/fase2-cervello-runtime` (parte da `feature/brain-bootstrap` mergiato in main)
**Obiettivo:** rendere il vault `.brain/` (layer L1-L3.5) interrogabile da Wendy a runtime via pgvector, riusando lo schema RAG esistente.
**Architettura ref:** contesto consolidato in `.brain/40_Agent_Context/`

---

## Mappa dei task

```
Step 1 → Step 2 → Step 3 → Step 4
  DB      Worker   AI-Tool   Test+Gate
```

**Pre-condizione**: `feature/brain-bootstrap` mergiato (= `.brain/` presente sul branch di lavoro).

---

## Step 1 — DB: aggiungere `obsidianPath` a `ragSourcesTable`

### Obiettivo
Permettere upsert idempotente di un file `.brain/*.md` come `ragSource` distinto. Il `sourceType` esistente (`text` libero) viene esteso a includere `'brain'` — nessuna constraint da modificare.

### File da modificare
- `packages/db/src/schema/ragSource.ts` — aggiungi colonna + indice

### Schema diff
```typescript
// packages/db/src/schema/ragSource.ts (DIFF)
export const ragSourcesTable = pgTable(
  "rag_sources",
  {
    // ...campi esistenti
    obsidianPath: text("obsidian_path"),                    // ⇐ NEW: path relativo es. ".brain/20_Product/Subsystems/Wendy.md"
    // ...
  },
  (t) => ({
    typeIdx:     index("rag_sources_type_idx").on(t.sourceType),
    nameIdx:     index("rag_sources_name_idx").on(t.name),
    obsidianIdx: index("rag_sources_obsidian_idx").on(t.obsidianPath), // ⇐ NEW
  }),
);
```

Aggiorna commento doc-block:
```
sourceType: 'report' | 'job_agg' | 'news' | 'community' | 'brain'
```

### Migration
`pnpm db:generate` produrrà `0015_step2_brain_obsidian_path.sql`. Verifica che includa solo `ALTER TABLE rag_sources ADD COLUMN obsidian_path text` + `CREATE INDEX`.

### Criteri di successo
- [ ] `pnpm db:generate` genera la migration
- [ ] `pnpm db:migrate` applica senza errori
- [ ] `SELECT obsidian_path FROM rag_sources LIMIT 1;` non errora

### Security gate (`gate-db`)
- `fk-on-delete` ✓ (nessuna nuova FK)
- `cascade-on-user-data` ✓ (no userId)
- `pii-no-bare-text` ✓ (obsidian_path non è PII)

### Non fare
- Non rimuovere/rinominare colonne esistenti
- Non aggiungere `NOT NULL` su `obsidian_path` (i record legacy hanno NULL)

---

## Step 2 — Worker: `vault-ingest` cron job

### Obiettivo
Scansionare `.brain/**/*.md`, leggere frontmatter, ingerire solo i file con `runtime: true` in `ragSourcesTable` + `ragChunksTable`. Idempotente via `obsidianPath` come unique key logica.

### File da creare
- `apps/server/src/jobs/vault-ingest.ts` — cron job top-level (NON un routine executor; gira a livello sistema, non per utente)
- `apps/server/src/jobs/vault-ingest.test.ts` — coverage TDD

### File da modificare
- `apps/server/src/jobs/cron.ts` — registra `runVaultIngest` con `recordCronRun`, intervallo `VAULT_INGEST_INTERVAL_MS` (default 24h)

### Logica (pseudo)
```typescript
// apps/server/src/jobs/vault-ingest.ts
import { db, ragSourcesTable, ragChunksTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { embedText } from "@workspace/ai-server"; // riusa pipeline esistente di Step 6
import matter from "gray-matter";                  // parsing frontmatter
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { rootLogger } from "../middleware/logger.js";

const VAULT_ROOT = process.env.BRAIN_VAULT_ROOT ?? ".brain";
const MAX_FILES_PER_RUN = 200;        // batch limit (gate-worker)
const RUN_TIMEOUT_MS    = 5 * 60_000; // 5 min (gate-worker)
const log = rootLogger.child({ module: "job:vault-ingest" });

export async function runVaultIngest(): Promise<{ scanned: number; ingested: number; skipped: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS);
  try {
    const files = await walkMarkdown(VAULT_ROOT, { maxFiles: MAX_FILES_PER_RUN });
    let ingested = 0, skipped = 0;
    for (const filePath of files) {
      if (controller.signal.aborted) break;
      const raw = await readFile(filePath, "utf-8");
      const { data: fm, content } = matter(raw);
      if (fm.runtime !== true) { skipped++; continue; }

      const obsidianPath = relative(process.cwd(), filePath).replaceAll("\\", "/");
      const layer  = String(fm.layer ?? "unknown");
      const tags   = Array.isArray(fm.tags) ? fm.tags.map(String) : [];

      // upsert source
      const [source] = await db
        .insert(ragSourcesTable)
        .values({
          name: obsidianPath,
          sourceType: "brain",
          format: "markdown",
          obsidianPath,
          trustScore: 0.95,
          lastIngestedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: ragSourcesTable.obsidianPath,
          set: { lastIngestedAt: new Date(), updatedAt: new Date() },
        })
        .returning();

      // delete previous chunks (idempotent re-embed)
      await db.delete(ragChunksTable).where(eq(ragChunksTable.sourceId, source.id));

      // chunk + embed (riusa stesso splitter di Step 6)
      const chunks = splitMarkdown(content, { maxTokens: 500 });
      const embeddings = await embedText(chunks); // batch, no PII (vault è no-PII)
      await db.insert(ragChunksTable).values(
        chunks.map((c, i) => ({
          sourceId: source.id,
          content: c,
          chunkIndex: i,
          embedding: embeddings[i],
          trustScore: 0.95,
          sectors: [layer],       // riusa colonna `sectors` per filtrare per layer L1-L3.5
          roles: tags,             // riusa `roles` per i tag #L1 #L2 ecc.
        })),
      );
      ingested++;
    }
    return { scanned: files.length, ingested, skipped };
  } finally {
    clearTimeout(timer);
  }
}
```

### Helper da implementare
- `walkMarkdown(root, { maxFiles })` — recursive readdir filtrato `.md`, **non segue symlink/junction** (rispetta `90_Code/`)
- `splitMarkdown(text, opts)` — usa il chunker esistente del Step 6 (cerca in `packages/ai-server/src/wendy-router/` o `chunker.ts`)

### Registrazione in cron
```typescript
// apps/server/src/jobs/cron.ts (aggiunta)
import { runVaultIngest } from "./vault-ingest";
const VAULT_INGEST_INTERVAL_MS = Number(process.env.VAULT_INGEST_INTERVAL_MS) || 24 * 60 * 60 * 1000;

// dentro startup, dopo gli altri scheduler:
setInterval(() => {
  recordCronRun("vault-ingest", "system", runVaultIngest, (r) => r);
}, VAULT_INGEST_INTERVAL_MS);
```

### Criteri di successo
- [ ] Test unit: walker rispetta `runtime: false` (file skippati)
- [ ] Test unit: re-run con file invariato → 0 nuovi chunk (idempotent)
- [ ] Test integration: 30 file in `.brain/` ingeriti, `sources` con `source_type='brain'` = 30
- [ ] Junction `.brain/90_Code/` NON viene seguita
- [ ] Log: nessun token/email/segreto

### Security gate (`gate-worker`)
- `timeout-enforced` ✓ (AbortController)
- `no-credentials-in-logs` ✓ (no PII nel vault per principio)
- `max-batch-size` ✓ (`MAX_FILES_PER_RUN = 200`)
- `safe-run-pattern` ✓ (wrappato in `recordCronRun`)

### Non fare
- Non leggere file fuori da `.brain/`
- Non assumere `runtime: true` di default — file senza frontmatter sono skippati
- Non ingerire `.brain/90_Code/**` (junction — verifica `fs.lstat` per non seguire link)

---

## Step 3 — AI-Tool: `search_brain` per Wendy

### Obiettivo
Esporre il vault a Wendy come tool dedicato. Variante di `search_rag` filtrata su `source_type = 'brain'`, con filtro opzionale per layer.

### File da creare
- `packages/ai-server/src/wendy-router/tools/search-brain.ts` — handler
- `packages/ai-server/src/wendy-router/tools/search-brain.test.ts` — coverage

### File da modificare
- `packages/ai-server/src/wendy-router/tool-registry.ts` — registra tool
- `packages/ai-server/src/wendy-router/tool-handlers.ts` — case `search_brain` nel dispatcher `executeToolCall`
- `packages/ai-server/src/wendy-router/index.ts` — re-export se serve
- `apps/server/src/services/wendy/wendy-prompt-builder.ts` — menziona `search_brain` nel system prompt con istruzione: "Usa search_brain per domande su NorthStar, il prodotto, l'architettura, o la mia identità. Usa search_rag per domande sul mercato job esterno."

### Schema tool
```typescript
// packages/ai-server/src/wendy-router/tools/search-brain.ts
import { z } from "zod";
import { db, ragChunksTable, ragSourcesTable } from "@workspace/db";
import { eq, sql, and } from "drizzle-orm";
import { embedText } from "../../embeddings";

export const searchBrainSchema = z.object({
  query: z.string().min(3).max(500),
  layer: z.enum(["identity", "domain", "product", "process"]).optional(),
  limit: z.number().int().min(1).max(20).default(5),
});

export type SearchBrainArgs = z.infer<typeof searchBrainSchema>;

export async function handleSearchBrain(args: SearchBrainArgs, userId: number) {
  await rateLimit(userId, "search_brain", { perMinute: 20 }); // gate-ai-tool: rate-limited-per-user

  const [queryEmbedding] = await embedText([args.query]);

  const filters = [eq(ragSourcesTable.sourceType, "brain")];
  if (args.layer) {
    const layerTag = ({ identity: "L1", domain: "L2", product: "L3", process: "L3.5" } as const)[args.layer];
    filters.push(sql`${ragChunksTable.sectors} && ARRAY[${layerTag}]::text[]`);
  }

  const rows = await db
    .select({
      content:      ragChunksTable.content,
      obsidianPath: ragSourcesTable.obsidianPath,
      sectors:      ragChunksTable.sectors,
      similarity:   sql<number>`1 - (${ragChunksTable.embedding} <=> ${queryEmbedding}::vector)`,
    })
    .from(ragChunksTable)
    .innerJoin(ragSourcesTable, eq(ragChunksTable.sourceId, ragSourcesTable.id))
    .where(and(...filters))
    .orderBy(sql`${ragChunksTable.embedding} <=> ${queryEmbedding}::vector`)
    .limit(args.limit);

  return rows; // { content, obsidianPath, sectors, similarity }[]
}
```

### Registrazione
- In `tool-registry.ts`: aggiungi entry con name `"search_brain"`, description: `"Cerca nel cervello interno di NorthStar (identity, domain, product, process). Usalo per domande sul prodotto, l'architettura, decisioni, valori, o il modello mentale del founder."`, schema `searchBrainSchema`.
- In `tool-handlers.ts` `executeToolCall`: `case "search_brain": return handleSearchBrain(parsedArgs, userId);`
- Export da `index.ts` se la convenzione lo richiede.

### Criteri di successo
- [ ] Test: query semantica → top-K risultati con `obsidianPath` popolato
- [ ] Test: `layer: "product"` filtra solo chunk con `sectors` contenente `"L3"`
- [ ] Test: rate limit blocca al 21° call nello stesso minuto per utente
- [ ] Wendy chat: "spiegami la pipeline RAG" → risposta cita `.brain/20_Product/Subsystems/RAG-Pipeline.md`

### Security gate (`gate-ai-tool`)
- `confirm-before-destructive` ✓ N/A (tool read-only)
- `rate-limited-per-user` ✓ (`rateLimit(userId, ..., {perMinute: 20})`)
- `tool-registered-in-index` ✓ (verifica export da `packages/ai-server/src/tools/index.ts` o equivalente)

### Non fare
- Non esporre chunk con `sourceType != 'brain'` (no leak su rag_chunks generici)
- Non disabilitare il filtro `source_type='brain'` in nessun branch del codice
- Non passare `obsidianPath` direttamente come link cliccabile in UI senza sanitizzazione

---

## Step 4 — Test + Gate

### Obiettivo
Coverage completa + verifica esplicita di tutti i gate prima del commit.

### File coinvolti
- `apps/server/src/jobs/vault-ingest.test.ts` (creato in Step 2)
- `packages/ai-server/src/wendy-router/tools/search-brain.test.ts` (creato in Step 3)
- `packages/ai-server/src/wendy-router/tool-registry.test.ts` — aggiorna asserzione che `search_brain` è presente
- `apps/server/src/jobs/cron.test.ts` (se esiste) — verifica registrazione interval

### Test E2E manuale
1. Avvia server: `pnpm dev:server`
2. Forza un run: `curl -X POST http://localhost:3000/admin/cron/vault-ingest` (o invoca via REPL)
3. Verifica DB: `SELECT count(*) FROM rag_sources WHERE source_type='brain';` ≈ 30
4. Chat con Wendy: domanda "qual è la mia vision per NorthStar?" → deve citare `.brain/00_Identity/Vision-NorthStar.md`
5. Modifica `.brain/00_Identity/Garik.md`, ri-esegui ingest → solo quel source aggiornato (`lastIngestedAt` recente, chunks ri-embedded)

### Security gate (`gate-test`)
- `no-real-credentials` ✓ (test usano test DB)
- `real-db-not-mock` ✓ (i `*.integration.test.ts` usano DB reale; gli `*.test.ts` unit possono mockare `@workspace/db`)

### Criteri di successo finali (per `/gsd:verify-work`)
- [ ] Tutti i test passano: `pnpm test`
- [ ] Migration applicata in dev
- [ ] Vault ingerito (~30 source `brain`)
- [ ] Wendy cita correttamente nodi del vault
- [ ] Junction `90_Code/` NON ingerita (zero source con `obsidian_path LIKE '%/90_Code/%'`)
- [ ] Tutti i gate del registry passano per gli step toccati
- [ ] Cartographer rilanciabile: `/cartographer phase-sync` aggiorna `30_Process/GSD-Phases/Fase-2-Cervello-Runtime.md` con stato

### Non fare
- Non skippare i test del walker (logica più rischiosa: junction, filesystem case-sensitivity)
- Non committare prima di aver visto Wendy citare un nodo del vault in chat reale

---

## Note operative

### Ordine di esecuzione
Strettamente sequenziale: Step 1 → 2 → 3 → 4. Ogni step un commit atomico.

### Dipendenze esterne
- `gray-matter` (frontmatter parser) — potrebbe già esistere, verifica `pnpm ls gray-matter`. Se no: `pnpm -F @workspace/server add gray-matter`
- `embedText` — riusa l'API esistente del Step 6 (cerca in `packages/ai-server/src/wendy-router/` o `embeddings.ts`)

### Env vars nuove
- `BRAIN_VAULT_ROOT` (default `.brain`)
- `VAULT_INGEST_INTERVAL_MS` (default `86_400_000` = 24h)

### Cartographer integration
Al termine di Fase 2, invoca `/cartographer subsystem-sync` per propagare le modifiche di Wendy/RAG-Pipeline ai loro file nel vault. Aggiungerà un riferimento a `search_brain` in `.brain/20_Product/Subsystems/Wendy.md`.

### Verifica freshness vault
Dopo l'ingest, ogni `ragSourcesTable.lastIngestedAt` deve essere più recente del `updated:` frontmatter del file corrispondente. Se diverge → file modificato dopo l'ingest, in attesa di prossimo run cron.
