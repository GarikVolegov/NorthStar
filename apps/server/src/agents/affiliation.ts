import type { Agent, AgentInput, AgentOutput } from "./types";
import { AffiliationInputSchema, AffiliationOutputSchema } from "./types";
import { RIASEC_LABELS, type RiasecType } from "../lib/riasec";

export const affiliationAgent: Agent = {
  name: "AffiliationAgent",

  async run(input: AgentInput): Promise<AgentOutput> {
    try {
      const parsed = AffiliationInputSchema.safeParse(input.payload);
      if (!parsed.success) {
        return {
          agentName: this.name,
          success: false,
          data: {},
          error: `Invalid input: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
        };
      }

      const { primaryTypes, topSectors, institutionType } = parsed.data;
      const isPremium = input.context.plan === "premium";
      const institution = institutionType ?? "scuola";
      const primaryLabels = (primaryTypes ?? [])
        .map((t) => RIASEC_LABELS[t as RiasecType])
        .filter(Boolean) as string[];
      const topSectorNames = (topSectors ?? []).slice(0, 3).map((s) => s.sectorName);

      const cta = {
        scuola: {
          headline: "Orientamento professionale basato sul profilo RIASEC + Cinque Spiriti",
          subheadline: "Aiuta i tuoi studenti a scoprire il percorso giusto con NorthStar",
          body: `Questo studente ha un profilo ${primaryLabels.join(" + ")} con alta compatibilità nei settori: ${topSectorNames.join(", ")}.`,
          callToAction: "Richiedi una demo per la tua scuola",
          benefits: ["Test gratuito per tutti gli studenti", "Dashboard classe per i docenti", "Report personalizzati per ogni studente"],
        },
        università: {
          headline: "Career guidance avanzata per i tuoi studenti universitari",
          subheadline: "Integra NorthStar nel percorso di orientamento del tuo ateneo",
          body: `Profilo identificato: ${primaryLabels.join(" + ")}. Settori compatibili: ${topSectorNames.join(", ")}.`,
          callToAction: "Richiedi una partnership istituzionale",
          benefits: ["API di integrazione con i sistemi universitari", "Dati aggregati anonimizzati", "Personalizzazione del brand"],
        },
        agenzia: {
          headline: "Strumento professionale per consulenti di carriera",
          subheadline: "Arricchisci le tue sessioni di orientamento con dati oggettivi",
          body: `Report completo disponibile per il profilo ${primaryLabels.join(" + ")}.`,
          callToAction: "Inizia la prova gratuita per agenzie",
          benefits: ["Report PDF esportabili", "Dashboard multi-cliente", "Integrazione con CRM"],
        },
        azienda: {
          headline: "Selezione e sviluppo del talento con NorthStar",
          subheadline: "Identifica il fit culturale e professionale con dati oggettivi",
          body: `Profilo candidato: ${primaryLabels.join(" + ")}. Settori ideali: ${topSectorNames.join(", ")}.`,
          callToAction: "Contatta il team enterprise",
          benefits: ["Assessment per i candidati", "Matching con le posizioni aperte", "Report HR avanzati"],
        },
      } as const;

      const materials = cta[institution] ?? cta["scuola"];

      const output = {
        institution,
        materials,
        profileSummary: {
          primaryTypes,
          primaryLabels,
          topSectors: topSectorNames,
        },
        ...(isPremium
          ? {
              detailedReport: {
                riasecProfile: primaryLabels,
                sectorCompatibility: topSectorNames,
                recommendedActions: [
                  "Pianifica un colloquio di orientamento individuale",
                  "Proponi percorsi formativi nei settori identificati",
                  "Monitora i progressi con revisioni trimestrali",
                ],
              },
            }
          : {}),
      };

      const outputValidation = AffiliationOutputSchema.safeParse(output);
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
