# Adaptive Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first adaptive dashboard slice so NorthStar reorders cards, tools, and calls to action as the user completes discovery steps.

**Architecture:** Add a pure dashboard flow module that derives phase, next action, and section order from existing dashboard inputs. Keep `dashboard.tsx` as the page orchestrator, update `DashboardClarityPath` to display the derived active step, and preserve existing fallback behavior for stale layouts and failed data.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, TanStack Query, Wouter, Tailwind CSS v4, lucide-react.

---

## File Structure

- Create `apps/web/src/components/dashboard/dashboard-adaptive-flow.ts`
  - Owns pure phase derivation, next action metadata, adaptive section order, and section presentation metadata.
- Create `apps/web/src/components/dashboard/dashboard-adaptive-flow.test.ts`
  - Unit tests for phase derivation, order, stale layout protection, and standard journey fallback.
- Modify `apps/web/src/components/dashboard/DashboardClarityPath.tsx`
  - Accepts optional adaptive metadata and renders current step, completion count, and next action without becoming a wizard.
- Modify `apps/web/src/pages/dashboard.tsx`
  - Derives adaptive flow from existing data and renders dashboard sections in adaptive order.
- Modify `apps/web/src/pages/dashboard.test.tsx`
  - Adds an indeciso rendering test proving adaptive order places the active next section above lower-priority content.

## Task 1: Pure Adaptive Flow Module

**Files:**
- Create: `apps/web/src/components/dashboard/dashboard-adaptive-flow.ts`
- Test: `apps/web/src/components/dashboard/dashboard-adaptive-flow.test.ts`

- [ ] **Step 1: Write failing tests for phase derivation and section ordering**

Create `apps/web/src/components/dashboard/dashboard-adaptive-flow.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  deriveDashboardPhase,
  getAdaptiveDashboardLayout,
  getAdaptiveSectionPresentation,
  type AdaptiveDashboardInput,
} from "./dashboard-adaptive-flow";

const baseInput: AdaptiveDashboardInput = {
  journeyType: "indeciso",
  hasSession: false,
  savedSectorsCount: 0,
  hasDecided: false,
  layout: [
    { id: "tools", position: 0, visible: true, size: "lg" },
    { id: "clarity_path", position: 1, visible: true, size: "lg" },
    { id: "discovery_feed", position: 2, visible: true, size: "lg" },
  ],
};

describe("dashboard adaptive flow", () => {
  it("derives start_test when the indeciso user has no session", () => {
    expect(deriveDashboardPhase(baseInput)).toEqual({
      phase: "start_test",
      nextAction: {
        label: "Inizia il test",
        href: "/test",
        sectionId: "clarity_path",
      },
    });
  });

  it("derives explore_sectors after the test and before three saved sectors", () => {
    const result = deriveDashboardPhase({
      ...baseInput,
      hasSession: true,
      savedSectorsCount: 1,
    });

    expect(result.phase).toBe("explore_sectors");
    expect(result.nextAction).toEqual({
      label: "Esplora settori",
      href: "/settori",
      sectionId: "discovery_feed",
    });
  });

  it("derives compare_options after three saved sectors when readiness is not high", () => {
    const result = deriveDashboardPhase({
      ...baseInput,
      hasSession: true,
      savedSectorsCount: 3,
      readinessBand: "mid",
    });

    expect(result.phase).toBe("compare_options");
    expect(result.nextAction).toEqual({
      label: "Confronta opzioni",
      href: "/settori",
      sectionId: "career_comparison",
    });
  });

  it("derives choose_path when readiness is high and the user is still indeciso", () => {
    const result = deriveDashboardPhase({
      ...baseInput,
      hasSession: true,
      savedSectorsCount: 4,
      readinessBand: "high",
    });

    expect(result.phase).toBe("choose_path");
    expect(result.nextAction).toEqual({
      label: "Scegli percorso",
      href: "/percorso",
      sectionId: "tools",
    });
  });

  it("derives active_journey for non-indeciso users", () => {
    const result = deriveDashboardPhase({
      ...baseInput,
      journeyType: "dipendente",
      hasSession: true,
      savedSectorsCount: 5,
    });

    expect(result.phase).toBe("active_journey");
    expect(result.nextAction).toEqual({
      label: "Apri prossima routine",
      href: "/dashboard",
      sectionId: "next_routine",
    });
  });

  it("promotes the active indeciso section above stale saved layout positions", () => {
    const layout = getAdaptiveDashboardLayout({
      ...baseInput,
      hasSession: true,
      savedSectorsCount: 1,
      layout: [
        { id: "tools", position: 0, visible: true, size: "lg" },
        { id: "personality", position: 1, visible: true, size: "md" },
        { id: "discovery_feed", position: 2, visible: true, size: "lg" },
        { id: "clarity_path", position: 3, visible: true, size: "lg" },
      ],
    });

    expect(layout.map((section) => section.id).slice(0, 3)).toEqual([
      "clarity_path",
      "discovery_feed",
      "tools",
    ]);
  });

  it("preserves standard journey layout order while returning active_journey", () => {
    const layout = getAdaptiveDashboardLayout({
      ...baseInput,
      journeyType: "dipendente",
      hasSession: true,
      layout: [
        { id: "week_timeline", position: 0, visible: true, size: "lg" },
        { id: "kpi_strip", position: 1, visible: true, size: "lg" },
      ],
    });

    expect(layout.map((section) => section.id)).toEqual(["week_timeline", "kpi_strip"]);
  });

  it("marks the active section as primary and future gated sections as gated", () => {
    const presentation = getAdaptiveSectionPresentation({
      ...baseInput,
      hasSession: true,
      savedSectorsCount: 1,
    });

    expect(presentation.discovery_feed).toMatchObject({ priority: "primary", gated: false });
    expect(presentation.career_comparison).toMatchObject({ priority: "supporting", gated: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @northstar/web test -- src/components/dashboard/dashboard-adaptive-flow.test.ts
```

