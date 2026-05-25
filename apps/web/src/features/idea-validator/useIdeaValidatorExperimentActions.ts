import { useCallback, type Dispatch, type SetStateAction } from "react";

import { apiFetch } from "@/lib/api-fetch";

import { EXPERIMENT_TEMPLATES } from "./ideaValidatorConfig";
import type {
  ExperimentAction,
  GuidedExperiment,
  TimelineEventType,
} from "./ideaValidatorTypes";
import { createExperimentFromTemplate } from "./ideaValidatorUtils";
import { readResponseError } from "../../pages/validatore-idea-api";

const BASE = import.meta.env.BASE_URL || "/";

interface ExperimentActionOptions {
  activeExperiment: GuidedExperiment | null;
  selectedTemplate: string;
  ideaName: string;
  setExperiments: Dispatch<SetStateAction<GuidedExperiment[]>>;
  setActiveExperimentId: Dispatch<SetStateAction<string>>;
  setSelectedTemplate: Dispatch<SetStateAction<string>>;
  setExperimentActionLoading: Dispatch<SetStateAction<ExperimentAction | null>>;
  setExperimentActionError: Dispatch<SetStateAction<string>>;
  addTimelineEvent: (
    type: TimelineEventType,
    title: string,
    description: string,
    metadata?: Record<string, unknown>,
  ) => void;
  markDirty: () => void;
}

