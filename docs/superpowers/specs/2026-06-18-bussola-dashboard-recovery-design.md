# Design — Recupero de "La Bussola" come dashboard dell'indeciso (full-stack)

> Stato: **DRAFT in revisione** · Autore: Opus 4.8 · Data: 2026-06-18
> Sotto-progetto B/C (parte DB-pesante). Fonte di recupero: commit **`9c9a450`**
> (deploy live del 2026-06-02, branch `feature/fase2-cervello-runtime`).

## 1. Obiettivo

Riportare nella linea attuale (`release/launch-candidate`) **La Bussola** — il
percorso guidato dell'utente *indeciso* — e renderla **la dashboard** per
`journeyType=indeciso`, esattamente come nel sito live (`BussolaHome` ha già nel
codice il commento *"Usato sia a /bussola sia dentro il dashboard"*). Gli altri
journey (dipendente/autonomo/azienda/investitore) tengono la dashboard
**Guided Focus** attuale, invariata.

Decisione di prodotto confermata dal founder: **Bussola = dashboard dell'indeciso**,
con backend **fasato**.

## 2. Cos'è La Bussola

`BussolaHome` è un hub guidato dallo **stage** del profilo compass, in 4 fasi:
1. **Scopri** — `bussola/blocco`, `bussola/specchio`, `/test`, `/diario?mode=indizi`, `/coach?mode=socratic`, `/mood`
2. **Sperimenta** — `/settori`, `/news`
3. **Restringi** — `bussola/torneo`
4. **Decidi & Agisci** — `bussola/spike`, action plan (`CommittedActionPlan`)

Molti tool **esistono già** sulla linea attuale (test, settori, news, diario, mood,
coach). Mancano: il **profilo compass** (motore), le 4 **esperienze gamificate**
(blocco/specchio/torneo/spike) e i loro **backend**.

## 3. Architettura da recuperare

### Frontend (`apps/web/src/features/compass/`)
- `useCompass.ts` — **GIÀ recuperato** (in sub-progetto B, per `/chi-sono`): hook + tipi + chiamate API. Autonomo.
- `BussolaHome.tsx` — l'hub a 4 fasi (268 righe).
- `CommittedActionPlan.tsx` — la card del piano d'azione (fase 4).
- Pagine: `bussola.tsx` (wrapper di BussolaHome), `bussola-blocco.tsx`, `bussola-specchio.tsx`, `bussola-torneo.tsx`, `bussola-spike.tsx`.

### Backend
- `routes/compass.ts` — `GET /` (profilo), `POST /signal`, `POST /diagnose`, `GET /scenes`, `GET /tournament`, `POST /tournament/choice`, `GET /action-plan`.
- `routes/spikes.ts` — `GET /`, `POST /propose`, `POST /`, `POST /:id/resolve`.
- Montaggio in `apps/server/src/route-config.ts` (auth `authenticated`).

### Data model (4 tabelle, da `9c9a450`)
| Tabella | Tipo | Note |
|---|---|---|
| `compass_profiles` | dati utente (PK=userId) | stage, blockType, revealedRiasec, energyProfile, hypotheses, signalCount, directionConfidence |
| `compass_signals` | dati utente (FK userId) | segnali comportamentali (+3 indici) che aggiornano il profilo |
| `scene_cards` | **contenuto** (no userId) | catalogo scene dello "Specchio"; **va seminato** |
| `career_spikes` | dati utente (FK userId) | esperimenti reversibili (action + kill criterion + review date) |

Dipendono anche da tabelle **già presenti**: `professions`, `sectors`,
`job_posting_snapshot`, `user_objectives`, `calendar_events`.

## 4. Fasatura

