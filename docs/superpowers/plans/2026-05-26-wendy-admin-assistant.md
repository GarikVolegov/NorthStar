# Wendy Admin Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a secure V1 Wendy Admin assistant with admin-only SSE chat, signed confirmed actions, audit logging, Printing Press gating, and a docked admin console panel.

**Architecture:** Add focused server modules for admin Wendy schemas, tool registry, action tokens, audit, and route handling under `apps/server/src`. Reuse existing Wendy SSE shape and frontend chat/action-card primitives while keeping public Wendy on `/api/ai/wendy` isolated from admin tools. The first V1 uses deterministic admin tool routing plus safe fallback text so tests and local admin workflows do not depend on a live LLM.

**Tech Stack:** Express, zod, Drizzle DB helpers, Vitest, Supertest, React, TanStack Query, lucide-react, existing `useWendyChat` and `WendyActionCard`.

---

## File Structure

- Create `apps/server/src/lib/admin-wendy-schemas.ts`: zod request and confirm schemas plus exported TypeScript types.
- Create `apps/server/src/lib/admin-wendy-actions.ts`: HMAC action token signing, verification, preview/action-card helpers, and expiry errors.
- Create `apps/server/src/lib/admin-wendy-audit.ts`: before/after audit adapter around `writeAuditLog`.
- Create `apps/server/src/lib/admin-wendy-tools.ts`: admin tool definitions, read handlers, action-card generation, confirmation handlers, Printing Press bridge guard.
- Create `apps/server/src/routes/admin/wendy.ts`: `/wendy` SSE route and `/wendy/actions/confirm`.
- Modify `apps/server/src/routes/admin.ts`: mount Wendy Admin router under existing admin guard.
- Create `apps/server/src/routes/admin/wendy.test.ts`: API and confirmation tests.
- Modify `apps/web/src/hooks/useWendyChat.types.ts`: add optional `buildRequestBody` callback.
- Modify `apps/web/src/hooks/useWendyChat.ts`: merge admin-specific request body into Wendy requests.
- Modify `apps/web/src/hooks/useWendyChatSse.ts`: include admin context sources.
- Modify `apps/web/src/hooks/useWendyActionExecutor.ts`: support `admin_*` action tokens and confirmation endpoint.
- Modify `apps/web/src/components/wendy/WendyActionCard.tsx`: strong confirmation input for high-risk admin cards.
- Create `apps/web/src/features/admin-review/components/AdminWendyPanel.tsx`: docked panel and mobile drawer.
- Modify `apps/web/src/features/admin-review/components/AdminReviewShell.tsx`: header toggle and panel mount.
- Create or extend focused frontend tests around chat request body and action card confirmation.

## Task 1: Backend Schemas And Tokens

**Files:**
- Create: `apps/server/src/lib/admin-wendy-schemas.ts`
- Create: `apps/server/src/lib/admin-wendy-actions.ts`
- Test: `apps/server/src/lib/admin-wendy-actions.test.ts`

- [ ] **Step 1: Write failing tests for token signing and verification**

```ts
import { describe, expect, it } from "vitest";
import {
  createAdminWendyActionToken,
  verifyAdminWendyActionToken,
} from "./admin-wendy-actions";

describe("admin Wendy action tokens", () => {
  it("verifies a signed token for the same admin user", () => {
    const token = createAdminWendyActionToken({
      secret: "test-secret",
      now: 1_000,
      ttlMs: 60_000,
      action: {
        actionId: "act_1",
        toolName: "admin_run_agent",
        risk: "medium",
        section: "agents",
        adminUserId: 7,
        payload: { agentKey: "collector" },
        requestId: "req_1",
      },
    });

    const verified = verifyAdminWendyActionToken({
      token,
      secret: "test-secret",
      now: 2_000,
      adminUserId: 7,
    });

    expect(verified.toolName).toBe("admin_run_agent");
    expect(verified.payload).toEqual({ agentKey: "collector" });
  });

  it("rejects tampered tokens", () => {
    const token = createAdminWendyActionToken({
      secret: "test-secret",
      now: 1_000,
      ttlMs: 60_000,
      action: {
        actionId: "act_1",
        toolName: "admin_run_agent",
        risk: "medium",
        section: "agents",
        adminUserId: 7,
        payload: { agentKey: "collector" },
        requestId: "req_1",
      },
    });

    expect(() =>
      verifyAdminWendyActionToken({
        token: `${token.slice(0, -2)}xx`,
        secret: "test-secret",
        now: 2_000,
        adminUserId: 7,
      }),
    ).toThrow("Invalid admin action token");
  });
});
```

- [ ] **Step 2: Run tests and verify red**

Run: `pnpm --filter @northstar/server exec vitest run src/lib/admin-wendy-actions.test.ts --configLoader runner`

Expected: FAIL because `admin-wendy-actions.ts` does not exist.

- [ ] **Step 3: Implement schema and token helpers**

Implement zod schemas with max sizes and token helpers using `node:crypto` HMAC SHA-256 over base64url JSON.

- [ ] **Step 4: Run tests and verify green**

Run: `pnpm --filter @northstar/server exec vitest run src/lib/admin-wendy-actions.test.ts --configLoader runner`

Expected: PASS.

## Task 2: Backend Registry, Confirmation, And Audit

**Files:**
- Create: `apps/server/src/lib/admin-wendy-audit.ts`
- Create: `apps/server/src/lib/admin-wendy-tools.ts`
- Test: `apps/server/src/lib/admin-wendy-tools.test.ts`

- [ ] **Step 1: Write failing tests for action cards and strong confirmation**

Test that `admin_run_agent` returns a medium-risk action card with a token and no side effect, `admin_restart_database` requires strong text `RESTART DATABASE`, and disabled Printing Press returns an unavailable result.

