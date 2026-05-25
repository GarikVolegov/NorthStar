import type { ContactInboxResponse, ContactMessageItem } from "@/components/admin/console";
import { useCallback, useState } from "react";
import {
  fetchContactMessages,
  updateContactMessage,
  type AdminReviewApiFetch,
} from "../api/adminReviewApi";

export function useAdminMessages(apiFetch: AdminReviewApiFetch) {
  const [data, setData] = useState<ContactInboxResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("all");
  const [read, setRead] = useState("all");
  const [assignedTo, setAssignedTo] = useState("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ContactMessageItem | null>(null);
  const [notes, setNotes] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchContactMessages(apiFetch, { status, read, assignedTo, search }));
    } catch {
      /* handled by apiFetch */
    }
    setLoading(false);
  }, [apiFetch, assignedTo, read, search, status]);

  const selectMessage = useCallback((message: ContactMessageItem) => {
    setSelected(message);
    setNotes(message.internalNotes ?? "");
  }, []);

  const update = useCallback(
    async (
      id: number,
      path: "read" | "status" | "notes" | "assign",
      body: Record<string, unknown>,
    ) => {
      setActionLoading(path);
      try {
        const updated = await updateContactMessage(apiFetch, id, path, body);
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
    assignedTo,
    search,
    selected,
    notes,
    actionLoading,
    setStatus,
    setRead,
    setAssignedTo,
    setSearch,
    setNotes,
    load,
    selectMessage,
    update,
    reset,
  };
}
