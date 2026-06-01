---
name: ui-quality
description: Use when changing NorthStar web UI, dashboards, Wendy surfaces, mobile layouts, styling, UX states, or frontend interaction flows.
---

# UI Quality

NorthStar UI should feel operational, calm, and fast to scan.

## Rules

- Read `.brain/40_Agent_Context/rules/FRONTEND_RULES.md` before UI edits.
- Keep dashboard and SaaS surfaces dense, restrained, and workflow-first.
- Use existing components and icons before inventing new primitives.
- Avoid nested cards, decorative blobs, and marketing-style hero layouts for tools.
- Verify desktop and mobile layout when visual behavior changes.

## Checks

- Text fits on mobile and desktop.
- Loading, empty, error, disabled, and success states are represented when relevant.
- Important controls use familiar UI forms: icons, toggles, segmented controls, menus, tabs.
- Screenshots or Playwright evidence exist before claiming visual completion.
