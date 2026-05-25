import { z } from "zod";
import { PREMIUM_REMINDER_MINUTES } from "./CalendarioEventoModal.reminders";

export const eventFormSchema = z.object({
  title: z.string().min(1, "Titolo obbligatorio").max(200),
  description: z.string().max(2000).optional(),
  startDate: z.string().min(1, "Data obbligatoria"),
  startTime: z.string().optional(),
  endDate: z.string().min(1, "Data obbligatoria"),
  endTime: z.string().optional(),
  allDay: z.boolean().default(false),
  category: z.enum([
    "study",
    "training",
    "interview",
    "deadline",
    "task",
    "follow-up",
  ] as const),
  priority: z.enum(["low", "medium", "high"] as const),
  status: z.enum(["todo", "in-progress", "done", "postponed"] as const),
  linkedGoal: z.string().max(500).optional(),
  linkedSectorId: z.string().optional(),
});

export type EventFormValues = z.infer<typeof eventFormSchema>;

export function buildCalendarEventPayload(
  values: EventFormValues,
  reminderToggles: Record<number, boolean>,
) {
  const localToUtc = (date: string, time: string) =>
    new Date(`${date}T${time || "00:00"}`).toISOString();

  const startAt = values.allDay
    ? `${values.startDate}T00:00:00.000Z`
    : localToUtc(values.startDate, values.startTime || "00:00");
  const endAt = values.allDay
    ? `${values.endDate}T23:59:59.000Z`
    : localToUtc(values.endDate, values.endTime || "23:59");

  const reminders = PREMIUM_REMINDER_MINUTES.filter(
    (minutes) => reminderToggles[minutes],
  ).map((minutes) => ({ minutesBefore: minutes, enabled: true }));

  return {
    title: values.title,
    description: values.description || null,
    startAt,
    endAt,
    allDay: values.allDay,
    category: values.category,
    priority: values.priority,
    status: values.status,
    linkedGoal: values.linkedGoal || null,
    linkedSectorId: values.linkedSectorId
      ? parseInt(values.linkedSectorId, 10)
      : null,
    reminders,
  };
}
