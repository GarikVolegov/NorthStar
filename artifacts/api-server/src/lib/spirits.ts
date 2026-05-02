export const SPIRIT_KEYS = ["shen", "hun", "po", "yi", "zhi"] as const;
export type SpiritKey = typeof SPIRIT_KEYS[number];

export const SPIRIT_META: Record<SpiritKey, { name: string; emoji: string; description: string }> = {
  shen: { name: "Presenza", emoji: "✨", description: "Coscienza, presenza e chiarezza emotiva" },
  hun:  { name: "Visione",  emoji: "🌙", description: "Visione, immaginazione e direzione futura" },
  po:   { name: "Istinto",  emoji: "⚡", description: "Istinto, energia corporea e percezione immediata" },
  yi:   { name: "Focus",    emoji: "🔮", description: "Concentrazione, logica, memoria e analisi" },
  zhi:  { name: "Tenacia",  emoji: "🔥", description: "Volontà, resilienza e capacità di portare a termine" },
};

export const SECTOR_SPIRIT_WEIGHTS: Record<string, Partial<Record<SpiritKey, number>>> = {
  "tecnologia & software":                   { yi: 0.9, zhi: 0.8, hun: 0.4 },
  "salute & benessere":                      { shen: 0.9, po: 0.7, yi: 0.4 },
  "creatività & design":                     { hun: 0.9, shen: 0.6, po: 0.4 },
  "business & imprenditoria":                { zhi: 0.9, hun: 0.8, shen: 0.4 },
  "tecnologia & digitale":                   { yi: 0.9, zhi: 0.8, hun: 0.5 },
  "cybersecurity":                           { yi: 0.9, zhi: 0.9, po: 0.4 },
  "data & analytics":                        { yi: 1.0, zhi: 0.7, po: 0.3 },
  "fintech":                                 { yi: 0.8, zhi: 0.9, hun: 0.5 },
  "green economy & sostenibilità":           { po: 0.7, zhi: 0.8, shen: 0.6 },
  "sanità & healthcare digitale":            { shen: 0.9, yi: 0.6, po: 0.5 },
  "istruzione & formazione":                 { shen: 0.9, hun: 0.6, yi: 0.6 },
  "marketing & growth":                      { hun: 0.9, shen: 0.5, zhi: 0.6 },
  "e-commerce & retail digitale":            { hun: 0.6, zhi: 0.7, yi: 0.5 },
  "logistica & supply chain":                { yi: 0.7, zhi: 0.8, po: 0.5 },
  "ingegneria & sistemi tecnici":            { yi: 0.9, zhi: 0.8, po: 0.6 },
  "turismo & hospitality":                   { shen: 0.8, po: 0.6, hun: 0.5 },
  "consulenza & strategia":                  { yi: 0.9, zhi: 0.7, hun: 0.6 },
  "risorse umane & people operations":       { shen: 0.9, yi: 0.6, zhi: 0.5 },
  "design & creatività digitale":            { hun: 0.9, shen: 0.6, po: 0.4 },
  "immobiliare & property":                  { zhi: 0.8, yi: 0.6, po: 0.5 },
  "agroalimentare & food industry":          { po: 0.7, zhi: 0.6, shen: 0.5 },
  "gaming & esports":                        { hun: 0.9, po: 0.7, zhi: 0.6 },
  "legal tech & servizi legali digitali":    { yi: 0.9, zhi: 0.8, shen: 0.4 },
  "biotech & life sciences":                 { yi: 1.0, zhi: 0.9, po: 0.4 },
  "finanza & investimenti":                  { yi: 0.9, zhi: 0.9, hun: 0.3 },
};

/**
 * Extracts spirit scores from answers.
 * New format (3 questions per spirit): shen_1, shen_2, shen_3 → averaged.
 * Legacy format (1 question): shen, hun, po, yi, zhi → used directly.
 */
