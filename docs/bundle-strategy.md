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

## Feature Loading

Feature pages are loaded through route-level `import()` boundaries. Admin, Wendy and
affiliation surfaces intentionally avoid manual chunk names because several of them share
runtime dependencies; letting Rollup place the chunks avoids circular chunk warnings and
large forced feature bundles while preserving lazy loading.

## Analysis

Run:

```bash
pnpm run build:analyze
```

Keep large new libraries out of the main route path unless they are needed on the first screen.
