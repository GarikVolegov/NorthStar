# Vercel Full-Stack Deploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare NorthStar for a single full-stack Vercel deployment with static Vite frontend, Express API under `/api/*`, external Postgres, documented env setup, and desktop/mobile verification.

**Architecture:** Keep the existing root Vercel shape: `vercel.json` builds the server bundle and web app, `api/[...path].js` forwards requests to the bundled Express app, and Vite assets are served from `apps/web/dist/public`. Add a deploy sanity script and runbook so the deploy can be checked locally and repeated on Vercel without committing secrets.

**Tech Stack:** Vercel, Vercel Functions, Express, React/Vite, pnpm workspaces, Drizzle/Postgres, Playwright, TypeScript.

---

## File Structure

- Create `scripts/check-vercel-deploy.mjs`: static sanity check for root `vercel.json`, function wrapper, server build script, web output directory, ignored generated bundle, and critical env names.
- Modify `package.json`: add `deploy:vercel:check` script.
- Create `docs/deployment/vercel.md`: operational deployment runbook with env checklist, DB workflow, Vercel project settings, deployment steps, and verification commands.
- Inspect `vercel.json`, `api/[...path].js`, `apps/server/build.mjs`, and `apps/server/api/index.ts`; modify only if the check proves they are inconsistent.

---

### Task 1: Add Vercel Deploy Sanity Check

**Files:**
- Create: `scripts/check-vercel-deploy.mjs`
- Modify: `package.json`

- [ ] **Step 1: Create the failing deploy check script**

Create `scripts/check-vercel-deploy.mjs` with this content:

```js
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];

function readJson(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch (error) {
    failures.push(`${relativePath}: cannot read JSON (${error.message})`);
    return null;
  }
}

function readText(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  try {
    return fs.readFileSync(absolutePath, "utf8");
  } catch (error) {
    failures.push(`${relativePath}: cannot read file (${error.message})`);
    return "";
  }
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

const vercel = readJson("vercel.json");
const packageJson = readJson("package.json");
const wrapper = readText("api/[...path].js");
const buildScript = readText("apps/server/build.mjs");
const serverlessEntry = readText("apps/server/api/index.ts");
const gitignore = readText(".gitignore");
const vercelignore = readText(".vercelignore");

assert(vercel?.framework === "vite", "vercel.json must use framework \"vite\"");
assert(vercel?.outputDirectory === "apps/web/dist/public", "vercel.json outputDirectory must be apps/web/dist/public");
assert(vercel?.installCommand === "pnpm install --frozen-lockfile", "vercel.json installCommand must use frozen pnpm install");
assert(
  typeof vercel?.buildCommand === "string" &&
    vercel.buildCommand.includes("pnpm --filter @northstar/server exec node build.mjs") &&
    vercel.buildCommand.includes("pnpm --filter @northstar/web run build"),
  "vercel.json buildCommand must build server bundle and web app",
);
assert(
  Array.isArray(vercel?.rewrites) &&
    vercel.rewrites.some((rewrite) => rewrite.source === "/api/:path*" && rewrite.destination === "/api/[...path]"),
  "vercel.json must rewrite /api/:path* to /api/[...path]",
);

assert(wrapper.includes("../apps/server/api/index.js"), "api/[...path].js must load apps/server/api/index.js");
assert(wrapper.includes("maxDuration: 60"), "api/[...path].js must set maxDuration to 60 seconds");

assert(buildScript.includes("./api/index.ts"), "apps/server/build.mjs must use apps/server/api/index.ts as entrypoint");
assert(buildScript.includes('outfile: "api/index.js"'), "apps/server/build.mjs must output api/index.js");
assert(buildScript.includes('platform: "node"'), "apps/server/build.mjs must target node platform");
assert(buildScript.includes('target: "node20"'), "apps/server/build.mjs must target node20");

assert(serverlessEntry.includes('import app from "../src/app"'), "apps/server/api/index.ts must import Express app from src/app");
assert(serverlessEntry.includes("export default app"), "apps/server/api/index.ts must default-export Express app");
assert(!serverlessEntry.includes(".listen("), "apps/server/api/index.ts must not start a listener");

assert(gitignore.includes("apps/server/api/index.js"), ".gitignore must ignore generated serverless bundle");
assert(vercelignore.includes(".env"), ".vercelignore must exclude local env files");
assert(packageJson?.packageManager?.startsWith("pnpm@"), "package.json must pin pnpm packageManager");

if (failures.length > 0) {
  console.error("[vercel-check] failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("[vercel-check] ok");
```