export function useIdeaValidatorExperimentActions(options: ExperimentActionOptions) {
  const {
    activeExperiment,
    selectedTemplate,
    ideaName,
    setExperiments,
    setActiveExperimentId,
    setSelectedTemplate,
    setExperimentActionLoading,
    setExperimentActionError,
    addTimelineEvent,
    markDirty,
  } = options;

  const updateActiveExperiment = useCallback(
    <K extends keyof GuidedExperiment>(key: K, value: GuidedExperiment[K]) => {
      if (!activeExperiment) return;
      const now = new Date().toISOString();
      setExperiments((current) =>
        current.map((item) =>
          item.id === activeExperiment.id ? { ...item, [key]: value, updatedAt: now } : item,
        ),
      );
      if (key === "status" && value === "completed" && activeExperiment.status !== "completed") {
        addTimelineEvent("experiment_completed", "Esperimento completato", activeExperiment.title, {
          experimentId: activeExperiment.id,
        });
      }
      markDirty();
    },
    [activeExperiment, addTimelineEvent, markDirty, setExperiments],
  );

  const patchActiveExperiment = useCallback(
    (patch: Partial<GuidedExperiment>) => {
      if (!activeExperiment) return;
      const now = new Date().toISOString();
      setExperiments((current) =>
        current.map((item) =>
          item.id === activeExperiment.id ? { ...item, ...patch, updatedAt: now } : item,
        ),
      );
      markDirty();
    },
    [activeExperiment, markDirty, setExperiments],
  );

  const createExperiment = useCallback(
    (templateId = selectedTemplate) => {
      const template =
        EXPERIMENT_TEMPLATES.find((item) => item.template === templateId) ??
        EXPERIMENT_TEMPLATES[0];
      if (!template) return;
      const next = createExperimentFromTemplate(template);
      setExperiments((current) => [next, ...current]);
      setActiveExperimentId(next.id);
      setSelectedTemplate(template.template);
      addTimelineEvent("experiment_created", "Esperimento creato", next.title, {
        experimentId: next.id,
        template: next.template,
      });
      markDirty();
    },
    [addTimelineEvent, markDirty, selectedTemplate, setActiveExperimentId, setExperiments, setSelectedTemplate],
  );

  const duplicateActiveExperiment = useCallback(() => {
    if (!activeExperiment) return;
    const next = createExperimentFromTemplate(EXPERIMENT_TEMPLATES[0], {
      ...activeExperiment,
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `experiment-${Date.now()}`,
      title: `${activeExperiment.title} - copia`,
      status: "planned",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setExperiments((current) => [next, ...current]);
    setActiveExperimentId(next.id);
    addTimelineEvent("experiment_created", "Esperimento duplicato", next.title, {
      experimentId: next.id,
      sourceExperimentId: activeExperiment.id,
    });
    markDirty();
  }, [activeExperiment, addTimelineEvent, markDirty, setActiveExperimentId, setExperiments]);

  const discardActiveExperiment = useCallback(() => {
    if (!activeExperiment) return;
    updateActiveExperiment("status", "discarded");
  }, [activeExperiment, updateActiveExperiment]);

  const experimentDueDate = useCallback(() => {
    if (activeExperiment?.deadline) return activeExperiment.deadline;
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 7);
    return fallback.toISOString().slice(0, 10);
  }, [activeExperiment]);

  const experimentDescription = useCallback(() => {
    if (!activeExperiment) return "";
    return [
      activeExperiment.objective && `Obiettivo: ${activeExperiment.objective}`,
      activeExperiment.hypothesis && `Ipotesi: ${activeExperiment.hypothesis}`,
      activeExperiment.metric && `Misura: ${activeExperiment.metric}`,
      activeExperiment.expectedResult && `Risultato atteso: ${activeExperiment.expectedResult}`,
      ideaName && `Idea: ${ideaName}`,
    ]
      .filter(Boolean)
      .join("\n");
  }, [activeExperiment, ideaName]);

  const createExperimentObjective = useCallback(async () => {
    if (!activeExperiment || activeExperiment.objectiveId) return;
    setExperimentActionLoading("objective");
    setExperimentActionError("");
    try {
      const res = await apiFetch(`${BASE}api/objectives`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: activeExperiment.title || "Esperimento idea",
          category: "business",
          dueDate: experimentDueDate(),
        }),
      });
      if (!res.ok) throw new Error(await readResponseError(res, "Errore nella creazione del task"));
      const objective = (await res.json()) as { id: number };
      patchActiveExperiment({ objectiveId: objective.id });
    } catch (err) {
      setExperimentActionError(err instanceof Error ? err.message : "Errore nella creazione del task");
    } finally {
      setExperimentActionLoading(null);
    }
  }, [activeExperiment, experimentDueDate, patchActiveExperiment, setExperimentActionError, setExperimentActionLoading]);

  const createExperimentCalendarEvent = useCallback(
    async (type: "calendar" | "reminder") => {
      if (!activeExperiment) return;
      if (type === "calendar" && activeExperiment.calendarEventId) return;
      if (type === "reminder" && activeExperiment.reminderEventId) return;
      setExperimentActionLoading(type);
      setExperimentActionError("");
      try {
        const start = new Date();
        if (type === "reminder") start.setDate(start.getDate() + 7);
        else if (activeExperiment.deadline) {
          const [year, month, day] = activeExperiment.deadline.split("-").map(Number);
          if (year && month && day) start.setFullYear(year, month - 1, day);
        }
        start.setHours(9, 0, 0, 0);
        const end = new Date(start);
        end.setHours(type === "reminder" ? 9 : 10, type === "reminder" ? 30 : 0, 0, 0);
        const res = await apiFetch(`${BASE}api/calendar/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: type === "reminder" ? `Promemoria: ${activeExperiment.title || "esperimento idea"}` : activeExperiment.title || "Esperimento idea",
            description: experimentDescription(),
            startAt: start.toISOString(),
            endAt: end.toISOString(),
            allDay: false,
            category: "task",
            priority: "medium",
            status: "todo",
            tags: ["idea", "esperimento"],
            linkedContentIds: [],
            isRecurring: false,
          }),
        });
        if (!res.ok) throw new Error(await readResponseError(res, "Errore nella creazione dell'evento"));
        const event = (await res.json()) as { id: number };
        patchActiveExperiment(type === "reminder" ? { reminderEventId: event.id } : { calendarEventId: event.id });
      } catch (err) {
        setExperimentActionError(err instanceof Error ? err.message : "Errore nella creazione dell'evento");
      } finally {
        setExperimentActionLoading(null);
      }
    },
    [activeExperiment, experimentDescription, patchActiveExperiment, setExperimentActionError, setExperimentActionLoading],
  );

  const completeActiveExperiment = useCallback(async () => {
    if (!activeExperiment) return;
    setExperimentActionLoading("complete");
    setExperimentActionError("");
    try {
      if (activeExperiment.objectiveId) {
        const res = await apiFetch(`${BASE}api/objectives/${activeExperiment.objectiveId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completed: true }),
        });
        if (!res.ok && res.status !== 404) throw new Error(await readResponseError(res, "Errore nel completamento del task"));
      }
      patchActiveExperiment({ status: "completed", completedAt: new Date().toISOString() });
      addTimelineEvent("experiment_completed", "Esperimento completato", activeExperiment.title, {
        experimentId: activeExperiment.id,
        objectiveId: activeExperiment.objectiveId,
      });
    } catch (err) {
      setExperimentActionError(err instanceof Error ? err.message : "Errore nel completamento dell'esperimento");
    } finally {
      setExperimentActionLoading(null);
    }
  }, [activeExperiment, addTimelineEvent, patchActiveExperiment, setExperimentActionError, setExperimentActionLoading]);

  return {
    createExperiment,
    duplicateActiveExperiment,
    discardActiveExperiment,
    createExperimentObjective,
    createExperimentCalendarEvent,
    completeActiveExperiment,
    updateActiveExperiment,
  };
}
