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

## Backlog Prossima Tranche

1. Distinguere errori da stati vuoti su objectives, applications, job feed e dashboard widgets.
2. Consolidare Search/Wendy: evitare due pipeline AI parallele non scopribili.
3. Aggiungere E2E runtime: Wendy live, news, growth, sectors explore, onboarding/test completo, objectives UI.
4. Decidere contratto guest Wendy: risposta guest con quota anonima oppure login gate esplicito.
5. Rendere cancellazione memoria visibile su touch/focus.
6. Correggere stati auth/sync Clerk con token verificato obbligatorio.
7. Collegare Growth `types`/`italianTypes` a profilo/test reale invece di lasciarli vuoti.
