# Vercel Deployment Runbook

NorthStar deploys to Vercel as one full-stack project from the repository root.

## Project Settings

- Root Directory: repository root
- Framework Preset: Vite
- Install Command: `pnpm install --frozen-lockfile`
- Build Command: `pnpm run quality:required && pnpm --filter @northstar/server exec node build.mjs && pnpm --filter @northstar/web run build`
- Output Directory: `apps/web/dist/public`

API traffic is handled by `api/[...path].js`, which loads the bundled Express app generated at `apps/server/api/index.js`.

## Required Environment Variables

Set these in Vercel Project Settings for Production and Preview:

| Variable | Purpose |
|---|---|
| `NODE_ENV` | Set to `production`. |
| `APP_URL` | Production or preview Vercel URL. |
| `ALLOWED_ORIGINS` | Comma-separated allowed browser origins. Include the active Vercel URL. |
| `DATABASE_URL` | Runtime Postgres URL for the application role. |
| `DATABASE_URL_MIGRATOR` | Migrator Postgres URL for schema push. |
| `JWT_SECRET` | 32+ character high-entropy signing secret. |
| `CLERK_SECRET_KEY` | Clerk server secret. |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk browser publishable key. |
| `IP_HASH_SALT` | High-entropy salt for hashed IP audit fields. |

Optional, feature-specific variables:

| Variable | Enables |
|---|---|
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenAI-backed AI, embedding, voice, and vision plugins. |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | OpenAI-compatible base URL. |
| `OPENROUTER_API_KEY` | OpenRouter model routing. |
| `OPENROUTER_BASE_URL` | OpenRouter-compatible base URL. |
| `STRIPE_SECRET_KEY` | Stripe subscription API calls. |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification. |
| `STRIPE_TEAM_PRICE_ID` | Stripe team plan checkout. |
| `RESEND_API_KEY` | Transactional email. |
| `RESEND_FROM_EMAIL` | Transactional email sender. |
| `SENTRY_DSN` | Server Sentry reporting. |
| `VITE_SENTRY_DSN` | Browser Sentry reporting. |
| `SENTRY_AUTH_TOKEN` | Source map upload during build. |
| `SENTRY_ORG` | Source map upload during build. |
| `SENTRY_PROJECT` | Source map upload during build. |
| `VAPID_PUBLIC_KEY` | Web push notifications. |
| `VAPID_PRIVATE_KEY` | Web push notifications. |
| `VITE_VAPID_PUBLIC_KEY` | Browser push subscription. |
| `UPSTASH_REDIS_URL` | Public Redis endpoint for fail-closed rate limiting. |

Do not commit real values. `.env`, `.env.local`, and app-local env files are local only.

## Database Preparation

Use a managed Postgres instance reachable from Vercel. The database must have `pgvector` installed.

Apply schema with the migrator URL configured in the environment:

```bash
pnpm db:push
```

The project currently uses `db:push` as the canonical workflow. Do not use `db:generate` or `db:migrate` for this deploy unless the DB rules are changed.

Before applying schema to a production-like database, confirm the target database name, project, and role. Treat `pnpm db:push` as a remote database mutation.

## Local Preflight

Run these before opening or promoting a Vercel deploy:

```bash
pnpm run deploy:vercel:check
pnpm run typecheck
pnpm --filter @northstar/server exec node build.mjs
pnpm --filter @northstar/web run build
```

If time allows, run focused tests before deploying:

```bash
pnpm --filter @northstar/server run test
pnpm --filter @northstar/web run test
```

## Vercel Preview Verification

After Vercel creates a preview URL, verify health:

```bash
curl https://<preview-domain>/api/health/live
curl https://<preview-domain>/api/health/ready
```

Expected:

- `/api/health/live` returns `{ "status": "alive" }`.
- `/api/health/ready` returns `status: "ok"` or a known acceptable `degraded` state.

Desktop smoke:

```bash
PLAYWRIGHT_SKIP_WEBSERVER=1 BASE_URL=https://<preview-domain> API_URL=https://<preview-domain>/api pnpm exec playwright test e2e/core-smoke.spec.ts --project=chromium --workers=1
```

Mobile smoke:

```bash
PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_RESPONSIVE_PROJECTS=1 BASE_URL=https://<preview-domain> API_URL=https://<preview-domain>/api pnpm exec playwright test e2e/mobile --project=mobile-webkit --workers=1
```

## Production Promotion

Promote only after:

- Vercel build passes.
- Health endpoints pass.
- Desktop smoke passes.
- Mobile smoke passes or any failure is triaged as unrelated.
- No secrets appear in git diff.

## Troubleshooting

If `/api/health/ready` fails:

- Check `DATABASE_URL`, `DATABASE_URL_MIGRATOR`, and database network allowlists.
- Confirm `pgvector` is installed.
- Confirm the `discovery_sources` schema check passes after `pnpm db:push`.
- If Redis is required, set a public Redis URL reachable by Vercel.

If the frontend builds but API calls fail:

- Confirm the root project uses the repository root, not `apps/web`, as Root Directory.
- Confirm the root `vercel.json` rewrite sends `/api/:path*` to `/api/[...path]`.
- Confirm `ALLOWED_ORIGINS` includes the exact Vercel domain.

If the build fails before tests:

- Run `pnpm run deploy:vercel:check`.
- Run `pnpm --filter @northstar/server exec node build.mjs`.
- Run `pnpm --filter @northstar/web run build`.
