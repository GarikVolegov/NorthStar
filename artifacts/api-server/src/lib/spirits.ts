export const SPIRIT_KEYS = ["shen", "hun", "po", "yi", "zhi"] as const;
export type SpiritKey = typeof SPIRIT_KEYS[number];

export const SPIRIT_META: Record<SpiritKey, { name: string; emoji: string; description: string }> = {
  shen: {
    name: "Shen",
    emoji: "✨",
    description: "Coscienza, presenza e chiarezza emotiva",
  },
  hun: {
    name: "Hun",
    emoji: "🌙",
    description: "Visione, immaginazione e direzione futura",
  },
  po: {
    name: "Po",
    emoji: "⚡",
    description: "Istinto, energia corporea e percezione immediata",
  },
  yi: {
    name: "Yi",
    emoji: "🔮",
    description: "Concentrazione, logica, memoria e analisi",
  },
  zhi: {
    name: "Zhi",
    emoji: "🔥",
    description: "Volontà, resilienza e capacità di portare a termine",
  },
};

// Spirit weights per sector name (lowercase match). Values 0-1.
// Higher = stronger alignment.
export const SECTOR_SPIRIT_WEIGHTS: Record<string, Partial<Record<SpiritKey, number>>> = {
  "tecnologia & software": { yi: 0.9, zhi: 0.8, hun: 0.4 },
  "salute & benessere": { shen: 0.9, po: 0.7, yi: 0.4 },
  "creatività & design": { hun: 0.9, shen: 0.6, po: 0.4 },
  "business & imprenditoria": { zhi: 0.9, hun: 0.8, shen: 0.4 },
  "educazione & formazione": { shen: 0.9, yi: 0.7, hun: 0.4 },
  "finanza & investimenti": { yi: 0.9, zhi: 0.9, hun: 0.3 },
};

export function extractSpiritAnswers(answers: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const key of SPIRIT_KEYS) {
    if (key in answers) {
      result[key] = answers[key];
    }
  }
  return result;
}

export function getDominantSpirit(spiritScores: Record<string, number>): string {
  const entries = Object.entries(spiritScores);
  if (entries.length === 0) return "";
  return entries.sort(([, a], [, b]) => b - a)[0][0];
}

export function getSecondarySpiritS(spiritScores: Record<string, number>): string {
  const entries = Object.entries(spiritScores);
  if (entries.length < 2) return "";
  return entries.sort(([, a], [, b]) => b - a)[1][0];
}

/**
 * Returns a boost (0-5 points) added to a sector's match score based on spirit alignment.
 */
export function computeSpiritBoost(
  spiritScores: Record<string, number>,
  sectorName: string,
): number {
  const weights = SECTOR_SPIRIT_WEIGHTS[sectorName.toLowerCase()];
  if (!weights || Object.keys(spiritScores).length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const [spirit, weight] of Object.entries(weights)) {
    const score = spiritScores[spirit] ?? 0; // 1-5
    const normalised = (score - 1) / 4; // 0-1
    weightedSum += normalised * weight;
    totalWeight += weight;
  }

  if (totalWeight === 0) return 0;
  const alignment = weightedSum / totalWeight; // 0-1
  return Math.round(alignment * 5); // max +5 pts
}

export function buildSpiritInsight(dominant: string, secondary: string): string {
  const dominantInsights: Record<string, string> = {
    shen: "La tua forte coscienza emotiva ti rende eccellente in ambienti relazionali, di cura e leadership umana.",
    hun: "La tua visione e immaginazione ti spingono verso creatività, innovazione e percorsi imprenditoriali.",
    po: "La tua energia istintiva e corporea ti rende ideale per ambienti pratici, operativi e concreti.",
    yi: "La tua mente analitica e la tua concentrazione ti rendono perfetto per lavori basati su dati, logica e metodo.",
    zhi: "La tua volontà e resilienza ti permettono di eccellere in percorsi a lungo termine che richiedono disciplina.",
  };

  const secondaryAddons: Record<string, string> = {
    shen: "La tua sensibilità aggiunge profondità umana alle tue competenze.",
    hun: "La tua visione creativa arricchisce il tuo approccio.",
    po: "La tua energia pratica ti aiuta a passare subito all'azione.",
    yi: "La tua capacità analitica raffina le tue decisioni.",
    zhi: "La tua determinazione assicura che porti i progetti a termine.",
  };

  const base = dominantInsights[dominant] ?? "";
  const addon = secondary && secondaryAddons[secondary] ? ` ${secondaryAddons[secondary]}` : "";
  return base + addon;
}
