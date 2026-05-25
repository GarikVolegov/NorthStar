function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function readResponseError(
  res: Response,
  fallback: string,
): Promise<string> {
  try {
    const body = (await res.json()) as unknown;
    if (isRecord(body) && typeof body.error === "string") return body.error;
  } catch {
    /* ignore malformed error body */
  }
  return fallback;
}
