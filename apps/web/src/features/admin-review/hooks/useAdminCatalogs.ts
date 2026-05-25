import type { PersistenceMeta } from "@/components/admin/console";
import { useCallback, useState } from "react";
import {
  defaultCatalogPayload,
} from "../adminReviewConfig";
import type {
  CatalogOverviewItem,
  CatalogPreview,
  CatalogResponse,
  CatalogType,
} from "../adminReviewTypes";
import {
  fetchCatalogDetail,
  fetchCatalogItems,
  fetchCatalogOverview,
  previewCatalogDraft,
  publishCatalogDraft,
  saveCatalogDraft,
  setCatalogArchiveState,
  type AdminReviewApiFetch,
} from "../api/adminReviewApi";

type CatalogEntity = Record<string, unknown>;

function compactPersistenceMeta(meta: {
  persistenceUnavailable?: boolean | undefined;
  reason?: string | null | undefined;
  setupAction?: string | null | undefined;
}): PersistenceMeta {
  const compact: PersistenceMeta = {};
  if (meta.persistenceUnavailable !== undefined) compact.persistenceUnavailable = meta.persistenceUnavailable;
  if (meta.reason !== undefined) compact.reason = meta.reason;
  if (meta.setupAction !== undefined) compact.setupAction = meta.setupAction;
  return compact;
}

function parseJsonPayload(
  payloadText: string,
  setFields: (fields: Record<string, string>) => void,
) {
  try {
    const parsed = JSON.parse(payloadText) as unknown;
    setFields({});
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    setFields({ json: "JSON non valido: correggi la sintassi prima di continuare." });
    return null;
  }
}

export function useAdminCatalogs(apiFetch: AdminReviewApiFetch) {
  const [overview, setOverview] = useState<CatalogOverviewItem[]>([]);
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<CatalogType>("sectors");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [selected, setSelected] = useState<CatalogEntity | null>(null);
  const [draftId, setDraftId] = useState<number | null>(null);
  const [payloadText, setPayloadText] = useState(
    JSON.stringify(defaultCatalogPayload("sectors"), null, 2),
  );
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState<CatalogPreview | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [auditTrail, setAuditTrail] = useState<CatalogEntity[]>([]);
  const [persistence, setPersistence] = useState<PersistenceMeta>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewData, catalogData] = await Promise.all([
        fetchCatalogOverview(apiFetch),
        fetchCatalogItems(apiFetch, type, { search, status }),
      ]);
      setOverview(overviewData.items ?? []);
      setData(catalogData);
      setPersistence(compactPersistenceMeta({
        persistenceUnavailable: Boolean(overviewData.persistenceUnavailable || catalogData.persistenceUnavailable),
        reason: overviewData.reason ?? catalogData.reason ?? null,
        setupAction: overviewData.setupAction ?? catalogData.setupAction ?? null,
      }));
    } catch {
      /* handled by apiFetch */
    }
    setLoading(false);
  }, [apiFetch, search, status, type]);

  const openDraft = useCallback((nextType: CatalogType) => {
    setType(nextType);
    setSelected(null);
    setDraftId(null);
    setFields({});
    setPreview(null);
    setAuditTrail([]);
    setNotes("");
    setPayloadText(JSON.stringify(defaultCatalogPayload(nextType), null, 2));
  }, []);

  const selectType = useCallback((nextType: CatalogType) => {
    setType(nextType);
    setSelected(null);
    setDraftId(null);
    setPreview(null);
    setFields({});
    setPayloadText(JSON.stringify(defaultCatalogPayload(nextType), null, 2));
  }, []);

  const openItem = useCallback(
    async (item: CatalogEntity) => {
      setSelected(item);
      setDraftId(null);
      setFields({});
      setPreview(null);
      setNotes("");
      setPayloadText(JSON.stringify(item, null, 2));
      setActionLoading(`detail:${item.id}`);
      try {
        const detailData = await fetchCatalogDetail(apiFetch, type, Number(item.id));
        const entity = detailData.entity ?? item;
        setSelected(entity);
        setPayloadText(JSON.stringify(entity, null, 2));
        setAuditTrail(detailData.auditTrail ?? []);
      } catch {
        /* handled by apiFetch */
      }
      setActionLoading(null);
    },
    [apiFetch, type],
  );

  const runAction = useCallback(
    async (action: "preview" | "draft" | "publish" | "archive" | "restore") => {
      const selectedId = Number(selected?.id);
      const payload = parseJsonPayload(payloadText, setFields);
      if ((action === "preview" || action === "draft") && !payload) return;
      if ((action === "archive" || action === "restore") && !selectedId) {
        setFields({ item: "Seleziona un elemento gia pubblicato." });
        return;
      }
      if (action === "publish" && !draftId && !selectedId) {
        setFields({ draft: "Salva una bozza prima di pubblicare un nuovo elemento." });
        return;
      }

      setActionLoading(action);
      try {
        if (action === "preview" && payload) {
          const result = await previewCatalogDraft(apiFetch, type, payload);
          setPreview(result.preview);
        } else if (action === "draft" && payload) {
          const result = await saveCatalogDraft(apiFetch, type, payload, notes, selectedId || null);
          setDraftId(result.draft?.id ?? null);
          setPreview(result.preview);
          await load();
        } else if (action === "publish") {
          const publishId = draftId ?? selectedId;
          const result = await publishCatalogDraft(apiFetch, type, publishId, notes);
          setSelected(result.entity ?? null);
          setDraftId(null);
          setPayloadText(JSON.stringify(result.entity ?? payload, null, 2));
          await load();
        } else if (action === "archive" || action === "restore") {
          const result = await setCatalogArchiveState(apiFetch, type, selectedId, action, notes);
          setSelected(result.entity ?? null);
          setPayloadText(JSON.stringify(result.entity ?? payload, null, 2));
          await load();
        }
        setFields({});
      } catch (err) {
        const error = err as Error & { fields?: Record<string, string> };
        setFields(error.fields ?? { general: error.message });
      }
      setActionLoading(null);
    },
    [apiFetch, draftId, load, notes, payloadText, selected, type],
  );

  const openExistingDraft = useCallback((draft: CatalogResponse["drafts"][number]) => {
    setDraftId(draft.id);
    setSelected(draft.entityId ? { id: draft.entityId, ...draft.payload } : null);
    setPayloadText(JSON.stringify(draft.payload, null, 2));
    setPreview(null);
    setFields({});
  }, []);

  const reset = useCallback(() => {
    setOverview([]);
    setData(null);
    setLoading(false);
    setSelected(null);
    setDraftId(null);
    setFields({});
    setPreview(null);
    setAuditTrail([]);
    setActionLoading(null);
    setPersistence({});
  }, []);

  return {
    overview,
    data,
    loading,
    type,
    search,
    status,
    selected,
    draftId,
    payloadText,
    notes,
    preview,
    fields,
    actionLoading,
    auditTrail,
    persistence,
    setSearch,
    setStatus,
    setPayloadText,
    setNotes,
    load,
    openDraft,
    selectType,
    openItem,
    runAction,
    openExistingDraft,
    reset,
  };
}
