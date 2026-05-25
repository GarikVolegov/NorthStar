import type {
  AdminOpsAction,
  AdminOpsStatus,
  AdminSubscriptionDetail,
  AdminSubscriptionPlan,
  AdminSubscriptionsResponse,
  AffiliationInboxResponse,
  AffiliationLeadItem,
  AgentsOverview,
  BusinessStatusSnapshot,
  ContactInboxResponse,
  ContactMessageItem,
} from "@/components/admin/console";
import type {
  CatalogOverviewItem,
  CatalogPreview,
  CatalogResponse,
  CatalogType,
  GrowthArticleDetail,
  GrowthQueueResponse,
  GrowthQueueStatus,
  MemoryGraphOverview,
} from "../adminReviewTypes";

export type AdminReviewApiFetch = <T>(path: string, options?: RequestInit) => Promise<T>;

export type AdminSubscriptionFilters = {
  search: string;
  plan: string;
  status: string;
};

export type AdminSubscriptionUpdate = {
  plan: AdminSubscriptionPlan;
  validUntil?: string | null;
  reason: string;
};

function buildQuery(params: Record<string, string | null | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && value !== "all") {
      query.set(key, value);
    }
  }
  const serialized = query.toString();
  return serialized ? `?${serialized}` : "";
}

export function fetchBusinessStatus(apiFetch: AdminReviewApiFetch, days = 30) {
  return apiFetch<BusinessStatusSnapshot>(`/admin/business-status?days=${days}`);
}

export function fetchAdminSubscriptions(
  apiFetch: AdminReviewApiFetch,
  filters: AdminSubscriptionFilters,
) {
  const query = buildQuery({
    search: filters.search.trim() || null,
    plan: filters.plan,
    status: filters.status,
  });
  return apiFetch<AdminSubscriptionsResponse>(`/admin/subscriptions${query}`);
}

export function fetchAdminSubscriptionDetail(
  apiFetch: AdminReviewApiFetch,
  userId: number,
) {
  return apiFetch<AdminSubscriptionDetail>(`/admin/subscriptions/${userId}`);
}

export function updateAdminSubscription(
  apiFetch: AdminReviewApiFetch,
  userId: number,
  payload: AdminSubscriptionUpdate,
) {
  return apiFetch<{ detail?: AdminSubscriptionDetail }>(`/admin/subscriptions/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function fetchAdminOpsStatus(apiFetch: AdminReviewApiFetch) {
  return apiFetch<AdminOpsStatus>("/admin/ops/status");
}

export function runAdminOpsAction(
  apiFetch: AdminReviewApiFetch,
  action: AdminOpsAction,
  confirmation: string,
) {
  const endpointByAction: Record<AdminOpsAction, string> = {
    "server-start": "/admin/ops/server/start",
    "server-stop": "/admin/ops/server/stop",
    "server-restart": "/admin/ops/server/restart",
    "database-restart": "/admin/ops/database/restart",
  };

  return apiFetch(endpointByAction[action], {
    method: "POST",
    body: JSON.stringify({ confirmation }),
  });
}

export function setAdminDatabaseMaintenance(
  apiFetch: AdminReviewApiFetch,
  enabled: boolean,
) {
  return apiFetch("/admin/ops/database/maintenance", {
    method: "POST",
    body: JSON.stringify({
      enabled,
      reason: enabled ? "Attivata dalla console Admin" : "Disattivata dalla console Admin",
    }),
  });
}

export function fetchCatalogOverview(apiFetch: AdminReviewApiFetch) {
  return apiFetch<{
    items?: CatalogOverviewItem[];
    persistenceUnavailable?: boolean;
    reason?: string | null;
    setupAction?: string | null;
  }>("/admin/catalogs/overview");
}

export function fetchCatalogItems(
  apiFetch: AdminReviewApiFetch,
  type: CatalogType,
  filters: { search: string; status: string },
) {
  const query = buildQuery({
    limit: "100",
    search: filters.search.trim() || null,
    status: filters.status,
  });
  return apiFetch<CatalogResponse>(`/admin/catalogs/${type}${query}`);
}

export function fetchCatalogDetail(
  apiFetch: AdminReviewApiFetch,
  type: CatalogType,
  itemId: number,
) {
  return apiFetch<{
    entity?: Record<string, unknown>;
    auditTrail?: Array<Record<string, unknown>>;
  }>(`/admin/catalogs/${type}/${itemId}`);
}

export function previewCatalogDraft(
  apiFetch: AdminReviewApiFetch,
  type: CatalogType,
  payload: Record<string, unknown>,
) {
  return apiFetch<{ preview: CatalogPreview }>(`/admin/catalogs/${type}/preview`, {
    method: "POST",
    body: JSON.stringify({ payload }),
  });
}

export function saveCatalogDraft(
  apiFetch: AdminReviewApiFetch,
  type: CatalogType,
  payload: Record<string, unknown>,
  notes: string,
  selectedId: number | null,
) {
  const path = selectedId
    ? `/admin/catalogs/${type}/${selectedId}/draft`
    : `/admin/catalogs/${type}/draft`;
  return apiFetch<{
    draft?: { id?: number | null };
    preview: CatalogPreview;
  }>(path, {
    method: "POST",
    body: JSON.stringify({ payload, notes }),
  });
}

export function publishCatalogDraft(
  apiFetch: AdminReviewApiFetch,
  type: CatalogType,
  publishId: number,
  notes: string,
) {
  return apiFetch<{ entity?: Record<string, unknown> }>(`/admin/catalogs/${type}/${publishId}/publish`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
}

export function setCatalogArchiveState(
  apiFetch: AdminReviewApiFetch,
  type: CatalogType,
  selectedId: number,
  action: "archive" | "restore",
  notes: string,
) {
  return apiFetch<{ entity?: Record<string, unknown> }>(`/admin/catalogs/${type}/${selectedId}/${action}`, {
    method: "POST",
    body: JSON.stringify({ notes }),
  });
}

export function fetchGrowthQueue(
  apiFetch: AdminReviewApiFetch,
  filters: { status: GrowthQueueStatus; search: string },
) {
  const query = buildQuery({
    status: filters.status,
    search: filters.search.trim() || null,
  });
  return apiFetch<GrowthQueueResponse>(`/admin/growth-queue${query}`);
}

export function fetchGrowthArticleDetail(apiFetch: AdminReviewApiFetch, id: number) {
  return apiFetch<GrowthArticleDetail>(`/admin/growth-queue/${id}`);
}

export function saveGrowthArticle(
  apiFetch: AdminReviewApiFetch,
  id: number,
  payload: Record<string, unknown>,
) {
  return apiFetch<{ article?: { id: number }; preview?: Record<string, unknown> }>(`/admin/growth-queue/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ payload }),
  });
}