- [ ] **Step 2: Run the script before adding the package command**

Run:

```bash
node scripts/check-vercel-deploy.mjs
```

Expected: PASS if the current Vercel wiring is consistent, or FAIL with specific messages to fix in Task 2.

- [ ] **Step 3: Add the package script**

In root `package.json`, add this script near the QA or audit scripts:

```json
"deploy:vercel:check": "node scripts/check-vercel-deploy.mjs"
```

- [ ] **Step 4: Run the package script**

Run:

```bash
pnpm run deploy:vercel:check
```

Expected: `[vercel-check] ok`.

- [ ] **Step 5: Commit**

```bash
git add package.json scripts/check-vercel-deploy.mjs
git commit -m "chore(infra): add vercel deploy check"
```

---

### Task 2: Fix Any Vercel Wiring Drift

**Files:**
- Modify only if needed: `vercel.json`
- Modify only if needed: `api/[...path].js`
- Modify only if needed: `apps/server/build.mjs`
- Modify only if needed: `apps/server/api/index.ts`

- [ ] **Step 1: Run the deploy check**

Run:

```bash
pnpm run deploy:vercel:check
```

Expected: PASS. If it fails, use the exact failure messages to limit edits.

- [ ] **Step 2: Apply minimal fixes only if the check failed**

Expected valid shapes:

`vercel.json` must keep:

```json
{
  "installCommand": "pnpm install --frozen-lockfile",
  "buildCommand": "pnpm run typecheck && pnpm --filter @northstar/server exec node build.mjs && pnpm --filter @northstar/web run build",
  "outputDirectory": "apps/web/dist/public",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/:path*",
      "destination": "/api/[...path]"
    }
  ]
}
```

`api/[...path].js` must keep:

```js
let appPromise;

function loadApp() {
  appPromise ??= import("../apps/server/api/index.js").then(
    (module) => module.default ?? module,
  );
  return appPromise;
}

async function handler(req, res) {
  const app = await loadApp();
  return app(req, res);
}

handler.config = {
  maxDuration: 60,
};

module.exports = handler;
```

- [ ] **Step 3: Re-run the deploy check**

Run:

```bash
pnpm run deploy:vercel:check
```

Expected: `[vercel-check] ok`.

- [ ] **Step 4: Commit only if files changed**

```bash
git add vercel.json "api/[...path].js" apps/server/build.mjs apps/server/api/index.ts
git commit -m "fix(infra): align vercel serverless wiring"
```

If no files changed, do not create an empty commit.

---

### Task 3: Add Vercel Deployment Runbook

**Files:**
- Create: `docs/deployment/vercel.md`

- [ ] **Step 1: Create the runbook**

Create `docs/deployment/vercel.md` with:

```md
# Vercel Deployment Runbook

NorthStar deploys to Vercel as one full-stack project from the repository root.

## Project Settings

- Root Directory: repository root
- Framework Preset: Vite
- Install Command: `pnpm install --frozen-lockfile`
- Build Command: `pnpm run typecheck && pnpm --filter @northstar/server exec node build.mjs && pnpm --filter @northstar/web run build`
- Output Directory: `apps/web/dist/public`

API traffic is handled by `api/[...path].js`, which loads the bundled Express app generated at `apps/server/api/index.js`.

## Required Environment Variables

Set these in Vercel Project Settings for Production and Preview:

- `NODE_ENV`: set to `production`
- `APP_URL`: production or preview Vercel URL
- `ALLOWED_ORIGINS`: production or preview Vercel URL
- `DATABASE_URL`: runtime Postgres URL
- `DATABASE_URL_MIGRATOR`: migrator Postgres URL
- `JWT_SECRET`: 32+ character high-entropy value
- `CLERK_SECRET_KEY`: Clerk server secret
- `VITE_CLERK_PUBLISHABLE_KEY`: Clerk browser key
- `IP_HASH_SALT`: high-entropy salt

Optional, feature-specific variables:

- `AI_INTEGRATIONS_OPENAI_API_KEY`
- `AI_INTEGRATIONS_OPENAI_BASE_URL`
- `OPENROUTER_API_KEY`
- `OPENROUTER_BASE_URL`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_TEAM_PRICE_ID`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `SENTRY_DSN`
- `VITE_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VITE_VAPID_PUBLIC_KEY`
- `UPSTASH_REDIS_URL`

