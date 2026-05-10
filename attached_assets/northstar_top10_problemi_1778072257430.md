# NorthStar — 10 problemi ad alto impatto da affrontare

Questo documento è pensato come istruzione per Replit AI e per collaboratori, per concentrarsi sulle 10 aree a più alto impatto nel breve-medio termine.

## Panoramica sintetica

| ID | Problema | Tipo | Impatto atteso |
|----|----------|------|----------------|
| P1 | Mancanza di tooling locale (pnpm) nel contesto Replit / Dev | Tecnico | Alta |
| P2 | AI microservice Python limitato a 4 task specifici e non allineato al sistema multi‑agente TS | Tecnico | Alta |
| P3 | Cataloghi DB (settori, professioni, percorsi formativi, articoli crescita) critici ma senza strumenti di seed/admin robusti | Tecnico | Alta |
| P4 | Assenza di monitoraggio automatico degli errori degli agenti e delle validazioni nel flusso produttivo | Tecnico | Alta |
| P5 | Integrazioni opzionali (Stripe, GNews, Tavily, Resend, Push, Google OAuth, OpenAI) non guidate da wizard di setup | Tecnico | Media |
| P6 | Esperienza utente per chi ha già una carriera non ancora pienamente distinta nel prodotto | Prodotto/UX | Alta |
| P7 | Mancanza di un flusso di onboarding completamento profilo + obiettivi strettamente collegato al Calendario Agent | Prodotto/UX | Alta |
| P8 | Assenza di test end‑to‑end (E2E) per i flussi critici multi‑servizio | Tecnico | Alta |
| P9 | AI personal growth content basato solo su articoli statici, non ancora su ricerca dinamica | Tecnico | Alta |
| P10 | Limitata visibilità e controllo sulla separazione Discovery vs Execution nel pannello admin | Prodotto/UX | Alta |

## P1 — Mancanza di tooling locale (pnpm) nel contesto Replit / Dev

**Impatto:** Non si possono eseguire typecheck, build e script pnpm dal contesto attuale; per uno sviluppatore Replit questo va risolto con Nix e documentazione chiara.

**Dettagli attuali:**

Nel sandbox corrente pnpm non è disponibile, quindi gli script definiti in package.json non sono eseguibili. Su Replit questo tipicamente si risolve con una configurazione Nix che installa pnpm globalmente, oppure usando il template Replit che lo fornisce. Il replit.md non descrive ancora la configurazione Nix / steps di setup locale.

**Obiettivo per Replit:**

- Configurare un ambiente Nix Replit che installa pnpm (e Node 20+) come tools globali.
- Aggiornare `replit.md` con una sezione `Setup locale` che spiega come eseguire `pnpm install`, `pnpm run typecheck`, `pnpm --filter ... dev` e avviare il microservizio Python.
- Verificare che tutti i comandi in tabella `Run & Operate` funzionino su Replit con un click.

## P2 — AI microservice Python limitato a 4 task specifici e non allineato al sistema multi‑agente TS

**Impatto:** Il microservizio FastAPI espone solo personality_insight, sector_motivation, work_mode_advice, affiliation_materials, mentre l'Orchestrator TS lavora su full_profile, education_path, growth_suggestions, calendar_events ecc.; questo riduce il potenziale AI di NorthStar e crea confusione fra agenti duplicati.

**Dettagli attuali:**

Gli agenti principali (SectorAgent, ProfessionAgent, EducationAgent, GrowthAgent, CalendarAgent) sono implementati in TypeScript e lavorano su DB e logica deterministica. Il microservizio Python invece offre solo task di copy/insight, non integrato con questi agenti. Manca una roadmap chiara per quali task devono vivere in Python (LLM-heavy) e quali in TS (deterministici), e non esiste ancora un task orchestrator AI che componga i risultati.

**Obiettivo per Replit:**

- Disegnare una mappa chiara di quali task AI devono vivere nel microservizio Python e quali restare negli agenti TS.
- Estendere `SUPPORTED_TASKS` in `artifacts/ai-agents/main.py` e `TASK_HANDLERS` in `agents/orchestrator.py` per coprire almeno un flusso completo di career coaching basato su LLM.
- Documentare in `replit.md` come aggiungere un nuovo task AI end‑to‑end (FastAPI → Express route → frontend).

## P3 — Cataloghi DB (settori, professioni, percorsi formativi, articoli crescita) critici ma senza strumenti di seed/admin robusti

**Impatto:** L'esperienza utente e la qualità delle raccomandazioni dipendono da dati di catalogo ricchi. Attualmente esistono seed-crescita e script di migrazione in lib/db, ma non c'è un flusso chiaro su Replit per popolare, aggiornare e validare questi cataloghi da pannello admin.