export function previewGrowthArticle(
  apiFetch: AdminReviewApiFetch,
  id: number,
  payload: Record<string, unknown>,
) {
  return apiFetch<{ article?: { id: number }; preview?: Record<string, unknown> }>(`/admin/growth-queue/${id}/preview`, {
    method: "POST",
    body: JSON.stringify({ payload }),
  });
}

export function publishGrowthArticle(apiFetch: AdminReviewApiFetch, id: number) {
  return apiFetch<{ article?: { id: number }; preview?: Record<string, unknown> }>(`/admin/growth-queue/${id}/publish`, {
    method: "POST",
  });
}

export function rejectGrowthArticle(
  apiFetch: AdminReviewApiFetch,
  id: number,
  reason: string,
) {
  return apiFetch<{ article?: { id: number }; preview?: Record<string, unknown> }>(`/admin/growth-queue/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function fetchMemoryGraphOverview(apiFetch: AdminReviewApiFetch) {
  return apiFetch<MemoryGraphOverview>("/admin/memory-graph/overview");
}

export function backfillMemoryGraphUser(apiFetch: AdminReviewApiFetch, userId: number) {
  return apiFetch("/admin/memory-graph/backfill-user", {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export function reviewMemoryGraphRelation(
  apiFetch: AdminReviewApiFetch,
  id: number,
  action: "approve" | "reject",
) {
  return apiFetch(`/admin/memory-graph/relations/${id}/${action}`, {
    method: "POST",
    body: JSON.stringify({ reason: action === "reject" ? "Rifiutata da admin" : undefined }),
  });
}

export function fetchAgentHealth(apiFetch: AdminReviewApiFetch) {
  return apiFetch<Pick<AgentsOverview, "agents">>("/admin/agent-health");
}

export function fetchContactMessages(
  apiFetch: AdminReviewApiFetch,
  filters: { status: string; read: string; assignedTo: string; search: string },
) {
  const query = buildQuery({
    status: filters.status,
    read: filters.read,
    assignedTo: filters.assignedTo,
    search: filters.search.trim() || null,
  });
  return apiFetch<ContactInboxResponse>(`/contact/messages${query}`);
}

export function updateContactMessage(
  apiFetch: AdminReviewApiFetch,
  id: number,
  path: "read" | "status" | "notes" | "assign",
  body: Record<string, unknown>,
) {
  return apiFetch<ContactMessageItem>(`/contact/messages/${id}/${path}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function fetchAffiliationLeads(
  apiFetch: AdminReviewApiFetch,
  filters: { status: string; read: string; source: string; assignedTo: string; search: string },
) {
  const query = buildQuery({
    status: filters.status,
    read: filters.read,
    source: filters.source,
    assignedTo: filters.assignedTo,
    search: filters.search.trim() || null,
  });
  return apiFetch<AffiliationInboxResponse>(`/affiliazione/leads${query}`);
}

export function updateAffiliationLead(
  apiFetch: AdminReviewApiFetch,
  id: number,
  path: "read" | "status" | "notes" | "assign",
  body: Record<string, unknown>,
) {
  return apiFetch<AffiliationLeadItem>(`/affiliazione/leads/${id}/${path}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
