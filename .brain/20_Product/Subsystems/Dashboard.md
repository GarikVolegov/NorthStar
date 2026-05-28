---
layer: product
status: stable
runtime: true
owner: garik
links_to: [[Wendy]], [[AAaS-Ritual]], [[Auth-Profile]]
tags: [L3, product, dashboard, ui]
updated: 2026-05-28
---

# Dashboard

## Ruolo
UI personalizzabile dell'utente loggato. Mostra insight proattivi, prossime routine, hero/welcome, layout salvato per utente.

## Personalizzazione (Step 7-8)
Layout per utente salvato in `userDashboardLayoutTable` (jsonb `layout: WidgetLayout[]`).

## File chiave
- `apps/web/src/components/dashboard/DashboardLayoutManager.tsx` — gestore layout drag/drop
- `apps/web/src/components/dashboard/DashboardHero.tsx`
- `apps/web/src/components/dashboard/DashboardObjectives.tsx`
- `apps/web/src/components/dashboard/DashboardPersonalisationPanel.tsx`
- `apps/web/src/components/dashboard/widgets/NextRoutineWidget.tsx`
- `apps/web/src/components/dashboard/JourneyToolsSection.tsx`

## Security gates rilevanti
`gate-ui-component`, `gate-ui-page` — vedi [[../Pipelines/development]].
