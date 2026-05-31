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

## Tranche 7 Applicata

- `/api/news` espone diagnostica provider quando il feed e vuoto o degradato: stato fonti, ultimo tentativo, errori e prossima azione consigliata.
- UI News non lascia piu l'utente davanti a un vuoto muto: mostra messaggio operativo su pipeline, chiavi provider, fonti mancanti o refresh atteso.
- Clerk sync in produzione richiede un bearer Clerk verificabile: token mancante/invalido o `sub` non coerente non arrivano piu alla sync DB.
- La verifica JWKS Clerk usa un resolver condiviso che deriva l'endpoint dal Frontend API URL o dalla publishable key, evitando il vecchio default generico.
- API candidature non restituisce piu un falso empty state quando l'utente richiede candidature di un altro account: risponde `403 APPLICATIONS_USER_MISMATCH`.
- E2E mobile Pixel 5 copre SearchDialog/Wendy, pagina `/wendy`, memoria Wendy e dashboard, verificando assenza di overflow orizzontale e controlli raggiungibili.
- Auth dev/e2e supporta token NorthStar locale senza sessione Clerk reale solo in `DEV`, cosi le route protette sono testabili senza indebolire produzione.
- Wendy mobile tiene composer e pulsanti dentro il viewport: bottom sheet con altezza reale, console fullscreen ordinata prima dello stage e input flex `min-w-0`.

## Tranche 8 Applicata

- Verifica Clerk rafforzata: i token RS256 ora validano anche `issuer` derivato da Frontend API/publishable key e `audience` esplicita quando configurata.
- I test auth coprono un bearer Clerk production valido e un issuer inatteso bloccato prima di qualunque sync DB.
- La pipeline admin `news-publishing` ritorna `sourceDiagnostics` per GNews, Tavily, RSS statici e RSS admin: stato, raccolti, ultimo errore e azione operativa.
- La console admin mostra la sezione "Fonti news" nei risultati pipeline, cosi l'operatore capisce subito se mancano chiavi, quota/provider o feed RSS.
- Route lavori/candidature non fingono piu persistenza: `GET/POST/PATCH/DELETE` placeholder espongono `status: "not_configured"`, `reason` e `action` invece di empty/fake success.
- UI lavori/candidature mostra stato setup esplicito e nasconde CTA che farebbero credere a salvataggi reali quando backend/provider non sono collegati.

## Tranche 9 Applicata

- `PATCH /api/objectives/:id` mantiene coerenti progresso e completamento: `progress: 100` completa l'obiettivo, mentre un progresso inferiore riapre e cancella `completedAt`.
- Errori obiettivo invalidi o mancanti tornano codici azionabili (`OBJECTIVE_INVALID_ID`, `OBJECTIVE_NOT_FOUND`) con `action: "refresh_objectives"`.
- Wendy action executor conserva la ragione API quando una creazione obiettivo viene rifiutata, chiarisce che nulla e stato modificato e invita a correggere la proposta prima del retry.
- Diario obiettivi non confonde piu errore API con lista vuota: mostra un recovery state con `Riprova`.
- Le mutazioni fallite nel Diario restano visibili con motivo API, invece di sparire in silenzio.
- Dashboard non maschera piu errori `/api/dashboard` con KPI/timeline/diario vuoti: mostra un blocco recuperabile e mantiene consultabile il resto.
- Timeline settimanale usa gli obiettivi attivi quando non ci sono eventi calendario, evitando la traccia predefinita se l'utente ha gia azioni reali.

## Tranche 10 Applicata

- Wendy mostra prossimi passi cliccabili anche dopo un errore di stream, cosi la conversazione non finisce in un vicolo cieco.
- I follow-up da messaggio errore passano a Wendy il contesto del fallimento e chiedono di continuare con azioni/tool senza ripartire da zero.
- News conserva e mostra la diagnostica provider anche quando `getJson` trasforma un `503` in errore client.
- `/api/news` non maschera piu una feed vuota come stato reale quando tutte le fonti abilitate hanno `lastError`: risponde `503 news_unavailable` con diagnostica GNews/Tavily/RSS.
- Growth personalizzato non sparisce quando il profilo esiste ma non ci sono articoli matchati: mostra "Profilo pronto, contenuti in arrivo" e guida alla libreria generale.

## Tranche 11 Applicata

