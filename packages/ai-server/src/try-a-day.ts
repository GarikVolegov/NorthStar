export type TryADayTimeBlock = "morning" | "afternoon" | "evening";
export type TryADayInteractionType = "choice" | "comfort_slider" | "priority_order";

export interface TryADayProfession {
  id: number;
  title: string;
  sector: string;
  description?: string | null;
  skills: string[];
  riasecFit: string[];
  workModes: string[];
  salaryRange?: string | null;
  growthOutlook?: string | null;
  autonomyScore?: number | null;
  stabilityScore?: number | null;
}

export interface TryADayOption {
  id: string;
  label: string;
  signal: string;
  value: number;
}

export type TryADayInteraction =
  | {
      type: "choice";
      prompt: string;
      options: TryADayOption[];
    }
  | {
      type: "priority_order";
      prompt: string;
      options: TryADayOption[];
    }
  | {
      type: "comfort_slider";
      prompt: string;
      minLabel: string;
      maxLabel: string;
    };

export interface TryADayScene {
  timeBlock: TryADayTimeBlock;
  title: string;
  narrative: string;
  taskImportance: string;
  interaction: TryADayInteraction;
  emotionalPrompt: string;
  signals: {
    skills: string[];
    values: string[];
    energy: number;
    interest: number;
    competence: number;
  };
}

export type TryADaySceneResponse =
  | { choiceId?: string; emotion?: number }
  | { orderedIds?: string[]; emotion?: number }
  | { comfort?: number; emotion?: number };

export type TryADayResponses = Partial<Record<TryADayTimeBlock, TryADaySceneResponse>>;

export interface TryADayDebrief {
  radar: {
    energy: number;
    interest: number;
    perceivedCompetence: number;
    valuesAlignment: number;
  };
  summary: string;
  highlights: string[];
  suggestions?: TryADaySuggestions;
}

export interface TryADaySuggestions {
  similar: TryADaySuggestion | null;
  opposite: TryADaySuggestion | null;
}

export interface TryADaySuggestion {
  id: number;
  title: string;
  sector: string;
  reason: string;
}

const fallbackSkill = "ascolto attivo";

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function skillAt(profession: TryADayProfession, index: number): string {
  return profession.skills[index] ?? profession.skills[0] ?? fallbackSkill;
}

function modeLabel(profession: TryADayProfession): string {
  return profession.workModes[0] ?? "contesto reale";
}

export function buildTryADayScenes(profession: TryADayProfession): TryADayScene[] {
  const primarySkill = skillAt(profession, 0);
  const secondSkill = skillAt(profession, 1);
  const thirdSkill = skillAt(profession, 2);
  const context = modeLabel(profession);

  return [
    {
      timeBlock: "morning",
      title: `Mattina da ${profession.title}`,
      narrative: `Arrivi nel contesto ${context} e trovi una richiesta appena aperta. Devi capire cosa conta davvero prima di muoverti. Usi ${primarySkill} per separare urgenza, impatto e rumore operativo. Il tuo primo gesto decide la qualità del resto della giornata.`,
      taskImportance: `La mattina misura quanto ti piace trasformare ambiguità in una prima direzione concreta nel ruolo di ${profession.title}.`,
      interaction: {
        type: "choice",
        prompt: "Quale prima mossa scegli?",
        options: [
          { id: "investigate", label: `Analizzo i dati e cerco il nodo con ${primarySkill}`, signal: "analisi", value: 92 },
          { id: "align", label: `Chiarisco aspettative e vincoli con il team`, signal: "collaborazione", value: 76 },
          { id: "execute", label: `Parto da una soluzione rapida e la testo subito`, signal: "azione", value: 64 },
        ],
      },
      emotionalPrompt: "Quanto ti carica questo tipo di inizio giornata?",
      signals: {
        skills: [primarySkill, secondSkill],
        values: ["chiarezza", "impatto"],
        energy: 72,
        interest: 78,
        competence: 68,
      },
    },
    {
      timeBlock: "afternoon",
      title: "Pomeriggio operativo",
      narrative: `Dopo pranzo la richiesta diventa più concreta. Qualcuno vuole velocità, qualcuno qualità, qualcuno visibilità. Devi ordinare le priorità senza perdere il quadro. Qui ${secondSkill} e ${thirdSkill} diventano strumenti per proteggere il risultato.`,
      taskImportance: "Il pomeriggio mostra se il ritmo decisionale e le micro-negoziazioni del ruolo ti consumano o ti danno energia.",
      interaction: {
        type: "priority_order",
        prompt: "Ordina le tre priorità del cliente interno.",
        options: [
          { id: "customer", label: "Bisogno dell'utente o cliente", signal: "valori", value: 88 },
          { id: "quality", label: "Qualità e affidabilità del risultato", signal: "competenza", value: 82 },
          { id: "speed", label: "Velocità di consegna", signal: "energia", value: 68 },
        ],
      },
      emotionalPrompt: "Come ti senti nel gestire priorità in tensione?",
      signals: {
        skills: [secondSkill, thirdSkill],
        values: ["responsabilità", "qualità"],
        energy: 66,
        interest: 74,
        competence: 72,
      },
    },
    {
      timeBlock: "evening",
      title: "Chiusura e riflessione",
      narrative: `La giornata finisce con una sintesi: cosa hai capito, cosa resta aperto e cosa serve domani. Non è solo produzione, è anche leggere il senso del lavoro. Nel settore ${profession.sector}, questa capacità aiuta a crescere senza rincorrere ogni stimolo.`,
      taskImportance: "La sera fa emergere il fit profondo: energia residua, desiderio di migliorare e allineamento con i tuoi valori.",
      interaction: {
        type: "comfort_slider",
        prompt: "Quanto ti sentiresti a tuo agio a ripetere una giornata simile?",
        minLabel: "Mi prosciuga",
        maxLabel: "Mi fa venire voglia di imparare",
      },
      emotionalPrompt: "Che temperatura emotiva ti lascia questa giornata?",
      signals: {
        skills: [primarySkill, thirdSkill],
        values: ["crescita", "sostenibilità"],
        energy: 62,
        interest: 76,
        competence: 70,
      },
    },
  ];
}

