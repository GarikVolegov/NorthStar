# NorthStar UX Hardening Mission Board

Data: 2026-05-31

## Missione Prodotto

NorthStar e una bussola professionale: aiuta utenti italiani a capire chi sono, quali percorsi professionali hanno senso, quali settori osservare e quale prossima azione compiere. Il valore non e avere molte pagine, ma trasformare test, mercato, obiettivi, contenuti e Wendy in una guida continua.

## Journey Ideale

1. Utente nuovo capisce il prodotto dalla landing.
2. Fa il test senza attrito e vede risultati pubblici condivisibili.
3. Conferma un settore o una direzione.
4. Entra in dashboard con obiettivi, roadmap, contenuti e Wendy gia contestuali.
5. Esplora settori/news/crescita con stati chiari, non vuoti ambigui.
6. Chiede a Wendy, che capisce pagina e profilo, propone azioni e le esegue con conferma quando serve.
7. I progressi vengono aggiornati e riflessi in dashboard/diario/routine.

## Dipendenti Attivati

- Product Strategist / UX Mission: missione, journey, priorita prodotto.
- Frontend UX Engineer: route, layout, touch target, stati vuoti/errori, navigazione.
- Backend/API Reliability: contratti API, auth, empty/error state, public/protected mismatch.
- Wendy/Agent Experience Engineer: page context, action cards, tool UI, filtri, continuita.
- QA Runtime/E2E: copertura reale dei flussi critici.

## Finding P0/P1 Consolidati

1. Test pubblico incoerente: UI pubblica, API test-sessions montata autenticata.
2. Wendy full-path perdeva `pageContext`, quindi risposte complesse troppo generiche.
3. `set_filters` poteva perdere filtri se il modello seguiva lo schema con JSON string.
4. SearchDialog non si chiudeva dopo navigazione/filtri eseguiti da Wendy.
5. UI tool renderer Wendy non era allineato allo schema server e poteva mostrare card vuote.
6. `/workspace/:id` poteva finire in 404; alcune route utente non erano protette/layout-consistent.
7. Wendy full-screen aveva rischio overflow a 1024px.
8. Composer Wendy/Search aveva touch target sotto 44px.
9. CTA login job board puntava alla home.
10. Runtime gate non copre ancora abbastanza UX reale: Wendy live UI, news/growth, settori, onboarding, obiettivi.

## Tranche Applicata

- `POST /api/test-sessions` e `GET /api/test-sessions/:id` sono pubblici; `latest/history/confirm/assign-user` restano protetti.
- Wendy passa `pageContext` al growth agent nel percorso full LLM/tool.
- Filtri Wendy accettano sia object sia JSON string lato server/client.
- Azioni Wendy `navigate` e `set_filters` emettono `wendy:navigation-complete`; SearchDialog si chiude.
- Touch target composer Wendy/Search portati a 44px.
- Wendy full-screen usa layout responsive `xl` per tre colonne e non taglia la console a desktop piccolo.
- Route `/wendy/memoria`, `/workspace`, `/workspace/:id`, `/profilo/briefing` protette e con layout coerente.
- Job board CTA login punta a `/sign-in?redirect_url=/lavori`.
- UI tool renderer normalizza payload server per roadmap, career match, risorse, quiz e action plan.

## Tranche 2 Applicata

- News non maschera piu fallimenti totali come `200` con lista vuota: ritorna `503` strutturato con `status: "error"`.
- News multi-categoria mantiene contenuti parziali con `status: "partial"` e distingue fallimento totale da vuoto reale.
- UI News mostra stati separati per loading, errore API, vuoto reale e contenuto disponibile.
- Growth `/per-te` non promette piu personalizzazione senza profilo/test reale: usa `hasProfile` e `personalization`.
- UI Growth distingue contenuti generici in evidenza da contenuti realmente personalizzati.
- Esplora Settori distingue errore query, backend vuoto, nessun risultato filtrato e piramide con risultati reali.
- Wendy reidrata i messaggi visibili dalla persistenza locale, non solo la history per il backend.
- Wendy salva transcript visibile con action/tool metadata, suggerimenti cliccabili, request id e stato azioni.

## Tranche 3 Applicata