**Dettagli attuali:**

La tabella education_paths, professions, sectors, growth_articles è definita ed usata dagli agenti, ma il popolamento sembra affidato a script manuali (seed-crescita.mjs/ts). Manca un'interfaccia admin nel frontend per creare/aggiornare questi record, con validazione e versioning, e manca documentazione passo-passo per lanciare i seed in ambiente Replit/Postgres.

**Obiettivo per Replit:**

- Aggiungere nel frontend una sezione Admin → Cataloghi (Settori, Professioni, Percorsi, Articoli Crescita).
- Implementare CRUD protetto con `ADMIN_KEY` che usa le tabelle `sectors`, `professions`, `education_paths`, `growth_articles`.
- Scrivere in `replit.md` i comandi per eseguire i seed iniziali e come evitare di sovrascrivere dati in produzione.

## P4 — Assenza di monitoraggio automatico degli errori degli agenti e delle validazioni nel flusso produttivo

**Impatto:** L'Orchestrator TS e i singoli agenti fanno logging e validazione, ma non c'è ancora un dashboard o un sistema di alert che renda visibili fallimenti sistematici (es. EducationAgent senza percorsi, GrowthAgent senza articoli) all'owner del prodotto.

**Dettagli attuali:**

Esiste agentLogsTable e agentReview, con logAgentCall e validatorAgent, ma nel frontend non c'è ancora un pannello admin che mostri trend di errori/warning per agenti, né avvisi quando la qualità delle raccomandazioni degrada (per mancanza dati o errori LLM). Questo è un problema ad alto impatto perché si rischia di servire risultati vuoti o parziali senza accorgersene.

**Obiettivo per Replit:**

- Costruire una dashboard Admin → Agent Health che legge da `agentLogsTable` e dai log del ValidatorAgent.
- Visualizzare per ciascun agente: success rate 7/30 giorni, ultimi errori, warning di validazione, tempo medio di risposta.
- Aggiungere notifiche (email o in‑app) quando un agente scende sotto una soglia di successo configurabile.

## P5 — Integrazioni opzionali (Stripe, GNews, Tavily, Resend, Push, Google OAuth, OpenAI) non guidate da wizard di setup

**Impatto:** startup-check.ts e /api/health espongono lo stato delle env vars, ma un nuovo deploy su Replit non offre un'esperienza guidata per completare le integrazioni. Questo rallenta l'onboarding e rende fragile il go-live.

**Dettagli attuali:**

Le env opzionali vengono solo loggate a console; manca una pagina 'System Status / Setup Wizard' nel frontend admin che legge /api/health, mostra quali integrazioni mancano e offre link/guide per completarle (es. collegare Stripe, configurare GNews/Tavily, ecc.).

**Obiettivo per Replit:**

- Creare una pagina Admin → Setup Wizard che chiama `/api/health` e mostra lo stato di tutte le integrazioni.
- Per ogni integrazione mancante, spiegare in italiano: a cosa serve, come ottenere la chiave, dove incollarla su Replit.
- Aggiungere link diretti a documentazione Stripe, GNews, Tavily, Resend, Push, Google OAuth, Replit OpenAI.

## P6 — Esperienza utente per chi ha già una carriera non ancora pienamente distinta nel prodotto

**Impatto:** Dal punto di vista business, NorthStar deve servire sia chi deve scegliere la strada sia chi vuole ottimizzare/accelerare una carriera già avviata. L'attuale UX è centrata soprattutto sul primo caso.

**Dettagli attuali:**

Il test RIASEC + Cinque Spiriti, la pagina risultati e gli strumenti orientamento sono pensati per discovery iniziale. Manca una modalità 'Career Climber' con dashboard, obiettivi avanzati, skill gap mirato e percorsi di upskilling/reskilling per utenti con esperienza, nonostante nel codice esistano già moduli come skills-gap, coach, calendar e growth che possono essere ri-orchestrati per questo segmento.

**Obiettivo per Replit:**

- Introdurre un campo `userMode` (es. `explorer` vs `climber`) in profilo/DB e gestirlo nell'onboarding.
- Creare una variante di dashboard per `climber` focalizzata su: avanzamento carriera, upskilling, skill‑gap, coaching.
- Aggiornare i prompt AI (Wiki, Roadmap, Coach) per adattare tono e suggerimenti in base a `userMode`.

## P7 — Mancanza di un flusso di onboarding completamento profilo + obiettivi strettamente collegato al Calendario Agent