function emotionToScore(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 50;
  return clampScore((Math.max(1, Math.min(5, value)) - 1) * 25);
}

function findOptionValue(scene: TryADayScene, id?: string): number {
  if (!id || scene.interaction.type === "comfort_slider") return 50;
  return scene.interaction.options.find((option) => option.id === id)?.value ?? 50;
}

export function computeTryADayDebrief(
  scenes: TryADayScene[],
  responses: TryADayResponses,
): TryADayDebrief {
  const emotionScores = scenes.map((scene) => {
    const response = responses[scene.timeBlock] as { emotion?: number } | undefined;
    return emotionToScore(response?.emotion);
  });
  const averageEmotion = emotionScores.reduce((sum, score) => sum + score, 0) / Math.max(1, emotionScores.length);

  const morning = responses.morning as { choiceId?: string } | undefined;
  const afternoon = responses.afternoon as { orderedIds?: string[] } | undefined;
  const evening = responses.evening as { comfort?: number } | undefined;
  const morningValue = findOptionValue(scenes[0]!, morning?.choiceId);
  const orderedFirst = afternoon?.orderedIds?.[0];
  const afternoonValue = findOptionValue(scenes[1]!, orderedFirst);
  const comfort = typeof evening?.comfort === "number" ? clampScore(evening.comfort) : 50;
  const baseInterest = scenes.reduce((sum, scene) => sum + scene.signals.interest, 0) / Math.max(1, scenes.length);
  const baseCompetence = scenes.reduce((sum, scene) => sum + scene.signals.competence, 0) / Math.max(1, scenes.length);

  const roleTitle = scenes[0]?.title.replace(/^Mattina da /, "") ?? "questo ruolo";
  const radar = {
    energy: clampScore(averageEmotion * 0.75 + comfort * 0.25),
    interest: clampScore(baseInterest * 0.45 + morningValue * 0.35 + averageEmotion * 0.2),
    perceivedCompetence: clampScore(baseCompetence * 0.45 + afternoonValue * 0.35 + comfort * 0.2),
    valuesAlignment: clampScore((morningValue + afternoonValue + comfort) / 3),
  };

  return {
    radar,
    summary: `La giornata da ${roleTitle} sembra funzionare meglio quando puoi alternare analisi, priorità e riflessione senza perdere il senso del lavoro.`,
    highlights: [
      radar.energy >= 65 ? "Energia sostenuta durante la simulazione." : "Energia da monitorare: alcune scene potrebbero pesare nel quotidiano.",
      radar.interest >= 65 ? "Interesse vivo verso i compiti centrali." : "Interesse selettivo: conviene esplorare ruoli vicini.",
      radar.valuesAlignment >= 65 ? "Buon allineamento con valori e ritmo." : "Allineamento ancora da verificare con esempi più concreti.",
    ],
  };
}

function overlap(a: string[], b: string[]): number {
  const target = new Set(b.map((value) => value.toLowerCase()));
  return a.reduce((count, value) => count + (target.has(value.toLowerCase()) ? 1 : 0), 0);
}

function roleSimilarity(source: TryADayProfession, candidate: TryADayProfession): number {
  return (
    overlap(source.skills, candidate.skills) * 3 +
    overlap(source.riasecFit, candidate.riasecFit) * 2 +
    overlap(source.workModes, candidate.workModes)
  );
}

export function pickTryADaySuggestions(
  source: TryADayProfession,
  candidates: TryADayProfession[],
): TryADaySuggestions {
  const pool = candidates.filter((candidate) => candidate.id !== source.id);
  if (pool.length === 0) return { similar: null, opposite: null };
  const ranked = pool
    .map((candidate) => ({ candidate, score: roleSimilarity(source, candidate) }))
    .sort((a, b) => b.score - a.score);
  const similar = ranked[0]?.candidate ?? null;
  const opposite = ranked.at(-1)?.candidate ?? null;

  return {
    similar: similar
      ? {
          id: similar.id,
          title: similar.title,
          sector: similar.sector,
          reason: "Condivide skill, interessi o modalità di lavoro emerse nella giornata.",
        }
      : null,
    opposite: opposite
      ? {
          id: opposite.id,
          title: opposite.title,
          sector: opposite.sector,
          reason: "Offre un contrasto utile per capire cosa cambia nel ritmo quotidiano.",
        }
      : null,
  };
}