export function extractSpiritAnswers(answers: Record<string, number>): Record<string, number> {
  const result: Record<string, number> = {};
  for (const key of SPIRIT_KEYS) {
    const subs = [answers[`${key}_1`], answers[`${key}_2`], answers[`${key}_3`]].filter((v) => v != null);
    if (subs.length > 0) {
      const avg = subs.reduce((a, b) => a + b, 0) / subs.length;
      result[key] = Math.round(avg * 10) / 10;
    } else if (key in answers) {
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

export function computeSpiritBoost(spiritScores: Record<string, number>, sectorName: string): number {
  const weights = SECTOR_SPIRIT_WEIGHTS[sectorName.toLowerCase()];
  if (!weights || Object.keys(spiritScores).length === 0) return 0;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const [spirit, weight] of Object.entries(weights)) {
    const score = spiritScores[spirit] ?? 0;
    const normalised = (score - 1) / 4;
    weightedSum += normalised * (weight as number);
    totalWeight += weight as number;
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 5);
}

// Rich combination-based insights (dominant × secondary)
const COMBO_INSIGHTS: Record<string, Record<string, string>> = {
  shen: {
    hun: "La tua coscienza emotiva alimenta una visione autentica del futuro. Eccelli in ruoli dove la sensibilità umana si unisce alla creatività e alla leadership visionaria.",
    po:  "Sei profondamente in contatto con te stesso, sia emotivamente che istintivamente. Ambienti relazionali e pratici ti valorizzano al massimo.",
    yi:  "Combini presenza emotiva e precisione analitica: capisci le persone e sai strutturare soluzioni concrete per loro con grande efficacia.",
    zhi: "La tua consapevolezza emotiva è sostenuta da una forte determinazione. Non solo capisci le situazioni — le affronti con costanza e chiarezza di intenti.",
  },
  hun: {
    shen: "La tua visione del futuro è profondamente umana e sensibile. Sei un innovatore che non perde mai di vista le persone e i loro bisogni.",
    po:   "Immagini grandi cose e hai l'energia per iniziarle. Il tuo punto di forza è trasformare l'entusiasmo creativo in azione concreta e tangibile.",
    yi:   "Combini visione creativa e rigore analitico: non solo immagini soluzioni nuove, ma sai strutturarle con precisione metodica.",
    zhi:  "Sei un visionario determinato: hai la capacità di immaginare il futuro e la forza di costruirlo passo dopo passo, senza mollare.",
  },
  po: {
    shen: "Il tuo istinto è guidato da una forte intelligenza emotiva. Sei una persona autentica, radicata e profondamente presente in ogni momento.",
    hun:  "La tua energia si sposa con una visione chiara. Sei mosso dall'entusiasmo e sai dove vuoi arrivare, con una forza che ispira chi ti circonda.",
    yi:   "Combini intuizione rapida e analisi profonda: vedi le cose in modo diretto e sai anche valutarle con metodo prima di agire.",
    zhi:  "Hai un'energia istintiva potenziata da una volontà di ferro. Quando qualcosa ti appassiona, vai avanti senza fermarti.",
  },
  yi: {
    shen: "La tua mente analitica è arricchita da una forte consapevolezza emotiva. Capisci i dati e le persone con la stessa profondità e cura.",
    hun:  "Analisi e visione si combinano in te in modo potente. Sai leggere la realtà con precisione e immaginare scenari futuri innovativi.",
    po:   "La tua mente logica è supportata da un istinto forte. Elabori velocemente e agisci con una precisione che raramente sbaglia.",
    zhi:  "Sei l'archetipo dello stratega: mente affilata e volontà incrollabile. Eccelli in percorsi tecnici e sfide di lungo periodo.",
  },
  zhi: {
    shen: "La tua determinazione è radicata nella consapevolezza. Non ti muovi solo per ambizione, ma per valori profondi che ti danno direzione duratura.",
    hun:  "Sei un costruttore di visioni: immagini grandi obiettivi e hai la resilienza per raggiungerli nel tempo, anche quando le cose si fanno difficili.",
    po:   "La tua volontà è fisica, concreta, istintiva. Quando decidi di fare qualcosa, corpo e mente sono perfettamente allineati e nulla ti ferma.",
    yi:   "Sei un esecutore preciso e determinato. La tua combinazione di analisi e perseveranza ti rende eccellente nei percorsi tecnici e strutturati.",
  },
};

const DOMINANT_FALLBACK: Record<string, string> = {
  shen: "La tua forte coscienza emotiva ti rende eccellente in ambienti relazionali, di cura e leadership umana.",
  hun:  "La tua visione e immaginazione ti spingono verso creatività, innovazione e percorsi imprenditoriali.",
  po:   "La tua energia istintiva e corporea ti rende ideale per ambienti pratici, operativi e concreti.",
  yi:   "La tua mente analitica e la tua concentrazione ti rendono perfetto per lavori basati su dati, logica e metodo.",
  zhi:  "La tua volontà e resilienza ti permettono di eccellere in percorsi a lungo termine che richiedono disciplina.",
};

/**
 * Builds a personalized spirit insight string.
 * When spiritScores is provided, detects balance/polarization for richer output.
 */
export function buildSpiritInsight(
  dominant: string,
  secondary: string,
  spiritScores?: Record<string, number>,
): string {
  if (spiritScores && Object.keys(spiritScores).length === 5) {
    const values = Object.values(spiritScores);
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min;

    if (range <= 0.8) {
      return "La tua Bussola Interiore è straordinariamente equilibrata: tutti e cinque gli spiriti sono attivi in modo armonico. Hai capacità di presenza, visione, istinto, analisi e determinazione tutte allo stesso livello. Questa versatilità è un punto di forza raro: ti permette di adattarti con naturalezza a contesti professionali molto diversi tra loro.";
    }

    if (range >= 2.5) {
      const dominantMeta = SPIRIT_META[dominant as SpiritKey];
      const lowestKey = Object.entries(spiritScores).sort(([, a], [, b]) => a - b)[0][0];
      const lowestMeta = SPIRIT_META[lowestKey as SpiritKey];
      return `Il tuo spirito dominante ${dominantMeta?.emoji ?? ""} ${dominantMeta?.name ?? dominant} emerge con grande forza rispetto agli altri. Il contrasto con ${lowestMeta?.name ?? lowestKey} suggerisce un profilo molto focalizzato: dai il meglio di te quando puoi esprimere pienamente la tua energia principale, in ambienti che la valorizzano e la mettono al centro.`;
    }
  }

  const combo = COMBO_INSIGHTS[dominant]?.[secondary];
  if (combo) return combo;

  return DOMINANT_FALLBACK[dominant] ?? "Il tuo profilo interiore è unico e complesso.";
}
