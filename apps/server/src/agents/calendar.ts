import type { Agent, AgentInput, AgentOutput } from "./types";
import { CalendarInputSchema, CalendarOutputSchema } from "./types";
import { db, calendarEventsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

interface CalendarEventTemplate {
  title: string;
  description: string;
  category: string;
  offsetDays: number;
  durationMinutes: number;
  linkedGoal?: string;
}

function buildEventTemplates(
  educationPaths: Array<{ path: string }>,
  professions: Array<{ title: string }>,
  primaryTypes: string[],
): CalendarEventTemplate[] {
  const events: CalendarEventTemplate[] = [
    {
      title: "Esplora il tuo percorso formativo",
      description: "Dedica 30 minuti a ricercare le opzioni formative più adatte al tuo profilo.",
      category: "formazione",
      offsetDays: 1,
      durationMinutes: 30,
      linkedGoal: "formazione",
    },
    {
      title: "Aggiorna il tuo CV",
      description: "Rivedi e aggiorna il tuo curriculum con le nuove competenze identificate.",
      category: "carriera",
      offsetDays: 3,
      durationMinutes: 60,
      linkedGoal: "cv",
    },
    {
      title: "Ricerca opportunità lavorative",
      description: "Esplora le offerte di lavoro nei settori compatibili con il tuo profilo.",
      category: "lavoro",
      offsetDays: 7,
      durationMinutes: 45,
      linkedGoal: "lavoro",
    },
  ];

  if (educationPaths.length > 0) {
    events.push({
      title: `Approfondisci: ${educationPaths[0]!.path}`,
      description: `Ricerca dettagliata sul percorso formativo "${educationPaths[0]!.path}".`,
      category: "formazione",
      offsetDays: 5,
      durationMinutes: 45,
      linkedGoal: educationPaths[0]!.path,
    });
  }

  if (professions.length > 0) {
    events.push({
      title: `Professione target: ${professions[0]!.title}`,
      description: `Studia i requisiti e le competenze necessarie per diventare ${professions[0]!.title}.`,
      category: "carriera",
      offsetDays: 10,
      durationMinutes: 30,
      linkedGoal: professions[0]!.title,
    });
  }

  if (primaryTypes.includes("S") || primaryTypes.includes("E")) {
    events.push({
      title: "Networking professionale",
      description: "Partecipa a un evento o contatta 3 professionisti del tuo settore target.",
      category: "networking",
      offsetDays: 14,
      durationMinutes: 60,
      linkedGoal: "networking",
    });
  }

  return events;
}

export const calendarAgent: Agent = {
  name: "CalendarAgent",

  async run(input: AgentInput): Promise<AgentOutput> {
    try {
      const parsed = CalendarInputSchema.safeParse(input.payload);
      if (!parsed.success) {
        return {
          agentName: this.name,
          success: false,
          data: { suggestedEvents: [], count: 0, persisted: false },
          error: `Invalid input: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
        };
      }

      const { primaryTypes, educationPaths, professions } = parsed.data;
      const isPremium = input.context.plan === "premium";
      const userId = input.context.userId;
      const now = new Date();

      const templates = buildEventTemplates(
        educationPaths ?? [],
        professions ?? [],
        primaryTypes ?? [],
      );

      const limit = isPremium ? templates.length : 3;
      const selectedTemplates = templates.slice(0, limit);

      if (userId) {
        // Deduplication: skip titles that already exist for this user tagged as northstar-agent
        // within the last 7 days to prevent spamming duplicate events on repeated calls
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const existingEvents = await db
          .select({ title: calendarEventsTable.title })
          .from(calendarEventsTable)
          .where(
            and(
              eq(calendarEventsTable.userId, userId),
              sql`${calendarEventsTable.tags} @> ARRAY['northstar-agent']::text[]`,
              sql`${calendarEventsTable.createdAt} >= ${sevenDaysAgo.toISOString()}`,
            ),
          );

        const existingTitles = new Set(existingEvents.map((e) => e.title));
        const newTemplates = selectedTemplates.filter((t) => !existingTitles.has(t.title));

        if (newTemplates.length === 0) {
          // All events already exist — return existing ones without re-inserting
          const recentEvents = await db
            .select()
            .from(calendarEventsTable)
            .where(
              and(
                eq(calendarEventsTable.userId, userId),
                sql`${calendarEventsTable.tags} @> ARRAY['northstar-agent']::text[]`,
                sql`${calendarEventsTable.createdAt} >= ${sevenDaysAgo.toISOString()}`,
              ),
            );

          const output = {
            suggestedEvents: recentEvents.slice(0, limit).map((e) => ({
              id: e.id,
              title: e.title,
              description: e.description ?? undefined,
              category: e.category,
              startAt: e.startAt.toISOString(),
              endAt: e.endAt.toISOString(),
              linkedGoal: e.linkedGoal ?? undefined,
              persisted: true,
            })),
            count: recentEvents.length,
            persisted: true,
          };

          const outputValidation = CalendarOutputSchema.safeParse(output);
          return {
            agentName: this.name,
            success: true,
            data: outputValidation.success ? outputValidation.data : output,
          };
        }

        // Insert only new (non-duplicate) events
        const insertedEvents = await db
          .insert(calendarEventsTable)
          .values(
            newTemplates.map((t) => {
              const startAt = new Date(now);
              startAt.setDate(startAt.getDate() + t.offsetDays);
              const endAt = new Date(startAt);
              endAt.setMinutes(endAt.getMinutes() + t.durationMinutes);
              return {
                userId,
                title: t.title,
                description: t.description,
                startAt,
                endAt,
                category: t.category,
                priority: "medium" as const,
                status: "todo" as const,
                linkedGoal: t.linkedGoal,
                tags: ["northstar-agent"],
              };
            }),
          )
          .returning();

        const output = {
          suggestedEvents: insertedEvents.map((e) => ({
            id: e.id,
            title: e.title,
            description: e.description ?? undefined,
            category: e.category,
            startAt: e.startAt.toISOString(),
            endAt: e.endAt.toISOString(),
            linkedGoal: e.linkedGoal ?? undefined,
            persisted: true,
          })),
          count: insertedEvents.length,
          persisted: true,
        };

        const outputValidation = CalendarOutputSchema.safeParse(output);
        if (!outputValidation.success) {
          return {
            agentName: this.name,
            success: true,
            data: output,
            partial: true,
          };
        }

        return {
          agentName: this.name,
          success: true,
          data: outputValidation.data,
        };
      }

      // No userId — return suggested (non-persisted) events
      const suggestedEvents = selectedTemplates.map((t, i) => {
        const startAt = new Date(now);
        startAt.setDate(startAt.getDate() + t.offsetDays);
        const endAt = new Date(startAt);
        endAt.setMinutes(endAt.getMinutes() + t.durationMinutes);
        return {
          id: `suggested-${Date.now()}-${i}`,
          title: t.title,
          description: t.description,
          category: t.category,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          linkedGoal: t.linkedGoal,
          persisted: false,
        };
      });

      const output = { suggestedEvents, count: suggestedEvents.length, persisted: false };

      const outputValidation = CalendarOutputSchema.safeParse(output);
      if (!outputValidation.success) {
        return {
          agentName: this.name,
          success: true,
          data: output,
          partial: true,
        };
      }

      return {
        agentName: this.name,
        success: true,
        data: outputValidation.data,
      };
    } catch (err) {
      return {
        agentName: this.name,
        success: false,
        data: { suggestedEvents: [], count: 0, persisted: false },
        error: err instanceof Error ? err.message : String(err),
        partial: true,
      };
    }
  },
};
