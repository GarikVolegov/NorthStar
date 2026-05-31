type QuickActionKind = "today" | "profile" | "sectors" | "progress";

type Objective = {
  id?: unknown;
  text?: unknown;
  progress?: unknown;
  category?: unknown;
  dueDate?: unknown;
};

type Sector = {
  name?: unknown;
};

type UserContextData = {
  journeyType?: unknown;
  topObjectives?: unknown;
  preferredSectors?: unknown;
};

function normalize(message: string): string {
  return message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asObjectives(value: unknown): Objective[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Objective => typeof item === "object" && item !== null);
}

function asSectors(value: unknown): Sector[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Sector => typeof item === "object" && item !== null);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function wantsEnglish(locale: unknown): boolean {
  return typeof locale === "string" && locale.toLowerCase().startsWith("en");
}

function progress(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function objectiveId(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function objectiveRowsFromPayload(value: unknown): Objective[] {
  return asObjectives(
    typeof value === "object" && value !== null && "objectives" in value
      ? (value as { objectives?: unknown }).objectives
      : undefined,
  );
}

function primaryObjective(objectives: Objective[]): Objective | undefined {
  return objectives
    .filter((objective) => text(objective.text))
    .sort((a, b) => progress(b.progress) - progress(a.progress))[0];
}

export function classifyWendyDataBackedQuickAction(message: string): QuickActionKind | null {
  const normalized = normalize(message);
  if (/\b(analizza|analyze)\b.*\b(progress|progressi)\b/.test(normalized)) return "progress";
  if (
    (normalized.includes("profilo") || normalized.includes("profile")) &&
    (normalized.includes("prossima mossa") || normalized.includes("next move") || normalized.includes("analizza") || normalized.includes("analyze"))
  ) {
    return "profile";
  }
  if (
    (normalized.includes("settori") || normalized.includes("settore") || normalized.includes("sectors") || normalized.includes("sector")) &&
    (/\badatt/.test(normalized) || normalized.includes("fit") || normalized.includes("scelgo") || normalized.includes("scegliere") || normalized.includes("choose"))
  ) return "sectors";
  if (
    /\b(cosa|che)\b.*\b(fare|faccio)\b.*\b(oggi|domani|settimana)\b/.test(normalized) ||
    /\b(what|which)\b.*\b(do|should)\b.*\b(today|tomorrow|week)\b/.test(normalized) ||
    /\bprossim[ao]\b.*\b(azion\w*|pass\w*|moss\w*)\b/.test(normalized) ||
    /\bnext\b.*\b(step|action|move)\b/.test(normalized)
  ) return "today";
  return null;
}

export function buildWendyDataBackedGuidedAction(input: {
  kind: QuickActionKind;
  objectives?: unknown;
  userContext?: unknown;
}): {
  toolName: "update_objective_progress" | "save_objective" | "set_filters" | "open_view";
  args: Record<string, unknown>;
  confirmBeforeExecution?: boolean;
} | null {
  if (input.kind !== "today" && input.kind !== "progress" && input.kind !== "profile" && input.kind !== "sectors") return null;

  const objectiveRows = objectiveRowsFromPayload(input.objectives);
  const userContext = typeof input.userContext === "object" && input.userContext !== null
    ? input.userContext as UserContextData
    : {};
  const topObjectives = objectiveRows.length > 0
    ? objectiveRows
    : asObjectives(userContext.topObjectives);
  const firstObjective = primaryObjective(topObjectives);
  const id = objectiveId(firstObjective?.id);
  const sectors = asSectors(userContext.preferredSectors).map((sector) => text(sector.name)).filter(Boolean);

  if (input.kind === "sectors") {
    const firstSector = sectors[0];
    if (firstSector) {
      return {
        toolName: "set_filters",
        confirmBeforeExecution: true,
        args: {
          listType: "sectors",
          filters: {
            q: firstSector,
            source: "wendy_personal_fit",
          },
        },
      };
    }
    return {
      toolName: "open_view",
      confirmBeforeExecution: true,
      args: { viewId: "settori" },
    };
  }

  if (firstObjective && id) {
    const currentProgress = progress(firstObjective.progress);
    const nextProgress = Math.min(100, Math.max(currentProgress + 15, currentProgress === 0 ? 15 : currentProgress));
    return {
      toolName: "update_objective_progress",
      args: {
        objectiveId: id,
        progress: nextProgress,
      },
    };
  }

  if (input.kind === "today" || input.kind === "progress") {
    return {
      toolName: "save_objective",
      args: {
        text: "Definire il prossimo passo professionale e completarlo in 25 minuti",
        category: "career",
        deadlineWeeks: 1,
      },
    };
  }

  return null;
}

export function formatWendyDataBackedQuickActionReply(input: {
  kind: QuickActionKind;
  locale?: string | undefined;
  objectives?: unknown;
  userContext?: unknown;
}): string {
  const objectiveRows = objectiveRowsFromPayload(input.objectives);
  const userContext = typeof input.userContext === "object" && input.userContext !== null
    ? input.userContext as UserContextData
    : {};
  const topObjectives = objectiveRows.length > 0
    ? objectiveRows
    : asObjectives(userContext.topObjectives);
  const firstObjective = primaryObjective(topObjectives);
  const sectors = asSectors(userContext.preferredSectors).map((sector) => text(sector.name)).filter(Boolean);
  const journeyType = text(userContext.journeyType);
  const english = wantsEnglish(input.locale);

  if (input.kind === "today") {
    if (firstObjective) {
      const percent = progress(firstObjective.progress);
      if (english) {
        return `Today I would start with one concrete step on "${text(firstObjective.text)}"${percent ? `, now at ${percent}%` : ""}. Do 25 minutes of focused work, update the progress, then choose one thing to postpone.`;
      }
      return `Oggi partirei da un passo concreto su "${text(firstObjective.text)}"${percent ? `, che ora e al ${percent}%` : ""}. Fai 25 minuti di lavoro concentrato, aggiorna il progresso e poi scegli una sola cosa da rimandare.`;
    }
    if (english) {
      return "Today I would keep it simple: complete or update the test, create one small objective, then ask me to turn it into a 25-minute plan.";
    }
    return "Oggi farei una cosa semplice: completa o aggiorna il test, crea un obiettivo piccolo e chiedimi subito di trasformarlo in un piano da 25 minuti.";
  }

  if (input.kind === "progress") {
    if (topObjectives.length > 0) {
      if (english) {
        return `I see ${topObjectives.length} open objectives. The most useful signal is to focus on "${text(firstObjective?.text)}": move it forward by one micro-step and use progress as evidence, not as a feeling.`;
      }
      return `Vedo ${topObjectives.length} obiettivi aperti. Il segnale piu utile e concentrarti su "${text(firstObjective?.text)}": avanzalo di un micro-step e usa il progresso come prova, non come sensazione.`;
    }
    if (english) {
      return "I do not see open objectives to analyze. The first move is to create one measurable objective, then Wendy can read progress, blockers, and priorities.";
    }
    return "Non vedo obiettivi aperti da analizzare. La prima mossa e creare un obiettivo misurabile, poi Wendy potra leggere avanzamento, blocchi e priorita.";
  }

  if (input.kind === "profile") {
    if (english) {
      const profileHint = journeyType ? `Your current profile is "${journeyType}". ` : "";
      const objectiveHint = firstObjective ? `The next move should connect to "${text(firstObjective.text)}". ` : "";
      return `${profileHint}${objectiveHint}Choose one verifiable decision: a sector to explore for 30 minutes, a skill to validate, and one objective to update today.`;
    }
    const profileHint = journeyType ? `Il tuo profilo attuale e "${journeyType}". ` : "";
    const objectiveHint = firstObjective ? `La prossima mossa dovrebbe collegarsi a "${text(firstObjective.text)}". ` : "";
    return `${profileHint}${objectiveHint}Scegli una decisione verificabile: un settore da esplorare per 30 minuti, una competenza da validare e un obiettivo da aggiornare entro oggi.`;
  }

  if (sectors.length > 0) {
    if (english) {
      return `I would start from the sectors you already signaled: ${sectors.slice(0, 3).join(", ")}. Compare them by personal fit, work mode, indicative compensation, and AI impact; then open the one with the best balance, not the loudest one.`;
    }
    return `Partirei dai settori che hai gia segnalato: ${sectors.slice(0, 3).join(", ")}. Confrontali per fit personale, modalita di lavoro, compenso indicativo e impatto AI; poi apri quello con il miglior equilibrio, non quello piu rumoroso.`;
  }

  if (journeyType || firstObjective) {
    if (english) {
      const profileHint = journeyType ? `For your "${journeyType}" profile` : "For your profile";
      const objectiveHint = firstObjective ? ` and the objective "${text(firstObjective.text)}"` : "";
      return `${profileHint}${objectiveHint}, I would build a shortlist of 3 sectors and compare them on personal fit, work mode, indicative compensation, and AI impact. Open first the one that makes it easiest to produce concrete proof within 7 days.`;
    }
    const profileHint = journeyType ? `Per il tuo profilo "${journeyType}"` : "Per il tuo profilo";
    const objectiveHint = firstObjective ? ` e l'obiettivo "${text(firstObjective.text)}"` : "";
    return `${profileHint}${objectiveHint}, sceglierei una shortlist di 3 settori e li confronterei su fit personale, modalita di lavoro, compenso indicativo e impatto AI. Apri prima quello che rende piu facile produrre una prova concreta entro 7 giorni.`;
  }

  if (english) {
    return "To identify the best-fit sectors, I need your personal fit first: if you have a recent test I will use it, otherwise take the test and then compare the first sectors by interests, skills, work mode, and AI impact.";
  }
  return "Per capire i settori piu adatti serve prima il fit personale: se hai un test recente uso quello, altrimenti fai il test e poi confronta i primi settori per interessi, competenze, modalita di lavoro e impatto AI.";
}
