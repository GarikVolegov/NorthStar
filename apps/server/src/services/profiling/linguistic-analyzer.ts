/**
 * linguistic-analyzer.ts — Motore di inferenza NLP per profilo Big Five
 *
 * Analizza il testo delle conversazioni utente con Wendy (coach_sessions)
 * per estrarre segnali linguistici proxy dei Big Five (OCEAN).
 *
 * Approccio LIWC-proxy per italiano:
 * Invece di usare dizionari LIWC proprietari, utilizziamo liste di parole
 * e pattern costruiti su ricerca NLP (Mairesse et al., 2007; Yarkoni, 2010)
 * adattate all'italiano.
 *
 * Mappatura segnali → Big Five:
 * - questionRatio ↑       → Openness ↑ (curiosità, esplorazione)
 * - uncertaintyMarkers ↑  → Neuroticism ↑ (ansia, indecisione)
 * - negativeEmotionWords ↑→ Neuroticism ↑ (stress, paura)
 * - socialWordUsage ↑     → Agreeableness ↑, Extraversion ↑
 * - futureOrientation ↑   → Conscientiousness ↑ (pianificazione)
 * - abstractionLevel ↑    → Openness ↑ (pensiero astratto)
 * - autonomyLanguage ↑    → Extraversion ↑, low Agreeableness (assertività)
 *
 * Privacy:
 * - Analizza SOLO messaggi con role="user"
 * - Non persiste testo grezzo — solo metriche numeriche aggregate
 * - Richiede consent "linguistic" attivo per l'utente
 *
 * Nota: questo è un proxy statistico, non una misurazione diretta.
 * Confidence massima 0.65 (non supera quiz esplicito al 0.85).
 */

export interface LinguisticSignals {
  /** Ratio domande/totale-frasi (0-1). Proxy: Openness ↑ */
  questionRatio: number;
  /** % frasi con marker di incertezza (0-1). Proxy: Neuroticism ↑ */
  uncertaintyMarkers: number;
  /** % parole a valenza negativa sul totale parole (0-1). Proxy: Neuroticism ↑ */
  negativeEmotionWords: number;
  /** % parole sociali sul totale parole (0-1). Proxy: Agreeableness ↑, Extraversion ↑ */
  socialWordUsage: number;
  /** % verbi/riferimenti al futuro (0-1). Proxy: Conscientiousness ↑ */
  futureTemporalFocus: number;
  /** Livello di astrazione (sillabe medie per parola, normalizzato 0-1). Proxy: Openness ↑ */
  abstractionLevel: number;
  /** % frasi con linguaggio di autonomia/controllo (0-1). Proxy: basso Agreeableness */
  autonomyLanguage: number;
  /** Numero di parole totali analizzate */
  totalWords: number;
  /** Numero di frasi totali analizzate */
  totalSentences: number;
}

export interface OceanInference {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  /** Confidence 0-1. Dipende da totalWords: < 200 parole → bassa confidence */
  confidence: number;
}

// ─── Dizionari italiani ───────────────────────────────────────────────────────

/** Marker di incertezza soggettiva */
const UNCERTAINTY_MARKERS = new Set([
  "forse", "magari", "probabilmente", "possibilmente", "non so",
  "credo", "penso", "mi sembra", "suppongo", "immagino",
  "dovrebbe", "potrebbe", "sembrerebbe", "pare", "sembra",
  "non sono sicuro", "non sono sicura", "non lo so",
  "boh", "mah", "chissà", "vedremo",
]);

/** Parole a valenza emotiva negativa */
const NEGATIVE_EMOTION_WORDS = new Set([
  "paura", "ansia", "ansioso", "ansiosa", "preoccupato", "preoccupata",
  "preoccupazione", "stress", "stressato", "stressata", "stressante",
  "difficile", "difficoltà", "problema", "problemi", "ostacolo",
  "fallimento", "fallire", "sbagliato", "sbagliata", "errore",
  "delusione", "deluso", "delusa", "triste", "tristezza",
  "frustrazione", "frustrato", "frustrata", "bloccato", "bloccata",
  "incapace", "impossibile", "inutile", "perduto", "perduta",
  "confuso", "confusa", "spaventato", "spaventata", "dubbio", "dubbi",
  "rischio", "pericolo", "sbaglio", "rimpianto",
]);

/** Parole sociali (riferimenti a persone, relazioni, collaborazione) */
const SOCIAL_WORDS = new Set([
  "noi", "insieme", "team", "squadra", "colleghi", "colleghe",
  "amici", "amiche", "partner", "collaborare", "collaborazione",
  "relazione", "relazioni", "condividere", "condividiamo",
  "famiglia", "persone", "gente", "altri", "qualcuno",
  "aiutare", "supporto", "supportare", "comunità",
  "gruppo", "gruppi", "rete", "connessione", "connessioni",
  "incontro", "incontri", "parlare", "ascolto", "ascoltare",
]);

