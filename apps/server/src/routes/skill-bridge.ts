import { Router } from "express";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { getSkillCooccurrenceRows } from "@workspace/ai-server";
import { db, professionsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { getUserSkills, normalizeSkillLabel } from "../services/user-skills-aggregator";

type Ring = 1 | 2 | 3;

export interface SkillBridgeFilters {
  sectorId?: number;
  minSalary?: number;
  workMode?: string;
  city?: string;
}

export interface SkillBridgeProfessionCandidate {
  id: number;
  title: string;
  sector: string;
  sectorId?: number | null;
  salaryRange: string;
  workModes: string[];
  skills: string[];
}

export interface SkillBridgeStore {
  getUserSkills(userId: number): Promise<string[]>;
  getRelatedSkills(skillName: string): Promise<string[]>;
  listProfessionCandidates(input: {
    skills: string[];
    filters: SkillBridgeFilters;
  }): Promise<SkillBridgeProfessionCandidate[]>;
}

export const dbSkillBridgeStore: SkillBridgeStore = {
  getUserSkills,
  async getRelatedSkills(skillName) {
    const rows = await getSkillCooccurrenceRows({ skillName, limit: 5 });
    return rows.map((row) => row.coSkillName);
  },
  async listProfessionCandidates({ skills, filters }) {
    const normalizedSkills = skills
      .map((skill) => normalizeSkillLabel(skill))
      .filter((skill): skill is string => Boolean(skill));
    const skillClauses = normalizedSkills.slice(0, 25).map((skill) => sql`${professionsTable.skills}::text ILIKE ${`%${skill}%`}`);

    const rows = await db
      .select({
        id: professionsTable.id,
        title: professionsTable.title,
        sector: professionsTable.sector,
        sectorId: professionsTable.sectorId,
        salaryRange: professionsTable.salaryRange,
        workModes: professionsTable.workModes,
        skills: professionsTable.skills,
      })
      .from(professionsTable)
      .where(
        and(
          eq(professionsTable.isActive, true),
          filters.sectorId ? eq(professionsTable.sectorId, filters.sectorId) : undefined,
          filters.workMode ? sql`${professionsTable.workModes}::text ILIKE ${`%${filters.workMode}%`}` : undefined,
          skillClauses.length > 0 ? or(...skillClauses) : undefined,
        ),
      )
      .orderBy(desc(professionsTable.updatedAt))
      .limit(100);

    return rows.filter((row) => {
      if (filters.minSalary && estimateMinSalary(row.salaryRange) < filters.minSalary) return false;
      return true;
    });
  },
};

function parseOptionalInt(value: unknown): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function parseFilters(query: Record<string, unknown>): SkillBridgeFilters {
  const filters: SkillBridgeFilters = {};
  const sectorId = parseOptionalInt(query.sectorId);
  const minSalary = parseOptionalInt(query.minSalary);
  if (sectorId !== undefined) filters.sectorId = sectorId;
  if (minSalary !== undefined) filters.minSalary = minSalary;
  if (typeof query.workMode === "string" && query.workMode.trim()) {
    filters.workMode = query.workMode.trim().toLowerCase();
  }
  if (typeof query.city === "string" && query.city.trim()) {
    filters.city = query.city.trim();
  }
  return filters;
}

function normalizedSet(skills: string[]): Set<string> {
  return new Set(skills.map((skill) => normalizeSkillLabel(skill)).filter((skill): skill is string => Boolean(skill)));
}

function ringForMissing(count: number): Ring {
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  return 3;
}

export function estimateMinSalary(salaryRange: string): number {
  const match = salaryRange.match(/\d+(?:[.,]\d+)?/);
  if (!match) return 0;
  const raw = match[0].replace(",", ".");
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return 0;
  if (/[kK]/.test(salaryRange) || parsed < 1000) return Math.round(parsed * 1000);
  return Math.round(parsed);
}

function distributeByRing<T extends { ring: Ring }>(items: T[], totalLimit = 30, ringLimit = 12): T[] {
  const result: T[] = [];
  for (const ring of [1, 2, 3] as const) {
    result.push(...items.filter((item) => item.ring === ring).slice(0, ringLimit));
  }
  return result.slice(0, totalLimit);
}

export async function buildSkillBridgeMap(input: {
  userId: number;
  userSkills: string[];
  relatedSkills: string[];
  candidates: SkillBridgeProfessionCandidate[];
  filters: SkillBridgeFilters;
}) {
  const coreSkills = input.userSkills.slice(0, 15);
  const coreSet = normalizedSet(coreSkills);

  const professions = input.candidates
    .map((profession) => {
      const overlapSkills = profession.skills.filter((skill) => {
        const normalized = normalizeSkillLabel(skill);
        return normalized ? coreSet.has(normalized) : false;
      });
      const missingSkills = profession.skills.filter((skill) => {
        const normalized = normalizeSkillLabel(skill);
        return normalized ? !coreSet.has(normalized) : true;
      });
      const overlapPercent = profession.skills.length > 0
        ? Math.round((overlapSkills.length / profession.skills.length) * 100)
        : 0;
      return {
        id: profession.id,
        title: profession.title,
        sector: profession.sector,
        salaryRange: profession.salaryRange,
        workModes: profession.workModes,
        overlapSkills,
        missingSkills,
        ring: ringForMissing(missingSkills.length),
        overlapPercent,
        learnTimeWeeks: missingSkills.length * 4,
      };
    })
    .sort((a, b) => a.ring - b.ring || b.overlapPercent - a.overlapPercent || a.title.localeCompare(b.title));

  return {
    center: {
      userId: input.userId,
      skills: coreSkills,
    },
    professions: distributeByRing(professions),
    filtersApplied: input.filters,
  };
}

export function createSkillBridgeRouter({ store = dbSkillBridgeStore }: { store?: SkillBridgeStore } = {}) {
  const router = Router();

  router.get("/", requireAuth, async (req, res) => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const filters = parseFilters(req.query);
    const userSkills = (await store.getUserSkills(userId)).slice(0, 15);
    if (userSkills.length === 0) {
      res.json({ center: { userId, skills: [] }, professions: [], filtersApplied: filters });
      return;
    }

    const relatedSkills = [
      ...new Set((await Promise.all(userSkills.map((skill) => store.getRelatedSkills(skill)))).flat()),
    ];
    const candidates = await store.listProfessionCandidates({
      skills: [...userSkills, ...relatedSkills],
      filters,
    });

    res.json(await buildSkillBridgeMap({ userId, userSkills, relatedSkills, candidates, filters }));
  });

  return router;
}

