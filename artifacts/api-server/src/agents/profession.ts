import type { Agent, AgentInput, AgentOutput } from "./types";
import { ProfessionInputSchema, ProfessionOutputSchema } from "./types";
import { RIASEC_LABELS, type RiasecType } from "../lib/riasec";
import { db, professionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

interface ProfessionTemplate {
  title: string;
  sector: string;
  riasecFit: RiasecType[];
  skills: string[];
  workModes: string[];
  salaryRange: string;
  growthOutlook: string;
}

const PROFESSION_FALLBACK: ProfessionTemplate[] = [
  { title: "Sviluppatore Software", sector: "tecnologia & software", riasecFit: ["I", "R"], skills: ["Programmazione", "Problem solving", "Debugging", "Git"], workModes: ["dipendente", "freelance", "autonomo"], salaryRange: "€30.000 – €65.000", growthOutlook: "Molto alto" },
  { title: "Data Analyst", sector: "data & analytics", riasecFit: ["I", "C"], skills: ["SQL", "Python", "Statistica", "Visualizzazione dati"], workModes: ["dipendente", "freelance"], salaryRange: "€28.000 – €55.000", growthOutlook: "Alto" },
  { title: "UX/UI Designer", sector: "design & creatività digitale", riasecFit: ["A", "I"], skills: ["Figma", "Ricerca utente", "Prototipazione", "CSS"], workModes: ["dipendente", "freelance"], salaryRange: "€25.000 – €50.000", growthOutlook: "Alto" },
  { title: "Marketing Manager", sector: "marketing & growth", riasecFit: ["E", "A"], skills: ["SEO/SEM", "Copywriting", "Analytics", "Social media"], workModes: ["dipendente"], salaryRange: "€28.000 – €55.000", growthOutlook: "Stabile" },
  { title: "Consulente Aziendale", sector: "consulenza & strategia", riasecFit: ["E", "I"], skills: ["Analisi strategica", "Project management", "Presentazione", "Excel"], workModes: ["dipendente", "autonomo"], salaryRange: "€35.000 – €80.000", growthOutlook: "Stabile" },
  { title: "Infermiere/a", sector: "salute & benessere", riasecFit: ["S", "R"], skills: ["Cura del paziente", "Procedure cliniche", "Lavoro di squadra"], workModes: ["dipendente"], salaryRange: "€25.000 – €42.000", growthOutlook: "Molto alto" },
  { title: "Insegnante", sector: "istruzione & formazione", riasecFit: ["S", "A"], skills: ["Comunicazione", "Progettazione didattica", "Gestione classe"], workModes: ["dipendente"], salaryRange: "€22.000 – €38.000", growthOutlook: "Stabile" },
  { title: "Imprenditore Digitale", sector: "business & imprenditoria", riasecFit: ["E", "A"], skills: ["Visione strategica", "Marketing", "Gestione risorse", "Vendita"], workModes: ["autonomo", "imprenditore"], salaryRange: "€20.000 – €100.000+", growthOutlook: "Variabile" },
  { title: "Ingegnere Gestionale", sector: "ingegneria & sistemi tecnici", riasecFit: ["R", "C"], skills: ["Lean manufacturing", "Project management", "Analisi processi"], workModes: ["dipendente"], salaryRange: "€30.000 – €58.000", growthOutlook: "Stabile" },
  { title: "Avvocato", sector: "legal tech & servizi legali digitali", riasecFit: ["E", "C"], skills: ["Diritto civile/penale", "Contrattualistica", "Negoziazione"], workModes: ["dipendente", "autonomo"], salaryRange: "€25.000 – €80.000+", growthOutlook: "Stabile" },
  { title: "Creativo/Content Creator", sector: "creatività & design", riasecFit: ["A", "E"], skills: ["Storytelling", "Video editing", "Social media", "Fotografia"], workModes: ["freelance", "autonomo"], salaryRange: "€15.000 – €60.000", growthOutlook: "Alto" },
  { title: "Ricercatore/Scienziato", sector: "biotech & life sciences", riasecFit: ["I", "R"], skills: ["Metodo scientifico", "Laboratorio", "Pubblicazioni", "Statistiche"], workModes: ["dipendente"], salaryRange: "€25.000 – €60.000", growthOutlook: "Alto" },
  { title: "HR Manager", sector: "risorse umane & people operations", riasecFit: ["S", "E"], skills: ["Selezione personale", "Formazione", "Relazioni sindacali"], workModes: ["dipendente"], salaryRange: "€28.000 – €55.000", growthOutlook: "Stabile" },
  { title: "Financial Analyst", sector: "finanza & investimenti", riasecFit: ["I", "C"], skills: ["Modellazione finanziaria", "Excel avanzato", "Bloomberg", "Valutazione"], workModes: ["dipendente"], salaryRange: "€30.000 – €70.000", growthOutlook: "Stabile" },
  { title: "Agronomo", sector: "agroalimentare & food industry", riasecFit: ["R", "I"], skills: ["Agronomia", "Sostenibilità", "Gestione terreni", "Normative"], workModes: ["dipendente", "autonomo"], salaryRange: "€22.000 – €45.000", growthOutlook: "Crescente" },
];

async function loadProfessions(): Promise<ProfessionTemplate[]> {
  try {
    const rows = await db.select().from(professionsTable).where(eq(professionsTable.isActive, true));
    if (rows.length === 0) return PROFESSION_FALLBACK;
    return rows.map((r) => ({
      title: r.title,
      sector: r.sector,
      riasecFit: (r.riasecFit ?? []) as RiasecType[],
      skills: r.skills ?? [],
      workModes: r.workModes ?? [],
      salaryRange: r.salaryRange,
      growthOutlook: r.growthOutlook,
    }));
  } catch {
    return PROFESSION_FALLBACK;
  }
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

      const templates = await loadProfessions();

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
