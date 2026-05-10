import type { Agent, AgentInput, AgentOutput } from "./types";
import { EducationInputSchema, EducationOutputSchema } from "./types";
import { db, educationPathsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

type EducationPathType = "universitario" | "professionale" | "online" | "bootcamp";

async function loadEducationPaths() {
  const rows = await db.select().from(educationPathsTable).where(eq(educationPathsTable.isActive, true)).orderBy(educationPathsTable.id);
  return rows.map((r) => ({
    path: r.path,
    type: r.type as EducationPathType,
    duration: r.duration,
    cost: r.cost,
    steps: r.steps ?? [],
    careerOutcomes: r.careerOutcomes ?? [],
    sectorFit: r.sectorFit ?? [],
  }));
}

export const educationAgent: Agent = {
  name: "EducationAgent",

  async run(input: AgentInput): Promise<AgentOutput> {
    try {
      const parsed = EducationInputSchema.safeParse(input.payload);
      if (!parsed.success) {
        return {
          agentName: this.name,
          success: false,
          data: {},
          error: `Invalid input: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
        };
      }

      const { topSectors, professions } = parsed.data;
      const isPremium = input.context.plan === "premium";
      const limit = isPremium ? 4 : 2;

      let allPaths;
      try {
        allPaths = await loadEducationPaths();
      } catch (dbErr) {
        logger.error({ err: dbErr }, "[EducationAgent] DB query failed — no education paths available");
        return {
          agentName: this.name,
          success: false,
          data: { educationPaths: [] },
          error: "Impossibile caricare i percorsi formativi dal catalogo.",
        };
      }

      if (allPaths.length === 0) {
        return {
          agentName: this.name,
          success: true,
          data: { educationPaths: [] },
        };
      }

      const sectorKeywords = [
        ...(topSectors ?? []).map((s) => s.sectorName.toLowerCase()),
        ...(professions ?? []).map((p) => p.sector.toLowerCase()),
      ];

      let matched = allPaths.filter((ep) =>
        ep.sectorFit.some((sf) =>
          sectorKeywords.some((kw) => kw.includes(sf) || sf.includes(kw.split(" ")[0]!)),
        ),
      );

      if (matched.length === 0) matched = allPaths.slice(0, limit);

      const educationPaths = matched.slice(0, limit).map((ep) => ({
        path: ep.path,
        type: ep.type,
        duration: ep.duration,
        cost: ep.cost,
        steps: ep.steps,
        careerOutcomes: isPremium ? ep.careerOutcomes : ep.careerOutcomes.slice(0, 2),
      }));

      const output = { educationPaths };

      const outputValidation = EducationOutputSchema.safeParse(output);
      if (!outputValidation.success) {
        return {
          agentName: this.name,
          success: false,
          data: output,
          error: `Output validation failed: ${outputValidation.error.issues.map((i) => i.message).join(", ")}`,
          partial: true,
        };
      }

      return { agentName: this.name, success: true, data: output };
    } catch (err) {
      return {
        agentName: this.name,
        success: false,
        data: {},
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
