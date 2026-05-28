/**
 * discovery-nudge executor — routine quotidiana (60s) per il percorso "indeciso".
 *
 * Sceglie l'azione di scoperta migliore in base al gap del Commitment Readiness:
 *   - se manca self_knowledge → propone test/Career DNA
 *   - se manca emotion       → propone mood checkin
 *   - se manca reflection    → propone diario indizi
 *   - se manca exploration   → propone settore
 *   - se manca commitment    → propone sessione socratica
 *
 * Parameters (UserRoutine.parameters):
 *   { tone?: "soft" | "diretto" }  // default "soft"
 */
import { getReadinessForDashboard } from "../../services/discovery-engine/index.js";
import { rootLogger } from "../../middleware/logger.js";
import type { RoutineExecutor, RoutineResult } from "../routine-types.js";

const log = rootLogger.child({ module: "executor:discovery-nudge" });

const FALLBACK_NUDGE = {
  component: "emotion",
  toolHref: "/mood",
  message: "Fai un check-in mood: 60 secondi per sapere dove sei oggi.",
};

const COMPONENT_TITLES: Record<string, string> = {
  selfKnowledge: "Conosci te stesso",
  emotion:       "Ascolta come stai",
  reflection:    "Cattura un indizio",
  exploration:   "Esplora un settore",
  commitment:    "Fai chiarezza con Wendy",
};

const TONE_LINES: Record<"soft" | "diretto", string> = {
  soft:    "Nessuna pressione — fai solo questa piccola cosa se ti va.",
  diretto: "Una cosa concreta, oggi. 5 minuti.",
};

export const discoveryNudgeExecutor: RoutineExecutor = async (routine, user): Promise<RoutineResult> => {
  const params = routine.parameters as { tone?: "soft" | "diretto" };
  const tone = params?.tone ?? "soft";

  try {
    const readiness = await getReadinessForDashboard(user.id);
    const nudge = readiness.nextNudge ?? FALLBACK_NUDGE;

    const componentTitle = COMPONENT_TITLES[nudge.component] ?? "Una piccola scoperta";

    const body = [
      `**${componentTitle}**`,
      "",
      nudge.message,
      "",
      `_${TONE_LINES[tone]}_`,
      "",
      `Readiness attuale: **${readiness.score.toFixed(0)}/100** (${readiness.band === "low" ? "esplorazione" : readiness.band === "mid" ? "messa a fuoco" : "scelta vicina"}).`,
    ].join("\n");

    return {
      title:     `🧭 Prossimo passo: ${componentTitle.toLowerCase()}`,
      body,
      ctaLabel:  "Vai allo strumento",
      ctaTarget: nudge.toolHref,
      metadata:  {
        readinessScore: readiness.score,
        band: readiness.band,
        component: nudge.component,
        toolHref: nudge.toolHref,
      },
    };
  } catch (err) {
    log.warn({ err, routineId: routine.id }, "[discovery-nudge] executor failed, using fallback");
    return {
      title:     "🧭 Una piccola scoperta",
      body:      "Oggi prova a notare un momento in cui hai sentito energia o curiosità. Anche solo per 30 secondi.",
      ctaLabel:  "Apri il diario",
      ctaTarget: "/diario?mode=indizi",
      metadata:  { fallback: true, error: String(err) },
    };
  }
};
