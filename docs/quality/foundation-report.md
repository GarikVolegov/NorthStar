# NorthStar Foundation Report

Updated: 2026-05-25

## Gate Model

NorthStar uses two quality levels:

- `pnpm run quality:required`: fast daily gate for lint, typecheck, coverage and static audits.
- `pnpm run quality:full`: release/runtime gate that runs `quality:required`, build, smoke core and browser/API E2E.

This keeps local development practical while preserving a single command for release confidence.

## Current Foundation Status

- Global lint is the blocking lint gate.
- Tech-debt tracked categories are at zero: direct API fetch, namespace pollution, hot console paths, admin hardcoded colors and production DB `as any`.
- Dead-code audit is active through Knip.
- File-size debt is under ratchet: no offender can grow and no new offender can appear.
- Package file-size offenders are at zero.
- App file-size offenders remaining: 2.
- Feature Protocol is active as a ratchet through `audit:feature-protocol`.
- Wendy Tool Protocol is active as a ratchet through `audit:wendy-tools`.
- Calendar, objectives, sectors and profile are protocol-complete feature manifests.

## Runtime Smoke Coverage

The full gate must prove the user-facing runtime does not regress on:

- public content fetches such as `/api/news`;
- account synchronization through `/api/auth/clerk-sync`;
- `/api/health/ready`;
- Wendy base flow;
- dashboard and admin metrics access.

The last observed runtime regressions were `500` responses from `/api/news` and `/api/auth/clerk-sync`; these are now explicit smoke targets.

## File-Size Burn-Down Order

The remaining app offenders are split in this order:

1. `grafo-conoscenza.tsx`
2. `validatore-idea.tsx`

Each split must leave the original file under 600 lines, avoid new offenders, and update `file-size-baseline.json` only after a real decrease.

## Feature Protocol Coverage

Current protocol manifests:

- `calendar`: protocol-complete pilot with web route, API route contracts, smoke ids, telemetry and Wendy tools.
- `objectives`: protocol-complete pilot with dashboard/API contracts and Wendy read/confirmed-write tools.
- `sectors`: protocol-complete pilot with list/detail API contracts and Wendy read/navigate tools.
- `profile`: protocol-complete pilot with profile/background API contracts and Wendy read/navigate/confirmed-write tools.

Wendy capabilities now have a formal contract:

- `read` and `navigate` tools can be low-risk and auto-executed.
- `write`, `delete` and `high` risk tools require confirmation.
- Every feature tool must declare input schema, output schema and telemetry.

Admin visibility:

- `GET /api/admin/wendy-capabilities` returns registered feature manifests, protocol coverage and Wendy tool contracts.

Next modules to migrate:

1. `test-results`
2. `applications`
3. `roadmap`
4. `workspace`
5. `calendar` service/repository split