Do not commit real values. `.env`, `.env.local`, and app-local env files are local only.

## Database Preparation

Use a managed Postgres reachable from Vercel. The database must have `pgvector` installed.

Apply schema with the migrator URL:

```bash
pnpm db:push
```

The project currently uses `db:push` as the canonical workflow. Do not use `db:generate` or `db:migrate` for this deploy unless the DB rules are changed.

## Local Preflight

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

After Vercel creates a preview URL:

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
```

- [ ] **Step 2: Check for placeholders and secret-looking values**

Run the repository secret diff check from `.brain/40_Agent_Context/rules/GIT_RULES.md` against staged changes.

Expected: no output from the secret diff check and no placeholder markers in `docs/deployment/vercel.md`.

- [ ] **Step 3: Commit**

```bash
git add docs/deployment/vercel.md
git commit -m "docs(infra): add vercel deployment runbook"
```

---

### Task 4: Run Local Build Preflight

**Files:**
- Modify only if needed: files reported by failing commands.

- [ ] **Step 1: Run deploy sanity check**

Run:

```bash
pnpm run deploy:vercel:check
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm run typecheck
```

Expected: PASS. If it fails, fix only errors related to deployment or current build compatibility; do not refactor unrelated dirty files.

- [ ] **Step 3: Build the Vercel server bundle**

Run:

```bash
pnpm --filter @northstar/server exec node build.mjs
```

Expected: generates ignored `apps/server/api/index.js` successfully.

- [ ] **Step 4: Build the web app**

Run:

```bash
pnpm --filter @northstar/web run build
```

Expected: generates ignored `apps/web/dist/public` successfully.

- [ ] **Step 5: Commit fixes only if needed**

If build-related fixes were required:

```bash
git add <exact-files-fixed>
git commit -m "fix(infra): resolve vercel build preflight"
```

If no fixes were needed, do not create an empty commit.

---

### Task 5: Validate Database Readiness

**Files:**
- No code edits expected.

- [ ] **Step 1: Confirm target before mutating any remote database**

Do not run `pnpm db:push` against a production-like database until the target `DATABASE_URL_MIGRATOR` is confirmed. If using a disposable preview/staging database, proceed.

- [ ] **Step 2: Apply schema to the confirmed target**

Run:

```bash
pnpm db:push
```

Expected: Drizzle push completes without destructive prompts or errors.

- [ ] **Step 3: Check local or deployed readiness**

For local API:

```bash
curl http://localhost:3001/api/health/ready
```

For Vercel preview:

```bash
curl https://<preview-domain>/api/health/ready
```

Expected: DB, pgvector, and discovery schema checks are `ok`.

---

### Task 6: Desktop And Mobile Smoke Verification

**Files:**
- Modify only if needed: files reported by failing smoke tests.

- [ ] **Step 1: Run desktop smoke on local or preview URL**

For local stack:

```bash
pnpm run test:smoke:core
```

For Vercel preview:

```bash
PLAYWRIGHT_SKIP_WEBSERVER=1 BASE_URL=https://<preview-domain> API_URL=https://<preview-domain>/api pnpm exec playwright test e2e/core-smoke.spec.ts --project=chromium --workers=1
```

Expected: PASS.

- [ ] **Step 2: Run mobile smoke on local or preview URL**

For Vercel preview:

```bash
PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_RESPONSIVE_PROJECTS=1 BASE_URL=https://<preview-domain> API_URL=https://<preview-domain>/api pnpm exec playwright test e2e/mobile --project=mobile-webkit --workers=1
```

Expected: PASS, or failures documented as unrelated to deploy readiness.

- [ ] **Step 3: Commit smoke fixes only if needed**

```bash
git add <exact-files-fixed>
git commit -m "fix(web): resolve vercel smoke issues"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review

- Spec coverage: plan covers Vercel wiring, env contract, DB push workflow, local build preflight, and desktop/mobile smoke verification.
- Placeholder scan: angle-bracket placeholders appear only where operators must insert their real Vercel domain; no implementation step is deferred.
- Type consistency: script paths match the current repo: `vercel.json`, `api/[...path].js`, `apps/server/build.mjs`, `apps/server/api/index.ts`, and `apps/web/dist/public`.
- Scope check: background jobs and WebSocket production hosting are intentionally out of scope for the Vercel request/response deploy.
