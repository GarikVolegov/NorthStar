import type { Agent, AgentInput, AgentOutput } from "./types";
import { PersonalityInputSchema, PersonalityOutputSchema } from "./types";
import {
  RIASEC_LABELS,
  RIASEC_DESCRIPTIONS,
  getPrimaryTypes,
  type RiasecType,
} from "../lib/riasec";
import {
  SPIRIT_META,
  getDominantSpirit,
  getSecondarySpiritS,
  buildSpiritInsight,
} from "../lib/spirits";

const RIASEC_STRENGTHS: Record<RiasecType, string[]> = {
  R: ["Lavoro pratico e concreto", "Abilità manuali e tecniche", "Problem solving operativo"],
  I: ["Analisi critica e ricerca", "Risoluzione di problemi complessi", "Pensiero scientifico"],
  A: ["Creatività e originalità", "Espressione artistica", "Pensiero non convenzionale"],
  S: ["Empatia e relazione", "Comunicazione interpersonale", "Lavoro in team"],
  E: ["Leadership e iniziativa", "Persuasione e negoziazione", "Visione strategica"],
  C: ["Organizzazione e metodo", "Attenzione ai dettagli", "Affidabilità e precisione"],
};

const RIASEC_ATTENTION: Record<RiasecType, string[]> = {
  R: ["Tendenza ad evitare attività teoriche o astratte", "Difficoltà in contesti molto sociali"],
  I: ["Possibile isolamento nelle attività solitarie", "Difficoltà nelle decisioni rapide"],
  A: ["Resistenza alle strutture rigide", "Difficoltà in ambienti molto convenzionali"],
  S: ["Difficoltà nel prendere decisioni dure", "Possibile trascuratezza dei propri bisogni"],
  E: ["Tendenza all'impazienza", "Possibile scarsa attenzione ai dettagli"],
  C: ["Difficoltà nell'improvvisazione", "Possibile rigidità al cambiamento"],
};

export const personalityAgent: Agent = {
  name: "PersonalityAgent",

  async run(input: AgentInput): Promise<AgentOutput> {
    try {
      const parsed = PersonalityInputSchema.safeParse(input.payload);
      if (!parsed.success) {
        return {
          agentName: this.name,
          success: false,
          data: {},
          error: `Invalid input: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
        };
      }

      const { riasecScores, spiritScores, primaryTypes: existingPrimary } = parsed.data;
      const isPremium = input.context.plan === "premium";

      const primaryTypes: RiasecType[] =
        (existingPrimary as RiasecType[] | undefined) ??
        getPrimaryTypes(riasecScores as Record<RiasecType, number>);

      const strengths = primaryTypes.flatMap((t) => RIASEC_STRENGTHS[t] ?? []);
      const attentionAreas = isPremium
        ? primaryTypes.flatMap((t) => RIASEC_ATTENTION[t] ?? [])
        : primaryTypes.slice(0, 1).flatMap((t) => RIASEC_ATTENTION[t] ?? []).slice(0, 1);

      const predispositions = primaryTypes.map((t) => ({
        type: t,
        label: RIASEC_LABELS[t],
        description: RIASEC_DESCRIPTIONS[t],
      }));

      const spiritData =
        spiritScores && Object.keys(spiritScores).length > 0
          ? (() => {
              const dominant = getDominantSpirit(spiritScores);
              const secondary = getSecondarySpiritS(spiritScores);
              const insight = buildSpiritInsight(dominant, secondary, spiritScores);
              const dominantMeta = SPIRIT_META[dominant as keyof typeof SPIRIT_META];
              const secondaryMeta = SPIRIT_META[secondary as keyof typeof SPIRIT_META];
              return { dominant, secondary, insight, dominantMeta, secondaryMeta };
            })()
          : undefined;

      const output = {
        primaryTypes,
        predispositions,
        strengths: isPremium ? strengths : strengths.slice(0, 2),
        attentionAreas,
        spiritProfile: spiritData,
        summary: `Profilo ${primaryTypes.map((t) => RIASEC_LABELS[t]).join(" + ")}`,
      };

      const outputValidation = PersonalityOutputSchema.safeParse(output);
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
