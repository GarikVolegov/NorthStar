# NorthStar Runbook

Procedure operative per incidenti. In caso di dubbio: preserva evidenza, riduci impatto utente, comunica stato, poi correggi.

## Triage Iniziale

1. Identifica ambiente: local, staging, production.
2. Apri Sentry, GitHub Actions e provider deploy (Railway/Vercel).
3. Recupera release attiva, SHA, orario inizio errore e volume utenti coinvolti.
4. Classifica severita':
   - SEV1: login, pagamento, dati utente, API core o DB production non disponibili.
   - SEV2: feature importante degradata con workaround.
   - SEV3: bug limitato, admin-only o cosmetico.
5. Nomina owner incident e canale comunicazione.

## Sentry Alert

1. Apri l'issue Sentry e verifica release, environment, frequenza e primo evento.
2. Confronta con ultimo deploy in `.github/workflows/production.yml` o `staging.yml`.
3. Se l'errore e' legato a una release recente, scegli tra rollback e hotfix.
4. Se contiene PII, non incollare payload in chat o issue pubbliche.
5. Dopo mitigazione, marca l'issue come resolved solo quando health check e metriche sono stabili.

## SLI, SLO e Dashboard

Dashboard minime: Vercel per Web Vitals/build, Sentry per error rate e release regression, Grafana/Prometheus per metriche server e RAG.

- API p95 latency: SLO iniziale `< 2000ms` su finestra 10 minuti.
- API error rate: SLO iniziale `< 5%` su finestra 10 minuti.
- RAG fallback rate: SLO iniziale `< 5%` su finestra 10 minuti.
- RAG empty result rate: SLO iniziale `< 20%` su finestra 10 minuti.
- Health dependency failure: alert immediato se `/api/health` risponde 503.

Widget consigliati:

- `p95 latency`: usa `getStats().p95` o istogrammi HTTP/OpenTelemetry se esportati in Grafana.
- `error rate`: errori 5xx / richieste totali, correlato alla release Sentry.
- `RAG fallback rate`: `rag_fallback_total / rag_retrieve_total`.
- `RAG empty result rate`: `rag_retrieve_total{empty=true} / rag_retrieve_total`.
- `dependency health`: DB, Redis, pgvector, embedder da `/api/health`.

Drill staging mensile:

1. Abilita `OBS_TEST_ERROR_ENABLED=true` solo in staging.
2. Chiama `POST /api/admin/observability/test-error` con utente admin.
3. Verifica evento Sentry, alert operativo e annotazione release entro 60 secondi.
4. Disabilita il flag e registra esito nel postmortem/drill log.

## Rollback Applicativo

Usa `.github/workflows/rollback.yml`.

1. Vai su GitHub Actions -> "Rollback Production" -> "Run workflow".
2. Inserisci SHA target, environment, motivo e `ROLLBACK`.
3. Il workflow esegue `db-safety-check`; non esegue down-migration automatica.
4. Se il check blocca per schema incompatibile, fermati e pianifica una correzione DB manuale.
5. Verifica `/api/health` e Sentry dopo il rollback.

## Incident DB o Migration

1. Non lanciare SQL manuale non revisionato su production.
2. Verifica il piano con `pnpm run db:migrate:dry-run`.
3. `DROP COLUMN`, `DROP TABLE`, `ALTER TYPE`, `DROP TYPE`, `ALTER TABLE ... DROP` e `TRUNCATE` sono DDL ad alto rischio.
4. Se una migration e' gia' applicata, non modificarla: crea una nuova migration forward-fix.
5. Per rollback app con schema nuovo additivo, lascia colonne extra nel DB se compatibili.
6. Per down-migration distruttive, richiedi review esplicita e backup verificato.

## Hotfix Vercel o Railway

1. Crea branch `fix/<incident-name>` dal commit attivo o da `main`.
2. Applica fix minimo, senza refactor fuori incidente.
3. Esegui `pnpm run check` e, se il tempo lo permette, `pnpm run qa`.
4. Apri PR, collega Sentry issue o GitHub Actions failure.
5. Dopo merge, osserva deploy, `/api/health`, Sentry e metriche admin.

Vercel usa `vercel.json` con `lint:ci` + `typecheck` prima del build. Railway production applica migration versionate prima del deploy.

## Redis Down

Redis e' usato per cache e rate limiting.

1. Controlla `REDIS_URL`, provider Redis e log server `[redis]` / `[rate-limit]`.
2. Cache applicativa degrada a miss se Redis non e' disponibile.
3. Rate-limit puo' fallire chiuso dove `requireRateLimitRedis` e' richiesto.
4. Se l'impatto e' login/API core, valuta failover Redis o temporanea riduzione del perimetro protetto, con PR e review.
5. Dopo ripristino, verifica `redis ping`, log di reconnect e tasso 429/5xx.

## RAG o AI Degradato

1. Controlla `/api/admin/wendy-metrics` e la sezione "RAG Core" in admin metriche.
2. Se `fallbackRate > 5%` o `emptyResultRate > 20%`, guarda Sentry e metriche `rag_*`.
3. Se pgvector e' giu', il retriever puo' usare fallback JS o circuit breaker.
4. Se i risultati sono vuoti, verifica ingestion RAG, `rag_sources`, `rag_chunks` e embedding.
5. Non forzare risposte non grounded: Wendy deve dichiarare dati insufficienti.

## Postmortem Breve

Entro 48 ore per SEV1/SEV2:

- timeline;
- impatto utente;
- root cause;
- mitigazione;
- follow-up owner + scadenza;
- test o alert aggiunti per evitare regressione.
