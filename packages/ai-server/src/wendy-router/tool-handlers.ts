/**
 * tool-handlers.ts — implementazione dei 17 tool Wendy V1.
 *
 * SECURITY:
 *   - userId sempre iniettato server-side, mai dai parametri del tool call LLM
 *   - Ogni query su dati utente ha WHERE userId = ? (doppio filtro)
 *   - Output pulito: mai email, passwordHash, stripe, resetToken
 *
 * PRIVACY:
 *   - get_user_context: max 5 fatti biografici, nessun dato finanziario
 *   - Tutti i dati restituiti al LLM sono già in DB, non generati ex-novo
 */
import { generateEmbedding } from "../embeddings/generate";
import { recordToolCall } from "../metrics";
import { logger } from "../logger";
import { numberArg, stringArg, typedArgs } from "./tool-arg-utils";
import { handleCompareSectors, handleGenerateDayScene, handleGetGrowthArticles, handleGetLearningPaths, handleGetMarketTrend, handleGetNewsSummary, handleGetProfessionDetail, handleGetSectorDetail, handleGetUserObjectives, handleListSectors, handleSearchProfessions } from "./tool-handlers-data";
import { handleGetUserContext } from "./tool-handlers-user";
import { handleGetJobPostingTrend, handleGetSkillCooccurrences, handleGetWeakSignals, handleSearchBrain, handleSearchMemoryGraph, handleSearchRag } from "./tool-handlers-market";
import { handleCheckFoodSafety, handleGetBreedInfo, handleGetRabbitCareGuide, handleSearchRabbitKb } from "./tool-handlers-rabbit";

// ── Cache embedding query (LRU semplice con TTL 5 min) ───────────────────────
const _embCache = new Map<string, { vec: number[]; ts: number }>();
const EMB_TTL_MS = 5 * 60 * 1000;

export async function queryEmbedding(text: string): Promise<number[] | null> {
  const key = text.slice(0, 200);
  const cached = _embCache.get(key);
  if (cached && Date.now() - cached.ts < EMB_TTL_MS) return cached.vec;
  const vec = await generateEmbedding(text);
  if (vec) _embCache.set(key, { vec, ts: Date.now() });
  // Limita la cache a 200 entry
  if (_embCache.size > 200) {
    const oldest = [..._embCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0];
    if (oldest) _embCache.delete(oldest[0]);
  }
  return vec;
}

// ── Tipo risposta uniforme ────────────────────────────────────────────────────

export type ToolResult = { ok: true; data: unknown } | { ok: false; code: string; message: string };

export function err(code: string, message: string): ToolResult {
  return { ok: false, code, message };
}

type WendyActionStatus = "preview" | "needs_confirmation" | "running" | "executed" | "failed"; type WendyActionRisk = "low" | "medium" | "high";

interface WendyActionPayload {
  id: string;
  type: string;
  status: WendyActionStatus;
  risk: WendyActionRisk;
  label: string;
  description: string;
  requiresConfirmation: boolean;
  payload: Record<string, unknown>;
  targetRoute?: string;
  preview?: Array<{ label: string; value: string }>;
}