/** Riferimenti temporali al futuro */
const FUTURE_TEMPORAL_WORDS = new Set([
  "domani", "futuro", "prossimamente", "presto", "poi",
  "vorrei", "potrei", "farò", "andrò", "sarò", "diventerò",
  "voglio", "devo", "obiettivo", "obiettivi", "piano", "piani",
  "progetto", "progetti", "meta", "traguardo", "traguardi",
  "crescere", "migliorare", "costruire", "raggiungere",
  "nei prossimi", "entro", "quando", "un giorno", "alla fine",
]);

/** Linguaggio di autonomia, controllo, indipendenza */
const AUTONOMY_LANGUAGE = new Set([
  "io voglio", "voglio decidere", "libertà", "indipendente", "indipendenza",
  "autonomia", "autonomo", "autonoma", "da solo", "da sola",
  "mio percorso", "mia scelta", "mia decisione", "faccio da me",
  "senza dipendere", "controllo", "gestire", "gestisco",
  "libero", "libera", "mio ritmo", "come voglio",
]);

// ─── Funzioni di analisi ──────────────────────────────────────────────────────

/** Tokenizza testo in parole lowercase, rimuovendo punteggiatura */
function tokenizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\sàáâãäåèéêëìíîïòóôõöùúûü']/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/** Divide testo in frasi (su . ! ? e \n) */
function splitSentences(text: string): string[] {
  return text
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

/** Conta sillabe approssimative per una parola italiana */
function countSyllablesIt(word: string): number {
  // Conta vocali come proxy sillabe (semplificazione)
  const vowels = (word.match(/[aeiouàáèéìíòóùú]/gi) ?? []).length;
  return Math.max(1, Math.min(vowels, word.length));
}

/**
 * Analizza il testo aggregato dei messaggi utente.
 * Accetta un array di stringhe (un messaggio per elemento).
 */
export function analyzeLinguisticSignals(userMessages: string[]): LinguisticSignals {
  if (userMessages.length === 0) {
    return {
      questionRatio: 0, uncertaintyMarkers: 0, negativeEmotionWords: 0,
      socialWordUsage: 0, futureTemporalFocus: 0, abstractionLevel: 0,
      autonomyLanguage: 0, totalWords: 0, totalSentences: 0,
    };
  }

  const fullText = userMessages.join(" ");
  const sentences = splitSentences(fullText);
  const allWords = tokenizeWords(fullText);

  if (allWords.length === 0 || sentences.length === 0) {
    return {
      questionRatio: 0, uncertaintyMarkers: 0, negativeEmotionWords: 0,
      socialWordUsage: 0, futureTemporalFocus: 0, abstractionLevel: 0,
      autonomyLanguage: 0, totalWords: 0, totalSentences: 0,
    };
  }

  // 1. Question ratio: frasi che terminano con ? o iniziano con come/cosa/perché/quando
  const questionWords = new Set(["come", "cosa", "perché", "quando", "dove", "chi", "quale", "quanto"]);
  let questionCount = 0;
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase().trim();
    if (lower.endsWith("?") || questionWords.has(lower.split(/\s+/)[0] ?? "")) {
      questionCount++;
    }
  }
  const questionRatio = questionCount / sentences.length;

  // 2. Uncertainty markers: cerca le frasi che le contengono
  let uncertainCount = 0;
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    for (const marker of UNCERTAINTY_MARKERS) {
      if (lower.includes(marker)) {
        uncertainCount++;
        break;
      }
    }
  }
  const uncertaintyMarkers = uncertainCount / sentences.length;

  // 3. Negative emotion words: conta parole nel dizionario
  let negativeCount = 0;
  for (const word of allWords) {
    if (NEGATIVE_EMOTION_WORDS.has(word)) negativeCount++;
  }
  const negativeEmotionWords = Math.min(negativeCount / allWords.length, 1);

  // 4. Social word usage
  let socialCount = 0;
  for (const word of allWords) {
    if (SOCIAL_WORDS.has(word)) socialCount++;
  }
  const socialWordUsage = Math.min(socialCount / allWords.length, 1);

  // 5. Future temporal focus
  let futureCount = 0;
  for (const word of allWords) {
    if (FUTURE_TEMPORAL_WORDS.has(word)) futureCount++;
  }
  const futureTemporalFocus = Math.min(futureCount / allWords.length, 1);

  // 6. Abstraction level: media sillabe per parola, normalizzata
  // Parole < 3 sillabe = concrete, > 4 = astratte
  const totalSyllables = allWords.reduce((acc, w) => acc + countSyllablesIt(w), 0);
  const avgSyllables = totalSyllables / allWords.length;
  // Range tipico italiano: 2.0-4.5 sillabe/parola
  const abstractionLevel = Math.min(Math.max((avgSyllables - 2.0) / 2.5, 0), 1);

  // 7. Autonomy language: cerca frasi con pattern di autonomia
  let autonomyCount = 0;
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    for (const pattern of AUTONOMY_LANGUAGE) {
      if (lower.includes(pattern)) {
        autonomyCount++;
        break;
      }
    }
  }
  const autonomyLanguage = autonomyCount / sentences.length;

  return {
    questionRatio: Math.round(questionRatio * 1000) / 1000,
    uncertaintyMarkers: Math.round(uncertaintyMarkers * 1000) / 1000,
    negativeEmotionWords: Math.round(negativeEmotionWords * 1000) / 1000,
    socialWordUsage: Math.round(socialWordUsage * 1000) / 1000,
    futureTemporalFocus: Math.round(futureTemporalFocus * 1000) / 1000,
    abstractionLevel: Math.round(abstractionLevel * 1000) / 1000,
    autonomyLanguage: Math.round(autonomyLanguage * 1000) / 1000,
    totalWords: allWords.length,
    totalSentences: sentences.length,
  };
}