- Wendy action card per aggiornamento obiettivi non mostra piu fallimenti generici: conserva il motivo API e chiarisce che nulla e stato modificato.
- Le azioni Wendy fallite mostrano recovery esplicita e bottone `Riprova`, senza saltare la conferma iniziale.
- Candidature distingue loading, errore API, empty reale e contenuto; l'empty state porta verso offerte lavoro.
- API candidature e lavori espongono `status` e `totalCount` per rendere l'empty state verificabile dalla UI.
- Job feed dashboard non converte piu errori in feed vuoto: mostra errore recuperabile con retry.
- Widget dashboard critici non spariscono su errore API: readiness, insight personalita, obiettivi, streak mindset e insights mostrano stati recuperabili.
- `useProactiveInsights` non maschera errori come lista vuota quando la dashboard deve guidare l'utente.

## Tranche 4 Applicata

- Search/Wendy non usa piu due pipeline concorrenti: `useGlobalSearch` gestisce ricerca globale, `WendyConsole` resta la sola chat Wendy.
- SearchDialog separa visivamente `Ricerca globale` e `Chat Wendy`, con empty/error state chiari e CTA verso Wendy quando la ricerca non trova risultati.
- Navbar passa lo stato errore ricerca al dialog, evitando empty state ambigui.
- Guest Wendy non riceve piu un 401 JSON che sembra stream rotto: `/api/ai/wendy` emette un gate SSE non retriable con `auth_required`.
- Il gate guest punta alla route reale `/sign-in` e non avvia registry, LLM o memoria.
- Il parser SSE Wendy conserva i metadati del gate auth, cosi il client puo distinguere login richiesto da errore tecnico.
- Memoria Wendy rende il pulsante delete sempre visibile su touch/focus, con target 44px e focus ring.

## Tranche 5 Applicata

- Aggiunta copertura E2E runtime per Wendy integrata nella search bar, stati guest/auth, stream SSE token+done e contratto API usato dalla chat.
- Aggiunta copertura E2E per news, contenuti growth e settori: contenuto presente, empty state reale, errore recuperabile e piramide decisionale.
- Aggiunta copertura E2E per test RIASEC pubblico e flusso obiettivi autenticato con aggiornamento progresso riflesso in dashboard.
- L'helper auth E2E non dipende piu obbligatoriamente dall'utente seed locale: se non ci sono credenziali esplicite e il seed manca, crea un utente temporaneo.
- I test Wendy API sono allineati al contratto attuale: small talk locale dichiara `answerMode: "local-fast-path"` e restituisce `suggestedPrompts`.
- Verifica runtime ha individuato DB locale con schema `discovery_sources` incompleto; applicata localmente la migration `0041_discovery_sources_fast_lane.sql`, rendendo `/api/health/ready` verde.

## Tranche 6 Applicata

- Growth `/per-te` ora usa l'ultima sessione test reale dell'utente, non un flag profilo vuoto: espone tipi RIASEC/italiani e ordina prima gli articoli compatibili con `personalityMatches`.
- Clerk sync non collega piu silenziosamente un'email gia associata a un altro `clerkId`: risponde `409 CLERK_SYNC_EMAIL_ALREADY_LINKED` con messaggio azionabile.
- News fast lane parte allo startup quando `NEWS_RUN_ON_STARTUP` e attivo, anche in development con cron heavy spento, cosi la feed puo popolarsi senza aspettare l'intervallo da 90 minuti.
- SearchDialog mobile non somma piu risultati `60vh` e chat Wendy `58vh` dentro un bottom sheet limitato: la lista diventa flessibile e la chat resta raggiungibile.
- Memoria Wendy ha composer mobile stacked, input e CTA con target 44px, evitando campi compressi su schermi stretti.

## Verifica Tranche

- `pnpm --filter @northstar/server test src/routes/test-sessions.test.ts`
- `pnpm --filter @workspace/ai-server test src/wendy-router/tool-handlers.test.ts`
- `pnpm --filter @northstar/web test src/components/wendy/UiToolRenderer.test.tsx src/hooks/useWendyActionExecutor.test.ts`
- `pnpm --filter @northstar/server run typecheck`
- `pnpm --filter @northstar/web run typecheck`
- `git diff --check`
- Smoke locale:
  - guest `GET /api/test-sessions/latest` -> 401
  - guest `POST /api/test-sessions` -> 201
  - guest `GET /api/test-sessions/7` -> 200

