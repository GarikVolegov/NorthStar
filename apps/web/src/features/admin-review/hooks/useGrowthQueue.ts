import { useCallback, useState } from "react";
import { growthArticleToForm } from "../adminReviewConfig";
import type {
  GrowthArticleDetail,
  GrowthArticleForm,
  GrowthArticlePreview,
  GrowthQueueResponse,
  GrowthQueueStatus,
} from "../adminReviewTypes";
import {
  fetchGrowthArticleDetail,
  fetchGrowthQueue,
  previewGrowthArticle,
  publishGrowthArticle,
  rejectGrowthArticle,
  saveGrowthArticle,
  type AdminReviewApiFetch,
} from "../api/adminReviewApi";

export function useGrowthQueue(apiFetch: AdminReviewApiFetch) {
  const [data, setData] = useState<GrowthQueueResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<GrowthQueueStatus>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<GrowthArticleDetail | null>(null);
  const [form, setForm] = useState<GrowthArticleForm>(growthArticleToForm(null));
  const [fields, setFields] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [preview, setPreview] = useState<GrowthArticlePreview | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchGrowthQueue(apiFetch, { status, search }));
    } catch {
      /* handled by apiFetch */
    }
    setLoading(false);
  }, [apiFetch, search, status]);

  const loadDetail = useCallback(
    async (id: number) => {
      setActionLoading("detail");
      setFields({});
      try {
        const detail = await fetchGrowthArticleDetail(apiFetch, id);
        setSelected(detail);
        setForm(growthArticleToForm(detail.article));
        setPreview(detail.preview ?? null);
        setRejectReason("");
      } catch {
        /* handled by apiFetch */
      }
      setActionLoading(null);
    },
    [apiFetch],
  );

  const runAction = useCallback(
    async (action: "save" | "preview" | "publish" | "reject") => {
      if (!selected?.article?.id) return;
      const id = selected.article.id;
      setActionLoading(action);
      setFields({});
      try {
        const payload = {
          ...form,
          tags: Array.isArray(form.tags)
            ? form.tags
            : String(form.tags ?? "")
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
          readTimeMinutes: Number(form.readTimeMinutes) || 1,
        };
        const result =
          action === "save"
            ? await saveGrowthArticle(apiFetch, id, payload)
            : action === "preview"
              ? await previewGrowthArticle(apiFetch, id, payload)
              : action === "publish"
                ? await publishGrowthArticle(apiFetch, id)
                : await rejectGrowthArticle(apiFetch, id, rejectReason);

        if (result.preview) setPreview(result.preview);
        if (result.article) {
          await load();
          await loadDetail(result.article.id);
        }
      } catch (error) {
        const err = error as Error & { fields?: Record<string, string> };
        setFields(err.fields ?? {});
      }
      setActionLoading(null);
    },
    [apiFetch, form, load, loadDetail, rejectReason, selected],
  );

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setSelected(null);
    setPreview(null);
    setFields({});
    setActionLoading(null);
  }, []);

  return {
    data,
    loading,
    status,
    search,
    selected,
    form,
    fields,
    actionLoading,
    rejectReason,
    preview,
    setStatus,
    setSearch,
    setSelected,
    setForm,
    setRejectReason,
    load,
    loadDetail,
    runAction,
    reset,
  };
}
