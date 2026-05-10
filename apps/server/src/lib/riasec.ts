export type RiasecType = "R" | "I" | "A" | "S" | "E" | "C";

export const RIASEC_LABELS: Record<RiasecType, string> = {
  R: "Realistico",
  I: "Investigativo",
  A: "Artistico",
  S: "Sociale",
  E: "Imprenditoriale",
  C: "Convenzionale",
};

export const RIASEC_DESCRIPTIONS: Record<RiasecType, string> = {
  R: "Pratico, concreto, orientato all'azione. Ama lavorare con le mani, strumenti e macchine.",
  I: "Curioso, analitico, intellettuale. Ama risolvere problemi complessi e fare ricerca.",
  A: "Creativo, espressivo, originale. Ama arte, musica, scrittura e design.",
  S: "Empatico, collaborativo, orientato alle persone. Ama aiutare, insegnare e curare.",
  E: "Ambizioso, persuasivo, leader. Ama vendere, negoziare e guidare progetti.",
  C: "Organizzato, preciso, metodico. Ama ordine, dati e procedure.",
};

export type WorkMode = "dipendente" | "autonomo" | "ibrido" | "unknown";

export const RIASEC_SUGGESTED_WORK_MODE: Record<RiasecType, WorkMode> = {
  E: "autonomo",
  A: "ibrido",
  I: "ibrido",
  R: "dipendente",
  S: "dipendente",
  C: "dipendente",
};

export interface QuestionMapping {
  id: string;
  type: RiasecType;
}

export const QUESTION_RIASEC_MAP: QuestionMapping[] = [
  { id: "q1", type: "R" },
  { id: "q2", type: "I" },
  { id: "q3", type: "A" },
  { id: "q4", type: "S" },
  { id: "q5", type: "E" },
  { id: "q6", type: "C" },
  { id: "q7", type: "R" },
  { id: "q8", type: "I" },
  { id: "q9", type: "A" },
  { id: "q10", type: "S" },
  { id: "q11", type: "E" },
  { id: "q12", type: "C" },
];

export function computeRiasecScores(
  answers: Record<string, number>,
): Record<RiasecType, number> {
  const scores: Record<RiasecType, number> = {
    R: 0,
    I: 0,
    A: 0,
    S: 0,
    E: 0,
    C: 0,
  };

  for (const mapping of QUESTION_RIASEC_MAP) {
    const val = answers[mapping.id];
    if (val != null) {
      scores[mapping.type] += val;
    }
  }

  return scores;
}

export function getPrimaryTypes(
  scores: Record<RiasecType, number>,
  topN = 2,
): RiasecType[] {
  return (Object.entries(scores) as [RiasecType, number][])
    .sort(([, a], [, b]) => b - a)
    .slice(0, topN)
    .map(([type]) => type);
}

export function buildProfileSummary(primaryTypes: RiasecType[]): string {
  const labels = primaryTypes.map((t) => RIASEC_LABELS[t]);
  const descriptions = primaryTypes.map((t) => RIASEC_DESCRIPTIONS[t]);

  return `Profilo ${labels.join(" + ")}: ${descriptions[0]} Al tempo stesso, ${descriptions[1]?.toLowerCase() ?? ""}`;
}

export function getSuggestedWorkMode(primaryTypes: RiasecType[]): WorkMode {
  if (primaryTypes.length === 0) return "ibrido";
  const dominant = primaryTypes[0];
  return RIASEC_SUGGESTED_WORK_MODE[dominant] ?? "ibrido";
}

export function applyWorkModeBoost(
  baseScore: number,
  userWorkPreference: WorkMode | null | undefined,
  sectorWorkModes: Array<"dipendente" | "autonomo" | "ibrido"> | null | undefined,
): number {
  if (!userWorkPreference || userWorkPreference === "unknown") return baseScore;
  if (!sectorWorkModes || sectorWorkModes.length === 0) return baseScore;

  if (userWorkPreference === "ibrido") {
    // ibrido users get full boost only for sectors explicitly tagged ibrido;
    // partial boost for dipendente/autonomo sectors (they are compatible but not ideal)
    if (sectorWorkModes.includes("ibrido")) {
      return Math.min(99, baseScore + 5);
    }
    return Math.min(99, baseScore + 2);
  }

  const hasMatch = sectorWorkModes.some((mode) => mode === userWorkPreference);

  if (hasMatch) {
    return Math.min(99, baseScore + 5);
  }
  return Math.max(55, baseScore - 5);
}

