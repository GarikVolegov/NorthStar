import type { Agent, AgentInput, AgentOutput } from "./types";
import { ProfessionInputSchema, ProfessionOutputSchema } from "./types";
import { RIASEC_LABELS, type RiasecType } from "../lib/riasec";
import { db, professionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

async function loadProfessions() {
  const rows = await db.select().from(professionsTable).where(eq(professionsTable.isActive, true)).orderBy(professionsTable.id);
  return rows.map((r) => ({
    title: r.title,
    sector: r.sector,
    riasecFit: (r.riasecFit ?? []) as RiasecType[],
    skills: r.skills ?? [],
    workModes: r.workModes ?? [],
    salaryRange: r.salaryRange,
    growthOutlook: r.growthOutlook,
  }));
}

export const professionAgent: Agent = {
  name: "ProfessionAgent",

  async run(input: AgentInput): Promise<AgentOutput> {
    try {
      const parsed = ProfessionInputSchema.safeParse(input.payload);
      if (!parsed.success) {
        return {
          agentName: this.name,
          success: false,
          data: {},
          error: `Invalid input: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
        };
      }

      const { primaryTypes, topSectors, workModePreference } = parsed.data;
      const isPremium = input.context.plan === "premium";
      const limit = isPremium ? 6 : 3;
      const sectorNames = (topSectors ?? []).map((s) => s.sectorName.toLowerCase());

      let templates;
      try {
        templates = await loadProfessions();
      } catch (dbErr) {
        logger.error({ err: dbErr }, "[ProfessionAgent] DB query failed — no professions available");
        return {
          agentName: this.name,
          success: false,
          data: { professions: [] },
          error: "Impossibile caricare le professioni dal catalogo.",
        };
      }

      if (templates.length === 0) {
        return {
          agentName: this.name,
          success: true,
          data: { professions: [] },
        };
      }

      let candidates = templates.filter((p) => {
        const riasecMatch = p.riasecFit.some((r) => primaryTypes.includes(r));
        const sectorMatch =
          sectorNames.length === 0 ||
          sectorNames.some((s) => p.sector.includes(s) || s.includes(p.sector.split(" ")[0]!));
        return riasecMatch || sectorMatch;
      });

      if (workModePreference && workModePreference !== "any") {
        const modeFiltered = candidates.filter((p) => p.workModes.includes(workModePreference));
        if (modeFiltered.length >= 2) candidates = modeFiltered;
      }

      const professions = candidates.slice(0, limit).map((p) => ({
        title: p.title,
        sector: p.sector,
        skills: isPremium ? p.skills : p.skills.slice(0, 2),
        workModes: p.workModes,
        salaryRange: p.salaryRange,
        growthOutlook: p.growthOutlook,
        riasecAlignment: p.riasecFit.map((r) => RIASEC_LABELS[r]).join(", "),
        advantages:
          workModePreference === "autonomo"
            ? ["Massima flessibilità oraria", "Potenziale di guadagno elevato"]
            : ["Stabilità contrattuale", "Benefit aziendali"],
        disadvantages:
          workModePreference === "autonomo"
            ? ["Reddito variabile", "Gestione fiscale autonoma"]
            : ["Minore flessibilità", "Crescita più lenta"],
      }));

      const output = { professions };

      const outputValidation = ProfessionOutputSchema.safeParse(output);
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
