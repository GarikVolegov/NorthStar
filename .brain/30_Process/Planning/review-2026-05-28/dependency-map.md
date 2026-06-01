# Dependency Map — NorthStar monorepo (2026-05-28)

Output di Fase 2: identifica orfani, isole di codice e duplicazioni semantiche oltre a quanto già detectato da knip.

## Metodologia

- Output di [`knip`](baseline/dead-code.txt) come ground truth per file orfani.
- Grep mirato sui nomi sospetti emersi dalla mappatura iniziale.
- Verifica importer cross-package.

## Findings

### A. Duplicazioni sospette → confermate NON duplicati (false positives)

| Coppia | Realtà | Azione |
|---|---|---|
| `wendy-brain.ts` + `wendy-neural.ts` | `wendy-neural.ts` è **un re-export di una riga** verso `wendy-neural/index.ts`. Coesistono: brain è l'ingestion store (`vault-ingest` + `search_brain`), neural è il vecchio agent orchestrator. | Vedi REVIEW-ai-server, sezione legacy. |
| `model-router.ts` + `model-router/catalog.ts` | File principale + sottocartella dati (catalog). Pattern intenzionale, 34 importer. | Lasciare. Considerare rename a `model-router/index.ts` per chiarezza. |
| `memory-graph.ts` + `memory-graph-ingest.ts` | Uno per query, uno per ingestione. Funzionalità separate. | Lasciare. |
| `apps/server/src/routes/agent.ts` + `agents.ts` | **VERA confusione di naming**: `agent.ts` = plan-gated agent feature; `agents.ts` = sistema "agenti dipendenti AI" (catalogo agenti). | Rename consigliato in REVIEW-server. |

### B. Pagine `apps/web/src/pages/` NON in `route-config.ts` (19 voci)

Helper file (OK, non sono pagine):
- `amici-components.tsx`, `confronta-components.tsx`, `confronta-data.ts`, `grafo-storage.ts`, `grafo-types.ts`, `roadmap-components.tsx`, `admin-review-api.ts`, `validatore-idea-api.ts` → helper colocati, non page

Pagine **vere ma non routate** (candidate REMOVE o RECONNECT):
- `admin-office.tsx`, `admin-review.tsx` → probabili tool admin non più nel menu
- `briefing.tsx`, `certificato.tsx` → pagine standalone scollegate
- `memoria-wendy.tsx` → probabile residuo della vecchia memory UI (sostituita da Cervello Runtime?)
- `not-found.tsx` → tipicamente referenziato dal router con `*` o handler 404 — verificare
- `roadmap-sse.tsx` → pagina di test SSE
- `sign-in.tsx`, `sign-up.tsx` → potrebbero essere usate da Clerk redirect — verificare
- `test-draft.tsx` → palesemente WIP
- `workspace.tsx` → pagina scollegata

Vedi REVIEW-web per la classificazione finale.

### C. Script `migrate-v*` in `scripts/` (6 file)

`migrate-v2.ps1`, `migrate-v3.cjs`, `migrate-v4.cjs`, `migrate-structure.ps1`, `migrate-structure.bat`, `migrate-to-vscode.mjs`.

Tutti hanno `$ROOT = "C:\Users\osman\Documents\GitHub\NorthStar"` hardcoded e sono one-shot per la ristrutturazione del monorepo, **già eseguiti**. Candidate REMOVE (archivio in `scripts/archive/` se si vuole memoria storica).

### D. File orfani knip (9)

Confermati da knip — vedi [baseline/dead-code.txt](baseline/dead-code.txt):
- `apps/server/src/lib/routine-schedule.ts`
- `apps/web/src/components/dashboard/DashboardCalendar.tsx`
- `apps/web/src/components/dashboard/DashboardPersonalisationPanel.tsx`
- `apps/web/src/components/diary/DiaryPreviewWidget.tsx`
- 4 widget in `apps/web/src/components/dashboard/widgets/`
- `packages/ai-server/src/tools/index.ts` ← **interessante**: barrel di un sottosistema mai importato

### E. Route server duplicate per dominio

4 route "search": `search`, `search-route`, `search-hybrid`, `search-track`. Da inspectare in REVIEW-server: serve consolidare o sono livelli diversi del search funnel?

3 route profile: `profile`, `profile-background`, `profile-logo`, `profile-navigation-layout`, `profile-vision` — tutti montati su `/api/profile`. Frammentazione intenzionale o accidentale?

### F. Fase 2 Cervello → pipeline pre-esistente (potenzialmente superata)

Commit Fase 2: `vault-ingest` worker (`apps/server/src/jobs/vault-ingest.ts`) + `search_brain` Wendy tool + admin brain route (`apps/server/src/routes/admin/wendy-brain.ts`).

Componenti pre-Fase 2 da rivedere per overlap:
- `memory-graph.ts` / `memory-graph-ingest.ts` — vecchia ingest pipeline?
- `rag/ingestors/` — directory con altri ingestor
- `apps/server/src/routes/admin/memory-graph.ts` — admin route omonima

Da decidere in REVIEW-ai-server.

## Output successivi

Le decisioni concrete su ciascun finding finiscono nei 4 REVIEW di dominio. Questo file è solo la mappa, non il verdetto.
