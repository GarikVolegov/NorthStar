# Piano Wendy Admin Assistant Design

Date: 2026-05-26
Status: Approved design, awaiting implementation plan

## Summary

Wendy Admin adds a persistent assistant inside the admin console. It is separate from the public Wendy chat and uses dedicated admin endpoints, admin-only server authorization, a separate admin tool registry, signed action tokens, and audit logging for every confirmed action.

The V1 scope is a vertical, secure implementation: shared streaming shape with Wendy, separate admin mode, read tools for the main admin observability areas, confirmed action cards for write operations, strong confirmation for high-risk operations, and Printing Press as a high-risk allowlisted admin tool when its bridge is configured.

## Goals

- Add `POST /api/admin/wendy` for admin SSE chat.
- Add `POST /api/admin/wendy/actions/confirm` for server-signed admin action execution.
- Keep `/api/ai/wendy` unchanged for normal users and free of admin tools.
- Add an `admin-wendy-tools` registry separate from the existing public Wendy tool registry.
- Support admin context from the console: section, selected entity, filters, and compact visible state.
- Render Wendy Admin as a docked panel on desktop and a drawer or bottom sheet on mobile.
- Require action confirmation before writes, with strong confirmation for high-risk actions.
- Produce audit logs for every confirmed admin action.
- Include Printing Press in V1 only through a bridge, only for admin, and only through allowlisted high-risk actions.

## Non-Goals

- Do not grant Wendy Admin arbitrary HTTP, shell, filesystem, or database access.
- Do not expose admin tools to global SearchDialog or public Wendy.
- Do not implement granular admin roles beyond the existing `admin` role in V1.
- Do not make every admin endpoint callable generically. Each action must map to a named server handler.
- Do not make Printing Press a free-form public skill.

## Existing Project Fit

The public Wendy route already streams SSE from `apps/server/src/routes/ai-wendy.ts`, with shared schemas and event helpers in `apps/server/src/routes/ai-wendy-shared.ts`. The public tool registry lives in `packages/ai-server/src/wendy-router/tool-registry.ts`, and action cards are normalized and executed in `apps/web/src/hooks/useWendyActionExecutor.ts`.

Admin routes are mounted under `/api/admin` through `apps/server/src/routes/admin.ts` and protected by `requireAdminAccess`. The main admin console shell is `apps/web/src/features/admin-review/components/AdminReviewShell.tsx`, with section state and admin hooks in `apps/web/src/pages/admin-review.tsx`.

Wendy Admin should follow these patterns instead of introducing a second framework.

## Backend Architecture

### Route Mounting

Add `apps/server/src/routes/admin/wendy.ts` and mount it from `apps/server/src/routes/admin.ts`, so it inherits the existing admin guard. The router exposes:

- `POST /wendy`
- `POST /wendy/actions/confirm`

Because the router is mounted under `/api/admin`, the public paths become:

- `POST /api/admin/wendy`
- `POST /api/admin/wendy/actions/confirm`

The admin route must also perform an explicit admin-role check or rely on `requireAdminAccess` in tests through the mounted admin router. Unauthorized requests return `401`; authenticated non-admin users return `403`.

### Request Schema

Create an admin-specific zod schema:

```ts
AdminWendyRequest = {
  message: string;
  compressedHistory?: CompressedHistory;
  locale?: string;
  adminContext?: {
    section: string;
    selectedEntity?: Record<string, unknown>;
    filters?: Record<string, unknown>;
    visibleState?: Record<string, unknown>;
  };
}
```

Use max sizes on strings, history, and context records. The server should reject oversized or malformed input before starting SSE.

### SSE Shape

Reuse the public Wendy SSE event shape:

- `status`
- `token`
- `tool_call`
- `done`
- `error`

`done.contextSources` may include:

- `app-data`
- `rag`
- `openhuman`
- `graphify`
- `wendy-brain`
- `semantic-memory`
- `admin`
- `printing-press`

### Admin Pipeline

V1 should implement a compact admin pipeline rather than modifying the public Wendy router in place:

1. Build an admin system prompt that states Wendy Admin can diagnose and guide admin operations, but cannot execute writes without confirmation.
2. Build compact admin context from the request.
3. Load admin knowledge context through existing Graphify, Wendy Brain, RAG, and admin read handlers when relevant.
4. Call the configured LLM with admin tools from `admin-wendy-tools`.
5. Execute read tools immediately.
6. Convert write and high-risk tool calls into signed action cards.
7. Stream follow-up text and `done.contextSources`.

