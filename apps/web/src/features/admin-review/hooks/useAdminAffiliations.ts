import type { AffiliationInboxResponse, AffiliationLeadItem } from "@/components/admin/console";
import { useCallback, useState } from "react";
import {
  fetchAffiliationLeads,
  updateAffiliationLead,
  type AdminReviewApiFetch,
} from "../api/adminReviewApi";

export function useAdminAffiliations(apiFetch: AdminReviewApiFetch) {
  const [data, setData] = useState<AffiliationInboxResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("all");
  const [read, setRead] = useState("all");
  const [source, setSource] = useState("all");
  const [assignedTo, setAssignedTo] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<AffiliationLeadItem | null>(null);
  const [notes, setNotes] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchAffiliationLeads(apiFetch, { status, read, source, assignedTo, search }));
    } catch {
      /* handled by apiFetch */
    }
    setLoading(false);
  }, [apiFetch, assignedTo, read, search, source, status]);

  const selectLead = useCallback((lead: AffiliationLeadItem) => {
    setSelected(lead);
    setNotes(lead.internalNotes ?? "");
  }, []);

  const update = useCallback(
    async (
      id: number,
      path: "read" | "status" | "notes" | "assign",
      body: Record<string, unknown>,
    ) => {
      setActionLoading(path);
      try {
        const updated = await updateAffiliationLead(apiFetch, id, path, body);
        setSelected(updated);
        setNotes(updated.internalNotes ?? "");
        await load();
      } catch {
        /* handled by apiFetch */
      }
      setActionLoading(null);
    },
    [apiFetch, load],
  );

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setStatus("all");
    setRead("all");
    setSource("all");
    setAssignedTo("all");
    setSearch("");
    setSelected(null);
    setNotes("");
    setActionLoading(null);
  }, []);

  return {
    data,
    loading,
    status,
    read,
    source,
    assignedTo,
    search,
    selected,
    notes,
    actionLoading,
    setStatus,
    setRead,
    setSource,
    setAssignedTo,
    setSearch,
    setNotes,
    load,
    selectLead,
    update,
    reset,
  };
}
