# Bundle Strategy

NorthStar uses route-level lazy loading plus Vite manual chunking.

## Vendor Chunks

- `vendor-react`: React, React DOM and routing primitives.
- `vendor-query`: TanStack Query.
- `vendor-radix` / `vendor-ui`: UI primitives and icons.
- `vendor-motion`: Framer Motion.
- `vendor-charts`: charting libraries.
- `vendor-forms`: form and validation libraries.
- `vendor-i18n`: localization runtime.

## Feature Chunks

- `feature-admin`: admin pages, admin console components and admin review feature modules.

The admin chunk follows a source-path boundary because those modules are mostly isolated
behind admin-only routes. Wendy and affiliation surfaces stay route-lazy without manual
chunk names because they share runtime dependencies; letting Rollup place them avoids
circular chunk warnings while preserving lazy loading.

## Analysis

Run:

```bash
pnpm run build:analyze
```

Keep large new libraries out of the main route path unless they are needed on the first screen.
