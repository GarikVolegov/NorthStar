import { and, desc, eq, isNull } from "drizzle-orm";
import {
  certificationsTable,
  db,
  linkedinImportsTable,
  userProfileSettingsTable,
} from "@workspace/db";

export interface AggregateSkillSourcesInput {
  certificationSkills?: string[][];
  cvJson?: unknown;
  linkedinExtractedData?: unknown[];
}

interface SkillEntry {
  label: string;
  count: number;
  firstSeen: number;
}

export function normalizeSkillLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized.toLowerCase() : null;
}

function readableSkillLabel(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readSkillArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function extractCvSkills(cvJson: unknown): string[] {
  const record = asRecord(cvJson);
  if (!record) return [];
  const skills = [...readSkillArray(record.skills)];

  for (const key of ["experiences", "education"]) {
    const entries = Array.isArray(record[key]) ? record[key] : [];
    for (const entry of entries) {
      const item = asRecord(entry);
      if (item) skills.push(...readSkillArray(item.skills));
    }
  }

  return skills;
}

function extractLinkedInSkills(extractedData: unknown): string[] {
  const record = asRecord(extractedData);
  if (!record) return [];
  return readSkillArray(record.skills);
}

function addSkill(
  map: Map<string, SkillEntry>,
  value: string,
  firstSeen: number,
): void {
  const key = normalizeSkillLabel(value);
  if (!key) return;
  const existing = map.get(key);
  if (existing) {
    existing.count += 1;
    return;
  }
  map.set(key, {
    label: readableSkillLabel(value),
    count: 1,
    firstSeen,
  });
}

export function aggregateUserSkillsFromSources(input: AggregateSkillSourcesInput): string[] {
  const entries = new Map<string, SkillEntry>();
  let position = 0;

  for (const skills of input.certificationSkills ?? []) {
    for (const skill of skills) addSkill(entries, skill, position++);
  }

  for (const skill of extractCvSkills(input.cvJson)) {
    addSkill(entries, skill, position++);
  }

  for (const extractedData of input.linkedinExtractedData ?? []) {
    for (const skill of extractLinkedInSkills(extractedData)) {
      addSkill(entries, skill, position++);
    }
  }

  return [...entries.values()]
    .sort((a, b) => b.count - a.count || a.firstSeen - b.firstSeen || a.label.localeCompare(b.label))
    .map((entry) => entry.label);
}

export async function getUserSkills(userId: number): Promise<string[]> {
  const [certifications, profileRows, linkedinRows] = await Promise.all([
    db
      .select({ skills: certificationsTable.skills })
      .from(certificationsTable)
      .where(
        and(
          eq(certificationsTable.userId, userId),
          eq(certificationsTable.status, "active"),
          isNull(certificationsTable.deletedAt),
        ),
      )
      .orderBy(desc(certificationsTable.issuedDate), desc(certificationsTable.createdAt)),
    db
      .select({ cvJson: userProfileSettingsTable.cvJson })
      .from(userProfileSettingsTable)
      .where(eq(userProfileSettingsTable.userId, userId))
      .limit(1),
    db
      .select({ extractedData: linkedinImportsTable.extractedData })
      .from(linkedinImportsTable)
      .where(and(eq(linkedinImportsTable.userId, userId), isNull(linkedinImportsTable.deletedAt)))
      .orderBy(desc(linkedinImportsTable.createdAt)),
  ]);

  return aggregateUserSkillsFromSources({
    certificationSkills: certifications.map((row) => row.skills),
    cvJson: profileRows[0]?.cvJson,
    linkedinExtractedData: linkedinRows.map((row) => row.extractedData),
  });
}
