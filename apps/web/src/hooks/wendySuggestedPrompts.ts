import type { WendySuggestedPrompt } from "./useWendyChatSse";

type WendyPromptPageContext = {
  page?: string | undefined;
  title?: string | undefined;
  data?: Record<string, unknown> | undefined;
};

type AdaptiveNextActionContext = {
  label: string;
  href: string;
  sectionId?: string | undefined;
};

function readContextName(pageContext: WendyPromptPageContext | null | undefined): string | undefined {
  const entityName = pageContext?.data?.entityName;
  if (typeof entityName === "string" && entityName.trim()) return entityName.trim();
  if (pageContext?.title?.trim()) return pageContext.title.trim();
  return undefined;
}

function readAdaptivePhase(pageContext: WendyPromptPageContext | null | undefined): string | undefined {
  const phase = pageContext?.data?.adaptivePhase;
  return typeof phase === "string" && phase.trim() ? phase.trim() : undefined;
}

function readAdaptiveNextAction(
  pageContext: WendyPromptPageContext | null | undefined,
): AdaptiveNextActionContext | undefined {
  const value = pageContext?.data?.adaptiveNextAction;
  if (!value || typeof value !== "object") return undefined;
  const action = value as Record<string, unknown>;
  const label = typeof action.label === "string" ? action.label.trim() : "";
  const href = typeof action.href === "string" ? action.href.trim() : "";
  const sectionId = typeof action.sectionId === "string" ? action.sectionId.trim() : undefined;
  if (!label || !href) return undefined;
  return { label, href, ...(sectionId ? { sectionId } : {}) };
}

function addPrompt(
  prompts: WendySuggestedPrompt[],
  seen: Set<string>,
  prompt: WendySuggestedPrompt,
): void {
  const label = prompt.label.trim();
  const text = prompt.prompt.trim();
  if (!label || !text) return;
  const key = text.toLowerCase();
  if (seen.has(key)) return;
  seen.add(key);
  prompts.push({ ...prompt, label, prompt: text });
}

function sanitizeSuggestedPrompts(
  suggestedPrompts: WendySuggestedPrompt[] | undefined,
): WendySuggestedPrompt[] {
  if (!suggestedPrompts?.length) return [];
  const prompts: WendySuggestedPrompt[] = [];
  const seen = new Set<string>();
  for (const prompt of suggestedPrompts) {
    addPrompt(prompts, seen, prompt);
    if (prompts.length >= 3) break;
  }
  return prompts;
}

function mergeSuggestedPrompts(
  primary: WendySuggestedPrompt[],
  fallback: WendySuggestedPrompt[],
): WendySuggestedPrompt[] {
  const prompts: WendySuggestedPrompt[] = [];
  const seen = new Set<string>();
  for (const prompt of [...primary, ...fallback]) {
    addPrompt(prompts, seen, prompt);
    if (prompts.length >= 3) break;
  }
  return prompts;
}

function fallbackPrompt(
  id: string,
  label: string,
  prompt: string,
  labelContext: string,
  promptContext: string,
): WendySuggestedPrompt {
  return {
    label,
    prompt,
    labelTranslation: {
      key: `wendy.suggestedPrompts.${id}.label`,
      source: label,
      context: labelContext,
    },
    promptTranslation: {
      key: `wendy.suggestedPrompts.${id}.prompt`,
      source: prompt,
      context: promptContext,
    },
  };
}

