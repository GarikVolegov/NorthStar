# Graphify + Multi-Agent Analysis — packages/ai-server
Date: 2026-05-29 · Graph: 1472 nodi / 2860 edge / 85 community · Baseline: 0e744e3 · Tests: 259✓

Agenti: legacy-hunter · wendy-rag-reviewer · security-auditor · code-reviewer.
Findings consolidati, deduplicati, ordinati per tier. **Nessuna modifica ancora applicata.**

---

## TIER 0 — CRITICAL (correttezza/sicurezza)

- **SEC-C1 · `security-agent/applier.ts:25,83`** — scrittura file arbitraria: `finding.file`
  (da `JSON.parse` dell'output LLM su testo non fidato) usato in `readFileSync`/`writeFileSync`
  senza validazione → RCE/backdoor (può riscrivere `auth.ts`, `/etc/...`). `repoRoot` esiste in
  `types.ts:36` ma non è passato a `applyFix`.
  **Fix:** `path.resolve(repoRoot, finding.file)` + confinamento `startsWith(repoRoot+sep)` +
  allowlist estensioni + no symlink. (Zod su `SecurityFinding` = SEC-M2, correlato.)

- **WENDY-C1 · `tool-handlers-market.ts:15-23,56-58` vs `apps/server/.../vault-ingest.ts:195,228`** —
  `search_brain` con argomento `layer` non matcha mai: il reader filtra `sectors && ARRAY['L3']`
  ma l'ingest scrive `sectors: [layer]` con la parola grezza (`product`, `identity`…). Layer-scoped
  brain search **silenziosamente a zero risultati**. Il test `search-brain.test.ts:38` mocka `["L3"]`
  → maschera il bug.
  **Decisione richiesta:** (A) vault-ingest scrive il codice `L*`, oppure (B) il handler filtra la
  parola grezza. + test di contratto writer↔reader.

---

## TIER 1 — HIGH

- **SEC-H1/H2 · `discovery-agent/collector-preview.ts:12-21,43`, `collector-rss.ts:50-58`,
  `rag/ingestors/rss-ingestor.ts:82`** — `isSafeHttpUrl` non blocca metadata cloud
  (`169.254.169.254`), RFC1918 (`10/172.16/192.168`), `::1`/`fe80::`, IP encodati; redirect
  (`follow`) non rivalidati → **SSRF** su URL da feed/scraping.
  **Fix:** hardening `isSafeHttpUrl` (range privati/encoded) + `redirect:"manual"` con
  re-check per-hop; applicarlo anche a `fetchRSS`/`ingestRssToRag`.

- **CODE-M4 · `growth-agent/parallel-handoff.ts:279`** *(correttezza, di fatto HIGH)* —
  precedenza operatori: `secondaryResult ?? (loser ?? {...}) as SpecialistResult` → quando il
  primario è il "loser", finisce duplicato nello slot secondario → `delta`/merge **double-count**.
  **Fix:** ricostruire `pResult`/`sResult` esplicitamente da `primaryResult`/`secondaryResult`.

- **CODE-H1 · `growth-agent/agent.ts:193-211`** — il path parallel-handoff **non** ha il try/catch
  che il path single-specialist ha (217-235): un throw del `specialist.run()` uccide il turno
  invece di fare fallback al generic agent. **Fix:** stesso try/catch del path singolo.

- **CODE-H2 · `growth-agent/agent.ts` (`saveAssistantMemory`)** — `sessionId ?? Date.now()`
  persiste memoria sotto session id fasulli → inquina `coachMemoryFacts.sourceSessionId` e
  `coachMemoryPatterns.sessionIds`, dedup per sessione non coalesce mai.
  **Fix:** `if (sessionId == null) return;` (skip, non inventare id).

- **WENDY-H1 · `tool-registry.ts:371-394`** — `search_brain` assente dall'intent `planning`
  (presente in simple_qa/conversation/deep_analysis). Domande di pianificazione su NorthStar non
  raggiungono il brain. Viola CLAUDE.md. **Fix:** aggiungere `search_brain` a `planning` + test.

- **WENDY-H2 · `prompt-builder.ts:145-157`, `light-prompt.ts:15`** — nessuna regola di prompt che
  preferisca `search_brain` per domande interne/prodotto/processo (c'è solo quella `search_rag` per
  il mercato) → il modello è attivamente sbilanciato lontano dal brain. **Fix:** regola simmetrica
  brain-vs-rag nei due prompt.

---

## TIER 2 — MEDIUM

- **CODE-M2 · `retriever.ts:204-209`** — feature-detect fragile su `.offset()`; se Drizzle cambia
  shape il fallback JS degrada silenziosamente a "solo pagina 0". Usare `.offset()` diretto o loggare.
- **CODE-M3 · `retriever.ts:319-323`** — il fallback JS non interroga `userId=0` → il **platform
  content sparisce** quando scatta il circuit breaker pgvector. Passare `globalUserId` + `OR userId=0`.
- **CODE-M5 · `agent.ts:350-351,308`** — `recordLlmTokens(model, fullText.length)`: metrica =
  lunghezza stringa, non token; prompt tokens omessi. `include_usage:true` + `chunk.usage`, o rinominare.
- **WENDY-M1 / CODE-L2 · `tool-registry.ts:446-447`** *(stesso bug)* — `toolsToOpenAIFormat`
  hardcoda `items:{type:"integer"}`; `get_job_posting_trend.periods` è array di stringhe `YYYY-MM`.
  Aggiungere `itemType` opzionale al param.
- **WENDY-M2 · `tool-registry.ts:28` vs `tool-handlers.ts:324`** — `set_filters.filters` dichiarato
  `string` (JSON) ma il dispatch passa un oggetto. Guard di parsing + test.
- **WENDY-M3 · `wendy-brain.ts:211-228`** — `searchWendyBrain` fa `.limit(200)` senza ORDER BY poi
  ranka in JS → oltre 200 nodi i più rilevanti possono essere esclusi. Latent scaling.
- **SEC-M1 · `rules-updater.ts:42`** — append non limitato di testo LLM in `SECURITY_RULES.md`
  (content injection in doc tracciato). Escape + cap lunghezza.
- **SEC-M2 · `scanner.ts:124-132`** — `JSON.parse` su output LLM senza schema; valida `SecurityFinding`
  con Zod (abilita anche SEC-C1).
- **SEC-M3 · `image/client.ts:70-71`** — `editImages` scrive `outputPath` non confinato (POTENTIAL).

---

## TIER 3 — LIGHTENING (legacy-hunter, basso rischio)

- **LH-1 · RIMUOVERE `tools/index.ts`** — barrel orfano, zero importer, superato da `index.ts:97-99` (knip).
- **LH-2 · Consolidare `isRecord()` ×10 byte-identiche → `utils.ts`** (export, re-point 10 siti).
- **LH-3 · Consolidare `mapWithConcurrency()` ×2** (news-publisher + collector-scraping).
- **LH-4 · Consolidare `clamp01()` ×2** (wendy-brain + wendy-neural) → `utils.ts`.
- **CODE-N2 · Consolidare `cosine`/`cosineSimilarity`** (retriever + memory-manager) → util.
- _Scartati (coincidenze, non dup):_ `normalize`×3, `apiKey`×2, `getClient`×2, `clamp`vs`clamp01`.

---

## TIER 4 — LOW/NIT + TEST DEBT

- **CODE-H3 · `wendy-router/` zero test** — `executeToolCall` (god node 37 edge), matrice intent→tool,
  rate-limiter write, validazione `propose*` non testati. Aggiungere test mirati.
- **CODE-M1 · doppia validazione** `propose*` vs `handle*` divergente → estrarre validatori condivisi.
- **CODE-L1 · `executeToolCall` switch 50-case** → handler map per evitare drift registry↔dispatch.
- **SEC-L1/L2, WENDY-L1/L2, NIT vari.**
- Fase 2 boundary: **PASS** (wendy-brain / wendy-neural / memory-graph distinti). Nota: `search_brain`
  = RAG `source_type='brain'`, NON `wendyBrain*` → aggiungere commento chiarificatore.

---

## Resolution Log (verde dopo ogni commit: 264 test + typecheck libs/server)

**Tier 0 — CRITICAL**
- `3f4ca4a` SEC-C1 — applier.ts confina i write a repoRoot (resolve+startsWith+ext allowlist+realpath).
- `0e2187a` WENDY-C1 — search_brain filtra la parola layer grezza; rimossa mappa L* errata; test corretto.

**Tier 1 — HIGH**
- `8b27414` SEC-H1/H2 — net-safety.ts (isSafeHttpUrl hardened + safeFetch redirect-manuali) su 3 fetch.
- `79cfcaf` CODE-M4/H1/H2 — parallel-handoff senza double-count; handoff try/catch; memoria salta sessionId nullo.
- `c016e09` WENDY-H1/H2 — search_brain in `planning`; regola prompt brain-vs-rag.

**Tier 3 — Lightening**
- `da530ec` — rimosso orfano tools/index.ts; consolidati isRecord×10, clamp01×2, mapWithConcurrency×2 in utils. cosine×7 NON fuso (varianti).

**Tier 2 — MEDIUM (7/9)**
- `2acae4c` WENDY-M1 — itemType nei tool schema (sectorIds→integer, periods→string).
- `765bdcb` CODE-M2/M3 — JS retriever include platform content (userId=0); .offset() diretto.
- `97af0cc` SEC-M2 — Zod su SecurityFinding prima dell'applier.
- `68e4fc1` SEC-M1 + WENDY-M3 + SEC-M3 — sanitize rules-updater; ORDER BY su searchWendyBrain; doc write image.

**Ancora aperti (non implementati):**
- CODE-M5 (metrica token = lunghezza stringa) · WENDY-M2 (set_filters string/object).
- Tier 4: CODE-H3 (wendy-router zero test — test debt), CODE-M1 (validatori condivisi propose*/handle*),
  CODE-L1 (handler-map per executeToolCall), vari LOW/NIT, e cosine×7 (deferito per varianti).
