# Sector Vital Signs Design

## Goal

Transform the sector detail page into an investor-friendly vital signs dashboard that shows sector health in under 10 seconds using only existing RAG and market data.

## Repo-Adapted Architecture

The implementation keeps the user-facing scope from the original plan: five vital signs, Wendy interpretation, sector compare drawer with up to three pinned sectors, and `market_report` routine support.

The repo uses integer IDs for `users` and `sectors`, so `pinned_sectors` uses `integer` foreign keys to `users(id)` and `sectors(id)`. Drizzle migrations live in `packages/db/drizzle/*.sql`. Express routes are mounted through `apps/server/src/route-config.ts`.

`computeVitalSigns(sectorId: number, geography?: string)` lives in `packages/ai-server/src/services/sector-vitals/`. It returns a 12-month sparkline for `pulse`, `oxygen`, `temperature`, `pressure`, and `adrenaline`, with a cached one-hour result per sector/geography. Pressure is explicitly labelled as a role-competition proxy because `job_posting_snapshots` does not store employer or company fields.

The API surface is:

- `GET /api/sectors/:id/vitals?geography=IT`
- `POST /api/sectors/:id/vitals/summary`
- `GET /api/pinned-sectors`
- `POST /api/pinned-sectors`
- `DELETE /api/pinned-sectors/:sectorId`
- `GET /api/routines`
- `POST /api/routines`
- `PATCH /api/routines/:id`
- `DELETE /api/routines/:id`
- `GET /api/routines/feed`
- `PATCH /api/routines/feed/:id/read`

The routine worker is added as `apps/server/src/jobs/routine-scheduler.ts` because the schema and schedule helper already reference it, but the file is missing. The cron entry runs due routines and includes vital signs snapshots in `market_report` executions when `parameters.includeVitals === true`.

## UI Design

The sector page gets a compact vital row below the existing header. The row is a functional dashboard section, not a landing block. Cards use existing card/border/muted tokens, Recharts for sparklines, Lucide icons, and color plus text/icon status so the state is not color-only.

`VitalSignsRow` handles fetching and persona filtering. `VitalSignCard` renders the compact monitor. `VitalSignDetail` opens an accessible dialog with the large trend and Wendy CTA. `CompareDrawer` uses the existing shadcn sheet primitive and shows up to three pinned sector monitors side by side on desktop, stacked on mobile.

Persona behavior:

- `investitore`: all five signs.
- `autonomo`: all five signs, emphasis on Pulse and Pressure.
- `indeciso`: Pulse and Oxygen only, with simpler labels.
- `azienda`: all five signs, emphasis on Oxygen and Pulse.

## Data Rules

No new external data sources are introduced.

Pulse uses job posting counts from `job_posting_snapshots`.
Oxygen uses distinct role titles plus `weak_signals` with `signal_type = 'new_job_title'`.
Temperature uses monthly counts from `news_articles` and `growth_articles`.
Pressure uses distinct role-title competition as a documented fallback proxy.
Adrenaline uses emerging weak signals with strength above `0.5` and monthly average strength.

Thresholds are intentionally initial calibration constants and are documented in code as values to revisit after two weeks of telemetry.

## Error Handling

The vitals service returns zero-filled 12-month series when source data is absent, with red/yellow statuses derived from the configured thresholds. API endpoints validate positive integer sector IDs and return 400 for invalid input, 401 for authenticated routes without a user, 404 where a requested owned record is absent, and 409 when a fourth sector pin is attempted.

The UI shows skeletons while loading and a compact retry/error state if vitals cannot be loaded. Wendy summary is lazy and non-blocking.

## Testing

Backend tests cover:

- 12-point sparkline generation.
- Threshold status mapping.
- Pressure fallback source label.
- Pinned sector limit of three with 409 on the fourth.
- Routine `market_report` output including vital signs when requested.

Frontend tests focus on pure persona configuration and component rendering where practical. Full visual confidence is completed through manual browser verification after the dev server runs.
