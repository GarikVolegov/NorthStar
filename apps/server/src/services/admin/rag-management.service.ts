export interface RagSourceInput {
  name?: unknown;
  url?: unknown;
  sourceType?: unknown;
}

export function normalizeRagSourceInput(input: RagSourceInput) {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const url = typeof input.url === "string" ? input.url.trim() : "";
  const sourceType = typeof input.sourceType === "string" && input.sourceType.trim()
    ? input.sourceType.trim()
    : "manual";

  if (!name) throw new Error("RAG source name is required");
  return { name, ...(url ? { url } : {}), sourceType };
}
