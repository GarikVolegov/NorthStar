import { apiFetch } from "@/lib/api-fetch";

const BASE = import.meta.env.BASE_URL || "/";

export function knowledgeApi<T>(path: string, init?: RequestInit): Promise<T> {
  return apiFetch(`${BASE}api/knowledge${path}`, init).then(async (r) => {
    if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
    return r.json() as Promise<T>;
  });
}