- `apiClient` trasforma i fallimenti di rete/fetch in `ApiClientError` con status `0` e messaggio operativo, invece di propagare `TypeError` grezzi alle pagine.
- La galleria certificati non mostra piu "Nessun certificato ancora" quando `/api/nft-certificates/me` fallisce: espone uno stato recuperabile con `Riprova`.
- `useRoutines` non converte piu errori API in lista vuota; il widget "Prossima routine" mostra errore recuperabile e link gestione routine.
- Il profilo non interpreta piu `emailVerified` mancante come successo: mostra "Email verificata" solo quando il valore e esplicitamente `true`.
- Le impostazioni profilo usano lo stato reale `user.emailVerified`, evitando un falso badge di fiducia quando la sync profilo fallisce.

## Tranche 12 Applicata

- La pagina pubblica certificato distingue un vero `404` da un servizio certificati non disponibile: mostra errore recuperabile con `Riprova` invece di dire "Certificato non trovato".
- Il profilo resta utilizzabile quando `/api/profile/:id` fallisce, ma segnala che bio, citta, banner e preferenze potrebbero essere incompleti e offre retry.
- Il feed routine non maschera piu errori API come feed vuoto reale: `useRoutineFeed` espone `error` e `isError` ai consumatori.
- Il salvataggio del tono di Wendy nelle impostazioni non resta ottimistico se fallisce: ripristina il tono precedente e mostra un alert operativo.

## Tranche 13 Applicata

- `/api/news` prova un refresh automatico con i provider reali quando la prima pagina e vuota o stale, poi rilegge il feed e marca la risposta `source: "auto_refresh"` quando arrivano contenuti.
- La cache news non serve piu una prima pagina vuota o stale senza tentare il refresh; le ricerche senza risultati non scatenano refresh provider inutili.
- Le news multi-categoria provano un refresh automatico quando tutti i bucket sono vuoti, cosi tecnologia/salute/business possono popolarsi appena GNews/Tavily trasferiscono articoli.
- Growth espone una libreria fallback italiana, divisa per categorie, quando non esistono articoli pubblicati: lista, categorie, `/per-te` e dettaglio slug restano navigabili.
- La UI Growth mostra i contenuti fallback come percorso generale, non come suggerimento personalizzato basato sul profilo.
- Wendy conserva gli errori stream come terminali, evita persistenza/TTS di risposte fallite e aggiunge follow-up cliccabili orientati a strumenti app, obiettivi e prossimo checkpoint.
- I suggerimenti backend di Wendy vengono sanificati, deduplicati e completati con fallback fino a tre azioni cliccabili.

## Tranche 14 Applicata

- Affiliate dashboard non mostra piu `Copiato` se clipboard e fallback copy falliscono: espone un messaggio recuperabile e lascia il link selezionabile manualmente.
- Il QR affiliate non fallisce in silenzio: fetch/download mostrano errore, stato di caricamento e `Riprova QR`, mantenendo disponibile la condivisione via link.
- Idea Validator valida le risposte Wendy radar/decisione prima di scriverle in UI: payload malformati non sovrascrivono score o consigli con dati rotti/stale.
- Idea Validator cancella suggerimenti AI ottimistici all'avvio di nuove richieste e rende errori di salvataggio, radar, decisione ed esperimenti annunciabili con `role="alert"`.
- Knowledge Graph espone errori di caricamento con stato recuperabile su canvas desktop e lista mobile, invece di cadere nello stato vuoto ambiguo.
- Knowledge Graph mantiene editor/dialog aperti quando mutazioni nodo/arco falliscono, mostra errore inline/toast e non segnala `Salvato` dopo un save fallito.
- La chat del grafo non resta bloccata su `Avvio`: stream malformati, vuoti o chiusi senza evento terminale diventano messaggi recuperabili.
- Dashboard indeciso usa la stessa validazione del widget readiness prima di bandizzare gli strumenti, evitando consigli adattivi basati su cache incompleta.

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

## Verifica Tranche 7

- `pnpm --filter @northstar/server exec vitest run --configLoader runner src/lib/clerk-jwks-url.test.ts src/routes/auth-clerk-sync.test.ts src/routes/applications.test.ts src/routes/jobs.test.ts src/routes/news.test.ts`
- `pnpm --filter @northstar/web exec vitest run --configLoader runner src/pages/news.test.tsx src/components/search/SearchDialog.test.tsx src/contexts/AuthContext.test.tsx src/components/wendy/WendyNodeStage.test.ts src/components/wendy/WendyActionCard.test.tsx`
- `pnpm exec playwright test e2e/mobile/wendy-critical-surfaces.mobile.spec.ts --project=chromium --workers=1`
- `pnpm --filter @northstar/server run typecheck`
- `pnpm --filter @northstar/web run typecheck`
- `git diff --check`

## Verifica Tranche 8

