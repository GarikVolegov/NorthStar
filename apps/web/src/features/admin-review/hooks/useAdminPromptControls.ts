import {
  type AgentPrompt,
  type AiModelPolicy,
  type PersistenceMeta,
  type PromptEditorTab,
  type PromptPreview,
  type PromptVersion,
} from "@/components/admin/console";
import { useCallback, useMemo, useState } from "react";
import type { AdminReviewApiFetch } from "../api/adminReviewApi";

function compactPersistenceMeta(meta: {
  persistenceUnavailable?: boolean | undefined;
  reason?: string | null | undefined;
  setupAction?: string | null | undefined;
}): PersistenceMeta {
  const compact: PersistenceMeta = {};
  if (meta.persistenceUnavailable !== undefined) {
    compact.persistenceUnavailable = meta.persistenceUnavailable;
  }
  if (meta.reason !== undefined) {
    compact.reason = meta.reason;
  }
  if (meta.setupAction !== undefined) {
    compact.setupAction = meta.setupAction;
  }
  return compact;
}

export function useAdminPromptControls(apiFetch: AdminReviewApiFetch) {
  const [prompts, setPrompts] = useState<AgentPrompt[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [promptExpandedKey, setPromptExpandedKey] = useState<string | null>(
    null,
  );
  const [promptTab, setPromptTab] = useState<PromptEditorTab>("editor");
  const [promptEditValues, setPromptEditValues] = useState<
    Record<string, string>
  >({});
  const [promptNotes, setPromptNotes] = useState<Record<string, string>>({});
  const [promptVersions, setPromptVersions] = useState<
    Record<string, PromptVersion[]>
  >({});
  const [promptPreview, setPromptPreview] = useState<
    Record<string, PromptPreview>
  >({});
  const [promptVersionPersistence, setPromptVersionPersistence] = useState<
    Record<string, PersistenceMeta>
  >({});
  const [promptSaving, setPromptSaving] = useState<Set<string>>(new Set());
  const [aiModelPolicy, setAiModelPolicy] = useState<AiModelPolicy | null>(
    null,
  );

  const loadPrompts = useCallback(async () => {
    setPromptsLoading(true);
    try {
      const [data, policyData] = await Promise.all([
        apiFetch<AgentPrompt[]>("/admin/prompts"),
        apiFetch<{ policy?: AiModelPolicy | null }>("/admin/ai/model-policy"),
      ]);
      setPrompts(data);
      setAiModelPolicy(policyData.policy ?? null);
      const vals: Record<string, string> = {};
      const notes: Record<string, string> = {};
      for (const p of data) {
        vals[p.key] = p.draftValue ?? p.currentValue;
        notes[p.key] = "";
      }
      setPromptEditValues(vals);
      setPromptNotes(notes);
    } catch {
      /* handled */
    }
    setPromptsLoading(false);
  }, [apiFetch]);

  const loadPromptVersions = useCallback(
    async (key: string) => {
      try {
        const data = await apiFetch<{
          versions?: PromptVersion[];
        } & PersistenceMeta>(`/admin/prompts/${key}/versions`);
        setPromptVersions((prev) => ({
          ...prev,
          [key]: data.versions ?? [],
        }));
        setPromptVersionPersistence((prev) => ({
          ...prev,
          [key]: compactPersistenceMeta({
            persistenceUnavailable: data.persistenceUnavailable,
            reason: data.reason,
            setupAction: data.setupAction,
          }),
        }));
      } catch {
        /* handled */
      }
    },
    [apiFetch],
  );

  const loadPromptPreview = useCallback(
    async (key: string) => {
      setPromptSaving((prev) => new Set(prev).add(`${key}:preview`));
      try {
        const data = await apiFetch<PromptPreview>(
          `/admin/prompts/${key}/preview`,
          {
            method: "POST",
            body: JSON.stringify({ value: promptEditValues[key] ?? "" }),
          },
        );
        setPromptPreview((prev) => ({
          ...prev,
          [key]: data,
        }));
      } catch {
        /* handled */
      }
      setPromptSaving((prev) => {
        const s = new Set(prev);
        s.delete(`${key}:preview`);
        return s;
      });
    },
    [apiFetch, promptEditValues],
  );

  const savePrompt = useCallback(
    async (key: string) => {
      setPromptSaving((prev) => new Set(prev).add(`${key}:draft`));
      try {
        await apiFetch(`/admin/prompts/${key}/draft`, {
          method: "POST",
          body: JSON.stringify({
            value: promptEditValues[key],
            notes: promptNotes[key] || undefined,
          }),
        });
        await loadPrompts();
        await loadPromptVersions(key);
      } catch {
        /* handled */
      }
      setPromptSaving((prev) => {
        const s = new Set(prev);
        s.delete(`${key}:draft`);
        return s;
      });
    },
    [apiFetch, promptEditValues, promptNotes, loadPrompts, loadPromptVersions],
  );

  const publishPrompt = useCallback(
    async (key: string) => {
      setPromptSaving((prev) => new Set(prev).add(`${key}:publish`));
      try {
        await apiFetch(`/admin/prompts/${key}/publish`, { method: "POST" });
        await loadPrompts();
        await loadPromptVersions(key);
      } catch {
        /* handled */
      }
      setPromptSaving((prev) => {
        const s = new Set(prev);
        s.delete(`${key}:publish`);
        return s;
      });
    },
    [apiFetch, loadPrompts, loadPromptVersions],
  );

  const resetPrompt = useCallback(
    async (key: string) => {
      setPromptSaving((prev) => new Set(prev).add(`${key}:reset`));
      try {
        await apiFetch(`/admin/prompts/${key}/reset`, { method: "POST" });
        await loadPrompts();
        await loadPromptVersions(key);
      } catch {
        /* handled */
      }
      setPromptSaving((prev) => {
        const s = new Set(prev);
        s.delete(`${key}:reset`);
        return s;
      });
    },
    [apiFetch, loadPrompts, loadPromptVersions],
  );

  const rollbackPrompt = useCallback(
    async (key: string, versionId: number) => {
      setPromptSaving((prev) =>
        new Set(prev).add(`${key}:rollback:${versionId}`),
      );
      try {
        await apiFetch(`/admin/prompts/${key}/rollback`, {
          method: "POST",
          body: JSON.stringify({ versionId }),
        });
        await loadPrompts();
        await loadPromptVersions(key);
      } catch {
        /* handled */
      }
      setPromptSaving((prev) => {
        const s = new Set(prev);
        s.delete(`${key}:rollback:${versionId}`);
        return s;
      });
    },
    [apiFetch, loadPrompts, loadPromptVersions],
  );

  const promptsPersistenceMeta = useMemo(() => {
    const promptsPersistence = prompts.find(
      (prompt) => prompt.persistenceUnavailable,
    );
    return promptsPersistence
      ? compactPersistenceMeta({
          persistenceUnavailable: true,
          reason: promptsPersistence.reason,
          setupAction: promptsPersistence.setupAction,
        })
      : {};
  }, [prompts]);

  return {
    aiModelPolicy,
    loadPromptPreview,
    loadPromptVersions,
    loadPrompts,
    promptEditValues,
    promptExpandedKey,
    promptNotes,
    promptPreview,
    promptSaving,
    promptTab,
    promptVersionPersistence,
    promptVersions,
    prompts,
    promptsLoading,
    promptsPersistenceMeta,
    publishPrompt,
    resetPrompt,
    rollbackPrompt,
    savePrompt,
    setPromptEditValues,
    setPromptExpandedKey,
    setPromptNotes,
    setPromptTab,
  };
}
