import type {
  AdminSubscriptionDetail,
  AdminSubscriptionItem,
  AdminSubscriptionPlan,
  AdminSubscriptionsResponse,
} from "@/components/admin/console";
import { useCallback, useState } from "react";
import {
  fetchAdminSubscriptionDetail,
  fetchAdminSubscriptions,
  updateAdminSubscription,
  type AdminReviewApiFetch,
} from "../api/adminReviewApi";

export type AdminSubscriptionForm = {
  plan: AdminSubscriptionPlan;
  validUntil: string;
  reason: string;
};

const EMPTY_FORM: AdminSubscriptionForm = {
  plan: "free",
  validUntil: "",
  reason: "",
};

function detailToForm(detail: AdminSubscriptionDetail): AdminSubscriptionForm {
  return {
    plan: detail.current.plan,
    validUntil: detail.current.validUntil
      ? new Date(detail.current.validUntil).toISOString().slice(0, 10)
      : "",
    reason: "",
  };
}

export function useAdminSubscriptions(apiFetch: AdminReviewApiFetch) {
  const [data, setData] = useState<AdminSubscriptionsResponse | null>(null);
  const [detail, setDetail] = useState<AdminSubscriptionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [form, setForm] = useState<AdminSubscriptionForm>(EMPTY_FORM);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchAdminSubscriptions(apiFetch, {
        search,
        plan: planFilter,
        status: statusFilter,
      }));
    } catch {
      /* handled by apiFetch */
    }
    setLoading(false);
  }, [apiFetch, planFilter, search, statusFilter]);

  const loadDetail = useCallback(
    async (userId: number) => {
      setDetailLoading(true);
      setFields({});
      try {
        const nextDetail = await fetchAdminSubscriptionDetail(apiFetch, userId);
        setDetail(nextDetail);
        setForm(detailToForm(nextDetail));
      } catch {
        /* handled by apiFetch */
      }
      setDetailLoading(false);
    },
    [apiFetch],
  );

  const selectUser = useCallback(
    (item: AdminSubscriptionItem) => {
      void loadDetail(item.user.id);
    },
    [loadDetail],
  );

  const save = useCallback(async () => {
    if (!detail?.user?.id) return;
    setActionLoading(true);
    setFields({});
    try {
      const result = await updateAdminSubscription(apiFetch, detail.user.id, {
        plan: form.plan,
        validUntil: form.plan === "free" || !form.validUntil
          ? null
          : new Date(`${form.validUntil}T23:59:59`).toISOString(),
        reason: form.reason,
      });
      if (result.detail) {
        setDetail(result.detail);
        setForm(detailToForm(result.detail));
      }
      await load();
    } catch (error) {
      const err = error as Error & { fields?: Record<string, string> };
      setFields(err.fields ?? { general: err.message ?? "Salvataggio non riuscito." });
    }
    setActionLoading(false);
  }, [apiFetch, detail, form, load]);

  const reset = useCallback(() => {
    setData(null);
    setDetail(null);
    setLoading(false);
    setDetailLoading(false);
    setActionLoading(false);
    setFields({});
    setForm(EMPTY_FORM);
  }, []);

  return {
    data,
    detail,
    loading,
    detailLoading,
    actionLoading,
    search,
    planFilter,
    statusFilter,
    form,
    fields,
    setSearch,
    setPlanFilter,
    setStatusFilter,
    setForm,
    load,
    loadDetail,
    selectUser,
    save,
    reset,
  };
}
