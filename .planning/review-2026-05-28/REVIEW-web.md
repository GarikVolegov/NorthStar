# REVIEW — `apps/web` (2026-05-28)

Scope: 81 file in `pages/`, 13 feature directory, 196 component, 49 hook, App.tsx, route-config.ts.

## Sintesi rapida

Il frontend ha **due sistemi di routing che coesistono**:
1. `route-config.ts` — declarative, ~60 route mappate, montato via `RouterFromConfig`.
2. `App.tsx` — usa direttamente `<Route>` di wouter per ~12 route "speciali" (admin-review, admin-office, memoria-wendy, workspace, briefing, certificato, sign-in/sign-up, /test, /certificato/:hash, NotFound fallback).

Questa è la **causa principale** dell'apparente discrepanza "81 pagine vs ~60 in route-config". Le pagine "non routate" lo sono in realtà via App.tsx. Convivenza intenzionale ma fonte di confusione.

I findings reali sono: la dualità del routing, qualche pagina davvero non più referenziata, 6 widget dashboard morti, file giganti nei componenti admin.

## Findings classificati

### F-WB-1 · Routing duale `route-config.ts` ↔ `App.tsx`
- Severità: **HIGH** · Azione: **CONSOLIDATE**
- Evidenza: `apps/web/src/App.tsx` definisce a mano 12+ `<Route>` con `lazy(() => import("@/pages/..."))` per pagine che potrebbero essere descritte in `route-config.ts`.
- Rischio: ogni nuova pagina richiede di scegliere dove dichiararla; review più difficile; due fonti di verità per "quali path esistono".
- Proposta: migrare le route dichiarate in App.tsx dentro `route-config.ts` (esiste già il campo `layout`). Eccezioni legittime: `/sign-in/:rest*` (Clerk catch-all), `*` (NotFound fallback) — possono restare in App.tsx.
- Costo: 2-3 ore.

### F-WB-2 · `roadmap-sse.ts` e `test-draft.ts` orfani in `pages/`
- Severità: **MEDIUM** · Azione: **REMOVE** (verificare prima)
- Evidenza: file `.ts` (non `.tsx`) in `pages/`, non sono page component. Probabilmente helper colocati abbandonati o residui di esperimenti SSE / draft test.
- Proposta: grep import; se zero importer → REMOVE. Se importati → spostare in `lib/` o `pages/<feature>/`.
- Costo: 10 min.

### F-WB-3 · 6 widget dashboard morti (knip)
- Severità: **MEDIUM** · Azione: **REMOVE**
- File:
  - `components/dashboard/DashboardCalendar.tsx`
  - `components/dashboard/DashboardPersonalisationPanel.tsx`
  - `components/diary/DiaryPreviewWidget.tsx`
  - `components/dashboard/widgets/InsightsWidget.tsx`
  - `components/dashboard/widgets/JobFeedWidget.tsx`
  - `components/dashboard/widgets/MindsetStreakWidget.tsx`
  - `components/dashboard/widgets/ProgressObjectivesWidget.tsx`
- Evidenza: knip ([baseline/dead-code.txt](baseline/dead-code.txt)) — zero importer.
- Proposta: REMOVE. La dashboard è stata ridisegnata; questi sono residui delle vecchie iterazioni.
- Costo: 15 min.

### F-WB-4 · File giganti `apps/web/src/components/admin/console/`
- Severità: **MEDIUM** · Azione: **REFACTOR**
- File:
  - `AgentsSection.tsx` (732 righe)
  - `types.ts` (640 righe)
  - `hooks/useWendyChat.ts` (625 righe)
  - `components/search/SearchDialog.tsx` (604 righe)
- Evidenza: [baseline/file-size.txt](baseline/file-size.txt) — soglia 600 superata.
- Proposta:
  - `AgentsSection.tsx`: estrarre sotto-pannelli (probabilmente già nominati con `<...Section>` interne).
  - `types.ts` 640 righe: i type non hanno limite logico, ma 640 indica accumulo cross-feature. Splittare per dominio.
  - `useWendyChat.ts`: hook chat è naturalmente complesso, valutare estrazione di sotto-hooks (state, streaming, tool execution).
- Costo: 4-8 ore distribuite.

### F-WB-5 · `route-paths.ts` parziale
- Severità: **LOW** · Azione: **REFACTOR**
- Evidenza: `PATHS` contiene solo 14 path su 60+. Le altre route sono path-literal in `route-config.ts`. Inconsistenza nel pattern.
- Proposta: o estendere `PATHS` a tutte le route principali, o eliminarlo e tenere solo path-literal nel config. Decidere e applicare.
- Costo: 30 min.

### F-WB-6 · 49 hook in `hooks/` — controllo overlap
- Severità: **LOW** · Azione: **DOCUMENT** (audit successivo)
- Evidenza: non analizzato in dettaglio. `useWendyChat.ts` (625 righe) suggerisce che ci siano hook complessi. Possibili duplicati semantici (es. due hook che fanno polling, due hook auth).
- Proposta: audit dedicato hooks fuori scope di questa revisione. Marcare come backlog.

## Cosa NON è un problema

- `not-found.tsx`, `sign-in.tsx`, `sign-up.tsx`: tutti referenziati in `App.tsx` con gestione speciale (catch-all, redirect Clerk). NOT orphans.
- `*-components.tsx`, `*-data.ts`, `*-storage.ts`, `*-types.ts`, `*-api.ts` in `pages/`: helper colocati. Pattern legittimo, da preservare.
- 13 feature directory in `features/` ben strutturate: pattern eccellente.

## Riepilogo conteggio

| Severità | Conta |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 (F-WB-1) |
| MEDIUM | 3 |
| LOW | 2 |