function actionId(type: string) {
  return `wendy-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function wendyAction(action: Omit<WendyActionPayload, "id">): ToolResult {
  return {
    ok: true,
    data: {
      clientSide: true,
      action: action.type,
      wendyAction: { id: actionId(action.type), ...action },
    },
  };
}

function addWeeksDate(weeks?: number): string | null {
  if (!weeks || weeks <= 0) return null;
  const d = new Date();
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split("T")[0] ?? null;
}

// ── Rate limiting in-memory per write tools ───────────────────────────────────

const writeCallCounts = new Map<string, { count: number; resetAt: number }>();
const WRITE_LIMIT = 20;
const WRITE_WINDOW_MS = 60 * 60 * 1000; // 1 ora

export function checkWriteRateLimit(userId: number, toolName: string): boolean {
  const key = `${userId}:${toolName}`;
  const now = Date.now();
  const entry = writeCallCounts.get(key);
  if (!entry || now > entry.resetAt) {
    writeCallCounts.set(key, { count: 1, resetAt: now + WRITE_WINDOW_MS });
    return true;
  }
  if (entry.count >= WRITE_LIMIT) return false;
  entry.count++;
  return true;
}

// ── 1. open_view (client-side) ────────────────────────────────────────────────

export async function handleOpenView(
  args: { viewId: string; entityId?: number; entityName?: string },
): Promise<ToolResult> {
  const viewMap: Record<string, string> = {
    dashboard: "/dashboard",
    settori:   "/settori",
    settore:   args.entityId ? `/settore/${args.entityId}` : "/settori",
    ruoli:     "/ruoli",
    ruolo:     args.entityId ? `/ruolo/${args.entityId}` : "/ruoli",
    news:      "/news",
    crescita:  "/crescita",
    percorso:  "/percorso",
    profilo:   "/profilo",
    archivio:  "/archivio",
    coach:     "/coach",
    calendario:"/calendario",
    calendar:  "/calendario",
    candidature:"/candidature",
    applicazioni:"/candidature",
    workspace: "/workspace",
    validatore:"/validatore-idea",
    idee:      "/validatore-idea",
    affiliazione:"/affiliate",
  };
  const url = viewMap[args.viewId] ?? "/dashboard";
  return wendyAction({
    type: "navigate",
    status: "executed",
    risk: "low",
    label: "Apro la pagina",
    description: `Ti porto in ${url}.`,
    requiresConfirmation: false,
    targetRoute: url,
    payload: { url, viewId: args.viewId, entityId: args.entityId, entityName: args.entityName },
    preview: [{ label: "Destinazione", value: url }],
  });
}

// ── 2. set_filters (client-side) ─────────────────────────────────────────────

export async function handleSetFilters(
  args: { listType: string; filters: Record<string, unknown> | string },
): Promise<ToolResult> {
  const filters = parseFilterRecord(args.filters);
  return wendyAction({
    type: "set_filters",
    status: "executed",
    risk: "low",
    label: "Applico i filtri",
    description: `Imposto i filtri sulla lista ${args.listType}.`,
    requiresConfirmation: false,
    payload: { listType: args.listType, filters },
    preview: Object.entries(filters).slice(0, 4).map(([label, value]) => ({
      label,
      value: typeof value === "string" ? value : JSON.stringify(value),
    })),
  });
}

function parseFilterRecord(value: Record<string, unknown> | string | undefined): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function proposeSaveObjective(args: { text?: string; category?: string; deadlineWeeks?: number }): ToolResult {
  const text = args.text?.trim() ?? "";
  if (!text) return err("INVALID_INPUT", "Il testo dell'obiettivo è obbligatorio");
  if (text.length > 300) return err("INVALID_INPUT", "Testo troppo lungo — max 300 caratteri");
  const dueDate = addWeeksDate(args.deadlineWeeks);
  return wendyAction({
    type: "create_objective",
    status: "needs_confirmation",
    risk: "medium",
    label: "Creare questo obiettivo?",
    description: "Wendy ha preparato l'obiettivo. Lo salvo solo dopo la tua conferma.",
    requiresConfirmation: true,
    targetRoute: "/dashboard",
    payload: { text, category: args.category ?? "altro", dueDate },
    preview: [
      { label: "Obiettivo", value: text },
      { label: "Categoria", value: args.category ?? "altro" },
      ...(dueDate ? [{ label: "Scadenza", value: dueDate }] : []),
    ],
  });
}

function proposeUpdateObjectiveProgress(args: { objectiveId?: number; progress?: number }): ToolResult {
  if (!Number.isInteger(args.objectiveId) || (args.objectiveId ?? 0) <= 0) {
    return err("INVALID_INPUT", "ID obiettivo obbligatorio e valido");
  }
  if (typeof args.progress !== "number" || !Number.isFinite(args.progress) || args.progress < 0 || args.progress > 100)
    return err("INVALID_INPUT", "Il progresso deve essere un numero tra 0 e 100");
  const completedLabel = args.progress === 100 ? "Completato" : "In corso";
  return wendyAction({
    type: "update_objective_progress",
    status: "needs_confirmation",
    risk: "medium",
    label: "Aggiornare il progresso?",
    description: `Conferma prima di portare l'obiettivo #${args.objectiveId} al ${args.progress}%.`,
    requiresConfirmation: true,
    targetRoute: "/dashboard",
    payload: { objectiveId: args.objectiveId, progress: args.progress },
    preview: [
      { label: "Obiettivo ID", value: `#${args.objectiveId}` },
      { label: "Nuovo progresso", value: `${args.progress}%` },
      { label: "Stato", value: completedLabel },
    ],
  });
}