- `pnpm --filter @northstar/server exec vitest run --configLoader runner src/lib/clerk-jwks-url.test.ts src/routes/auth-clerk-sync.test.ts src/routes/admin/shared/pipelines.test.ts src/routes/applications.test.ts src/routes/jobs.test.ts --pool=forks`
- `pnpm --filter @northstar/web exec vitest run --configLoader runner src/components/admin/console/sections.test.tsx src/pages/applications.test.tsx src/pages/lavori.test.tsx src/components/dashboard/widgets/JobFeedWidget.test.tsx`
- `pnpm --filter @northstar/server run typecheck`
- `pnpm --filter @northstar/web run typecheck`
- `git diff --check`

## Verifica Tranche 9

- `pnpm --filter @northstar/web exec vitest run --configLoader runner src/pages/dashboard.test.tsx src/components/diary/DiaryObjectives.test.tsx src/hooks/useWendyActionExecutor.test.ts src/components/wendy/WendyActionCard.test.tsx src/components/dashboard/DashboardWeekTimeline.test.tsx`
- `pnpm --filter @northstar/server exec vitest run --configLoader runner src/routes/objectives.test.ts`
- `pnpm --filter @northstar/web run typecheck`
- `pnpm --filter @northstar/server run typecheck`
- `git diff --check`

## Verifica Tranche 10

- `pnpm --filter @northstar/server exec vitest run --configLoader runner src/routes/news.test.ts`
- `pnpm --filter @northstar/web exec vitest run --configLoader runner src/pages/growth.test.tsx src/pages/news.test.tsx src/components/search/WendyMessageBubble.test.tsx`
- `pnpm --filter @northstar/server run typecheck`
- `pnpm --filter @northstar/web run typecheck`
- `git diff --check`

## Verifica Tranche 11

- `pnpm --filter @northstar/web exec vitest run --configLoader runner src/lib/apiClient.test.ts src/components/NftCertificateGallery.test.tsx src/hooks/useRoutines.test.tsx src/components/dashboard/widgets/NextRoutineWidget.test.tsx src/pages/profilo.test.tsx`
- `pnpm --filter @northstar/web run typecheck`
- `git diff --check`

## Verifica Tranche 12

- `pnpm --filter @northstar/web exec vitest run --configLoader runner src/pages/certificato.test.tsx src/pages/profilo.test.tsx src/hooks/useRoutines.test.tsx src/components/profile/ProfileSettings.test.tsx`
- `pnpm --filter @northstar/web run typecheck`
- `git diff --check`

## Verifica Tranche 13

- `pnpm --filter @northstar/server exec vitest run --configLoader runner src/routes/news.test.ts`
- `pnpm --filter @northstar/server exec vitest run --configLoader runner src/routes/growth.test.ts`
- `pnpm --filter @northstar/web exec vitest run --configLoader runner src/pages/growth.test.tsx`
- `pnpm --filter @northstar/web exec vitest run --configLoader runner src/hooks/useWendyChat.test.tsx src/hooks/wendySuggestedPrompts.test.ts`
- `pnpm --filter @northstar/server run typecheck`
- `pnpm --filter @northstar/web run typecheck`
- `git diff --check`

## Verifica Tranche 14

- `pnpm --filter @northstar/web exec vitest run --configLoader runner --maxWorkers=1 src/components/affiliate/AffiliateDashboard.test.tsx src/components/dashboard/DashboardIndecisoTools.test.tsx src/components/dashboard/CommitmentReadinessWidget.test.tsx`
- `pnpm --filter @northstar/web exec vitest run --configLoader runner --maxWorkers=1 src/features/idea-validator/IdeaValidatorErrorStates.test.tsx src/features/idea-validator/useIdeaValidatorScoringActions.test.tsx`
- `pnpm --filter @northstar/web exec vitest run --configLoader runner src/pages/grafo-conoscenza.test.tsx src/features/knowledge-graph/KnowledgeChatPanel.test.tsx src/features/knowledge-graph/KnowledgeNodeEditor.test.tsx src/features/knowledge-graph/useKnowledgeGraphData.test.tsx`
- `pnpm --filter @northstar/web run typecheck`
- `git diff --check`

## Backlog Prossima Tranche

1. Persistenza/storico stabile per stato provider news (`lastFetchAt`, `lastError`, rate limit) anche fuori dai run manuali.
2. Sostituire route placeholder di candidature/lavori con persistenza o provider reale quando il prodotto lo richiede.
3. Aggiungere pannello admin/manual refresh piu completo per fonti news, GNews/Tavily e stato provider.
4. Estendere mobile visual QA a WebKit/Safari e a viewport tablet.
5. Estendere E2E full-stack a referral, affiliate UI e mobile viewport, eliminando le ultime assunzioni su seed account.
