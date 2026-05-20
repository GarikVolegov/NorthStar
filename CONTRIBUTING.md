# Contributing to NorthStar

Questa guida e' il percorso breve per arrivare dal clone al primo PR senza contesto extra.

## Prerequisiti

- Node.js `>=20.10 <25` (validato su Node 20 e Node 24).
- pnpm `11.0.9` tramite Corepack o installazione globale.
- Docker e Docker Compose per PostgreSQL, Redis e servizi locali.
- Accesso alle env vars di sviluppo, oppure `.env` derivato da `.env.example`.

## Setup Locale

```bash
pnpm install
cp .env.example .env
pnpm secrets:env
pnpm dev
```

`pnpm dev` avvia Docker, API Express e frontend Vite. Se Docker non e' disponibile, avvia Postgres/Redis manualmente e verifica `DATABASE_URL` e `REDIS_URL` in `.env`.

## Comandi Obbligatori

Prima di aprire un PR:

```bash
pnpm run check
pnpm run qa
```

- `check` e' il preflight rapido: `lint:ci` + typecheck.
- `qa` e' il gate completo locale: `lint:ci`, typecheck, coverage AI/server/web e audit determinismo E2E.
- `lint:ci` e' il lint bloccante usato da CI/Vercel sul perimetro Step 4-6.
- `lint:legacy` resta un debt tracker globale e puo' fallire per debito preesistente.

Per modifiche mirate puoi eseguire anche:

```bash
pnpm --filter @northstar/web run typecheck
pnpm --filter @northstar/server run test:coverage
pnpm --filter @workspace/ai-server run test:coverage
pnpm run audit:e2e-determinism
```

## Branch, Commit e PR

Segui `GIT_RULES.md` per naming e flusso completo.

- Branch: `feat/<nome>`, `fix/<nome>`, `docs/<nome>`, `chore/<nome>`.
- Commit: Conventional Commits, per esempio `feat(rag): add observable fallback metrics`.
- Non committare `.env`, dump DB, coverage, build output, token, password o chiavi API.
- `pnpm-lock.yaml` va committato quando cambia.
- Le migration Drizzle generate vanno committate; non modificare migration gia' applicate.

## Checklist PR

- [ ] Ho letto il RULES file dell'area modificata (`API_RULES.md`, `DB_RULES.md`, `FRONTEND_RULES.md`, `AI_RULES.md`, `GIT_RULES.md`).
- [ ] `pnpm run check` passa.
- [ ] `pnpm run qa` passa, oppure nel PR e' spiegato quale parte non e' eseguibile localmente.
- [ ] Nessun secret o dato reale nel diff.
- [ ] Le route protette usano `requireAuth`/`requireAdmin` e non fidano `userId` dal client.
- [ ] Le chiamate frontend usano `apiFetch` e costanti API quando applicabile.
- [ ] Le modifiche DB usano migration versionate e sono state provate con `pnpm db:migrate`.
- [ ] La documentazione e' aggiornata se cambiano setup, architettura, deploy o runbook.

## Dove Guardare

- Setup e mappa generale: `README.md`.
- Architettura e flussi: `ARCHITECTURE.md`.
- Incident e rollback: `RUNBOOK.md`.
- Security disclosure pubblica: `SECURITY.md`.
- Regole interne security: `SECURITY_RULES.md`.