export function buildWendyFallbackSuggestedPrompts(
  content: string,
  pageContext?: WendyPromptPageContext | null,
): WendySuggestedPrompt[] {
  const normalizedContent = content.toLowerCase();
  const contextName = readContextName(pageContext);
  const adaptivePhase = readAdaptivePhase(pageContext);
  const adaptiveNextAction = readAdaptiveNextAction(pageContext);
  const prompts: WendySuggestedPrompt[] = [];
  const seen = new Set<string>();

  if (adaptiveNextAction) {
    const phaseText = adaptivePhase ? ` nella fase ${adaptivePhase}` : "";
    const prompt = `Usa il contesto della dashboard${phaseText}: guidami nell'azione "${adaptiveNextAction.label}" e prepara il passaggio verso ${adaptiveNextAction.href}.`;
    addPrompt(prompts, seen, {
      label: adaptiveNextAction.label,
      prompt,
      promptTranslation: {
        key: "wendy.suggestedPrompts.adaptiveNextAction.prompt",
        source: prompt,
        context: "Wendy suggested follow-up prompt for the next dashboard action. Keep the action label and URL intact.",
      },
    });
  }

  if (contextName) {
    const label = `Approfondisci ${contextName}`;
    const prompt = `Approfondisci ${contextName} usando il contesto della pagina e dimmi cosa fare dopo.`;
    addPrompt(
      prompts,
      seen,
      fallbackPrompt(
        "contextDeepDive",
        label,
        prompt,
        "Wendy suggested follow-up label to inspect the current page entity. Keep the entity name intact.",
        "Wendy suggested follow-up prompt to inspect the current page entity and decide the next step. Keep the entity name intact.",
      ),
    );
  }

  if (
    normalizedContent.includes("profilo")
    || normalizedContent.includes("competenz")
    || normalizedContent.includes("affinit")
  ) {
    addPrompt(
      prompts,
      seen,
      fallbackPrompt(
        "useProfile",
        "Usa il profilo",
        "Usa gli strumenti dell'app sul profilo per trasformare questa analisi in priorita, lacune e prossimo passo verificabile.",
        "Wendy suggested follow-up label that asks to use the user's profile data",
        "Wendy suggested follow-up prompt that asks Wendy to use app profile tools and return priorities, gaps, and a verifiable next step",
      ),
    );
    addPrompt(
      prompts,
      seen,
      fallbackPrompt(
        "transformPlan",
        "Trasforma in piano",
        "Trasforma questa analisi in un piano operativo con priorita e primo passo.",
        "Wendy suggested follow-up label that turns the answer into an action plan",
        "Wendy suggested follow-up prompt that asks Wendy to turn the answer into an operational plan with priorities and first step",
      ),
    );
  }

  if (
    normalizedContent.includes("obiettiv")
    || normalizedContent.includes("progres")
    || normalizedContent.includes("avanzament")
    || normalizedContent.includes("checkpoint")
    || normalizedContent.includes("milestone")
  ) {
    addPrompt(
      prompts,
      seen,
      fallbackPrompt(
        "updateProgress",
        "Aggiorna progresso",
        "Usa gli strumenti dell'app per leggere obiettivi e progresso, poi proponi l'aggiornamento o il prossimo checkpoint concreto.",
        "Wendy suggested follow-up label for updating user progress",
        "Wendy suggested follow-up prompt that asks Wendy to read goals and progress with app tools and propose a concrete checkpoint",
      ),
    );
  }

  if (
    pageContext?.page === "sector"
    || normalizedContent.includes("settore")
    || normalizedContent.includes("settori")
    || normalizedContent.includes("carriera")
  ) {
    addPrompt(
      prompts,
      seen,
      fallbackPrompt(
        "compareAlternatives",
        "Confronta alternative",
        "Confronta questa direzione con due alternative realistiche e indicami la scelta migliore.",
        "Wendy suggested follow-up label for comparing alternatives",
        "Wendy suggested follow-up prompt that asks Wendy to compare the current direction with two realistic alternatives",
      ),
    );
  }

  addPrompt(
    prompts,
    seen,
    fallbackPrompt(
      "nextConcreteMove",
      "Prossima mossa concreta",
      "Qual e la prossima azione concreta da fare oggi, con tempi e criteri di successo?",
      "Wendy suggested follow-up label for a practical next action",
      "Wendy suggested follow-up prompt that asks Wendy for today's concrete action with timing and success criteria",
    ),
  );
  addPrompt(
    prompts,
    seen,
    fallbackPrompt(
      "clarifyDoubts",
      "Chiarisci i dubbi",
      "Quali informazioni mancano per decidere meglio e quali domande dovrei farmi?",
      "Wendy suggested follow-up label for clarifying doubts",
      "Wendy suggested follow-up prompt that asks Wendy what information is missing and what questions the user should ask",
    ),
  );

  return prompts.slice(0, 3);
}

export function withWendySuggestedPromptFallback(
  suggestedPrompts: WendySuggestedPrompt[] | undefined,
  content: string,
  pageContext?: WendyPromptPageContext | null,
): WendySuggestedPrompt[] {
  const sanitizedPrompts = sanitizeSuggestedPrompts(suggestedPrompts);
  const fallbackPrompts = buildWendyFallbackSuggestedPrompts(content, pageContext);
  return mergeSuggestedPrompts(sanitizedPrompts, fallbackPrompts);
}