- [ ] **Step 2: Run tests and verify red**

Run: `pnpm --filter @northstar/server exec vitest run src/lib/admin-wendy-tools.test.ts --configLoader runner`

Expected: FAIL because registry functions do not exist.

- [ ] **Step 3: Implement registry and handlers**

Implement read tools for overview/status using existing helper functions where available, action-card generation for writes, confirmation execution through allowlisted handlers, and Printing Press env/bridge guard.

- [ ] **Step 4: Run tests and verify green**

Run: `pnpm --filter @northstar/server exec vitest run src/lib/admin-wendy-tools.test.ts --configLoader runner`

Expected: PASS.

## Task 3: Admin Wendy Routes

**Files:**
- Create: `apps/server/src/routes/admin/wendy.ts`
- Modify: `apps/server/src/routes/admin.ts`
- Test: `apps/server/src/routes/admin/wendy.test.ts`

- [ ] **Step 1: Write failing route tests**

Test unauthenticated `POST /api/admin/wendy` returns `401`, normal user returns `403`, admin receives SSE with `status`, `token`, and `done`, write requests emit `tool_call` with `admin_*` action, high-risk confirm fails without exact text, and tampered tokens are rejected.

- [ ] **Step 2: Run tests and verify red**

Run: `pnpm --filter @northstar/server exec vitest run src/routes/admin/wendy.test.ts --configLoader runner`

Expected: FAIL because the route is not mounted.

- [ ] **Step 3: Implement SSE and confirm route**

Add admin router. Set SSE headers, validate body, route message to admin tool selection, stream tool calls and fallback text, and call `confirmAdminWendyAction` from the confirmation endpoint.

- [ ] **Step 4: Run tests and verify green**

Run: `pnpm --filter @northstar/server exec vitest run src/routes/admin/wendy.test.ts --configLoader runner`

Expected: PASS.

## Task 4: Frontend Chat Body And Admin Action Execution

**Files:**
- Modify: `apps/web/src/hooks/useWendyChat.types.ts`
- Modify: `apps/web/src/hooks/useWendyChat.ts`
- Modify: `apps/web/src/hooks/useWendyChatSse.ts`
- Modify: `apps/web/src/hooks/useWendyActionExecutor.ts`
- Modify: `apps/web/src/components/wendy/WendyActionCard.tsx`
- Test: focused Vitest tests for changed hooks/components

- [ ] **Step 1: Write failing frontend tests**

Test that `useWendyChat` includes a custom `adminContext` body, `normalizeWendyAction` preserves `actionToken` and strong confirmation metadata, and `WendyActionCard` disables confirm until the exact high-risk phrase is entered.

- [ ] **Step 2: Run tests and verify red**

Run: `pnpm --filter @northstar/web exec vitest run src/hooks/useWendyActionExecutor.test.ts src/components/wendy/WendyActionCard.test.tsx --configLoader runner`

Expected: FAIL for missing fields and strong confirmation UI.

- [ ] **Step 3: Implement frontend hook and action card changes**

Add `buildRequestBody` to `useWendyChat`, extend context sources with `admin` and `printing-press`, add admin confirmation endpoint handling in `useWendyActionExecutor`, and add a strong confirmation input to `WendyActionCard`.

- [ ] **Step 4: Run tests and verify green**

Run: `pnpm --filter @northstar/web exec vitest run src/hooks/useWendyActionExecutor.test.ts src/components/wendy/WendyActionCard.test.tsx --configLoader runner`

Expected: PASS.

## Task 5: Admin Wendy Panel

**Files:**
- Create: `apps/web/src/features/admin-review/components/AdminWendyPanel.tsx`
- Modify: `apps/web/src/features/admin-review/components/AdminReviewShell.tsx`
- Test: `apps/web/src/features/admin-review/components/AdminWendyPanel.test.tsx`

- [ ] **Step 1: Write failing panel tests**

Test the admin header has a compact Wendy button, the panel uses `/api/admin/wendy`, and the request body includes the current section in `adminContext`.

- [ ] **Step 2: Run tests and verify red**

Run: `pnpm --filter @northstar/web exec vitest run src/features/admin-review/components/AdminWendyPanel.test.tsx --configLoader runner`

Expected: FAIL because the panel does not exist.

- [ ] **Step 3: Implement panel and shell mount**

Create a right-docked desktop panel, mobile fixed bottom drawer, message list, composer, and header toggle using existing Wendy message components.

- [ ] **Step 4: Run tests and verify green**

Run: `pnpm --filter @northstar/web exec vitest run src/features/admin-review/components/AdminWendyPanel.test.tsx --configLoader runner`

Expected: PASS.

## Task 6: Regression And Typecheck

**Files:**
- Modify only files already changed by previous tasks.

- [ ] **Step 1: Run backend focused tests**

Run: `pnpm --filter @northstar/server exec vitest run src/lib/admin-wendy-actions.test.ts src/lib/admin-wendy-tools.test.ts src/routes/admin/wendy.test.ts --configLoader runner`

Expected: PASS.

- [ ] **Step 2: Run frontend focused tests**

Run: `pnpm --filter @northstar/web exec vitest run src/hooks/useWendyActionExecutor.test.ts src/components/wendy/WendyActionCard.test.tsx src/features/admin-review/components/AdminWendyPanel.test.tsx --configLoader runner`

Expected: PASS.

- [ ] **Step 3: Run typechecks**

Run: `pnpm --filter @northstar/server run typecheck && pnpm --filter @northstar/web run typecheck`

Expected: PASS.

- [ ] **Step 4: Inspect public Wendy isolation**

Run: `rg -n "admin_" packages/ai-server/src/wendy-router apps/web/src/components/search`

Expected: No public Wendy registry or SearchDialog admin tool exposure.
