/**
 * mood-to-action.ts — mapping rule-based 5 slider → singola azione consigliata.
 *
 * Filosofia: anti-overwhelm. UNA azione concreta. Le regole sono ordinate
 * per priorità (la prima che matcha vince). Le soglie sono pensate per slider 0-100.
 */

export interface MoodInput {
  energy: number;     // 0-100
  anxiety: number;    // 0-100
  curiosity: number;  // 0-100
  clarity: number;    // 0-100
  motivation: number; // 0-100
}

export interface MoodSuggestion {
  toolHref: string;
  toolLabel: string;
  rationale: string;
}

/** Regole ordinate per priorità. Prima regola che matcha vince. */
function buildRules(): Array<{ match: (m: MoodInput) => boolean; suggestion: MoodSuggestion }> {
  return [
    // Ansia alta domina: prima calmiamo
    {
      match: (m) => m.anxiety >= 70,
      suggestion: {
        toolHref: "/coach?mode=socratic",
        toolLabel: "Apri una sessione socratica",
        rationale:
          "L'ansia è alta. Una conversazione strutturata con Wendy ti aiuta a separare il rumore dal segnale, senza pressione.",
      },
    },
    // Curiosità alta + chiarezza ok: caccia all'indizio
    {
      match: (m) => m.curiosity >= 65 && m.clarity >= 40,
      suggestion: {
        toolHref: "/settori",
        toolLabel: "Esplora un settore",
        rationale:
          "Curiosità alta è un buon momento per esplorare. Scegli un settore e leggi come sarebbe una giornata-tipo.",
      },
    },
    // Curiosità alta ma chiarezza bassa: cattura indizio, non scegliere
    {
      match: (m) => m.curiosity >= 60 && m.clarity < 40,
      suggestion: {
        toolHref: "/diario?mode=indizi",
        toolLabel: "Cattura un indizio nel diario",
        rationale:
          "Senti curiosità ma non vedi ancora chiaro. Non scegliere: annota ora il motivo prima che svanisca.",
      },
    },
    // Chiarezza bassa generale: diario indizi
    {
      match: (m) => m.clarity < 30,
      suggestion: {
        toolHref: "/diario?mode=indizi",
        toolLabel: "Annota un indizio",
        rationale:
          "La chiarezza è bassa. Scrivere 2 righe su qualcosa che oggi ti ha mosso aiuta più di pensarci ancora.",
      },
    },
    // Energia bassa + motivazione bassa: micro-azione, niente sforzo
    {
      match: (m) => m.energy < 35 && m.motivation < 35,
      suggestion: {
        toolHref: "/diario?mode=indizi",
        toolLabel: "60 secondi di diario",
        rationale:
          "Energia e motivazione basse. Niente progetti — solo 60 secondi per scrivere una frase. Domani sarà più facile.",
      },
    },
    // Motivazione alta + chiarezza alta: pronto a fare
    {
      match: (m) => m.motivation >= 65 && m.clarity >= 60,
      suggestion: {
        toolHref: "/coach?mode=socratic",
        toolLabel: "Trasforma in azione con Wendy",
        rationale:
          "Sei lucido e motivato: è il momento giusto per fissare una scelta concreta. Una sessione socratica ti aiuta a chiuderla.",
      },
    },
    // Energia alta + curiosità alta: esplora
    {
      match: (m) => m.energy >= 60 && m.curiosity >= 50,
      suggestion: {
        toolHref: "/settori",
        toolLabel: "Esplora settori",
        rationale:
          "Energia e curiosità alta: ottimo momento per allargare la mappa. Scopri 1-2 settori che non conosci.",
      },
    },
  ];
}

const FALLBACK: MoodSuggestion = {
  toolHref: "/diario?mode=indizi",
  toolLabel: "Cattura un indizio (60s)",
  rationale: "Quando non c'è una direzione chiara, scrivere un piccolo indizio è il passo migliore. Niente impegno.",
};

export function suggestActionForMood(m: MoodInput): MoodSuggestion {
  for (const rule of buildRules()) {
    if (rule.match(m)) return rule.suggestion;
  }
  return FALLBACK;
}

/** Validazione + clamping degli slider. */
export function normalizeMoodInput(input: Partial<MoodInput>): MoodInput | { error: string } {
  const keys: (keyof MoodInput)[] = ["energy", "anxiety", "curiosity", "clarity", "motivation"];
  const out: Partial<MoodInput> = {};
  for (const k of keys) {
    const v = Number(input[k]);
    if (!Number.isFinite(v)) return { error: `Campo ${k} mancante o non numerico` };
    out[k] = Math.max(0, Math.min(100, v));
  }
  return out as MoodInput;
}