Expected: FAIL because `dashboard-adaptive-flow.ts` does not exist.

- [ ] **Step 3: Implement the pure adaptive flow module**

Create `apps/web/src/components/dashboard/dashboard-adaptive-flow.ts`:

```ts
import type { WidgetLayout } from "@/hooks/useDashboardLayout";

export type AdaptiveDashboardPhase =
  | "start_test"
  | "explore_sectors"
  | "compare_options"
  | "choose_path"
  | "active_journey";

export type ReadinessBand = "low" | "mid" | "high";

export interface AdaptiveDashboardInput {
  journeyType?: string | null;
  hasSession: boolean;
  savedSectorsCount: number;
  hasDecided: boolean;
  readinessBand?: ReadinessBand;
  layout: WidgetLayout[];
}

export interface AdaptiveNextAction {
  label: string;
  href: string;
  sectionId: string;
}

export interface AdaptiveDashboardState {
  phase: AdaptiveDashboardPhase;
  nextAction: AdaptiveNextAction;
}

export interface AdaptiveSectionPresentation {
  priority: "primary" | "supporting" | "compact";
  gated: boolean;
}

export type AdaptiveSectionPresentationMap = Record<string, AdaptiveSectionPresentation>;

const INDECISO_PHASE_ORDER: Record<AdaptiveDashboardPhase, string[]> = {
  start_test: ["clarity_path", "wendy_prompts", "tools"],
  explore_sectors: ["clarity_path", "discovery_feed", "tools", "personality"],
  compare_options: ["clarity_path", "career_comparison", "discovery_feed", "wendy_prompts"],
  choose_path: ["clarity_path", "tools", "career_comparison", "wendy_prompts"],
  active_journey: ["kpi_strip", "next_routine", "week_timeline", "diary_objectives", "tools"],
};

const NEXT_ACTION_BY_PHASE: Record<AdaptiveDashboardPhase, AdaptiveNextAction> = {
  start_test: { label: "Inizia il test", href: "/test", sectionId: "clarity_path" },
  explore_sectors: { label: "Esplora settori", href: "/settori", sectionId: "discovery_feed" },
  compare_options: { label: "Confronta opzioni", href: "/settori", sectionId: "career_comparison" },
  choose_path: { label: "Scegli percorso", href: "/percorso", sectionId: "tools" },
  active_journey: { label: "Apri prossima routine", href: "/dashboard", sectionId: "next_routine" },
};

export function deriveDashboardPhase(input: AdaptiveDashboardInput): AdaptiveDashboardState {
  if (input.journeyType && input.journeyType !== "indeciso") {
    return { phase: "active_journey", nextAction: NEXT_ACTION_BY_PHASE.active_journey };
  }

  if (!input.hasSession) {
    return { phase: "start_test", nextAction: NEXT_ACTION_BY_PHASE.start_test };
  }

  if (input.savedSectorsCount < 3) {
    return { phase: "explore_sectors", nextAction: NEXT_ACTION_BY_PHASE.explore_sectors };
  }

  if (!input.hasDecided && input.readinessBand === "high") {
    return { phase: "choose_path", nextAction: NEXT_ACTION_BY_PHASE.choose_path };
  }

  if (!input.hasDecided) {
    return { phase: "compare_options", nextAction: NEXT_ACTION_BY_PHASE.compare_options };
  }

  return { phase: "active_journey", nextAction: NEXT_ACTION_BY_PHASE.active_journey };
}

export function getAdaptiveDashboardLayout(input: AdaptiveDashboardInput): WidgetLayout[] {
  const sortedVisible = [...input.layout]
    .filter((section) => section.visible)
    .sort((a, b) => a.position - b.position);

  const { phase } = deriveDashboardPhase(input);

  if (phase === "active_journey" && input.journeyType !== "indeciso") {
    return sortedVisible.map((section, position) => ({ ...section, position }));
  }

  const preferredOrder = INDECISO_PHASE_ORDER[phase];
  const byId = new Map(sortedVisible.map((section) => [section.id, section]));
  const promoted = preferredOrder
    .map((id) => byId.get(id))
    .filter((section): section is WidgetLayout => Boolean(section));
  const promotedIds = new Set(promoted.map((section) => section.id));
  const remaining = sortedVisible.filter((section) => !promotedIds.has(section.id));

  return [...promoted, ...remaining].map((section, position) => ({ ...section, position }));
}

export function getAdaptiveSectionPresentation(input: AdaptiveDashboardInput): AdaptiveSectionPresentationMap {
  const state = deriveDashboardPhase(input);
  const primaryId = state.nextAction.sectionId;
  const result: AdaptiveSectionPresentationMap = {};

  for (const section of input.layout) {
    const gated =
      (section.id === "career_comparison" && input.savedSectorsCount < 3) ||
      (section.id === "discovery_feed" && !input.hasSession);

    result[section.id] = {
      priority: section.id === primaryId ? "primary" : state.phase === "active_journey" ? "supporting" : "compact",
      gated,
    };
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:

```bash
pnpm --filter @northstar/web test -- src/components/dashboard/dashboard-adaptive-flow.test.ts
```

Expected: PASS for `dashboard-adaptive-flow.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/dashboard/dashboard-adaptive-flow.ts apps/web/src/components/dashboard/dashboard-adaptive-flow.test.ts
git commit -m "feat(dashboard): add adaptive flow model"
```

## Task 2: Connect Adaptive Layout To Dashboard

**Files:**
- Modify: `apps/web/src/pages/dashboard.tsx`
- Test: `apps/web/src/pages/dashboard.test.tsx`

- [ ] **Step 1: Write failing dashboard render test for indeciso adaptive order**

In `apps/web/src/pages/dashboard.test.tsx`, add hoisted auth state near the existing mocks:

```ts
const authState = vi.hoisted(() => ({
  user: {
    id: 7,
    name: "Ada",
    journeyType: "dipendente",
    onboardingCompleted: true,
    avatarUrl: null,
  } as {
    id: number;
    name: string;
    journeyType: string;
    onboardingCompleted: boolean;
    avatarUrl: string | null;
  },
}));
```

Replace the existing `useAuth` mock with:

```ts
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    authReady: true,
    user: authState.user,
  }),
}));
```

Replace the existing `useDashboardLayout` mock with:

```ts
vi.mock("@/hooks/useDashboardLayout", () => ({
  useDashboardLayout: () => ({
    layout: [
      { id: "tools", position: 0, visible: true, size: "lg" },
      { id: "clarity_path", position: 1, visible: true, size: "lg" },
      { id: "discovery_feed", position: 2, visible: true, size: "lg" },
      { id: "career_comparison", position: 3, visible: true, size: "lg" },
      { id: "kpi_strip", position: 4, visible: true, size: "lg" },
      { id: "week_timeline", position: 5, visible: true, size: "lg" },
      { id: "diary_objectives", position: 6, visible: true, size: "lg" },
    ],
  }),
}));
```

Add this test:

```ts
it("promotes discovery feed above tools when the indeciso user has completed the test", async () => {
  authState.user = {
    id: 7,
    name: "Ada",
    journeyType: "indeciso",
    onboardingCompleted: true,
    avatarUrl: null,
  };
  useDashboardDataMock.mockReturnValue({
    data: {
      user: {
        journeyType: "indeciso",
        name: "Ada",
        email: "ada@example.com",
        isPremium: false,
        onboardingCompleted: true,
      },
      session: null,
      objectives: [],
      objectivesProgress: { done: 0, total: 0, percent: 0 },
      upcomingEvents: [],
    },
    isLoading: false,
    isError: false,
    refetch: refetchDashboardMock,
  });
  getJsonMock.mockImplementation(async (url: string) => {
    if (url.endsWith("api/test-sessions/latest")) {
      return {
        sessionId: 42,
        recommendations: [
          { sectorId: 1, sectorName: "Product Design", matchScore: 91 },
          { sectorId: 2, sectorName: "UX Research", matchScore: 88 },
        ],
        riasecScores: {},
        primaryTypes: ["A"],
        spiritScores: {},
        createdAt: "2026-05-30T00:00:00.000Z",
      };
    }
    if (url.endsWith("api/test-sessions/42")) {
      return {
        id: 42,
        recommendations: [
          { sectorId: 1, sectorName: "Product Design", matchScore: 91 },
          { sectorId: 2, sectorName: "UX Research", matchScore: 88 },
        ],
        riasecScores: {},
        primaryTypes: ["A"],
        spiritScores: {},
        createdAt: "2026-05-30T00:00:00.000Z",
      };
    }
    return { layout: [] };
  });

  renderDashboard();

  const clarity = await screen.findByText(/mappa della chiarezza/i);
  const sectors = await screen.findByText(/settori consigliati per te/i);
  const tools = await screen.findByText(/strumenti del percorso/i);

  expect(clarity.compareDocumentPosition(sectors) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(sectors.compareDocumentPosition(tools) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @northstar/web test -- src/pages/dashboard.test.tsx
```

Expected: FAIL because `dashboard.tsx` still renders saved layout order before adaptive promotion.

- [ ] **Step 3: Import and use adaptive layout in dashboard**

In `apps/web/src/pages/dashboard.tsx`, add the import near dashboard component imports:

```ts
import {
  deriveDashboardPhase,
  getAdaptiveDashboardLayout,
  getAdaptiveSectionPresentation,
  type ReadinessBand,
} from "@/components/dashboard/dashboard-adaptive-flow";
```

In `Dashboard`, after `clarityScore` and before render helpers, add:

```ts
  const readinessBand = undefined as ReadinessBand | undefined;
  const adaptiveInput = {
    journeyType,
    hasSession: !!sessionId,
    savedSectorsCount,
    hasDecided: false,
    readinessBand,
    layout: dashboardLayout,
  };
  const adaptiveState = deriveDashboardPhase(adaptiveInput);
  const adaptiveSectionPresentation = getAdaptiveSectionPresentation(adaptiveInput);
  const visibleDashboardLayout = getAdaptiveDashboardLayout(adaptiveInput);
```

Replace the final layout map:

```tsx
      {dashboardLayout
        .filter((section) => section.visible)
        .sort((a, b) => a.position - b.position)
        .map((section) => {
          const content = renderDashboardSection(section);
          return content ? <div key={section.id}>{content}</div> : null;
        })}
```

with:

```tsx
      {visibleDashboardLayout.map((section) => {
        const content = renderDashboardSection(section);
        return content ? <div key={section.id}>{content}</div> : null;
      })}
```

If TypeScript reports unused `adaptiveState` or `adaptiveSectionPresentation` before Task 3, keep only `visibleDashboardLayout` in Task 2 and introduce the extra constants in Task 3.

- [ ] **Step 4: Run dashboard test**

Run:

```bash
pnpm --filter @northstar/web test -- src/pages/dashboard.test.tsx
```

Expected: PASS for dashboard progress UX tests and the new indeciso adaptive order test.

- [ ] **Step 5: Run adaptive flow tests**

Run:

```bash
pnpm --filter @northstar/web test -- src/components/dashboard/dashboard-adaptive-flow.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/dashboard.tsx apps/web/src/pages/dashboard.test.tsx
git commit -m "feat(dashboard): apply adaptive section order"
```

## Task 3: Upgrade Clarity Path Presentation

**Files:**
- Modify: `apps/web/src/components/dashboard/DashboardClarityPath.tsx`
- Modify: `apps/web/src/pages/dashboard.tsx`

- [ ] **Step 1: Add props and render contract to `DashboardClarityPath`**

Modify the component props in `apps/web/src/components/dashboard/DashboardClarityPath.tsx`:

```ts
interface ClarityPathNextAction {
  label: string;
  href: string;
}

export function DashboardClarityPath({
  hasSession,
  savedSectorsCount,
  hasDecided,
  currentPhaseLabel,
  nextAction,
  compact = false,
}: {
  hasSession: boolean;
  savedSectorsCount: number;
  hasDecided: boolean;
  currentPhaseLabel?: string;
  nextAction?: ClarityPathNextAction;
  compact?: boolean;
}) {
```

After `const currentStep = steps.findIndex((s) => s.active && !s.done);`, add:

```ts
  const completedCount = steps.filter((step) => step.done).length;
  const activeStep = currentStep >= 0 ? steps[currentStep] : steps[steps.length - 1];
  const activeAction = nextAction ?? (activeStep ? { label: activeStep.cta, href: activeStep.href } : undefined);
```

Replace the header block with:

```tsx
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Compass className="h-3.5 w-3.5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Mappa della chiarezza
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">
              {currentPhaseLabel ?? activeStep?.label ?? "Prossimo passo"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {completedCount} / {steps.length} step completati
            </p>
          </div>
        </div>
        {activeAction && (
          <Link
            href={activeAction.href}
            className="inline-flex min-h-9 items-center justify-center rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            {activeAction.label}
          </Link>
        )}
      </div>
```

Change the root class:

```tsx
    <div className={cn("rounded-2xl border border-border bg-card shadow-sm", compact ? "p-4" : "p-5")}>
```

- [ ] **Step 2: Wire adaptive metadata from dashboard**

In `apps/web/src/pages/dashboard.tsx`, add a phase label map near `JOURNEY_META`:

```ts
const ADAPTIVE_PHASE_LABEL: Record<string, string> = {
  start_test: "Scopri chi sei",
  explore_sectors: "Esplora il mondo",
  compare_options: "Confronta le opzioni",
  choose_path: "Scegli il percorso",
  active_journey: "Percorso attivo",
};
```

In the `clarity_path` case of `renderDashboardSection`, replace:

```tsx
return <DashboardClarityPath hasSession={!!sessionId} savedSectorsCount={savedSectorsCount} hasDecided={false} />;
```

with:

```tsx
return (
  <DashboardClarityPath
    hasSession={!!sessionId}
    savedSectorsCount={savedSectorsCount}
    hasDecided={false}
    currentPhaseLabel={ADAPTIVE_PHASE_LABEL[adaptiveState.phase]}
    nextAction={{
      label: adaptiveState.nextAction.label,
      href: adaptiveState.nextAction.href,
    }}
    compact={adaptiveSectionPresentation.clarity_path?.priority === "compact"}
  />
);
```

- [ ] **Step 3: Run targeted tests**

Run:

```bash
pnpm --filter @northstar/web test -- src/pages/dashboard.test.tsx src/components/dashboard/dashboard-adaptive-flow.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/dashboard/DashboardClarityPath.tsx apps/web/src/pages/dashboard.tsx
git commit -m "feat(dashboard): enrich clarity path state"
```

## Task 4: Verification And Guardrails

**Files:**
- Modify if needed: `apps/web/src/components/dashboard/dashboard-layout-sections.test.ts`
- Modify if needed: `apps/web/src/pages/dashboard.test.tsx`

- [ ] **Step 1: Run layout catalog tests**

Run:

```bash
pnpm --filter @northstar/web test -- src/components/dashboard/dashboard-layout-sections.test.ts
```

Expected: PASS. Existing catalog expectations remain valid because adaptive ordering happens after catalog resolution.

- [ ] **Step 2: Run all dashboard-related tests**

Run:

```bash
pnpm --filter @northstar/web test -- src/components/dashboard/dashboard-adaptive-flow.test.ts src/components/dashboard/dashboard-layout-sections.test.ts src/pages/dashboard.test.tsx
```

Expected: PASS.

- [ ] **Step 3: Run TypeScript check for web**

Run:

```bash
pnpm --filter @northstar/web typecheck
```

Expected: PASS. If unrelated existing errors appear, record the exact files and do not fix unrelated areas in this task.

- [ ] **Step 4: Run web lint if typecheck passes**

Run:

```bash
pnpm --filter @northstar/web lint
```

Expected: PASS. If unrelated existing lint failures appear, record the exact files and keep adaptive-dashboard files clean.

- [ ] **Step 5: Commit verification-only adjustments if any were needed**

Only run this commit if Step 1 through Step 4 required small test or typing corrections in adaptive-dashboard files:

```bash
git add apps/web/src/components/dashboard/dashboard-adaptive-flow.ts apps/web/src/components/dashboard/dashboard-adaptive-flow.test.ts apps/web/src/components/dashboard/DashboardClarityPath.tsx apps/web/src/pages/dashboard.tsx apps/web/src/pages/dashboard.test.tsx
git commit -m "test(dashboard): cover adaptive dashboard flow"
```

If no corrections were needed, do not create an empty commit.

## Self-Review

Spec coverage:

- Guided adaptive workspace: Task 1 derives phase and next action; Task 2 applies section order.
- Mappa della chiarezza as controller: Task 3 adds current phase, completion count, and next action display.
- Existing customized layout cannot bury the active step: Task 1 tests promotion above stale saved positions; Task 2 applies it.
- Conservative decision state: Task 1 keeps `hasDecided` explicit and uses `readinessBand` for `choose_path`.
- Error and fallback behavior: Task 1 preserves standard journey order; Task 4 verifies existing layout catalog behavior.

Placeholder scan:

- No incomplete-work markers or undefined implementation placeholders are present.
- Every code step includes concrete code or an exact command with expected result.

Type consistency:

- `AdaptiveDashboardInput`, `ReadinessBand`, `AdaptiveDashboardPhase`, and `AdaptiveNextAction` are defined in Task 1 before later tasks use them.
- `WidgetLayout` is reused from `useDashboardLayout` to match existing dashboard layout shape.
