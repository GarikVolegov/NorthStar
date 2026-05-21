export function readRoadmapSseChunk(raw: string): { content?: string; error?: string; done?: boolean } {
  const data = JSON.parse(raw) as unknown;
  if (typeof data !== "object" || data === null) return {};
  const chunk: { content?: string; error?: string; done?: boolean } = {};
  if ("content" in data && typeof data.content === "string") chunk.content = data.content;
  if ("error" in data && typeof data.error === "string") chunk.error = data.error;
  if ("done" in data && data.done === true) chunk.done = true;
  return chunk;
}

export function readRoadmapErrorMessage(data: unknown): string | undefined {
  return typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
    ? data.error
    : undefined;
}
