import { agentPromptVersionsTable, agentPromptsTable, db } from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";

type PromptRegistryRecord = typeof agentPromptsTable.$inferSelect;
type PromptVersionRecord = typeof agentPromptVersionsTable.$inferSelect;

function requireReturnedRow<T>(row: T | undefined, message: string): T {
  if (!row) {
    throw new Error(message);
  }
  return row;
}

export type AgentPrompt = {
  key: string;
  label: string;
  description: string;
  placeholders: string[];
  requiredPlaceholders?: string[];
  defaultValue: string;
};

export const DEFAULT_PROMPTS: AgentPrompt[] = [
  {
    key: "wendy.system",
    label: "Wendy - Sistema",
    description: "Identita operativa dell'assistente principale.",
    placeholders: ["{{USER_CONTEXT}}", "{{TOOLS}}"],
    requiredPlaceholders: ["{{USER_CONTEXT}}", "{{TOOLS}}"],
    defaultValue:
      "Sei Wendy, assistente operativa di NorthStar. Aiuta l'utente a orientarsi, pianificare e usare i tool dell'app in modo concreto.\n\nContesto utente:\n{{USER_CONTEXT}}\n\nTool disponibili:\n{{TOOLS}}",
  },
  {
    key: "knowledge.auto_link",
    label: "Knowledge Graph - Collegamenti",
    description: "Istruzioni per suggerire relazioni semantiche tra nodi.",
    placeholders: ["{{SOURCE_NODE}}", "{{CANDIDATES}}"],
    requiredPlaceholders: ["{{SOURCE_NODE}}", "{{CANDIDATES}}"],
    defaultValue:
      "Analizza il nodo sorgente e collega solo candidati con relazione semantica chiara.\n\nNodo sorgente:\n{{SOURCE_NODE}}\n\nCandidati:\n{{CANDIDATES}}\n\nRestituisci etichette brevi e motivazioni verificabili.",
  },
  {
    key: "memory_graph.retrieval",
    label: "Cervello Wendy - Retrieval",
    description: "Regole per usare memoria semantica, grafo e provenance nelle risposte Wendy.",
    placeholders: ["{{QUERY}}", "{{MEMORY_RESULTS}}", "{{RELATIONS}}"],
    requiredPlaceholders: ["{{QUERY}}", "{{MEMORY_RESULTS}}"],
    defaultValue:
      "Usa la memoria personale recuperata solo quando e rilevante per la query.\n\nQuery:\n{{QUERY}}\n\nNodi memoria:\n{{MEMORY_RESULTS}}\n\nRelazioni:\n{{RELATIONS}}\n\nCita le fonti interne, segnala confidence bassa e non inventare dettagli non presenti.",
  },
  {
    key: "growth.research",
    label: "Growth Research",
    description: "Guida per generare contenuti di crescita professionale.",
    placeholders: ["{{TOPIC}}", "{{AUDIENCE}}"],
    requiredPlaceholders: ["{{TOPIC}}", "{{AUDIENCE}}"],
    defaultValue:
      "Crea contenuti pratici, aggiornati e orientati all'azione.\n\nTema:\n{{TOPIC}}\n\nAudience:\n{{AUDIENCE}}\n\nEvita generalita e includi passi concreti per professionisti e team.",
  },
];

export function persistenceFallback(reason: string, setupAction: "run_migrations" | "check_database" | "check_schema" = "run_migrations") {
  return {
    persistenceUnavailable: true,
    reason,
    setupAction,
  };
}

export function findDefaultPrompt(key: string) {
  return DEFAULT_PROMPTS.find((prompt) => prompt.key === key);
}

function extractPromptPlaceholders(value: string) {
  return Array.from(new Set(value.match(/{{\s*[A-Z0-9_]+\s*}}/g) ?? []))
    .map((placeholder) => placeholder.replace(/\s+/g, ""));
}

