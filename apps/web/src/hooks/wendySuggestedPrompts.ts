import type { WendySuggestedPrompt } from "./useWendyChatSse";

type WendyPromptPageContext = {
  page?: string | undefined;
  title?: string | undefined;
  data?: Record<string, unknown> | undefined;
};

function readContextName(pageContext: WendyPromptPageContext | null | undefined): string | undefined {
  const entityName = pageContext?.data?.entityName;
  if (typeof entityName === "string" && entityName.trim()) return entityName.trim();
  if (pageContext?.title?.trim()) return pageContext.title.trim();
  return undefined;
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
  prompts.push({ label, prompt: text });
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

export function buildWendyFallbackSuggestedPrompts(
  content: string,
  pageContext?: WendyPromptPageContext | null,
): WendySuggestedPrompt[] {
  const normalizedContent = content.toLowerCase();
  const contextName = readContextName(pageContext);
  const prompts: WendySuggestedPrompt[] = [];
  const seen = new Set<string>();

  if (contextName) {
    addPrompt(prompts, seen, {
      label: `Approfondisci ${contextName}`,
      prompt: `Approfondisci ${contextName} usando il contesto della pagina e dimmi cosa fare dopo.`,
    });
  }

  if (
    normalizedContent.includes("profilo")
    || normalizedContent.includes("competenz")
    || normalizedContent.includes("affinit")
  ) {
    addPrompt(prompts, seen, {
      label: "Usa il profilo",
      prompt: "Usa gli strumenti dell'app sul profilo per trasformare questa analisi in priorita, lacune e prossimo passo verificabile.",
    });
    addPrompt(prompts, seen, {
      label: "Trasforma in piano",
      prompt: "Trasforma questa analisi in un piano operativo con priorita e primo passo.",
    });
  }

  if (
    normalizedContent.includes("obiettiv")
    || normalizedContent.includes("progres")
    || normalizedContent.includes("avanzament")
    || normalizedContent.includes("checkpoint")
    || normalizedContent.includes("milestone")
  ) {
    addPrompt(prompts, seen, {
      label: "Aggiorna progresso",
      prompt: "Usa gli strumenti dell'app per leggere obiettivi e progresso, poi proponi l'aggiornamento o il prossimo checkpoint concreto.",
    });
  }

  if (
    pageContext?.page === "sector"
    || normalizedContent.includes("settore")
    || normalizedContent.includes("settori")
    || normalizedContent.includes("carriera")
  ) {
    addPrompt(prompts, seen, {
      label: "Confronta alternative",
      prompt: "Confronta questa direzione con due alternative realistiche e indicami la scelta migliore.",
    });
  }

  addPrompt(prompts, seen, {
    label: "Prossima mossa concreta",
    prompt: "Qual e la prossima azione concreta da fare oggi, con tempi e criteri di successo?",
  });
  addPrompt(prompts, seen, {
    label: "Chiarisci i dubbi",
    prompt: "Quali informazioni mancano per decidere meglio e quali domande dovrei farmi?",
  });

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