function proposeSaveBusinessIdea(args: { title?: string; description?: string; sectorName?: string }): ToolResult {
  const title = args.title?.trim() ?? "";
  const description = args.description?.trim() ?? "";
  if (!title || !description) return err("INVALID_INPUT", "Titolo e descrizione sono obbligatori");
  return wendyAction({
    type: "create_business_idea",
    status: "needs_confirmation",
    risk: "medium",
    label: "Salvare questa idea?",
    description: "Wendy la salverà come bozza nel validatore idea dopo conferma.",
    requiresConfirmation: true,
    targetRoute: "/validatore-idea",
    payload: { title, description, sectorName: args.sectorName },
    preview: [
      { label: "Titolo", value: title },
      { label: "Descrizione", value: description.slice(0, 160) },
      ...(args.sectorName ? [{ label: "Settore", value: args.sectorName }] : []),
    ],
  });
}

function proposeCalendarEvent(args: { title?: string; date?: string; type?: string; notes?: string }): ToolResult {
  const title = args.title?.trim() ?? "";
  if (!title) return err("INVALID_INPUT", "Il titolo dell'evento è obbligatorio");
  if (!args.date?.match(/^\d{4}-\d{2}-\d{2}$/)) return err("INVALID_INPUT", "Data non valida — usa il formato YYYY-MM-DD");
  return wendyAction({
    type: "create_calendar_event",
    status: "needs_confirmation",
    risk: "medium",
    label: "Aggiungere questo evento?",
    description: "Conferma prima di inserirlo nel calendario.",
    requiresConfirmation: true,
    targetRoute: "/calendario",
    payload: { title, date: args.date, category: args.type ?? "task", notes: args.notes },
    preview: [
      { label: "Evento", value: title },
      { label: "Data", value: args.date },
      { label: "Tipo", value: args.type ?? "task" },
    ],
  });
}

function proposeMemoryFact(args: { key?: string; value?: string }): ToolResult {
  const key = args.key?.trim().replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64) ?? "";
  const value = args.value?.trim() ?? "";
  if (!key) return err("INVALID_INPUT", "La chiave della memoria è obbligatoria");
  if (!value) return err("INVALID_INPUT", "Il valore della memoria è obbligatorio");
  if (value.length > 300) return err("INVALID_INPUT", "Memoria troppo lunga — max 300 caratteri");
  return wendyAction({
    type: "create_memory_fact",
    status: "needs_confirmation",
    risk: "medium",
    label: "Vuoi che Wendy lo ricordi?",
    description: "Salvo questo fatto nella memoria personale solo dopo la tua conferma.",
    requiresConfirmation: true,
    targetRoute: "/wendy/memoria",
    payload: { key, value, source: "user_manual" },
    preview: [
      { label: "Memoria", value },
      { label: "Chiave", value: key },
    ],
  });
}

// ── 3. get_sector_detail ─────────────────────────────────────────────────────

// ── 15. save_business_idea ───────────────────────────────────────────────────


// ── Dispatcher centrale ───────────────────────────────────────────────────────

