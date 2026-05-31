import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-fetch";
import { eventBus } from "@/lib/event-bus";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

export type WendyActionStatus =
  | "preview"
  | "needs_confirmation"
  | "running"
  | "executed"
  | "done"
  | "failed"
  | "cancelled";

export type WendyActionRisk = "low" | "medium" | "high";

type KnownWendyActionType =
  | "navigate"
  | "set_filters"
  | "fill_form"
  | "create_objective"
  | "update_objective_progress"
  | "create_business_idea"
  | "create_calendar_event"
  | "create_memory_fact";

type WendyActionType = KnownWendyActionType | (string & {});

export interface WendyAction {
  id: string;
  type: WendyActionType;
  status: WendyActionStatus;
  risk: WendyActionRisk;
  label: string;
  description: string;
  requiresConfirmation: boolean;
  payload: Record<string, unknown>;
  targetRoute?: string | undefined;
  preview?: Array<{ label: string; value: string }> | undefined;
  sourceTool?: string | undefined;
  actionToken?: string | undefined;
  requiresStrongConfirmation?: boolean | undefined;
  confirmationText?: string | undefined;
  error?: string | undefined;
}

type ToolCallEvent = {
  name?: string;
  args?: Record<string, unknown> | undefined;
  result?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function emitWendyNavigationComplete(route: string, action: WendyAction) {
  eventBus.emit("wendy:navigation-complete", {
    route,
    actionType: action.type,
    actionId: action.id,
  });
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

function normalizeActionStatus(value: unknown): WendyActionStatus {
  if (value === "done") return "executed";
  if (
    value === "preview" ||
    value === "needs_confirmation" ||
    value === "running" ||
    value === "executed" ||
    value === "failed" ||
    value === "cancelled"
  ) {
    return value;
  }
  return "preview";
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

function readPositiveInteger(value: unknown): number | null {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : Number.NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function readProgressPercent(value: unknown): number | null {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : Number.NaN;
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : null;
}

async function readApiError(res: Response): Promise<string | null> {
  const body = await res.json().catch(() => null) as { error?: unknown; message?: unknown } | null;
  const message = typeof body?.error === "string"
    ? body.error
    : typeof body?.message === "string"
      ? body.message
      : null;
  return message?.trim() ? message.trim() : null;
}

function objectiveProgressApiFailureMessage(res: Response, apiReason: string | null) {
  const status = res.status ? ` (${res.status})` : "";
  const reason = apiReason
    ? `L'API obiettivi ha risposto: ${apiReason}.`
    : `L'API obiettivi non ha completato l'aggiornamento${status}.`;
  const recovery = apiReason?.toLowerCase().includes("non trovato")
    ? "Riprova dopo aver scelto un obiettivo ancora presente."
    : "Riprova tra poco; se il problema continua, aggiorna la pagina e riparti dall'obiettivo.";
  return `${reason} Non ho modificato nulla. ${recovery}`;
}

function objectiveCreationApiFailureMessage(res: Response, apiReason: string | null) {
  const status = res.status ? ` (${res.status})` : "";
  const reason = apiReason
    ? `L'API obiettivi ha risposto: ${apiReason}.`
    : `L'API obiettivi non ha completato la creazione${status}.`;
  return `${reason} Non ho modificato nulla. Correggi la proposta e riprova.`;
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
      status: normalizeActionStatus(serverAction.status),
      risk: (serverAction.risk as WendyActionRisk) ?? "low",
      label: String(serverAction.label ?? "Azione Wendy"),
      description: String(serverAction.description ?? ""),
      requiresConfirmation: Boolean(serverAction.requiresConfirmation),
      payload: asRecord(serverAction.payload),
      targetRoute: typeof serverAction.targetRoute === "string" ? serverAction.targetRoute : undefined,
      preview: Array.isArray(serverAction.preview)
        ? (serverAction.preview as Array<{ label: string; value: string }>)
        : undefined,
      actionToken: typeof serverAction.actionToken === "string" ? serverAction.actionToken : undefined,
      requiresStrongConfirmation: Boolean(serverAction.requiresStrongConfirmation),
      confirmationText: typeof serverAction.confirmationText === "string" ? serverAction.confirmationText : undefined,
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
      status: "executed",
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
      status: "executed",
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
        emitWendyNavigationComplete(url, action);
        toast({ title: "Wendy apre la pagina", description: url });
        return { ...action, status: "executed", error: undefined };
      }

      if (action.type === "set_filters") {
        const listType = String(action.payload.listType ?? "sectors");
        const filters = asRecord(action.payload.filters);
        const query = buildQuery(filters);
        const route = `${routeForList(listType)}${query ? `?${query}` : ""}`;
        eventBus.emit("wendy:action", { type: "set_filters", listType, filters, route });
        eventBus.emit("page:message", { to: listType, type: "wendy:set_filters", filters });
        setLocation(route);
        emitWendyNavigationComplete(route, action);
        toast({ title: "Filtri impostati", description: "Wendy ha preparato la vista richiesta." });
        return { ...action, status: "executed", targetRoute: route, error: undefined };
      }

      if (action.type === "fill_form") {
        eventBus.emit("wendy:action", { type: "fill_form", payload: action.payload });
        toast({ title: "Bozza pronta", description: "Wendy ha inviato i dati alla pagina corrente." });
        return { ...action, status: "executed", error: undefined };
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

  const confirm = useCallback(async (action: WendyAction, strongConfirmationText?: string): Promise<WendyAction> => {
    const canRunConfirmedAction = action.requiresConfirmation && (
      action.status === "needs_confirmation" ||
      action.status === "failed"
    );
    if (!canRunConfirmedAction) {
      return executeImmediate(action);
    }

    const running: WendyAction = { ...action, status: "running", error: undefined };
    try {
      if (String(action.type).startsWith("admin_")) {
        if (!action.actionToken) throw new Error("Token azione admin mancante.");
        const res = await apiFetch(`${BASE}api/admin/wendy/actions/confirm`, {
          method: "POST",
          body: JSON.stringify({
            actionToken: action.actionToken,
            confirmationText: strongConfirmationText,
          }),
        });
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Azione admin rifiutata.");
        }
        invalidateOperationalData();
        void queryClient.invalidateQueries({ queryKey: ["admin"] });
        toast({ title: "Azione admin eseguita", description: action.label });
        return { ...running, status: "executed" };
      }

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
        if (!res.ok) {
          throw new Error(objectiveCreationApiFailureMessage(res, await readApiError(res)));
        }
        invalidateOperationalData();
        toast({ title: "Obiettivo creato", description: "Wendy lo ha salvato nella tua dashboard." });
        return { ...running, status: "executed" };
      }

      if (action.type === "update_objective_progress") {
        const objectiveId = readPositiveInteger(action.payload.objectiveId);
        if (objectiveId === null) throw new Error("ID obiettivo non valido: non posso aggiornare il progresso.");
        const progress = readProgressPercent(action.payload.progress);
        if (progress === null) throw new Error("Il progresso deve essere un numero tra 0 e 100.");
        const res = await apiFetch(`${BASE}api/objectives/${objectiveId}`, {
          method: "PATCH",
          body: JSON.stringify({ progress, completed: progress === 100 }),
        });
        if (!res.ok) {
          throw new Error(objectiveProgressApiFailureMessage(res, await readApiError(res)));
        }
        invalidateOperationalData();
        toast({ title: "Progresso aggiornato", description: `Progresso al ${progress}%.` });
        return { ...running, status: "executed" };
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
        return { ...running, status: "executed" };
      }

      if (action.type === "create_calendar_event") {
        const res = await apiFetch(`${BASE}api/calendar/events`, {
          method: "POST",
          body: JSON.stringify(calendarPayload(action.payload)),
        });
        if (!res.ok) throw new Error("Non sono riuscita a creare l'evento.");
        invalidateOperationalData();
        toast({ title: "Evento creato", description: "Wendy lo ha aggiunto al calendario." });
        return { ...running, status: "executed" };
      }

      if (action.type === "create_memory_fact") {
        const res = await apiFetch(`${BASE}api/coach/memory`, {
          method: "POST",
          body: JSON.stringify({
            key: String(action.payload.key ?? "user_manual"),
            value: String(action.payload.value ?? ""),
            source: "user_manual",
          }),
        });
        if (!res.ok) throw new Error("Non sono riuscita a salvare la memoria.");
        invalidateOperationalData();
        toast({ title: "Memoria salvata", description: "Wendy potrà usarla nelle prossime risposte." });
        return { ...running, status: "executed" };
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
