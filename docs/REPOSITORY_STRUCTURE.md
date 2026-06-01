# NorthStar Repository Structure

Mappa operativa del monorepo NorthStar. Questo documento definisce dove devono
vivere codice, script, documentazione e tooling, cosi i refactor restano ordinati
e facili da verificare.

## Workspace Canonici

| Area | Path | Responsabilita |
|---|---|---|
| Frontend web | `apps/web` | Applicazione React/Vite, pagine, componenti, hook, i18n e asset UI. |
| Backend API | `apps/server` | API Express, middleware, route, job server-side e integrazioni runtime. |
| Database | `packages/db` | Schema Drizzle, migration SQL, DB client, seed e tipi DB condivisi. |
| AI/Wendy | `packages/ai-server` | Wendy, agenti AI, model routing, search, memory graph e metriche AI. |
| Python ML service | `packages/ml-service` | FastAPI per embedding, trend analysis e weak signals. |
| API contract | `packages/api-spec`, `packages/api-zod`, `packages/api-client-react` | OpenAPI, schemi condivisi e client generati. |
| Realtime | `packages/ws-server` | WebSocket server e canale eventi realtime. |
| Tooling operativo | `scripts/src` | Seed, diagnostics, maintenance, security scan e job manuali. |
| Config non-root | `config` | Configurazioni che non richiedono lookup automatico dalla root, es. Lighthouse/WikiLLM. |
| Documentazione | `docs` | Documentazione tecnica/prodotto, audit, mobile, SEO e procedure operative. |

## Root Del Repository

La root deve restare leggibile e contenere solo:

- manifest e lockfile: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`;
- configurazioni di progetto: TypeScript, Playwright, Knip, Vercel, Docker;
- ponte agenti unico: `AGENTS.md`;
- README, ponte agenti e file ambiente di template;
- config che i tool cercano necessariamente in root.

I documenti di governance vivono nel cervello del progetto:
`.brain/20_Product/ARCHITECTURE.md`, `.brain/30_Process/RUNBOOK.md`,
`.brain/30_Process/SECURITY.md` e `.brain/30_Process/CONTRIBUTING.md`.

Le policy principali vivono in `.brain/40_Agent_Context/rules/`:
`API_RULES.md`, `FRONTEND_RULES.md`, `DB_RULES.md`, `AI_RULES.md`,
`SECURITY_RULES.md`, `GIT_RULES.md`.

Non aggiungere nuovi script diagnostici, script di fix DB o test manuali nella
root. Devono stare in `scripts/src/diagnostics` o `scripts/src/maintenance`.

## Aree Da Trattare Con Cautela

| Area | Uso | Regola |
|---|---|---|
| `.brain/40_Agent_Context` | Contesto unico per agenti, skill, workflow e regole | E' la sorgente canonica; evitare duplicazioni in cartelle tool-specific. |
| `.brain/40_Agent_Context/tools` | CLI e binari agentici generati/locali | Non trattarla come codice sorgente applicativo. |
| Worktree agentici locali | Checkout temporanei creati da tool esterni | Non cancellare a mano se contengono modifiche; usare `git worktree remove` dopo aver salvato il lavoro. |
| `docs/attached_assets` | Asset allegati/importati (gitignored) | Non usarla come libreria asset definitiva senza promozione esplicita. Resta sotto `docs/` ed e' ignorata da git. |
| `docs/eval-wendy` | Suite valutazione Wendy AI (`run-eval.ts`, samples, history) | Procedura operativa: non eseguibile come test automatici, va invocata manualmente. |
| `test-results`, `.pnpm-store` | Output o ambiente locale | Non committare contenuti generati o cache. |

## Regole Di Posizionamento

- Script diagnostici read-only: `scripts/src/diagnostics`.
- Script che possono modificare DB/stato: `scripts/src/maintenance`.
- Nuove route backend: `apps/server/src/routes`, registrate in `apps/server/src/app.ts`.
- Nuovi endpoint frontend: aggiungere costanti in `apps/web/src/lib/constants.ts`.
- Fetch autenticati: usare `apiFetch`, non `fetch` diretto nei componenti.
- Migration: sempre in `packages/db/drizzle`, con schema in `packages/db/src/schema`.
- Componenti frontend riusabili: `apps/web/src/components`.
- Logica di pagina complessa: estrarre in componenti/hook, non creare nuove pagine monolitiche.
- Documentazione lunga o audit: `docs`, non root, salvo policy principali.
- Contesto agentico, skill, workflow e regole: `.brain/40_Agent_Context`.

## Sequenza Di Refactor Consigliata

1. Root hygiene e script operativi.
2. Mappa workspace e documentazione di struttura.
3. Split dei monoliti frontend piu grandi.
4. Split delle route backend piu grandi.
5. Normalizzazione accesso API frontend.
6. Governance AI/Wendy, search e memory graph.