**Impatto:** Esistono ProfileCompletionCard, ObjectivesKanban, calendarEventsTable e CalendarAgent, ma non c'è ancora un flusso unico che, finito il test, porta l'utente a definire 3 obiettivi e li sincronizza automaticamente nel calendario.

**Dettagli attuali:**

Gli T00x nel replit.md parlano di Test History, Profile Completion, Objectives↔calendar, ma il flusso UX potrebbe non essere ancora rifinito: dopo i risultati, l'utente dovrebbe essere guidato a scegliere modalità di lavoro, 2-3 obiettivi chiave e un piano automatico sul calendario (northstar-agent). L'attuale implementazione degli agenti lo rende possibile ma non è esplicitamente orchestrata come funnel.

**Obiettivo per Replit:**

- Progettare un funnel post‑test: Risultati → Scelta work‑mode → Definizione di 3 obiettivi → Generazione automatica di eventi calendario.
- Collegare esplicitamente `ObjectivesKanban`, `ProfileCompletionCard` e `CalendarAgent` con un unico flusso guidato.
- Aggiungere tracking (agentLogs, eventi analytics) per misurare quanti utenti completano il funnel.

## P8 — Assenza di test end‑to‑end (E2E) per i flussi critici multi‑servizio

**Impatto:** Esistono test unitari/frontend (Vitest) ma non sono visibili test E2E che verifichino end‑to‑end: registrazione → test → risultati → obiettivi → calendario → AI tools → Stripe upgrade. Senza questi, cambi futuri rischiano di rompere il funnel principale.

**Dettagli attuali:**

Il monorepo contiene test unitari React (motion, seo, work-mode-utils) ma non file di test Playwright/Cypress o simili. Per un SaaS che integra frontend, API Express, AI FastAPI e Stripe, test E2E automatizzati su Replit (o GitHub Actions) sarebbero un investimento ad altissimo impatto.

**Obiettivo per Replit:**

- Introdurre test E2E (es. Playwright) nel monorepo, con uno script `pnpm test:e2e` eseguibile da Replit.
- Coprire almeno il percorso: registrazione → test → risultati → obiettivi → calendario → attivazione premium (Stripe).
- Integrare i test E2E in una pipeline CI (GitHub Actions o Replit Deploy) per evitare regressioni.

## P9 — AI personal growth content basato solo su articoli statici, non ancora su ricerca dinamica

**Impatto:** Il GrowthAgent usa growth_articles dal DB e seleziona per RIASEC, ma manca ancora l'uso massivo del Growth Research Scheduler con Tavily/OpenAI per alimentare continuamente nuovi contenuti di crescita personale di alta qualità.

**Dettagli attuali:**

Nel codice esistono research/growth-research.ts e lib/research-scheduler.ts oltre a integrazioni Tavily, ma il flusso completo di 'scansione, proposta, validazione, pubblicazione' di nuovi articoli di crescita personale non sembra ancora industrializzato. Questo limita la freschezza e profondità del modulo Crescita.

**Obiettivo per Replit:**

- Stabilire il flusso automatico di Growth Research: Tavily/OpenAI → proposte articoli → review admin → pubblicazione in `growth_articles`.
- Creare un'interfaccia Admin che mostra le proposte in coda, con pulsanti Approva/Modifica/Scarta.
- Programmare un job periodico (cron/scheduler) che lancia la ricerca e notifica l'admin quando ci sono nuovi contenuti candidati.

## P10 — Limitata visibilità e controllo sulla separazione Discovery vs Execution nel pannello admin

**Impatto:** A livello architetturale NorthStar separa Discovery (settori, ruoli, percorsi) da Execution (calendario, obiettivi, crescita), ma il pannello admin non rende ancora chiara questa distinzione né permette di controllare pesi, regole e versioni dei moduli.

**Dettagli attuali:**

Gli agenti Sector, Profession, Education, Growth, Calendar, Coach, Skills-Gap esistono e sono cablati, ma manca un'unica Admin Console in cui l'owner può: regolare parametri (es. limiti premium/free, filtri automazione rischio, scoring growth), abilitare/ disabilitare feature, e vedere come Discovery alimenta Execution. Questo rende difficile sperimentare su pricing, segmentazione e retention.

**Obiettivo per Replit:**

- Disegnare una mappa visiva nel pannello admin che separa nettamente Discovery (test, settori, ruoli, percorsi) da Execution (obiettivi, calendario, crescita, coach).
- Esporre per ogni modulo i parametri chiave configurabili (limiti free/premium, pesi, feature‑flags).
- Documentare in `replit.md` come modificare questi parametri senza rompere la compatibilità con i dati esistenti.