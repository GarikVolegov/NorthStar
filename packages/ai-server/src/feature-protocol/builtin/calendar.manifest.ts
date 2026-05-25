import type { FeatureManifest } from "../types";

export const calendarFeatureManifest: FeatureManifest = {
  id: "calendar",
  name: "Calendario",
  owner: "full-stack",
  status: "protocol",
  webRoutes: [
    {
      path: "/calendario",
      auth: "authenticated",
      title: "Calendario",
      smoke: true,
    },
  ],
  apiRoutes: [
    {
      method: "GET",
      path: "/api/calendar/events",
      auth: "authenticated",
      schema: "CalendarEventsQuerySchema",
      smoke: true,
    },
    {
      method: "POST",
      path: "/api/calendar/events",
      auth: "authenticated",
      schema: "CalendarEventCreateSchema",
      smoke: true,
    },
    {
      method: "PATCH",
      path: "/api/calendar/events/:id",
      auth: "authenticated",
      schema: "CalendarEventUpdateSchema",
      smoke: true,
    },
    {
      method: "DELETE",
      path: "/api/calendar/events/:id",
      auth: "authenticated",
      schema: "CalendarEventDeleteSchema",
      smoke: true,
    },
  ],
  wendyTools: [
    {
      name: "add_calendar_event",
      description: "Prepara e crea un evento nel calendario dell'utente tramite WendyAction.",
      policy: "write",
      risk: "medium",
      requiresConfirmation: true,
      inputSchema: "AddCalendarEventInput",
      outputSchema: "WendyAction<CreateCalendarEventPayload>",
      telemetry: "wendy.calendar.create_event",
    },
    {
      name: "open_view:calendar",
      description: "Porta l'utente alla pagina calendario quando Wendy deve mostrare o far completare un evento.",
      policy: "navigate",
      risk: "low",
      requiresConfirmation: false,
      inputSchema: "OpenViewInput",
      outputSchema: "WendyAction<NavigatePayload>",
      telemetry: "wendy.calendar.navigate",
    },
  ],
  telemetry: [
    "calendar.events.list",
    "calendar.events.create",
    "calendar.events.update",
    "calendar.events.delete",
    "wendy.calendar.create_event",
  ],
  smoke: ["calendar:list", "calendar:create-preview", "wendy:create-calendar-event-preview"],
  migrations: ["calendar_events_table"],
  tests: [
    "apps/server/src/routes/calendar.test.ts",
    "packages/ai-server/src/__tests__/wendy-actions.test.ts",
    "apps/web/src/hooks/useWendyActionExecutor.test.ts",
  ],
};