## Verifica Tranche 2

- `pnpm --filter @northstar/server exec vitest run --configLoader runner src/routes/news.test.ts src/routes/growth.test.ts src/routes/test-sessions.test.ts`
- `pnpm --filter @workspace/ai-server test src/wendy-router/tool-handlers.test.ts`
- `pnpm --filter @northstar/web exec vitest run --configLoader runner src/pages/news.test.tsx src/pages/growth.test.tsx src/pages/settori.test.tsx src/hooks/wendyPersistence.test.ts src/hooks/useWendyChat.test.tsx src/components/wendy/UiToolRenderer.test.tsx src/hooks/useWendyActionExecutor.test.ts`
- `pnpm --filter @northstar/server run typecheck`
- `pnpm --filter @northstar/web run typecheck`
- `git diff --check`

## Verifica Tranche 3

- `pnpm --filter @northstar/server exec vitest run --configLoader runner src/routes/applications.test.ts src/routes/jobs.test.ts src/routes/objectives.test.ts`
- `pnpm --filter @northstar/web exec vitest run --configLoader runner src/hooks/useWendyActionExecutor.test.ts src/components/wendy/WendyActionCard.test.tsx src/pages/applications.test.tsx src/components/dashboard/widgets/JobFeedWidget.test.tsx src/hooks/useProactiveInsights.test.tsx src/components/dashboard/CommitmentReadinessWidget.test.tsx src/components/ai/PersonalityInsightCard.test.tsx src/components/dashboard/widgets/ProgressObjectivesWidget.test.tsx src/components/dashboard/widgets/MindsetStreakWidget.test.tsx src/components/dashboard/widgets/InsightsWidget.test.tsx`
- `pnpm --filter @northstar/server run typecheck`
- `pnpm --filter @northstar/web run typecheck`
- `git diff --check`

## Verifica Tranche 4

- `pnpm --filter @northstar/server exec vitest run --configLoader runner src/routes/ai-wendy.test.ts`
- `pnpm --filter @northstar/web exec vitest run --configLoader runner src/hooks/useGlobalSearch.test.tsx src/components/search/SearchDialog.test.tsx src/hooks/useWendyChatSse.test.ts src/hooks/useWendyChat.test.tsx src/pages/memoria-wendy.test.tsx`
- `pnpm --filter @northstar/server run typecheck`
- `pnpm --filter @northstar/web run typecheck`
- `git diff --check`

## Verifica Tranche 5

- `pnpm exec playwright test e2e/core-smoke.spec.ts e2e/wendy.spec.ts e2e/wendy-states.spec.ts e2e/content-sectors.spec.ts e2e/test-riasec.spec.ts e2e/objectives.spec.ts --project=chromium --workers=1`
- `pnpm exec playwright test e2e/api-affiliate.spec.ts --project=chromium --workers=1`
- `pnpm exec playwright test e2e/api-wendy.spec.ts --project=chromium --workers=1`
- `pnpm run audit:e2e-determinism`
- `pnpm --filter @northstar/server run typecheck`
- `pnpm --filter @northstar/web run typecheck`

## Verifica Tranche 6

- `pnpm --filter @northstar/server exec vitest run --configLoader runner src/routes/auth-clerk-sync.test.ts src/jobs/cron.test.ts src/routes/news.test.ts src/routes/growth.test.ts`
- `pnpm --filter @northstar/web exec vitest run --configLoader runner src/components/search/SearchDialog.test.tsx src/pages/memoria-wendy.test.tsx`
- `pnpm --filter @northstar/server run typecheck`
- `pnpm --filter @northstar/web run typecheck`
- `git diff --check`

## Backlog Prossima Tranche

1. Rafforzare ulteriormente auth/sync Clerk: rendere token verification obbligatoria in produzione e chiarire UX lato `AuthContext`.
2. Sostituire route placeholder di candidature/lavori con persistenza o provider reale quando il prodotto lo richiede.
3. Verificare mobile reale delle aree critiche con Playwright visuale: SearchDialog, Wendy full-screen, memoria, dashboard.
4. Aggiungere diagnostica provider a `/api/news` (`lastAttempt`, provider status, refresh action) senza appesantire il contratto pubblico.
5. Estendere E2E full-stack a referral, affiliate UI e mobile viewport, eliminando le ultime assunzioni su seed account.
