# Adaptive Dashboard Design

## Objective

NorthStar must make the frontend feel like a guided, adaptive workspace rather
than a static collection of cards. The first implementation slice is the
dashboard: cards, tools, calls to action, and visual priority should change as
the user completes discovery steps, especially the "Mappa della chiarezza".

This design is intentionally scoped to `apps/web` dashboard behavior while
creating a clean foundation for later expansion into navigation, Wendy prompts,
and other journey pages.

## Current Context

Relevant existing pieces:

- `apps/web/src/pages/dashboard.tsx` orchestrates the dashboard and already
  renders sections from `useDashboardLayout`.
- `DashboardClarityPath` shows four discovery steps for indeciso users:
  personality test, sector exploration, comparison, and decision.
- `dashboard-layout-sections.ts` defines separate section catalogs for
  `indeciso` and standard journeys.
- `JourneyToolsSection` and `DashboardIndecisoTools` already adapt tools based
  on journey type and readiness band.
- `DashboardHero` already accepts `clarityScore`, but the score does not yet
  control the overall page structure.

The missing layer is a single adaptive state model that turns progress into
layout priority and next action.

## User Experience Model

The dashboard will derive one active phase:

| Phase | Trigger | Primary user need |
|---|---|---|
| `start_test` | No completed test session | Start the personality/profile map |
| `explore_sectors` | Test done, fewer than 3 saved sectors | Explore and save relevant sectors |
| `compare_options` | At least 3 saved sectors, no decided journey, readiness is not `high` | Compare options and reduce uncertainty |
| `choose_path` | At least 3 saved sectors, readiness is `high`, still `indeciso` | Choose the working journey |
| `active_journey` | User has selected a non-indeciso journey | Execute goals, routines, and tools |

The user should always see one obvious next action. Secondary cards remain
available, but the page should not visually compete with itself.

## Adaptive Layout Rules

For `indeciso` users:

- The current phase controls the first dashboard band under the hero.
- The active step's supporting card is promoted near the top.
- Completed step cards become compact proof/context instead of occupying the
  same attention as the next action.
- Future step cards remain visible only when they help orient the user; they
  should not look actionable before the prerequisites are met.
- The dashboard layout manager must not override the adaptive phase with stale
  saved positions when doing so would hide or bury the next step.

Initial recommended ordering:

| Phase | Priority order |
|---|---|
| `start_test` | clarity path, Wendy prompts, tools |
| `explore_sectors` | clarity path, discovery feed, tools, personality |
| `compare_options` | clarity path, career comparison, discovery feed, Wendy prompts |
| `choose_path` | clarity path, tools, career comparison, Wendy prompts |
| `active_journey` | KPI strip, next routine, week timeline, diary/objectives, tools |

For standard journeys, preserve the existing standard dashboard catalog. The
same phase module will still return `active_journey`, so later work can add
objective and routine personalization without changing the dashboard contract.

## Component Design

Add a small dashboard progression module in
`apps/web/src/components/dashboard/dashboard-adaptive-flow.ts`, with pure
functions:

- `deriveDashboardPhase(input)` returns the current phase and next action.
- `getAdaptiveDashboardLayout(input)` returns ordered section IDs for the
  current phase.
- `getAdaptiveSectionPresentation(input)` returns metadata such as priority,
  compactness, and whether a section is currently gated.

Keep this logic pure and unit-tested. `dashboard.tsx` should consume the result
and remain an orchestrator.

Update `DashboardClarityPath` so it exposes richer presentation:

- current step label;
- completion count;
- next action;
- optional compact mode for completed or non-primary states.

Do not turn it into a monolithic wizard. It remains a visual controller and
orientation layer for the workspace.

## Data Flow

The first version can derive state from data already available in the
dashboard:

- `sessionId` indicates whether the test is complete.
- `savedSectorsCount` indicates exploration progress.
- `journeyType` indicates whether the user is still `indeciso`.
- `readinessBand`, when available from the discovery readiness query, separates
  `compare_options` from `choose_path`.
- A future persisted selected sector or path can replace `hasDecided` once the
  backend exposes it.

Until a true persisted decision is available, `hasDecided` should remain
explicit and conservative. The UI must not pretend the user decided merely
because they saved sectors.

## Error And Empty States

- If dashboard data fails, preserve the existing progress-unavailable banner and
  do not render empty progress widgets.
- If adaptive inputs are missing, fall back to the existing default section
  catalog for that journey.
- If saved layout data contains stale section IDs, keep the current fallback
  behavior from `resolveDashboardSectionLayout`.
- If readiness data fails, tools should still render from the base journey
  configuration.

## Responsive Behavior

- Mobile keeps a single-column flow with the active step first and no dense
  side-by-side workspace.
- Tablet may show the primary action followed by two supporting cards.
- Desktop can use two-column or grid emphasis only when stable dimensions avoid
  layout shifts.

The layout should feel operational, not decorative: compact headings, clear
CTA, stable cards, and no nested cards inside page cards.

## Testing

Add focused tests for:

- phase derivation across all five phases;
- adaptive section ordering for indeciso phases;
- fallback to standard layout for non-indeciso journeys;
- stale saved layouts not hiding the active next step;
- dashboard rendering with adaptive order in at least one indeciso scenario.

Existing tests in `dashboard-layout-sections.test.ts` and `dashboard.test.tsx`
are the closest anchors.

## Out Of Scope For First Slice

- Global navigation adaptation.
- Wendy prompt memory changes.
- Backend schema for a final "decided path" record.
- Full drag-and-drop redesign of the dashboard layout manager.
- Visual mockup implementation outside the real app components.

These should be planned as follow-up slices once the dashboard proves the
adaptive model.

## Success Criteria

- Completing a discovery step visibly changes dashboard priority.
- The next useful action is always above lower-priority content.
- The mappa della chiarezza acts as the user's progress controller.
- Existing user-customized layout cannot bury the active step.
- The design is implemented with small pure functions, focused components, and
  tests that cover the progression rules.
