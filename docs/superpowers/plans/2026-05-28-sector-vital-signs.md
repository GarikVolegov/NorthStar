# Sector Vital Signs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full Sector Vital Signs feature with backend aggregation, API routes, frontend dashboard UI, sector pin comparison, and market-report routine integration.

**Architecture:** A typed `computeVitalSigns` service in `@workspace/ai-server` computes cached five-sign snapshots from existing DB tables. Express routes expose vitals, pins, and routines through the existing route config. React hooks and feature components render a compact medical-monitor style dashboard on the sector page.

**Tech Stack:** TypeScript, Drizzle ORM, Express, Vitest, React, TanStack Query, Recharts, shadcn UI primitives, Lucide icons.

---

### Task 1: Vitals Types And Service

**Files:**
- Create: `packages/ai-server/src/services/sector-vitals/types.ts`
- Create: `packages/ai-server/src/services/sector-vitals/thresholds.ts`
- Create: `packages/ai-server/src/services/sector-vitals/sector-vitals.service.ts`
- Create: `packages/ai-server/src/services/sector-vitals/sector-vitals.service.test.ts`
- Modify: `packages/ai-server/src/index.ts`

- [ ] Write a failing Vitest test that calls `computeVitalSigns(7, "IT", { db: fakeDb, now })` and expects five signs, each with 12 sparkline values.
- [ ] Run `pnpm --filter @workspace/ai-server exec vitest run src/services/sector-vitals/sector-vitals.service.test.ts --configLoader runner` and verify failure due missing module.
- [ ] Implement the service with dependency injection for tests, one-hour in-memory cache, month helpers, threshold helpers, and documented pressure fallback.
- [ ] Export the service and types from `packages/ai-server/src/index.ts`.
- [ ] Re-run the focused Vitest command and verify it passes.

### Task 2: Pinned Sectors Schema And Routes

**Files:**
- Create: `packages/db/src/schema/pinnedSectors.ts`
- Create: `packages/db/drizzle/0047_pinned_sectors.sql`
- Modify: `packages/db/src/schema/index.ts`
- Create: `apps/server/src/routes/pinned-sectors.ts`
- Create: `apps/server/src/routes/pinned-sectors.test.ts`
- Modify: `apps/server/src/route-config.ts`

- [ ] Write failing route tests for authenticated list, pin, unpin, and fourth pin returning 409.
- [ ] Run `pnpm --filter @northstar/server exec vitest run src/routes/pinned-sectors.test.ts --configLoader runner` and verify failure due missing route.
- [ ] Implement the Drizzle schema and idempotent SQL migration with integer FKs.
- [ ] Implement route factory with injectable store and default DB store.
- [ ] Mount `/api/pinned-sectors` as authenticated in route config.
- [ ] Re-run the focused route test.

### Task 3: Sector Vitals API And Hooks

**Files:**
- Create: `apps/server/src/routes/sector-vitals.ts`
- Create: `apps/server/src/routes/sector-vitals.test.ts`
- Modify: `apps/server/src/route-config.ts`
- Create: `packages/api-client-react/src/hooks/useSectorVitals.ts`
- Create: `packages/api-client-react/src/hooks/usePinnedSectors.ts`
- Modify: `packages/api-client-react/src/index.ts`

- [ ] Write failing route tests for invalid sector ID, successful vitals response, and summary response.
- [ ] Run focused server Vitest for `sector-vitals.test.ts`.
- [ ] Implement route factory with injectable `computeVitalSigns` and summary generator.
- [ ] Mount `/api/sectors` vitals router before the existing sectors router so `/:id/vitals` resolves correctly.
- [ ] Implement TanStack Query hooks using existing `customFetch`.
- [ ] Re-run focused tests and typecheck the client package if available through root typecheck later.

### Task 4: Frontend Vitals Components

**Files:**
- Create: `apps/web/src/features/sector-vitals/vital-signs-config.ts`
- Create: `apps/web/src/features/sector-vitals/usePersonaVitalsConfig.ts`
- Create: `apps/web/src/features/sector-vitals/VitalSignCard.tsx`
- Create: `apps/web/src/features/sector-vitals/VitalSignDetail.tsx`
- Create: `apps/web/src/features/sector-vitals/WendyVitalLabel.tsx`
- Create: `apps/web/src/features/sector-vitals/VitalSignsRow.tsx`
- Create: `apps/web/src/features/sector-vitals/CompareDrawer.tsx`
- Modify: `apps/web/src/pages/sector.tsx`

- [ ] Write a focused test for `getPersonaVitalsConfig` showing `indeciso` only sees Pulse and Oxygen.
- [ ] Run `pnpm --filter @northstar/web exec vitest run src/features/sector-vitals/usePersonaVitalsConfig.test.ts --configLoader runner` and verify failure due missing module.
- [ ] Implement config and components with skeleton/error states, accessible buttons, no emoji icons, and responsive layouts.
- [ ] Integrate `VitalSignsRow` and compare drawer controls below the sector header.
- [ ] Re-run focused web test.

### Task 5: Routines API And Scheduler

**Files:**
- Create: `apps/server/src/routes/routines.ts`
- Create: `apps/server/src/routes/routines.test.ts`
- Create: `apps/server/src/jobs/routine-scheduler.ts`
- Create: `apps/server/src/jobs/routine-scheduler.test.ts`
- Modify: `apps/server/src/jobs/cron.ts`
- Modify: `apps/server/src/route-config.ts`

- [ ] Write failing route tests for creating a weekly `market_report` routine with `{ sectorId, includeVitals: true }`.
- [ ] Write failing scheduler tests proving market report body includes all five vital labels when `includeVitals` is true.
- [ ] Run focused server Vitest for both tests and verify missing modules.
- [ ] Implement routes with plan limits, CRUD, feed listing, and read marking.
- [ ] Implement scheduler with injectable store, `computeNextRun`, and `computeVitalSigns`.
- [ ] Wire scheduler into cron with a conservative interval.
- [ ] Re-run focused server tests.

### Task 6: Verification

**Files:**
- All files above.

- [ ] Run focused ai-server tests for sector vitals.
- [ ] Run focused server tests for vitals, pins, routines, and scheduler.
- [ ] Run focused web test for persona config.
- [ ] Run `pnpm --filter @northstar/server run typecheck`.
- [ ] Run `pnpm --filter @northstar/web run typecheck`.
- [ ] Start dev server if typecheck is clean and provide the local URL for manual review.
