import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-fetch";
import { eventBus } from "@/lib/event-bus";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

export type WendyActionStatus =
  | "draft"
  | "needs_confirmation"
  | "running"
  | "done"
  | "failed"
  | "cancelled";

export type WendyActionRisk = "low" | "medium" | "high";

export interface WendyAction {
  id: string;
  type:
    | "navigate"
    | "set_filters"
    | "fill_form"
    | "create_objective"
    | "update_objective_progress"
    | "create_business_idea"
    | "create_calendar_event"
    | string;
  status: WendyActionStatus;
  risk: WendyActionRisk;
  label: string;
  description: string;
  requiresConfirmation: boolean;
  payload: Record<string, unknown>;
  targetRoute?: string | undefined;
  preview?: Array<{ label: string; value: string }> | undefined;
  sourceTool?: string | undefined;
  error?: string | undefined;
}

type ToolCallEvent = {
  name?: string;
  args?: Record<string, unknown> | undefined;
  result?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function createActionId(type: string) {
  return `wendy-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function previewFromRecord(record: Record<string, unknown>) {
  return Object.entries(record)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .slice(0, 4)
    .map(([label, value]) => ({
      label,
      value: typeof value === "string" ? value : JSON.stringify(value),
    }));
}

function buildQuery(filters: Record<string, unknown>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      params.set(key, value.join(","));
    } else if (typeof value === "object") {
      params.set(key, JSON.stringify(value));
    } else {
      params.set(key, String(value));
    }
  }
  return params.toString();
}

function routeForList(listType: string) {
  const normalized = listType.toLowerCase();
  if (normalized.includes("profession") || normalized.includes("role")) return "/ruoli";
  if (normalized.includes("news")) return "/news";
  if (normalized.includes("article") || normalized.includes("growth")) return "/crescita";
  if (normalized.includes("application")) return "/candidature";
  return "/settori";
}

function objectiveDueDateFromWeeks(weeks: unknown) {
  if (typeof weeks !== "number" || weeks <= 0) return null;
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split("T")[0] ?? null;
}

function calendarPayload(payload: Record<string, unknown>) {
  const date = typeof payload.date === "string" ? payload.date : new Date().toISOString().split("T")[0];
  const startAt = new Date(`${date}T09:00:00`);
  const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
  return {
    title: String(payload.title ?? "Nuovo evento"),
    description: typeof payload.notes === "string" ? payload.notes : null,
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    allDay: false,
    category: typeof payload.category === "string" ? payload.category : "task",
    priority: "medium",
    status: "todo",
    tags: [],
    linkedContentIds: [],
  };
}

export function normalizeWendyAction(event: ToolCallEvent): WendyAction | null {
  const result = asRecord(event.result);
  const serverAction = asRecord(result.wendyAction);
  if (serverAction.id && serverAction.type) {
    return {
      id: String(serverAction.id),
      type: String(serverAction.type),
      status: (serverAction.status as WendyActionStatus) ?? "draft",
      risk: (serverAction.risk as WendyActionRisk) ?? "low",
      label: String(serverAction.label ?? "Azione Wendy"),
      description: String(serverAction.description ?? ""),
      requiresConfirmation: Boolean(serverAction.requiresConfirmation),
      payload: asRecord(serverAction.payload),
      targetRoute: typeof serverAction.targetRoute === "string" ? serverAction.targetRoute : undefined,
      preview: Array.isArray(serverAction.preview)
        ? (serverAction.preview as Array<{ label: string; value: string }>)
        : undefined,
      sourceTool: event.name,
    };
  }

  if (!result.clientSide) return null;

  const actionType = String(result.action ?? event.name ?? "client_action");
  if (actionType === "navigate") {
    const url = String(result.url ?? asRecord(event.args).url ?? "/dashboard");
    return {
      id: createActionId("navigate"),
      type: "navigate",
      status: "done",
      risk: "low",
      label: "Apro la pagina",
      description: `Ti porto in ${url}.`,
      requiresConfirmation: false,
      payload: { url },
      targetRoute: url,
      preview: [{ label: "Destinazione", value: url }],
      sourceTool: event.name,
    };
  }

  if (actionType === "set_filters") {
    const filters = asRecord(result.filters ?? asRecord(event.args).filters);
    const listType = String(result.listType ?? asRecord(event.args).listType ?? "sectors");
    return {
      id: createActionId("set_filters"),
      type: "set_filters",
      status: "done",
      risk: "low",
      label: "Applico i filtri",
      description: `Imposto i filtri su ${listType}.`,
      requiresConfirmation: false,
      payload: { listType, filters },
      preview: previewFromRecord(filters),
      sourceTool: event.name,
    };
  }

  return null;
}

export function useWendyActionExecutor() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const invalidateOperationalData = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ["dashboard-data"] });
    void queryClient.invalidateQueries({ queryKey: ["objectives-me"] });
    void queryClient.invalidateQueries({ queryKey: ["objectives-dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    void queryClient.invalidateQueries({ queryKey: ["business-ideas"] });
  }, [queryClient]);

  const executeImmediate = useCallback((action: WendyAction): WendyAction => {
    try {
      if (action.type === "navigate") {
        const url = action.targetRoute ?? String(action.payload.url ?? "/dashboard");
        setLocation(url);
        toast({ title: "Wendy apre la pagina", description: url });
        return { ...action, status: "done", error: undefined };
      }

      if (action.type === "set_filters") {
        const listType = String(action.payload.listType ?? "sectors");
        const filters = asRecord(action.payload.filters);
        const query = buildQuery(filters);
        const route = `${routeForList(listType)}${query ? `?${query}` : ""}`;
        eventBus.emit("wendy:action", { type: "set_filters", listType, filters, route });
        eventBus.emit("page:message", { to: listType, type: "wendy:set_filters", filters });
        setLocation(route);
        toast({ title: "Filtri impostati", description: "Wendy ha preparato la vista richiesta." });
        return { ...action, status: "done", targetRoute: route, error: undefined };
      }

      if (action.type === "fill_form") {
        eventBus.emit("wendy:action", { type: "fill_form", payload: action.payload });
        toast({ title: "Bozza pronta", description: "Wendy ha inviato i dati alla pagina corrente." });
        return { ...action, status: "done", error: undefined };
      }

      return action;
    } catch (error) {
      return {
        ...action,
        status: "failed",
        error: error instanceof Error ? error.message : "Azione non riuscita",
      };
    }
  }, [setLocation, toast]);

  const confirm = useCallback(async (action: WendyAction): Promise<WendyAction> => {
    if (!action.requiresConfirmation || action.status !== "needs_confirmation") {
      return executeImmediate(action);
    }

    const running: WendyAction = { ...action, status: "running", error: undefined };
    try {
      if (action.type === "create_objective") {
        const payload = {
          text: String(action.payload.text ?? ""),
          category: String(action.payload.category ?? "altro"),
          dueDate:
            typeof action.payload.dueDate === "string"
              ? action.payload.dueDate
              : objectiveDueDateFromWeeks(action.payload.deadlineWeeks),
        };
        const res = await apiFetch(`${BASE}api/objectives`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Non sono riuscita a creare l'obiettivo.");
        invalidateOperationalData();
        toast({ title: "Obiettivo creato", description: "Wendy lo ha salvato nella tua dashboard." });
        return { ...running, status: "done" };
      }

      if (action.type === "update_objective_progress") {
        const objectiveId = Number(action.payload.objectiveId);
        const progress = Number(action.payload.progress);
        const res = await apiFetch(`${BASE}api/objectives/${objectiveId}`, {
          method: "PATCH",
          body: JSON.stringify({ progress, completed: progress === 100 }),
        });
        if (!res.ok) throw new Error("Non sono riuscita ad aggiornare l'obiettivo.");
        invalidateOperationalData();
        toast({ title: "Progresso aggiornato", description: `Progresso al ${progress}%.` });
        return { ...running, status: "done" };
      }

      if (action.type === "create_business_idea") {
        const res = await apiFetch(`${BASE}api/business-ideas`, {
          method: "POST",
          body: JSON.stringify({
            title: String(action.payload.title ?? "Nuova idea"),
            ideaText: String(action.payload.description ?? ""),
            sector: typeof action.payload.sectorName === "string" ? action.payload.sectorName : null,
            status: "draft",
          }),
        });
        if (!res.ok) throw new Error("Non sono riuscita a salvare l'idea.");
        invalidateOperationalData();
        toast({ title: "Idea salvata", description: "L'ho messa tra le bozze del validatore." });
        return { ...running, status: "done" };
      }

      if (action.type === "create_calendar_event") {
        const res = await apiFetch(`${BASE}api/calendar/events`, {
          method: "POST",
          body: JSON.stringify(calendarPayload(action.payload)),
        });
        if (!res.ok) throw new Error("Non sono riuscita a creare l'evento.");
        invalidateOperationalData();
        toast({ title: "Evento creato", description: "Wendy lo ha aggiunto al calendario." });
        return { ...running, status: "done" };
      }

      return executeImmediate(running);
    } catch (error) {
      const failed = {
        ...running,
        status: "failed" as const,
        error: error instanceof Error ? error.message : "Azione non riuscita",
      };
      toast({ title: "Azione non riuscita", description: failed.error, variant: "destructive" });
      return failed;
    }
  }, [executeImmediate, invalidateOperationalData, toast]);

  const cancel = useCallback((action: WendyAction): WendyAction => {
    toast({ title: "Azione annullata", description: "Non ho modificato nulla." });
    return { ...action, status: "cancelled" };
  }, [toast]);

  return { executeImmediate, confirm, cancel };
}
