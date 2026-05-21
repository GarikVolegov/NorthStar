import { getJson, postJson, putJson, deleteJson } from "@/lib/apiClient";
import type { CatalogTab } from "./types";

const BASE = import.meta.env.BASE_URL || "/";

export function adminHeaders(adminKey: string): HeadersInit {
  return { Authorization: `Bearer ${adminKey}` };
}

export function catalogUrl(tab: CatalogTab, id?: number): string {
  return id == null
    ? `${BASE}api/admin/catalogs/${tab}`
    : `${BASE}api/admin/catalogs/${tab}/${id}`;
}

export function getCatalog<T>(tab: CatalogTab, adminKey: string): Promise<T[]> {
  return getJson<T[]>(catalogUrl(tab), { headers: adminHeaders(adminKey) });
}

export function createCatalogItem<TPayload>(
  tab: CatalogTab,
  adminKey: string,
  payload: TPayload,
): Promise<unknown> {
  return postJson(catalogUrl(tab), payload as Record<string, unknown>, {
    headers: adminHeaders(adminKey),
  });
}

export function updateCatalogItem<TPayload>(
  tab: CatalogTab,
  id: number,
  adminKey: string,
  payload: TPayload,
): Promise<unknown> {
  return putJson(catalogUrl(tab, id), payload as Record<string, unknown>, {
    headers: adminHeaders(adminKey),
  });
}

export function deleteCatalogItem(
  tab: CatalogTab,
  id: number,
  adminKey: string,
): Promise<unknown> {
  return deleteJson(catalogUrl(tab, id), { headers: adminHeaders(adminKey) });
}