### Fase 1 — Profilo compass + Bussola nella dashboard (core)
- **DB:** `compass_profiles`, `compass_signals`, `scene_cards` (migrazione `0045_indeciso_compass.sql`, idempotente — riusa lo **schema** di `0052` live). **Verificato: `0052` NON semina le scene** (0 INSERT) → aggiungo un **seed idempotente di ~8-12 `scene_cards` iniziali** (altrimenti lo "Specchio" è vuoto, come la news a tabella vuota).
- **Backend:** `compass.ts` (profilo/signal/diagnose/scenes/tournament/action-plan).
- **FE:** `features/compass/BussolaHome.tsx` + `CommittedActionPlan.tsx`; pagine `bussola.tsx`, `bussola-blocco.tsx`, `bussola-specchio.tsx`, `bussola-torneo.tsx`; rotte in `route-config.ts`.
- **Integrazione dashboard:** in `pages/dashboard.tsx`, quando `journeyType==='indeciso'`, rendere `<BussolaHome/>` al posto del layout Guided Focus; tutti gli altri journey invariati.
- **Risultato:** l'indeciso vede la Bussola come dashboard; lo "Spike" (fase 4) mostra un placeholder/CTA finché non arriva la Fase 2.

### Fase 2 — Spikes (Decidi & Agisci)
- **DB:** `career_spikes` (migrazione `0046_career_spikes.sql`, da `0053` live).
- **Backend:** `spikes.ts`.
- **FE:** `bussola-spike.tsx` + sblocco della fase 4 in BussolaHome.

## 5. Strategia migrazioni (vincolo non-negoziabile: DB)
- Convenzione repo: **SQL grezze idempotenti** (`CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`), numerate `NNNN_nome.sql` in `packages/db/drizzle/` (prossimo libero: **0045**). **NON** usare `drizzle-kit generate` (journal fermo a idx 34, drift noto — `memoria.md §8`).
- In **dev/test** lo schema si costruisce con `drizzle-kit push` (come gli altri test d'integrazione). In **staging/prod** vale `db:migrate` (journal-driven): le nuove voci vanno aggiunte al journal e riconciliate dal founder (gate prod).
- **Serve un DATABASE_URL non-prod** (Postgres+pgvector) per generare/testare le migrazioni: il `.env` del repo punta a **prod** — mai usarlo. Il founder fornisce un DB di testing (come il Neon usato nel run /ralph precedente).

## 6. Rischi di adattamento (drift atteso)
1. **Drift di tipi/colonne** — come per `diario` (`isCertifiableMilestone`): `compass.ts`/`spikes.ts` potrebbero referenziare campi di `users`/`objectives`/`calendar` cambiati. Il typecheck li rivela; si adatta (no nuove feature collaterali).
2. **`scene_cards` vuota → "Specchio" vuoto** — è contenuto. **Verificato: `0052` live NON semina le scene** e non c'è un seed-script nel repo (le scene erano popolate altrove sul DB live). Mitigazione: in Fase 1 aggiungo un **seed idempotente** di scene iniziali (INSERT … ON CONFLICT DO NOTHING) così lo "Specchio" funziona out-of-the-box; il founder può poi rivederle/ampliarle.
3. **Auth** — `compass.ts` usa `requireAuth` (esiste). OK.
4. **`useCompass` già presente** ma le sue chiamate (`/api/compass*`) oggi 404 → degradano con grazia (vedi `/chi-sono`); con la Fase 1 si attivano.

## 7. Test
- **Integrazione DB-reale** (regola `DB_RULES.md`, niente mock DB): suite per `compass.ts` (profilo upsert, signal→stage, scenes) gated con `describe.skipIf(!process.env.DATABASE_URL)`, eseguite sul DB di testing e in CI.
- Unit per la logica pura (es. calcolo stage/confidence dai segnali), se estraibile.
- Gate prima di ogni commit: typecheck + lint + test mirati.

## 8. Input necessari dal founder
1. **DATABASE_URL di testing** (Postgres+pgvector, non-prod) per migrazioni e test.
2. Conferma che il **seed delle scene** desiderato è quello del live (o se vuoi rivederlo).

## 9. Fuori scope (qui)
- Routines / Ritual Engine (sub-progetto C separato, altre 3 tabelle).
- Ridisegno della Bussola: si **recupera** com'era, adattandola; niente nuove feature.
