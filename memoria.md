# 🌍 memoria.md — Le Radici di NorthStar

> **Cos'è questo file.** Questo è il documento-radice vivente di NorthStar. La Terra
> sono le radici (tutti i file `.md` sedimentati sopra il progetto); i pianeti/le persone
> sono i modelli di intelligenza artificiale che Garik fa girare e che evolvono di continuo.
> Ogni AI che lavora qui **prima legge questo file, poi lavora, poi lo revisiona**: così il
> progetto sa sempre dov'è e dove deve andare, indipendentemente da quale modello lo tocchi.
>
> Questo file **non duplica** la documentazione: è l'**indice radice** che la collega e la
> tiene sincronizzata. Le verità di dettaglio vivono nei file `*_RULES.md`, in `ARCHITECTURE.md`,
> in `docs/` e nel cervello `.brain/`. Qui c'è la mappa e lo stato.

- **Ultima revisione:** 2026-06-01 — *Opus 4.8 (analisi agentica iniziale: 4 agenti Explore + verifica)*
- **Stato repo alla revisione:** `main @ 5e3545f` — Fase 2 (Cervello Runtime) mergiata (PR #5)
- **Numeri verificati:** 72 tabelle schema · 43 migrazioni · 79 file route · 72 pagine web

---

## 📜 Protocollo di revisione (LEGGERE PRIMA DI TUTTO)

Sei un'intelligenza artificiale al lavoro su NorthStar. Tratta questo file come **memoria di lungo termine condivisa** tra tutti i modelli.

1. **All'inizio della sessione:** leggi questo file per intero. È il punto di sincronizzazione tra te e i modelli che ti hanno preceduto.
2. **Verifica prima di fidarti:** la memoria invecchia. Se un fatto qui nomina un file, una tabella, un flag o un branch, **controlla che esista ancora** prima di basarci una decisione. Se diverge dal codice, vince il codice — e tu correggi questo file.
3. **Alla fine di un lavoro significativo** (fase GSD chiusa, commit/PR rilevante, cambio di architettura, nuova decisione di prodotto) **aggiorna le sezioni pertinenti**:
   - Aggiorna l'intestazione (data, modello, stato repo, numeri se cambiati).
   - Aggiorna **§7 Stato e Direzione** (cosa è fatto, cosa è in corso, prossimi passi).
   - Aggiungi una riga al **§10 Changelog della memoria** (data — modello — cosa è cambiato).
4. **Cosa NON mettere qui:** segreti/API key (mai), dettagli effimeri della singola conversazione, copie integrali di documenti che esistono già (linkali). Le radici crescono per strati, non per duplicazione.
5. **Lingua:** italiano per strategia/prodotto, inglese tecnico per codice e identificatori — come fa il fondatore.
6. **Coerenza col cervello:** quando una decisione di prodotto cambia, il riflesso canonico va in `.brain/` (vedi §6); questo file lo riassume e lo punta. Non sono in competizione: `.brain/` è il second-brain interrogabile da Wendy a runtime, `memoria.md` è la porta d'ingresso per gli umani e le AI.

> Regola d'oro: **se hai imparato qualcosa che il prossimo modello rischierebbe di ri-scoprire da zero, scrivilo qui.**

### Come arriva qui ogni AI (caricamento automatico)

Questo file è agganciato ai file di contesto che gli strumenti AI caricano da soli, così
nessuno deve ricordarsi di aprirlo. Se aggiungi un nuovo strumento, crea il suo file di
istruzioni e fallo puntare qui.

| Strumento | File auto-caricato | Punta a |
| --- | --- | --- |
| Claude Code | [`CLAUDE.md`](CLAUDE.md) | → `memoria.md` + `AGENTS.md` |
| OpenCode / Cursor / Codex / Gemini CLI / Copilot agent | [`AGENTS.md`](AGENTS.md) | → `memoria.md` |
| GitHub Copilot (VS Code) | [`.github/copilot-instructions.md`](.github/copilot-instructions.md) | → `memoria.md` + `AGENTS.md` |

---

## 1. 🌟 Identità del progetto

**NorthStar** è una piattaforma **SaaS + AaaS** (Agents-as-a-Service) di **orientamento e crescita professionale**, focalizzata sul mercato del lavoro IT italiano. Non è un job board né un clone di LinkedIn: è un sistema dove **agenti AI autonomi osservano il mercato** (annunci, trend skill, segnali deboli) e propongono opportunità, routine e coaching — anche quando l'utente non è loggato.

- **Fondatore / operatore unico:** Garik (`volegovgarik18@gmail.com`). Lavora in modalità solo-founder assistito da agenti AI (Claude Code + framework GSD). Pensa il prodotto, scrive il codice via agenti, decide la roadmap.
- **Preferenze di lavoro:** risposte concise; commit atomici e verificabili; GSD-first; security gate prima del commit; niente PII al LLM in chiaro; date assolute (non "giovedì").
- **Pilastri prodotto:** test RIASEC/vocazionale, AI coach conversazionale (**Wendy**), CV builder, knowledge graph personale, routine autonome, programma di affiliazione B2B.

Riferimenti canonici (cervello L1):
- [`.brain/00_Identity/Vision-NorthStar.md`](.brain/00_Identity/Vision-NorthStar.md) — ragion d'essere
- [`.brain/00_Identity/Values-Principles.md`](.brain/00_Identity/Values-Principles.md) — regole non negoziabili
- [`.brain/00_Identity/Garik.md`](.brain/00_Identity/Garik.md) — chi è e come lavora il fondatore
- [`.brain/00_Identity/Glossary.md`](.brain/00_Identity/Glossary.md) — glossario interno

---

## 2. 🧭 Regola 0 — quali RULES leggere PRIMA di toccare codice

Prima di modificare un'area, apri **sempre** il file di regole specifico. Questi sono radici di prima istanza.

| Area di lavoro | File da leggere |
| --- | --- |
| Backend API / Express / router / middleware / auth | [`API_RULES.md`](API_RULES.md) |
| Database / Drizzle ORM / migrations / seed | [`DB_RULES.md`](DB_RULES.md) |
| Frontend React / UI / Tailwind / Vite | [`FRONTEND_RULES.md`](FRONTEND_RULES.md) |
| AI agent / Wendy / RAG / prompt | [`AI_RULES.md`](AI_RULES.md) |
| Git / branching / commit / PR | [`GIT_RULES.md`](GIT_RULES.md) |
| Sicurezza (gate per tipo di step) | [`SECURITY_RULES.md`](SECURITY_RULES.md) |
| Dove posizionare file/script/docs | [`docs/REPOSITORY_STRUCTURE.md`](docs/REPOSITORY_STRUCTURE.md) |
| Visione di architettura e pattern | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Incident / rollback / hotfix | [`RUNBOOK.md`](RUNBOOK.md) |

---

## 3. 🏗️ Architettura e stack

Monorepo **pnpm workspace** (`packageManager: pnpm@11`). Node ≥20.10 <25. Python 3.11 per il microservizio ML opzionale.

### Servizi runtime

| Servizio | Tech | Porta | Scopo |
| --- | --- | --- | --- |
| **Frontend** | React 18 + Vite + TS | 5173 | SPA (`apps/web/`) |
| **Server API** | Express + Node + TS | 3001 | API REST + SSE (`apps/server/`) |
| **PostgreSQL** | postgres:16 + pgvector | 5432 | DB principale + vettori |
| **Redis** | redis:7 | 6379 | cache + rate limit |
| **AI/ML (opzionale)** | Python FastAPI (`main.py`) | 8000 | training/predizione scikit-learn |
| **Jaeger** | all-in-one | 16686 | distributed tracing (OTel) |

### Stack effettivo

| Layer | Tecnologia |
| --- | --- |
| Frontend | React 18 · Vite · TypeScript |
| Styling | Tailwind CSS · shadcn/ui (Radix) · tema "Deep Navy" |
| Router | **wouter** (non React Router) |
| State | React Context + TanStack Query v5 |
| Realtime | EventBus (BroadcastChannel) + WebSocket |
| Backend | Express + Node + TypeScript |
| DB | PostgreSQL (Neon) + **Drizzle ORM** + pgvector |
| Cache | Redis (ioredis) |
| AI | OpenAI · Groq · OpenRouter (via SSE) |
| Auth | JWT NorthStar + fallback Clerk (JWKS) |
| Osservabilità | Pino · Prometheus · Sentry · OpenTelemetry/Jaeger |

### Pacchetti condivisi (`packages/`)

| Package | Ruolo |
| --- | --- |
| `@workspace/ai-server` | Orchestrazione AI multi-agente (Growth Agent + Wendy) |
| `@workspace/db` | Schema Drizzle, migrazioni, pool PostgreSQL |
| `@workspace/api-zod` | Schemi Zod condivisi (generati da OpenAPI) |
| `@workspace/api-spec` | Specifica OpenAPI + codegen Orval |
| `@workspace/api-client-react` | Client React Query generato |
| `@workspace/ws-server` | Server WebSocket eventi real-time |
| `@workspace/design-tokens` | Design tokens CSS (tema Deep Navy) |
| `@workspace/ml-client` | Client TS per il microservizio ML Python |

> Flusso request: `apps/web` usa `apiFetch` (inietta JWT, normalizza 401) → `apps/server` valida JWT (fallback Clerk) → Drizzle/Postgres + Redis → route AI delegano a `packages/ai-server` → pgvector/LLM. Dettaglio in [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## 4. 🗄️ Backend, Database, API

### apps/server (`apps/server/src/`)

- **~79 file route** (thin HTTP wrapper) montati da `route-config.ts`.
- **Middleware chiave** (`middleware/`): `auth.ts` (JWT NorthStar + fallback Clerk JWKS con auto-upsert), `rate-limit.ts`, `audit.ts` (append-only), `cost-guard.ts` (limite costo LLM), `check-feature.ts` (gate per piano free/pro/team), `logger.ts` (Pino), `request-id.ts`, `metrics-protection.ts`.
- **Service layer isolato** solo per 3 contesti: `services/knowledge/`, `services/wendy/`, `services/admin/`. Gli altri bounded context hanno logica a livello di route o in `lib/`. *(Nota: `ARCHITECTURE.md` elenca `services/journey/`, `services/content/`, `services/social/`, `services/monetization/` come pattern target — non ancora estratti. Divergenza nota, vedi §8.)*
- **Jobs** (`jobs/`): include `vault-ingest.ts` (Fase 2) e altri worker schedulati via cron.

### Bounded contexts

| Context | Prefisso route | Service |
| --- | --- | --- |
| Core Journey | `/api/profile`, `/api/test-sessions`, `/api/roadmap`, `/api/journey-type` | route-level |
| Knowledge | `/api/knowledge`, `/api/wiki`, `/api/admin/rag` | `services/knowledge/` |
| AI Coach | `/api/wendy`, `/api/ai/wendy`, `/api/coach`, `/api/proactive-insights` | `services/wendy/` |
| Content | `/api/news`, `/api/crescita`, `/api/trending-sectors`, `/api/sectors`, `/api/roles` | route-level |
| Social | `/api/friends`, `/api/social`, `/api/leaderboard`, `/api/xp` | route-level |
| Monetization | `/api/subscription`, `/api/affiliate`, `/api/affiliazione` | route-level |
| Admin | `/api/admin`, `/api/admin/rag`, `/api/ml` | `services/admin/` |
| Personal Intelligence | `/api/openhuman`, `/api/graphify` | `lib/personal-intelligence-context.ts` |

Fonte runtime dei mount: `apps/server/src/route-config.ts`. Tabella generata: [`docs/api-routes.md`](docs/api-routes.md).

### Database (`packages/db/src/schema/`)

- **72 file schema** (≈1 tabella per file; multi-tabella in `coachMemory.ts`, `wendyBrain.ts`). Indice: `schema/index.ts`.
- **43 migrazioni** Drizzle in `packages/db/drizzle/`.
- **Tabelle con pgvector (embedding 1536-dim, `text-embedding-3-small`):** `rag_chunks`, `rag_routing_keys`, `wendy_brain_nodes`, `coach_memory_facts`, `coach_memory_patterns`, `knowledge_nodes`, `app_search_index`, `growth_articles`, `news_articles`, `professions`, `sectors`, ed altri cataloghi.
- **Famiglie tabelle:** Users/Auth · Gamification (badge, xp, leaderboard) · Content (news, growth, professioni, settori, business ideas) · Social (friendships, messages) · Workspace/Collab · Monetization (subscription, affiliate*) · RAG (`rag_sources`, `rag_chunks`, `rag_routing_keys`, `weak_signals`, `job_posting_snapshot`, `skill_cooccurrence`) · AI/Memory (`wendy_brain_*`, `coach_memory_*`, `coach_sessions`, `llm_usage`, `ai_cost_log`, `ai_request_log`, `wendy_feedback`, `wendy_briefing`) · Audit (`audit_log` append-only).
- Comandi: `pnpm db:generate` · `pnpm db:migrate` · `pnpm db:push`. Regole in [`DB_RULES.md`](DB_RULES.md). **Test di integrazione su DB reale (no mock).**

### Auth

- **Primaria:** JWT NorthStar emesso da `routes/auth.ts`, verificato con `JWT_SECRET`, payload con user data stabile (zero query DB nel path felice).
- **Fallback:** token Clerk verificato via JWKS (cache 1h), risolto su `users.clerkId`; auto-upsert utente per email se assente.
- **Autorizzazione:** `requireAuth` → `requireAdmin` (verifica `users.role='admin'` su DB) → `requirePremium` (gate piano).

### API contracts

- `packages/api-spec/openapi.yaml` è la sorgente; Orval genera Zod (`api-zod`) e hook React Query (`api-client-react`). Rigenera con lo script di codegen (`pnpm` task `api:generate`/`db:generate` secondo area).

---

## 5. 🤖 Sistema AI — Wendy, Growth Agent, RAG, Cervello

### Growth Agent (`packages/ai-server/src/growth-agent/`)

Pipeline multi-agente: **Router** (classifica dominio/intent) → **Memory Manager** (carica contesto) → **Specialist** (career / mindset / habits / health / trading) → moduli (Chain-of-Thought, Self-Evaluator, Retriever RAG, Web Search) → **Supervisor** (quality gate, riscrive se score basso) → **Memory Extraction** → risposta SSE. Moduli reali confermati: `router-agent`, `memory-manager`, `specialist-agent` (+ `specialists/`), `supervisor-agent`, `self-evaluator`, `parallel-handoff`, `chain-of-thought`, `tone-adapter`, `prompt-builder`, `ui-tools`/`ui-directives`, `embedder`, `retriever`, `web-search`, `voice-runner`. *(`socratic-engine` / `session-summarizer` citati storicamente NON sono presenti come file dedicati — vedi §8.)*

### Wendy — tool registry (`packages/ai-server/src/wendy-router/`)

Registry singleton `toolRegistry` (`tool-registry.ts`) con ~30 tool, dispatch in `tool-handlers*.ts`, matrice **intent → tool** (`navigation`, `simple_qa`, `conversation`, `planning`, `deep_analysis`). Famiglie:
- **Navigazione/UI:** `open_view`, `set_filters`
- **Settori/Professioni:** `get_sector_detail`, `list_sectors`, `get_profession_detail`, `search_professions`, `compare_sectors`
- **Mercato/Trend:** `get_market_trend`, `get_weak_signals`, `get_job_posting_trend`, `get_skill_cooccurrences`
- **Obiettivi:** `get_user_objectives`, `save_objective`, `update_objective_progress`
- **Contenuti/Formazione:** `get_growth_articles`, `get_news_summary`, `get_learning_paths`
- **Memoria/Dominio utente:** `save_business_idea`, `save_memory_fact`, `add_calendar_event`, `get_user_context`
- **RAG + Brain (Step 6 / Fase 2):** `search_rag` (knowledge esterno), **`search_brain`** (cervello interno `.brain/`), `search_memory_graph`
- **Personal Intelligence:** `ask_openhuman_memory`, `recall_semantic_memory`, `explain_app_with_graphify`, `search_code_graph`, `explain_code_node`

### RAG pipeline (`packages/ai-server/src/rag/`)

Retrieval a due livelli ("memory sparse attention"): (1) routing via `rag_routing_keys` per selezionare le fonti, (2) chunk via `rag_chunks` con similarità coseno pgvector. Multi-hop opzionale; circuit breaker: se il routing fallisce, fallback a query diretta sui chunk. Ingestori: PDF, JSON, RSS. Se non ci sono chunk affidabili, **Wendy dichiara dati insufficienti invece di inventare**.

### Cervello a runtime (Fase 2 — "Cervello Runtime")

- `packages/ai-server/src/wendy-brain.ts` — API memoria strutturata (`recordWendyBrainEvent`, `searchWendyBrain`, `promoteWendyBrainCandidate`, `runWendyBrainOptimizer`) su `wendy_brain_nodes`/`edges`/`events`; sanitizza PII (email/telefono).
- `apps/server/src/jobs/vault-ingest.ts` — cron (default 24h) che legge `.brain/**/*.md` con frontmatter `runtime: true`, ne fa chunk + embedding e li ingesta in `rag_sources`/`rag_chunks` (`source_type='brain'`, idempotente via hash + `obsidian_path`).
- `apps/server/src/routes/admin/wendy-brain.ts` — route admin per ispezionare/gestire il cervello.
- **Effetto:** Wendy distingue domande sul prodotto/architettura (cervello interno) da domande sul mercato reale (RAG esterno).

### Feature flags (`packages/ai-server/src/feature-flags.ts`)

`FF`: `parallelHandoff`, `generativeUI`, `chainOfThought`, `supervisorEnabled`, `memoryEnabled` → **default true**; `semanticMemory`, `voicePlugin`, `visionPlugin` → **default false**. Cervello: `WENDY_BRAIN_ENABLED` (default true), `WENDY_BRAIN_AUTO_PROMOTE`. Layer neurale (Fase 3): `WENDY_NEURAL_ENABLED` (default false).

### LLM & osservabilità

- Provider: OpenAI (default), Groq, OpenRouter; retry con backoff; timeout; fallback. Embeddings `text-embedding-3-small`. TTS OpenAI per voce.
- Metriche Prometheus `wendy_*` (requests, latency, supervisor_rewrites, llm_tokens, tool_calls, router_confidence) + `rag_*`. Endpoint `/api/metrics` e `/api/admin/wendy-metrics`.
- **Eval framework** (`docs/eval-wendy/`): ~46 test su 7 categorie (sector_qa, profession_qa, planning, navigation, insufficient_data, guardrail_safety, privacy). Soglia pass ≥70%. Esegui con `pnpm test:ai` / `pnpm eval`. KPI: safety/privacy 100%, accuracy >80%, latency p99 <3s.

Approfondimenti: [`AI_RULES.md`](AI_RULES.md), [`docs/ai-modules/`](docs/ai-modules/), [`.brain/20_Product/Subsystems/Wendy.md`](.brain/20_Product/Subsystems/Wendy.md), [`.brain/20_Product/Subsystems/RAG-Pipeline.md`](.brain/20_Product/Subsystems/RAG-Pipeline.md).

---

## 6. 🎨 Frontend & UX (`apps/web/src/`)

- **~72 pagine** (`pages/`, kebab-case) raggruppate per area: auth, dashboard/profilo, test/orientamento (RIASEC + "La Bussola"), Wendy/coach, admin (console ~10 sezioni), monetization (premium/Stripe), social/amici, knowledge graph (grafo/archivio), career tools (roadmap, skills-gap, colloquio, candidature), growth/news, affiliazioni B2B, marketing/info.
- **Routing dichiarativo:** `route-config.ts` (path · component lazy · `guard: public|publicOnly|protected` · `layout: default|admin|plain`) applicato da `RouterFromConfig.tsx` con `ProtectedRoute`, `Suspense`, `ErrorBoundary`. Router = **wouter**.
- **Stato globale:** `AuthContext`, `WendyProvider`, `AppStateContext` (+ admin); React Query per il data fetching. **EventBus** singleton (BroadcastChannel) per sync cross-tab; `usePageModule({ pageId })` è il template obbligatorio per ogni pagina. Hook chiave: `useSubscription`, `useProactiveInsights`, `usePageBus`.
- **Design system:** `packages/design-tokens` (tema **Deep Navy Premium**: bg `#0e1018`, accent oro `#c19e4a`, verde sage `#7db89a`; font Inter/Playfair). Tailwind + shadcn/ui (~66 componenti base). Utility glassmorphism (`.liquid-card`, `.liquid-panel`).
- **PWA/Mobile:** VitePWA (manifest standalone, Workbox runtime caching), service worker con push notification, `MobileBottomNav`, layout responsive.

### Pilastri frontend (non negoziabili)

1. URL API solo via `API_ENDPOINTS` (`lib/constants.ts`) — mai stringhe `/api/...` hardcoded.
2. Data fetching solo via `apiFetch` + React Query — mai `fetch()` nudo.
3. Comunicazione inter-pagina via `usePageModule`/EventBus (Observer).
4. Error handling: `ExecutionMonitor` (server) + `ErrorBoundary` (client).
5. `pnpm audit:dead-code` (knip) prima delle release.

Dettagli e checklist nuove pagine: [`FRONTEND_RULES.md`](FRONTEND_RULES.md) e [`ARCHITECTURE.md`](ARCHITECTURE.md).

> **Debito noto frontend (vedi §8):** `route-paths.ts` parzialmente sovrapposto a `route-config.ts`; EventBus sottoutilizzato; possibile duplicazione tra `features/admin-*`; alcuni componenti Fase 2 staged in knip-ignore (vanno **collegati**, non cancellati).

---

## 7. 🧭 Stato e Direzione (la sezione che ogni AI aggiorna)

### Traiettoria di prodotto — 3 fasi GSD

NorthStar evolve da **SaaS reattivo** a **SaaS+AaaS con agenti autonomi**:

1. **Fase 1 — Ritual Engine + Dashboard personalizzabile** — *quasi completa*. Routine autonome schedulate (job_monitor, market_report, mindset_exercise, growth_briefing, interview_prep), tabelle `userRoutines`/`userDashboardLayout`, tool Wendy `configure_routine`, UI dashboard + `/routines`. Branch parent `feature/fase1-ritual-engine`; estensione audio su `feature/global-ritual-audio`. Resta: test coverage finale + gate.
2. **Fase 2 — Cervello Runtime** — ✅ **MERGIATA** (`main @ 5e3545f`, PR #5). Vault `.brain/` interrogabile da Wendy a runtime via pgvector (`vault-ingest` + tool `search_brain`).
3. **Fase 3 — Wendy Neural Attention** — *draft, prossima*. Layer persistente che decide quali fonti "accendere" per turno (Brain, RAG, memoria utente, tool, page context) tramite trace + rinforzo edge (`wendy_neural_activations`, `wendy_neural_edges`), senza addestrare modelli custom; review-first, `WENDY_NEURAL_ENABLED=false` di default.

Note di fase: [`.brain/30_Process/GSD-Phases/`](.brain/30_Process/GSD-Phases/). Piano Fase 2: [`.planning/phases/fase-2-cervello-runtime/PLAN.md`](.planning/phases/fase-2-cervello-runtime/PLAN.md).

### Stato git (alla revisione)

- `main @ 5e3545f` — contiene Fase 1 (step 1–8) + Fase 2 (mergiata).
- Branch attivi non-snapshot: `main`, `feature/global-ritual-audio`, `feature/brain-bootstrap`, `feature/fase2-cervello-runtime`. Numerosi branch `claude/*` e `worktree-agent-*` sono snapshot storici (potabili).

### Prossimi passi

- [ ] Chiudere **Fase 1 / Step 9** (test + security gate) e mergiare in `main`.
- [ ] Avviare **Fase 3 — Wendy Neural Attention** una volta Fase 1 stabile.
- [ ] Ripianare il debito noto (§8): allineare service layer ai bounded context, collegare i componenti Fase 2 staged, consolidare `route-paths.ts`.

### Pipeline interne (`.brain/20_Product/Pipelines/`)

development (esterna, manuale via `gsd:ns-step`) · security · quality · compliance · infra-health · eval-wendy · performance · analytics · tech-debt. Lanciabili via `gsd:ns-pipeline`.

### Percorso "La Bussola" (utente indeciso)

Flusso: `/percorso` → `/test` (RIASEC) → `/risultati/:id` → `/dashboard` personalizzata per `journeyType` (default `indeciso`). Personas: indeciso, dipendente, autonomo, azienda, investitore.

---

## 8. ⚠️ Divergenze note (docs ↔ codice) e debito

Da riconciliare nel tempo. Quando ne risolvi una, rimuovila da qui.

1. **Service layer parziale.** `ARCHITECTURE.md` descrive `services/{journey,content,social,monetization}/` ma esistono solo `knowledge/`, `wendy/`, `admin/`. Gli altri BC hanno logica a livello di route.
2. **Moduli AI citati ma assenti.** `socratic-engine.ts` e `session-summarizer.ts` non esistono come file dedicati (memoria/decay gestiti altrove). Aggiornare i riferimenti storici.
3. **`route-paths.ts` vs `route-config.ts`.** Sovrapposizione parziale; valutare deprecazione di `route-paths.ts`.
4. **EventBus sottoutilizzato** — pochi call-site; il messaging inter-pagina è più potenziale che reale.
5. **Componenti Fase 2 staged** in knip-ignore: vanno **collegati** alle pagine, non cancellati (il gate dead-code può ingannare su feature read-only — vedi memoria `staged-wip-components-fase2` e `wendy-session-memory-restore`).
6. **Numeri "vivi".** route/tabelle/pagine cambiano: la fonte di verità è il codice, non questo file. Aggiorna l'header quando rifai il conteggio.

---

## 9. 🛠️ Comandi essenziali

```bash
# Sviluppo
pnpm install            # installa dipendenze (preinstall script)
pnpm dev                # Docker (postgres+redis) + server :3001 + web :5173
pnpm dev:web            # solo frontend
pnpm dev:server         # solo server

# Qualità (gate)
pnpm check              # lint + typecheck
pnpm qa                 # quality:required (lint, typecheck, coverage, audit/ratchet)
pnpm quality:full       # qa + build + runtime e2e
pnpm audit:dead-code    # knip (report, nessun delete)

# Database
pnpm db:generate        # genera migrazione Drizzle
pnpm db:migrate         # applica migrazioni
pnpm db:push            # push schema in dev

# AI / Test
pnpm test:ai            # test suite AI server
pnpm eval               # eval suite Wendy (docs/eval-wendy)
pnpm test:e2e           # Playwright
```

Setup completo, Docker, troubleshooting, microservizio Python: [`README.md`](README.md).

---

## 10. 🌱 Changelog della memoria

Aggiungi una riga ad ogni revisione significativa. Più recente in alto.

| Data | Modello/AI | Cosa è cambiato |
| --- | --- | --- |
| 2026-06-01 | Opus 4.8 | Creazione iniziale di `memoria.md` tramite workflow agentico (4 agenti Explore: backend/DB, frontend/UX, AI/Wendy/RAG, stato/direzione) + verifica diretta di git, conteggi e posizioni file. Stato: Fase 2 mergiata, Fase 1 in chiusura, Fase 3 in arrivo. |

---

> 🌍 *Le radici tengono; i pianeti passano. Ogni modello che legge queste righe è responsabile di lasciarle più vere di come le ha trovate.*