export async function executeToolCall(
  name: string,
  args: Record<string, unknown>,
  userId: number,
): Promise<ToolResult> {
  const t0 = Date.now();
  let result: ToolResult;

  switch (name) {
    case "open_view":                  result = await handleOpenView(typedArgs(args)); break;
    case "set_filters":                result = await handleSetFilters(typedArgs(args)); break;
    case "get_sector_detail":          result = await handleGetSectorDetail(typedArgs(args)); break;
    case "list_sectors":               result = await handleListSectors(typedArgs(args)); break;
    case "get_profession_detail":      result = await handleGetProfessionDetail(typedArgs(args)); break;
    case "generate_day_scene":         result = await handleGenerateDayScene(typedArgs(args)); break;
    case "search_professions":         result = await handleSearchProfessions(typedArgs(args)); break;
    case "compare_sectors":            result = await handleCompareSectors(typedArgs(args)); break;
    case "get_market_trend":           result = await handleGetMarketTrend(typedArgs(args)); break;
    case "get_user_objectives":        result = await handleGetUserObjectives({}, userId); break;
    case "save_objective":             result = proposeSaveObjective(typedArgs(args)); break;
    case "update_objective_progress":  result = proposeUpdateObjectiveProgress(typedArgs(args)); break;
    case "get_growth_articles":        result = await handleGetGrowthArticles(typedArgs(args)); break;
    case "get_news_summary":           result = await handleGetNewsSummary(typedArgs(args)); break;
    case "get_learning_paths":         result = await handleGetLearningPaths(typedArgs(args)); break;
    case "save_business_idea":         result = proposeSaveBusinessIdea(typedArgs(args)); break;
    case "add_calendar_event":         result = proposeCalendarEvent(typedArgs(args)); break;
    case "save_memory_fact":           result = proposeMemoryFact(typedArgs(args)); break;
    case "get_user_context":           result = await handleGetUserContext({}, userId); break;

    // Step 6: RAG + Job Market Intelligence
    case "search_rag":               result = await handleSearchRag(typedArgs(args)); break;
    case "search_brain":             result = await handleSearchBrain(typedArgs(args)); break;
    case "search_memory_graph":      result = await handleSearchMemoryGraph(typedArgs(args), userId); break;
    case "get_weak_signals":         result = await handleGetWeakSignals(typedArgs(args)); break;
    case "get_job_posting_trend":    result = await handleGetJobPostingTrend(typedArgs(args)); break;
    case "get_skill_cooccurrences":  result = await handleGetSkillCooccurrences(typedArgs(args)); break;

    // ── Rabbit expert domain ──────────────────────────────────────────────────
    case "get_rabbit_care_guide": result = await handleGetRabbitCareGuide(typedArgs(args)); break;
    case "check_food_safety":     result = await handleCheckFoodSafety(typedArgs(args)); break;
    case "get_breed_info":        result = await handleGetBreedInfo(typedArgs(args)); break;
    case "search_rabbit_kb":      result = await handleSearchRabbitKb(typedArgs(args), userId); break;

    // Legacy aliases
    case "get_sector":    result = await handleGetSectorDetail({ sectorId: numberArg(args, "id") ?? 0 }); break;
    case "get_profession":result = await handleGetProfessionDetail({ professionId: numberArg(args, "id") ?? 0 }); break;
    case "navigate":      result = await handleOpenView({ viewId: stringArg(args, "viewId") ?? "dashboard" }); break;
    case "filter_list":   result = await handleSetFilters({ listType: stringArg(args, "type") ?? "sectors", filters: args }); break;

    default:
      logger.warn({ name }, "[tool] unknown tool call");
      result = err("NOT_FOUND", `Tool "${name}" non riconosciuto`);
  }

  // Metriche Prometheus per ogni tool call
  recordToolCall(name, result.ok ? "ok" : "error", (Date.now() - t0) / 1000);
  return result;
}
