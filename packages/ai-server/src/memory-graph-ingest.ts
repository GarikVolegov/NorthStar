import { and, desc, eq, isNull } from "drizzle-orm";
import {
  businessIdeasTable,
  calendarEventsTable,
  coachMemoryFactsTable,
  coachMemoryPatternsTable,
  db,
  userObjectivesTable,
  userProfileSettingsTable,
} from "@workspace/db";
import type { IngestCandidate } from "./memory-graph";

function compactText(value: unknown, max = 1400): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim().slice(0, max);
  try {
    return JSON.stringify(value).slice(0, max);
  } catch {
    return String(value).slice(0, max);
  }
}

export async function collectIngestCandidates(userId: number): Promise<IngestCandidate[]> {
  const [ideas, objectives, events, profile, facts, patterns] = await Promise.all([
    db
      .select()
      .from(businessIdeasTable)
      .where(and(eq(businessIdeasTable.userId, userId), isNull(businessIdeasTable.deletedAt)))
      .limit(100),
    db
      .select()
      .from(userObjectivesTable)
      .where(and(eq(userObjectivesTable.userId, userId), isNull(userObjectivesTable.deletedAt)))
      .limit(100),
    db.select().from(calendarEventsTable).where(eq(calendarEventsTable.userId, userId)).orderBy(desc(calendarEventsTable.startAt)).limit(100),
    db.select().from(userProfileSettingsTable).where(eq(userProfileSettingsTable.userId, userId)).limit(1),
    db
      .select()
      .from(coachMemoryFactsTable)
      .where(and(eq(coachMemoryFactsTable.userId, userId), isNull(coachMemoryFactsTable.deletedAt)))
      .limit(100),
    db
      .select()
      .from(coachMemoryPatternsTable)
      .where(and(eq(coachMemoryPatternsTable.userId, userId), isNull(coachMemoryPatternsTable.deletedAt)))
      .limit(100),
  ]);

  const candidates: IngestCandidate[] = [];
  for (const idea of ideas) {
    candidates.push({
      type: "concept",
      title: idea.title || "Idea",
      content: compactText({ pitch: idea.ideaText, status: idea.status, score: idea.validationScore, validationData: idea.validationData }),
      sourceEntityType: "business_idea",
      sourceEntityId: String(idea.id),
      sourceType: "business_idea",
      url: `/validatore-idea?ideaId=${idea.id}`,
      importance: idea.status === "validated" ? 0.9 : 0.65,
      confidence: 0.9,
    });
  }
  for (const objective of objectives) {
    candidates.push({
      type: "concept",
      title: objective.text.slice(0, 120),
      content: compactText({
        text: objective.text,
        category: objective.category,
        progress: objective.progress,
        dueDate: objective.dueDate,
        completed: objective.completed,
      }),
      sourceEntityType: "objective",
      sourceEntityId: String(objective.id),
      sourceType: "objective",
      url: "/dashboard",
      importance: objective.completed ? 0.45 : 0.75,
      confidence: 0.9,
    });
  }
  for (const event of events) {
    candidates.push({
      type: "note",
      title: event.title,
      content: compactText({
        title: event.title,
        description: event.description,
        startAt: event.startAt,
        endAt: event.endAt,
        category: event.category,
        priority: event.priority,
        status: event.status,
        tags: event.tags,
      }),
      sourceEntityType: "calendar_event",
      sourceEntityId: String(event.id),
      sourceType: "calendar",
      url: "/calendario",
      importance: event.status === "done" ? 0.35 : 0.6,
      confidence: 0.86,
    });
  }
  const profileRow = profile[0];
  if (profileRow) {
    candidates.push({
      type: "note",
      title: "Profilo e preferenze",
      content: compactText({
        bio: profileRow.bio,
        city: profileRow.city,
        userMode: profileRow.userMode,
        horizon: profileRow.horizon,
        wendyTonePreference: profileRow.wendyTonePreference,
        workPreference: profileRow.workPreference,
      }),
      sourceEntityType: "profile",
      sourceEntityId: String(userId),
      sourceType: "profile",
      url: "/profilo#impostazioni",
      importance: 0.7,
      confidence: 0.88,
    });
  }
  for (const fact of facts) {
    candidates.push({
      type: "note",
      title: `Wendy ricorda: ${fact.key}`,
      content: fact.value,
      sourceEntityType: "wendy_fact",
      sourceEntityId: String(fact.id),
      sourceType: "wendy_memory",
      url: "/memoria-wendy",
      importance: Math.min(0.95, 0.5 + fact.confirmedCount * 0.08),
      confidence: Math.min(0.95, 0.65 + fact.confirmedCount * 0.06),
    });
  }
  for (const pattern of patterns) {
    candidates.push({
      type: "concept",
      title: `Pattern Wendy: ${pattern.patternType}`,
      content: pattern.description,
      sourceEntityType: "wendy_pattern",
      sourceEntityId: String(pattern.id),
      sourceType: "wendy_memory",
      url: "/memoria-wendy",
      importance: Math.min(0.95, 0.55 + pattern.observedCount * 0.05),
      confidence: pattern.confidence,
    });
  }
  return candidates;
}