/**
 * Trasforma i segnali linguistici in score Big Five inferiti.
 *
 * Le mappature sono basate su:
 * - Mairesse et al. (2007): "Using Linguistic Cues for the Automatic Recognition of Personality"
 * - Yarkoni (2010): "Personality in 100,000 Words"
 * Adattate per l'italiano (validazione empirica richiesta con dataset specifico).
 *
 * Confidence max 0.65 (inferenza indiretta, non sostituisce il quiz esplicito).
 */
export function inferOceanFromLinguistics(
  signals: LinguisticSignals,
  existingProfile?: { source?: string | null; confidence?: number | null },
): OceanInference {
  // Se hai già un quiz esplicito, non sovrascrivere
  if (existingProfile?.source === "explicit") {
    return {
      openness: 0.5, conscientiousness: 0.5, extraversion: 0.5,
      agreeableness: 0.5, neuroticism: 0.5, confidence: 0,
    };
  }

  // Confidence basata su volume di testo analizzato
  // < 50 parole: molto bassa; 200+: max 0.65
  const textConfidence = Math.min(signals.totalWords / 200, 1) * 0.65;

  if (textConfidence < 0.1) {
    return {
      openness: 0.5, conscientiousness: 0.5, extraversion: 0.5,
      agreeableness: 0.5, neuroticism: 0.5, confidence: 0,
    };
  }

  // Openness: curiosità (questionRatio) + astrazione + futuro
  const openness = clamp(
    0.5
    + signals.questionRatio * 0.3
    + signals.abstractionLevel * 0.2
    + signals.futureTemporalFocus * 0.1
    - signals.uncertaintyMarkers * 0.1,
  );

  // Conscientiousness: pianificazione (future) + bassa incertezza + bassa negatività
  const conscientiousness = clamp(
    0.5
    + signals.futureTemporalFocus * 0.4
    - signals.uncertaintyMarkers * 0.2
    - signals.negativeEmotionWords * 0.15,
  );

  // Extraversion: parole sociali + autonomy language (assertività) - incertezza
  const extraversion = clamp(
    0.5
    + signals.socialWordUsage * 0.35
    + signals.autonomyLanguage * 0.15
    - signals.uncertaintyMarkers * 0.1,
  );

  // Agreeableness: parole sociali - autonomy assertivo
  const agreeableness = clamp(
    0.5
    + signals.socialWordUsage * 0.4
    - signals.autonomyLanguage * 0.25,
  );

  // Neuroticism: incertezza + emozioni negative
  const neuroticism = clamp(
    0.5
    + signals.uncertaintyMarkers * 0.35
    + signals.negativeEmotionWords * 0.35
    - signals.futureTemporalFocus * 0.1,
  );

  return {
    openness: Math.round(openness * 1000) / 1000,
    conscientiousness: Math.round(conscientiousness * 1000) / 1000,
    extraversion: Math.round(extraversion * 1000) / 1000,
    agreeableness: Math.round(agreeableness * 1000) / 1000,
    neuroticism: Math.round(neuroticism * 1000) / 1000,
    confidence: Math.round(textConfidence * 100) / 100,
  };
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}
