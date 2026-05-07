/**
 * Shared WebSocket event schemas — used by both the Node.js server
 * (lib/ws-server) and the React client (lib/api-client-react).
 *
 * Every event follows the discriminated union pattern:
 *   { type: "namespace:action", payload: ... }
 *
 * Add new events here and import them in both server and client.
 */
import { z } from "zod/v4";

// ─── Notification events ──────────────────────────────────────────────────

export const NotificationLogSchema = z.object({
  id: z.number(),
  userId: z.number(),
  eventId: z.number().nullable(),
  channel: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  isRead: z.boolean(),
  sentAt: z.string(),
  openedAt: z.string().nullable(),
});

export const WsNotificationNewEvent = z.object({
  type: z.literal("notification:new"),
  payload: NotificationLogSchema,
});

export const WsNotificationReadEvent = z.object({
  type: z.literal("notification:read"),
  payload: z.object({ id: z.number() }),
});

export const WsNotificationReadAllEvent = z.object({
  type: z.literal("notification:read_all"),
  payload: z.object({ userId: z.number() }),
});

// ─── Calendar events ──────────────────────────────────────────────────────

export const CalendarEventSchema = z.object({
  id: z.number(),
  userId: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  startAt: z.string(),
  endAt: z.string(),
  allDay: z.boolean(),
  category: z.string(),
  priority: z.string(),
  status: z.string(),
  color: z.string().nullable(),
  tags: z.array(z.string()),
  linkedSectorId: z.number().nullable(),
  linkedGoal: z.string().nullable(),
  linkedContentIds: z.array(z.number()),
  isRecurring: z.boolean(),
  recurrenceRule: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const WsCalendarCreatedEvent = z.object({
  type: z.literal("calendar:created"),
  payload: CalendarEventSchema,
});

export const WsCalendarUpdatedEvent = z.object({
  type: z.literal("calendar:updated"),
  payload: CalendarEventSchema,
});

export const WsCalendarDeletedEvent = z.object({
  type: z.literal("calendar:deleted"),
  payload: z.object({ id: z.number() }),
});

export const WsCalendarReminderEvent = z.object({
  type: z.literal("calendar:reminder"),
  payload: z.object({
    eventId: z.number(),
    eventTitle: z.string(),
    startAt: z.string(),
    minutesBefore: z.number(),
  }),
});

// ─── Agent / AI streaming events ─────────────────────────────────────────

export const WsAgentRunStartedEvent = z.object({
  type: z.literal("agent:run_started"),
  payload: z.object({ agentName: z.string(), runId: z.number() }),
});

export const WsAgentRunCompletedEvent = z.object({
  type: z.literal("agent:run_completed"),
  payload: z.object({
    agentName: z.string(),
    runId: z.number(),
    durationMs: z.number().nullable(),
  }),
});

export const WsAgentRunErrorEvent = z.object({
  type: z.literal("agent:run_error"),
  payload: z.object({
    agentName: z.string(),
    runId: z.number(),
    error: z.string(),
  }),
});

// ─── Objectives / progress events ────────────────────────────────────────

export const WsObjectiveProgressEvent = z.object({
  type: z.literal("objective:progress"),
  payload: z.object({
    objectiveId: z.number(),
    progress: z.number(),
    completed: z.boolean(),
  }),
});

// ─── Knowledge graph events ───────────────────────────────────────────────

export const WsKnowledgeNodeUpsertedEvent = z.object({
  type: z.literal("knowledge:node_upserted"),
  payload: z.object({ id: z.number(), title: z.string(), type: z.string() }),
});

export const WsKnowledgeNodeDeletedEvent = z.object({
  type: z.literal("knowledge:node_deleted"),
  payload: z.object({ id: z.number() }),
});

// ─── Ping / Pong (keep-alive) ─────────────────────────────────────────────

export const WsPingEvent = z.object({ type: z.literal("ping") });
export const WsPongEvent = z.object({ type: z.literal("pong") });

// ─── Server → Client union ────────────────────────────────────────────────

export const ServerWsEvent = z.discriminatedUnion("type", [
  WsNotificationNewEvent,
  WsNotificationReadEvent,
  WsNotificationReadAllEvent,
  WsCalendarCreatedEvent,
  WsCalendarUpdatedEvent,
  WsCalendarDeletedEvent,
  WsCalendarReminderEvent,
  WsAgentRunStartedEvent,
  WsAgentRunCompletedEvent,
  WsAgentRunErrorEvent,
  WsObjectiveProgressEvent,
  WsKnowledgeNodeUpsertedEvent,
  WsKnowledgeNodeDeletedEvent,
  WsPongEvent,
]);

export type ServerWsEvent = z.infer<typeof ServerWsEvent>;

// ─── Client → Server union ────────────────────────────────────────────────

export const ClientWsEvent = z.discriminatedUnion("type", [WsPingEvent]);
export type ClientWsEvent = z.infer<typeof ClientWsEvent>;
