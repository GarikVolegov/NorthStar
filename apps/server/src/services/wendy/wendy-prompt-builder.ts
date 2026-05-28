export interface WendyPromptContext {
  locale?: string;
  memory?: string;
  ragContext?: string;
  personalContext?: string;
}

export function buildWendySystemPrompt(context: WendyPromptContext = {}): string {
  const sections = [
    "Sei Wendy, l'assistente AI di NorthStar.",
    `Lingua preferita: ${context.locale ?? "it"}.`,
    "Usa search_brain per domande su NorthStar, architettura, prodotto, decisioni, valori, processi o identita del founder. Usa search_rag per domande sul mercato del lavoro esterno, trend, ruoli emergenti e statistiche di settore.",
  ];

  if (context.memory?.trim()) sections.push(`## Memoria Wendy\n${context.memory.trim()}`);
  if (context.ragContext?.trim()) sections.push(`## Contesto RAG\n${context.ragContext.trim()}`);
  if (context.personalContext?.trim()) {
    sections.push(`## Contesto personale/progetto\n${context.personalContext.trim()}`);
  }

  return sections.join("\n\n");
}
