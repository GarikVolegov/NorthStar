import type { Agent, AgentInput, AgentOutput } from "./types";
import { WorkModeInputSchema, WorkModeOutputSchema } from "./types";
import { RIASEC_LABELS, type RiasecType } from "../lib/riasec";

const WORK_MODE_PROFILES: Record<string, {
  label: string;
  description: string;
  pros: string[];
  cons: string[];
  idealRiasec: RiasecType[];
  salaryModifier: string;
}> = {
  dipendente: {
    label: "Lavoro Dipendente",
    description: "Contratto di lavoro con un datore, stipendio fisso, benefit aziendali.",
    pros: ["Stabilità economica", "Benefit (ferie, malattia, pensione)", "Struttura e routine", "Crescita interna definita"],
    cons: ["Minore autonomia decisionale", "Crescita salariale più lenta", "Dipendenza dall'azienda"],
    idealRiasec: ["C", "S", "R"],
    salaryModifier: "Stabile, con progressione graduale",
  },
  autonomo: {
    label: "Lavoro Autonomo / Freelance",
    description: "Partita IVA o libero professionista, clienti multipli, tariffe orarie.",
    pros: ["Libertà di scelta dei clienti", "Flessibilità oraria", "Potenziale di guadagno elevato", "Varietà di progetti"],
    cons: ["Reddito variabile", "Gestione fiscale e amministrativa", "Nessun benefit fisso", "Acquisizione clienti continua"],
    idealRiasec: ["E", "A", "I"],
    salaryModifier: "Variabile, alto potenziale",
  },
  imprenditore: {
    label: "Imprenditoria",
    description: "Fondazione di una propria azienda, team, prodotto o servizio.",
    pros: ["Massima autonomia", "Impatto diretto sui risultati", "Costruzione di valore patrimoniale", "Visione a lungo termine"],
    cons: ["Rischio finanziario elevato", "Responsabilità totale", "Stress e incertezza iniziale", "Sacrifici personali"],
    idealRiasec: ["E", "A", "R"],
    salaryModifier: "Alto rischio, alto potenziale",
  },
  ibrido: {
    label: "Modello Ibrido",
    description: "Combina lavoro dipendente part-time con attività autonoma o progetti collaterali.",
    pros: ["Sicurezza economica di base", "Sperimentazione senza rischio totale", "Diversificazione del reddito"],
    cons: ["Gestione del tempo complessa", "Doppi adempimenti fiscali", "Fatica da carico doppio"],
    idealRiasec: ["E", "I", "C"],
    salaryModifier: "Stabile + variabile complementare",
  },
};

export const workModeAgent: Agent = {
  name: "WorkModeAgent",

  async run(input: AgentInput): Promise<AgentOutput> {
    try {
      const parsed = WorkModeInputSchema.safeParse(input.payload);
      if (!parsed.success) {
        return {
          agentName: this.name,
          success: false,
          data: {},
          error: `Invalid input: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
        };
      }

      const { primaryTypes, preference, topSectors } = parsed.data;
      const isPremium = input.context.plan === "premium";

      const scores: Record<string, number> = {};
      for (const [mode, profile] of Object.entries(WORK_MODE_PROFILES)) {
        const overlap = (primaryTypes ?? []).filter((t) =>
          profile.idealRiasec.includes(t as RiasecType),
        ).length;
        scores[mode] = overlap;
      }

      const recommended =
        preference && WORK_MODE_PROFILES[preference]
          ? preference
          : Object.entries(scores).sort(([, a], [, b]) => b - a)[0]![0];

      const comparison: Record<string, unknown> = {};
      for (const [mode, profile] of Object.entries(WORK_MODE_PROFILES)) {
        comparison[mode] = {
          label: profile.label,
          description: profile.description,
          pros: isPremium ? profile.pros : profile.pros.slice(0, 2),
          cons: isPremium ? profile.cons : profile.cons.slice(0, 1),
          salaryModifier: profile.salaryModifier,
          fit: scores[mode] === 2 ? "Ottimo" : scores[mode] === 1 ? "Buono" : "Neutro",
          isRecommended: mode === recommended,
        };
      }

      const topSectorNames = (topSectors ?? []).slice(0, 2).map((s) => s.sectorName);
      const riasecFit = (primaryTypes ?? []).map((t) => RIASEC_LABELS[t as RiasecType]).join(" + ");

      const output = {
        recommended,
        recommendedLabel: WORK_MODE_PROFILES[recommended]?.label ?? recommended,
        riasecFit,
        comparison,
        ...(isPremium
          ? {
              contextualAdvice: `Con un profilo ${riasecFit} e settori come ${topSectorNames.join(", ")}, il modello ${WORK_MODE_PROFILES[recommended]?.label} ti permette di esprimere al meglio le tue attitudini.`,
            }
          : {}),
      };

      const outputValidation = WorkModeOutputSchema.safeParse(output);
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
        data: {},
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
};
