export async function responseJson<T>(res: { json: () => Promise<unknown> }): Promise<T> {
  return (await res.json()) as T;
}

export function readStringField(value: unknown, key: string): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : undefined;
}
