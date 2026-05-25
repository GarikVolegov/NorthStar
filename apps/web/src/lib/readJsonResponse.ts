export async function readJsonResponse<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as unknown;
  if (!res.ok) throw new Error(readErrorMessage(data));
  return data as T;
}

function readErrorMessage(data: unknown) {
  return typeof data === "object" && data !== null && "error" in data && typeof data.error === "string"
    ? data.error
    : "Errore di rete";
}
