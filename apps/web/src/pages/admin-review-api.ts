export function readApiError(body: unknown): string | undefined {
  return typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
    ? body.error
    : undefined;
}

export function readApiErrorFields(
  body: unknown,
): Record<string, string> | undefined {
  if (typeof body !== "object" || body === null || !("fields" in body)) {
    return undefined;
  }
  const fields = body.fields;
  if (typeof fields !== "object" || fields === null || Array.isArray(fields)) {
    return undefined;
  }
  const entries = Object.entries(fields).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}
