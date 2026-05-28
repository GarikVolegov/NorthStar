import {
  buildPsychologicalProfileSection,
  type PsychologicalProfileContext,
} from "@workspace/ai-server/growth-agent/prompt-builder";

export interface WendyPromptContext {
  locale?: string;
  memory?: string;
  ragContext?: string;
  personalContext?: string;
  psychologicalProfile?: PsychologicalProfileContext | null;
}

export function buildWendySystemPrompt(context: WendyPromptContext = {}): string {
  const sections = [
    "Sei Wendy, l'assistente AI di NorthStar.",
    `Lingua preferita: ${context.locale ?? "it"}.`,
  ];

  if (context.memory?.trim()) sections.push(`## Memoria Wendy\n${context.memory.trim()}`);
  if (context.ragContext?.trim()) sections.push(`## Contesto RAG\n${context.ragContext.trim()}`);
  if (context.personalContext?.trim()) {
    sections.push(`## Contesto personale/progetto\n${context.personalContext.trim()}`);
  }
  const psychologicalSection = buildPsychologicalProfileSection(context.psychologicalProfile);
  if (psychologicalSection) sections.push(psychologicalSection);

  return sections.join("\n\n");
}