export function createMemorySkillBridgeStore(): SkillBridgeStore {
  const userSkills = ["SQL", "React", "Storytelling", "Python", "Dashboard"];
  const professions: SkillBridgeProfessionCandidate[] = [
    {
      id: 1,
      title: "Data Analyst",
      sector: "Tecnologia",
      sectorId: 1,
      salaryRange: "28.000 - 40.000 EUR",
      workModes: ["ibrido", "remote"],
      skills: ["SQL", "Dashboard", "Statistics"],
    },
    {
      id: 2,
      title: "Product Manager",
      sector: "Prodotto",
      sectorId: 2,
      salaryRange: "35.000 - 55.000 EUR",
      workModes: ["team", "remote"],
      skills: ["Storytelling", "Analytics", "Roadmap", "Stakeholder management"],
    },
    {
      id: 3,
      title: "Backend Developer",
      sector: "Tecnologia",
      sectorId: 1,
      salaryRange: "24.000 - 35.000 EUR",
      workModes: ["remote", "team"],
      skills: ["Node.js", "PostgreSQL", "API design", "Testing", "Cloud", "Security", "DevOps"],
    },
  ];

  return {
    async getUserSkills() {
      return userSkills;
    },
    async getRelatedSkills(skillName) {
      const related: Record<string, string[]> = {
        SQL: ["Statistics", "Analytics"],
        React: ["Node.js", "API design"],
        Storytelling: ["Stakeholder management", "Roadmap"],
      };
      return related[skillName] ?? [];
    },
    async listProfessionCandidates({ filters }) {
      return professions.filter((profession) => {
        if (filters.sectorId && profession.sectorId !== filters.sectorId) return false;
        if (filters.minSalary && estimateMinSalary(profession.salaryRange) < filters.minSalary) return false;
        if (filters.workMode && !profession.workModes.some((mode) => mode.toLowerCase() === filters.workMode)) return false;
        return true;
      });
    },
  };
}

export default createSkillBridgeRouter();