Public Wendy remains on `/api/ai/wendy` and continues using the existing public registry.

## Admin Tool Registry

Add a separate registry, preferably under server-owned code where admin DB and route helpers are available:

- `apps/server/src/lib/admin-wendy-tools.ts`
- `apps/server/src/lib/admin-wendy-actions.ts`
- `apps/server/src/lib/admin-wendy-audit.ts`

The registry item includes:

```ts
{
  name: string;
  description: string;
  parameters: ToolParameter[];
  risk: "low" | "medium" | "high";
  section: string;
  kind: "read" | "write";
  requiresConfirmation: boolean;
  requiresStrongConfirmation: boolean;
  confirmationText?: string;
}
```

### Read Tools

Read tools execute immediately and return compact JSON for Wendy to summarize:

- `admin_overview`
- `admin_ops_status`
- `admin_agent_health`
- `admin_recent_logs`
- `admin_quality_overview`
- `admin_prompts_overview`
- `admin_catalogs_overview`
- `admin_growth_queue_overview`
- `admin_subscriptions_overview`
- `admin_messages_overview`
- `admin_affiliation_overview`
- `admin_memory_graph_overview`
- `admin_wendy_brain_search`
- `admin_rag_search`
- `admin_graphify_search`

These tools should call internal functions or shared query helpers, not loop through HTTP endpoints.

### Write Tools

Write tools produce action cards, not side effects:

- `admin_run_agent`
- `admin_refresh_data`
- `admin_approve_item`
- `admin_reject_item`
- `admin_publish_content`
- `admin_update_notes`
- `admin_update_status`

### High-Risk Tools

High-risk tools require strong confirmation:

- `admin_restart_server`
- `admin_stop_server`
- `admin_restart_database`
- `admin_set_maintenance_mode`
- `admin_reset_prompt`
- `admin_rollback_prompt`
- `admin_modify_subscription`
- `admin_printing_press_generate`
- `admin_printing_press_publish`

V1 may return "not configured" or "not implemented" for handlers that are deliberately not enabled yet, but every exposed tool must have a registry entry, risk classification, action token, and confirmation policy.

## Action Tokens

Action cards contain:

```ts
AdminWendyAction = {
  id: string;
  type: string;
  risk: "low" | "medium" | "high";
  label: string;
  description: string;
  preview: Array<{ label: string; value: string }>;
  requiresConfirmation: boolean;
  requiresStrongConfirmation: boolean;
  confirmationText?: string;
  actionToken: string;
}
```

`actionToken` is an HMAC-signed compact payload using an existing server secret such as `JWT_SECRET` or a dedicated `WENDY_ADMIN_ACTION_SECRET`. Payload fields:

- `actionId`
- `toolName`
- `risk`
- `section`
- `adminUserId`
- `payload`
- `payloadHash`
- `expiresAt`
- `requestId`

Tokens expire quickly, with a default of 5 minutes. Confirmation must reject expired, tampered, user-mismatched, or tool-mismatched tokens.

## Confirmation Endpoint

`POST /api/admin/wendy/actions/confirm` accepts:

```ts
{
  actionToken: string;
  confirmationText?: string;
}
```

Flow:

1. Verify admin role.
2. Verify and decode token.
3. Check expiration and admin user binding.
4. Load action definition from the allowlist registry.
5. If high-risk, require exact `confirmationText`.
6. Write pre-execution audit log.
7. Execute named handler.
8. Write post-execution audit log with result status.
9. Return compact result for the action card.

No handler may accept arbitrary endpoints, shell commands, filesystem paths, or free-form bridge commands.

## Audit Logging

Every confirmed admin action writes audit data with:

- `userId`
- `toolName`
- `risk`
- `section`
- `payloadSummary`
- `confirmedAt`
- `requestId`
- `phase`: `before` or `after`
- `status`
- `errorCode`, when present

Prefer the existing audit log table and helpers already used by admin routes. If a helper is missing a field, add a small adapter that serializes the admin action payload into existing columns without requiring a broad schema migration for V1.

## Printing Press

Printing Press is available only when:

- `WENDY_ADMIN_PRINTING_PRESS_ENABLED=true`
- `PRINTING_PRESS_BRIDGE_URL` is configured
- Wendy Admin route is called by an admin
- The action is generated from a registered Printing Press admin tool
- Strong confirmation text is provided

The bridge contract should be narrow. V1 should allow named operations such as `generate_cli_from_spec` or `publish_generated_artifact`, each with validated parameters. Wendy Admin must not forward shell commands, arbitrary file paths, or arbitrary URLs.

If the bridge is missing or disabled, read tools can report that Printing Press is unavailable and write tools return a disabled action/error, not a partial execution.

## Frontend Architecture

### Admin Panel

Add `AdminWendyPanel` under the admin console feature or component tree. It uses:

```ts
useWendyChat({
  apiUrl: "/api/admin/wendy",
  restorePersisted: false
})
```

The panel is separate from the global Wendy provider and public SearchDialog state.

Desktop layout:

- Dock panel to the right of `AdminReviewShell`.
- Preserve the existing sidebar and main content.
- Add a compact header button to open and close the panel.
- Keep the panel width stable, with a practical range around 360-420px.

Mobile layout:

- Use a drawer or bottom sheet.
- Trigger from the admin header.
- Keep message list and composer usable within the viewport.

### Admin Context

Extend `useWendyChat` options with an optional `buildRequestContext` or `extraBody` callback so Admin Wendy can send `adminContext` without affecting public Wendy.

Admin context includes:

- current admin section
- selected entity when available
- filters for the current section
- compact visible state when useful

Keep the context small and serializable.

### Action Cards

Extend `useWendyActionExecutor` and `WendyActionCard`:

- Recognize action types beginning with `admin_`.
- Read `actionToken`, `requiresStrongConfirmation`, and `confirmationText`.
- Render a confirmation card.
- For high-risk actions, require the exact confirmation text before enabling execution.
- Confirm by calling `/api/admin/wendy/actions/confirm`.
- Invalidate admin React Query keys after successful admin actions.

Public Wendy actions continue using their existing endpoints and behavior.

## Security Rules

- Frontend hiding is convenience only; server authorization is authoritative.
- Public Wendy never imports or registers admin tools.
- Admin Wendy never executes writes during the chat tool-call phase.
- Every write action is server-signed and allowlisted.
- High-risk actions require strong confirmation and audit before/after execution.
- Printing Press bridge calls are named operations with validated payloads only.
- Maintenance mode must not block `/api/admin/wendy`.

## Testing Plan

### API Tests

- Unauthenticated `/api/admin/wendy` returns `401`.
- Authenticated non-admin `/api/admin/wendy` returns `403`.
- Admin `/api/admin/wendy` streams valid SSE.
- Public `/api/ai/wendy` does not expose admin tools.
- Admin read tool returns compact context.
- Admin write tool creates an action card and performs no write before confirmation.
- High-risk confirmation fails without exact strong confirmation text.
- Expired or tampered action tokens are rejected.
- Confirmed action writes before and after audit entries.

### Printing Press Tests

- Disabled when env or bridge URL is missing.
- Requires strong confirmation.
- Rejects non-allowlisted operation names.
- Does not accept shell, filesystem, or arbitrary command payloads.

### Frontend Tests

- Panel appears in admin console only.
- Header button opens and closes the panel.
- Mobile renders drawer or bottom sheet.
- Admin context is included in the request body.
- Admin action cards render confirmation controls.
- Strong confirmation gates high-risk execution.
- Cancel leaves action unchanged server-side.

### Regression Tests

- Public Wendy continues on `/api/ai/wendy`.
- SearchDialog global does not show admin tools.
- Existing public Wendy action cards still work.
- Maintenance mode does not block `/api/admin/wendy`.

## Rollout

Gate the feature with `WENDY_ADMIN_ENABLED=true`. When disabled, `/api/admin/wendy` should return a clear unavailable response for admins and should not register Printing Press actions.

Enable Printing Press separately with `WENDY_ADMIN_PRINTING_PRESS_ENABLED=true`.

## Implementation Notes

Implement in small test-first slices:

1. Admin request schema, route mount, auth behavior, and SSE skeleton.
2. Signed action token helpers and confirmation endpoint.
3. Admin registry with read tools and action-card generation.
4. Printing Press guarded high-risk handler.
5. Admin frontend panel and admin context request body.
6. Admin action card confirmation flow.
7. Regression tests for public Wendy isolation.
