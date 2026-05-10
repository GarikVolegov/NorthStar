import type { Agent, AgentInput, AgentOutput } from "./types";
import { SectorInputSchema, SectorOutputSchema } from "./types";
import { db, sectorsTable } from "@workspace/db";
import { computeMatchScore, buildMatchReason, type RiasecType } from "../lib/riasec";
import { computeSpiritBoost } from "../lib/spirits";

export const sectorAgent: Agent = {
  name: "SectorAgent",

  async run(input: AgentInput): Promise<AgentOutput> {
    try {
      const parsed = SectorInputSchema.safeParse(input.payload);
      if (!parsed.success) {
        return {
          agentName: this.name,
          success: false,
          data: {},
          error: `Invalid input: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
        };
      }

      const { riasecScores, spiritScores, primaryTypes, preferences } = parsed.data;
      const isPremium = input.context.plan === "premium";
      const sectors = await db.select().from(sectorsTable);
      const limit = isPremium ? 5 : 3;

      const scored = sectors
        .map((sector) => {
          const baseScore = computeMatchScore(
            riasecScores as Record<RiasecType, number>,
            sector.riasecTypes as string[],
          );
          const spiritBoost = spiritScores ? computeSpiritBoost(spiritScores, sector.name) : 0;
          const matchScore = Math.min(99, baseScore + spiritBoost);
          const motivation = buildMatchReason(
            primaryTypes as RiasecType[],
            sector.name,
            sector.riasecTypes as string[],
          );

          return {
            sectorId: sector.id,
            sectorName: sector.name,
            icon: sector.icon,
            color: sector.color,
            matchScore,
            motivation,
            trend: sector.trend,
            growthRate: sector.growthRate,
            automationRisk: sector.automationRisk,
            avgSalaryMin: sector.avgSalaryMin,
            avgSalaryMax: sector.avgSalaryMax,
          };
        })
        .sort((a, b) => b.matchScore - a.matchScore);

      const filtered = preferences?.avoidHigh
        ? scored.filter((s) => s.automationRisk !== "high")
        : scored;

      const results = preferences?.preferGrowth
        ? filtered.sort((a, b) => b.growthRate - a.growthRate).slice(0, limit)
        : filtered.slice(0, limit);

      const output = { sectors: results, total: sectors.length };

      const outputValidation = SectorOutputSchema.safeParse(output);
      if (!outputValidation.success) {
        return {
          agentName: this.name,
          success: false,
          data: output,
          error: `Output validation failed: ${outputValidation.error.issues.map((i) => i.message).join(", ")}`,
          partial: true,
        };
      }

      return {
        agentName: this.name,
        success: true,
        data: output,
      };
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