export function computeMatchScore(
  scores: Record<RiasecType, number>,
  sectorRiasecTypes: string[],
): number {
  const total = Object.values(scores).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;

  let matchSum = 0;
  for (const type of sectorRiasecTypes) {
    const score = scores[type as RiasecType] ?? 0;
    matchSum += score;
  }

  const maxPossible = sectorRiasecTypes.length * 10;
  const rawMatch = maxPossible > 0 ? (matchSum / maxPossible) * 100 : 0;
  return Math.min(99, Math.max(45, Math.round(rawMatch)));
}

// ─── Journey-type & career-goal scoring ──────────────────────────────────────

export type JourneyType = "indeciso" | "dipendente" | "autonomo" | "azienda" | "investitore";

/** RIASEC types that naturally align with each journey persona */
export const JOURNEY_RIASEC_AFFINITY: Record<JourneyType, RiasecType[]> = {
  indeciso:    [],
  dipendente:  ["S", "C", "R"],
  autonomo:    ["E", "A", "I"],
  azienda:     ["E", "C", "I"],
  investitore: ["E", "I", "C"],
};

/** Sector-name keywords strongly associated with each journey persona */
export const JOURNEY_SECTOR_KEYWORDS: Record<JourneyType, string[]> = {
  indeciso:    [],
  dipendente:  ["salute", "istruzione", "sanità", "risorse umane", "logistica", "agroalimentare"],
  autonomo:    ["business", "imprenditoria", "creatività", "design", "marketing", "gaming", "turismo"],
  azienda:     ["business", "consulenza", "marketing", "e-commerce", "logistica", "legal"],
  investitore: ["finanza", "fintech", "immobiliare", "data", "biotech", "green"],
};

/**
 * Applies a small boost (max +5 pts) based on how well the sector matches
 * the user's declared journey persona via RIASEC affinity + keyword overlap.
 */
export function applyJourneyTypeBoost(
  baseScore: number,
  journeyType: JourneyType | null | undefined,
  sectorName: string,
  sectorRiasecTypes: string[],
): number {
  if (!journeyType || journeyType === "indeciso") return baseScore;
  const affinity = JOURNEY_RIASEC_AFFINITY[journeyType] ?? [];
  const riasecOverlap = sectorRiasecTypes.filter((t) => affinity.includes(t as RiasecType)).length;
  const keywords = JOURNEY_SECTOR_KEYWORDS[journeyType] ?? [];
  const nameLC = sectorName.toLowerCase();
  const keywordMatch = keywords.some((kw) => nameLC.includes(kw));
  let boost = 0;
  if (riasecOverlap >= 2) boost += 3;
  else if (riasecOverlap === 1) boost += 1;
  if (keywordMatch) boost += 2;
  return Math.min(99, baseScore + boost);
}

/**
 * Boosts sectors whose trend matches the user's career-goal intent.
 * "nuovo_percorso" users favour booming/growing sectors (+2 pts).
 * "scala_esistente" users favour stable/growing sectors (+2 pts).
 */
export function applyCareerGoalBoost(
  baseScore: number,
  careerGoal: "nuovo_percorso" | "scala_esistente" | "aperto",
  trend: string | null | undefined,
): number {
  if (careerGoal === "aperto" || !trend) return baseScore;
  if (careerGoal === "nuovo_percorso" && (trend === "booming" || trend === "growing")) {
    return Math.min(99, baseScore + 2);
  }
  if (careerGoal === "scala_esistente" && (trend === "stable" || trend === "growing")) {
    return Math.min(99, baseScore + 2);
  }
  return baseScore;
}

export function buildMatchReason(
  primaryTypes: RiasecType[],
  sectorName: string,
  sectorRiasecTypes: string[],
): string {
  const overlap = primaryTypes.filter((t) =>
    sectorRiasecTypes.includes(t),
  );

  if (overlap.length > 0) {
    const labels = overlap.map((t) => RIASEC_LABELS[t].toLowerCase());
    return `Il tuo profilo ${labels.join(" e ")} si allinea perfettamente con le richieste del settore ${sectorName}.`;
  }

  return `Le tue attitudini ti portano naturalmente verso il settore ${sectorName}, con ottime possibilità di crescita.`;
}
