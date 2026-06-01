# REVIEW — `apps/server` (2026-05-28)

Scope: 91 file in `routes/` + 20 in `routes/admin/`, middleware, jobs, cron, registries.

## Sintesi rapida

Architettura **eccezionalmente pulita** per la dimensione:
- Route-config centralizzato (`apps/server/src/route-config.ts`, 71 route mappate con `path + router + auth + rateLimit`).
- 3 registry layer (`route-registry-{public,authenticated,admin}.ts`) che si selezionano dal route-config.
- `routes/admin.ts` è un sub-mounter che applica `requireAdminAccess` a 16 sub-router admin.
- Solo **2 route file orfani** su 91 (`wiki-telemetry`, `xp-constants`). Tasso di copertura: 97.8%.
- Zero uso di `SUPABASE_SERVICE_ROLE` nel codice applicativo → segnale che eventuali bypass RLS sono assenti (verificare).

I findings reali sono pochi e specifici.

## Findings classificati

### F-SV-1 · 2 route file mai registrati
- Severità: **HIGH** · Azione: **REMOVE** o **RECONNECT**
- File:
  - `apps/server/src/routes/wiki-telemetry.ts`
  - `apps/server/src/routes/xp-constants.ts`
- Evidenza: nessun `import.*routes/wiki-telemetry` o `routes/xp-constants` in `route-config.ts`, `app.ts`, `index.ts`, nei 3 `route-registry-*.ts`.
- Proposta: aprire i due file, decidere se la feature è ancora viva (in tal caso registrare in route-config) o defunta (REMOVE). Non lasciarli "in panchina".
- Costo: 15 min ciascuno.

### F-SV-2 · Naming confusion: `agent.ts` vs `agents.ts`
- Severità: **MEDIUM** · Azione: **REFACTOR** (rinominare)
- File: `apps/server/src/routes/agent.ts` (plan-gated feature) vs `apps/server/src/routes/agents.ts` (sistema agenti AI dipendenti, CRUD task).
- Evidenza: visivamente quasi indistinguibili nel route-config; un nuovo dev rischia di toccare quello sbagliato.
- Proposta: rinominare `agent.ts` → `agent-runner.ts` o `agent-feature.ts`. Aggiornare l'unico importer in route-config.
- Costo: 10 min.

### F-SV-3 · `routes/admin/agents.ts` (685) e `routes/ai-wendy.ts` (696) — file giganti
- Severità: **MEDIUM** · Azione: **REFACTOR**
- Evidenza: [baseline/file-size.txt](baseline/file-size.txt) — soglia 600 righe per apps superata.
- Proposta:
  - `ai-wendy.ts`: probabilmente l'handler chat principale; estrarre logica di tool execution / streaming SSE in `lib/ai-wendy-*.ts`.
  - `admin/agents.ts`: estrarre handler CRUD (list/get/update/delete) in submodules per tipo di entità.
- Costo: 4-6 ore ciascuno.

### F-SV-4 · `lib/routine-schedule.ts` orfano
- Severità: **MEDIUM** · Azione: **REMOVE**
- Evidenza: knip lo segnala unused.
- Proposta: verificare con `git log` se è il residuo di una feature cron che ora vive in `jobs/cron.ts`. Se confermato, REMOVE.
- Costo: 5 min.

### F-SV-5 · Sicurezza — esplicitare la mappa rate limiting per route
- Severità: **LOW** · Azione: **DOCUMENT**
- Evidenza: il campo `rateLimit` esiste in `RouteConfig` ma solo `/api/health` lo dichiara esplicitamente ("none"). Tutte le altre 70 route ereditano il `globalLimiter` di `app.ts` senza distinguere "strict" (es. auth/login, contact, ai-wendy che è expensive) da "global".
- Proposta: marcare esplicitamente `rateLimit: "strict"` su:
  - `auth` (brute-force login)
  - `contact` (spam)
  - `ai-wendy`, `voice`, `interview` (LLM cost guard)
  - eventuali endpoint pubblici scrittura.
- Costo: 30 minuti di review + edit.

### F-SV-6 · Sicurezza — verificare cookie/CSRF su route pubbliche di scrittura
- Severità: **MEDIUM** · Azione: **DOCUMENT / VERIFY**
- Evidenza: `/api/contact` è `auth: "public"` e accetta POST (review necessaria). Lo stesso vale per `/api/auth` (login/register).
- Proposta: confermare che CSRF non sia un vettore (header `Authorization` + CORS ristretto) e documentarlo in `.brain/30_Process/SECURITY.md`. Non un fix di codice, una validazione.
- Costo: 30 min review.

### F-SV-7 · Sicurezza — `requireAdminAccess` vs `requireAdmin` due nomi per la stessa cosa?
- Severità: **LOW** · Azione: **CONSOLIDATE**
- Evidenza: `route-registry-admin.ts` usa `requireAdmin` (da `middleware/require-admin.ts`); `routes/admin.ts` usa `requireAdminAccess` (importato da `middleware/auth.ts`). Due nomi diversi sullo stesso strato. Doppia rete di sicurezza ridondante o due check differenti?
- Proposta: leggere entrambe le implementazioni; se sono equivalenti, eliminare il duplicato e standardizzare su `requireAdmin`. Se sono diverse, documentare in `AGENTS.md` o nella Brain il perche'.
- Costo: 20 min.

## Cosa NON è un problema

- 4 route "search" (`search`, `search-route`, `search-hybrid`, `search-track`) → ruoli distinti verificati (semantic, query routing, multi-entity, analytics).
- 5 route "profile-*" tutte montate su `/api/profile` → frammentazione intenzionale per feature (background, logo, navigation, vision). OK.
- Centralizzazione route-config + 3 registry → pattern eccellente, mantenere.

## Riepilogo conteggio

| Severità | Conta |
|---|---|
| CRITICAL | 0 |
| HIGH | 1 (F-SV-1) |
| MEDIUM | 4 |
| LOW | 2 |