export function validatePromptValue(
  value: string,
  allowedPlaceholders: string[],
  requiredPlaceholders: string[],
) {
  const placeholders = extractPromptPlaceholders(value);
  const unknownPlaceholders = placeholders.filter(
    (placeholder) => !allowedPlaceholders.includes(placeholder),
  );
  const missingRequiredPlaceholders = requiredPlaceholders.filter(
    (placeholder) => !placeholders.includes(placeholder),
  );
  const missingPlaceholders = allowedPlaceholders.filter(
    (placeholder) =>
      !placeholders.includes(placeholder) &&
      !missingRequiredPlaceholders.includes(placeholder),
  );
  const errors: string[] = [];
  const warnings: string[] = [];

  if (value.trim().length < 10) errors.push("Il prompt deve contenere almeno 10 caratteri.");
  if (unknownPlaceholders.length > 0) {
    errors.push(`Placeholder non supportati: ${unknownPlaceholders.join(", ")}`);
  }
  if (missingRequiredPlaceholders.length > 0) {
    errors.push(`Placeholder obbligatori mancanti: ${missingRequiredPlaceholders.join(", ")}`);
  }
  if (missingPlaceholders.length > 0) {
    warnings.push(`Placeholder non usati: ${missingPlaceholders.join(", ")}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    placeholders,
    unknownPlaceholders,
    missingPlaceholders,
    missingRequiredPlaceholders,
  };
}

export function sampleVariables(placeholders: string[], provided?: Record<string, unknown>) {
  const defaults: Record<string, string> = {
    USER_CONTEXT: "Utente: Product Manager, obiettivo: pianificare crescita professionale nei prossimi 90 giorni.",
    TOOLS: "calendar.createEvent, objectives.create, knowledge.linkNodes, news.search",
    SOURCE_NODE: "Nodo: AI Strategy - competenze, decisioni e opportunita correlate.",
    CANDIDATES: "Product Strategy, Automazione Processi, Roadmap Competenze",
    TOPIC: "leadership operativa con AI",
    AUDIENCE: "professionisti e team business",
  };
  const variables: Record<string, string> = {};
  for (const placeholder of placeholders) {
    const key = placeholder.replace(/[{}]/g, "");
    variables[key] = String(provided?.[key] ?? defaults[key] ?? `[${key}]`);
  }
  return variables;
}

export function renderPrompt(value: string, variables: Record<string, string>) {
  return value.replace(/{{\s*([A-Z0-9_]+)\s*}}/g, (_match, key: string) => variables[key] ?? `[${key}]`);
}

export async function ensurePromptRegistry(prompt: AgentPrompt): Promise<PromptRegistryRecord> {
  const requiredPlaceholders = prompt.requiredPlaceholders ?? [];
  const now = new Date();
  const existing = await db
    .select()
    .from(agentPromptsTable)
    .where(eq(agentPromptsTable.key, prompt.key))
    .limit(1);

  let record: PromptRegistryRecord | undefined = existing[0];
  if (!record) {
    const [created] = await db
      .insert(agentPromptsTable)
      .values({
        key: prompt.key,
        label: prompt.label,
        description: prompt.description,
        defaultValue: prompt.defaultValue,
        placeholders: prompt.placeholders,
        requiredPlaceholders,
        updatedAt: now,
      })
      .returning();
    record = requireReturnedRow(
      created,
      `Prompt registry insert did not return a record for ${prompt.key}`,
    );
  } else {
    const [updated] = await db
      .update(agentPromptsTable)
      .set({
        label: prompt.label,
        description: prompt.description,
        defaultValue: prompt.defaultValue,
        placeholders: prompt.placeholders,
        requiredPlaceholders,
        updatedAt: now,
      })
      .where(eq(agentPromptsTable.id, record.id))
      .returning();
    record = requireReturnedRow(
      updated,
      `Prompt registry update did not return a record for ${prompt.key}`,
    );
  }

  const active = await db
    .select()
    .from(agentPromptVersionsTable)
    .where(and(
      eq(agentPromptVersionsTable.promptId, record.id),
      eq(agentPromptVersionsTable.status, "active"),
    ))
    .orderBy(desc(agentPromptVersionsTable.createdAt))
    .limit(1);

  if (!active[0]) {
    const [createdVersion] = await db
      .insert(agentPromptVersionsTable)
      .values({
        promptId: record.id,
        versionNumber: 1,
        status: "active",
        value: prompt.defaultValue,
        notes: "Versione default iniziale",
        publishedAt: now,
      })
      .returning();
    const version: PromptVersionRecord = requireReturnedRow(
      createdVersion,
      `Prompt default version insert did not return a record for ${prompt.key}`,
    );
    const [updatedRegistry] = await db
      .update(agentPromptsTable)
      .set({ activeVersionId: version.id, updatedAt: now })
      .where(eq(agentPromptsTable.id, record.id))
      .returning();
    record = requireReturnedRow(
      updatedRegistry,
      `Prompt registry active version update did not return a record for ${prompt.key}`,
    );
  }

  return record;
}

export async function getNextPromptVersionNumber(promptId: number) {
  const [row] = await db
    .select({
      next: sql<number>`coalesce(max(${agentPromptVersionsTable.versionNumber}), 0)::int + 1`,
    })
    .from(agentPromptVersionsTable)
    .where(eq(agentPromptVersionsTable.promptId, promptId));
  return Number(row?.next) || 1;
}

export async function getPromptVersions(promptId: number) {
  return db
    .select()
    .from(agentPromptVersionsTable)
    .where(eq(agentPromptVersionsTable.promptId, promptId))
    .orderBy(desc(agentPromptVersionsTable.versionNumber));
}

export async function getPromptPayload(prompt: AgentPrompt) {
  const registry = await ensurePromptRegistry(prompt);
  const versions = await getPromptVersions(registry.id);
  const activeVersion =
    versions.find((version) => version.id === registry.activeVersionId) ??
    versions.find((version) => version.status === "active") ??
    null;
  const draftVersion = versions.find((version) => version.status === "draft") ?? null;
  const currentValue = activeVersion?.value ?? registry.defaultValue;
  const draftValue = draftVersion?.value ?? currentValue;
  const validation = validatePromptValue(
    draftValue,
    registry.placeholders,
    registry.requiredPlaceholders,
  );

  return {
    key: registry.key,
    label: registry.label,
    description: registry.description,
    placeholders: registry.placeholders,
    requiredPlaceholders: registry.requiredPlaceholders,
    defaultValue: registry.defaultValue,
    currentValue,
    draftValue,
    isOverridden: currentValue !== registry.defaultValue,
    hasDraft: Boolean(draftVersion),
    activeVersionId: activeVersion?.id ?? null,
    activeVersionNumber: activeVersion?.versionNumber ?? null,
    draftVersionId: draftVersion?.id ?? null,
    draftVersionNumber: draftVersion?.versionNumber ?? null,
    updatedAt: activeVersion?.publishedAt?.toISOString() ?? activeVersion?.updatedAt.toISOString() ?? null,
    updatedBy: activeVersion?.createdBy ? `User #${activeVersion.createdBy}` : null,
    validation,
  };
}

export function getDefaultPromptPayload(prompt: AgentPrompt) {
  const requiredPlaceholders = prompt.requiredPlaceholders ?? [];
  const validation = validatePromptValue(
    prompt.defaultValue,
    prompt.placeholders,
    requiredPlaceholders,
  );

  return {
    key: prompt.key,
    label: prompt.label,
    description: prompt.description,
    placeholders: prompt.placeholders,
    requiredPlaceholders,
    defaultValue: prompt.defaultValue,
    currentValue: prompt.defaultValue,
    draftValue: prompt.defaultValue,
    isOverridden: false,
    hasDraft: false,
    activeVersionId: null,
    activeVersionNumber: null,
    draftVersionId: null,
    draftVersionNumber: null,
    updatedAt: null,
    updatedBy: null,
    validation,
    persistenceUnavailable: true,
    reason: "prompts_persistence_unavailable",
    setupAction: "run_migrations",
  };
}
