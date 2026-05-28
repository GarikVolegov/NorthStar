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
import { handleCompareSectors, handleGetGrowthArticles, handleGetLearningPaths, handleGetMarketTrend, handleGetNewsSummary, handleGetProfessionDetail, handleGetSectorDetail, handleGetUserObjectives, handleListSectors, handleSearchProfessions } from "./tool-handlers-data";
import { handleGetUserContext } from "./tool-handlers-user";
import { handleGetJobPostingTrend, handleGetSkillCooccurrences, handleGetWeakSignals, handleSearchMemoryGraph, handleSearchRag } from "./tool-handlers-market";
import { handleWebSearch, handleWebScrapeUrl, handleWebExtractStructured } from "./tool-handlers-web";
import { handleCheckFoodSafety, handleGetBreedInfo, handleGetRabbitCareGuide, handleSearchRabbitKb } from "./tool-handlers-rabbit";
import { handleGetPsychologicalProfile, handleUpdatePersonalityObservation } from "./tool-handlers-profile";
import { db } from "@workspace/db";
import { userRoutinesTable, ROUTINE_TYPES, ROUTINE_OUTPUT_CHANNELS } from "@workspace/db";
import type { NewUserRoutine, RoutineType, RoutineOutputChannel } from "@workspace/db";

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
  args: { listType: string; filters: Record<string, unknown> },
): Promise<ToolResult> {
  return wendyAction({
    type: "set_filters",
    status: "executed",
    risk: "low",
    label: "Applico i filtri",
    description: `Imposto i filtri sulla lista ${args.listType}.`,
    requiresConfirmation: false,
    payload: { listType: args.listType, filters: args.filters },
    preview: Object.entries(args.filters ?? {}).slice(0, 4).map(([label, value]) => ({
      label,
      value: typeof value === "string" ? value : JSON.stringify(value),
    })),
  });
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
  if (!args.objectiveId) return err("INVALID_INPUT", "ID obiettivo obbligatorio");
  if (typeof args.progress !== "number" || args.progress < 0 || args.progress > 100)
    return err("INVALID_INPUT", "Il progresso deve essere un numero tra 0 e 100");
  return wendyAction({
    type: "update_objective_progress",
    status: "needs_confirmation",
    risk: "medium",
    label: "Aggiornare il progresso?",
    description: "Conferma prima di modificare questo obiettivo.",
    requiresConfirmation: true,
    targetRoute: "/dashboard",
    payload: { objectiveId: args.objectiveId, progress: args.progress },
    preview: [
      { label: "Obiettivo ID", value: String(args.objectiveId) },
      { label: "Progresso", value: `${args.progress}%` },
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

// ── configure_routine ────────────────────────────────────────────────────────

const ROUTINE_TYPE_LABEL: Record<string, string> = {
  job_monitor:       "Monitor offerte di lavoro",
  market_report:     "Report di mercato",
  mindset_exercise:  "Esercizio mindset",
  growth_briefing:   "Briefing crescita",
  interview_prep:    "Preparazione colloquio",
};

const SCHEDULE_DISPLAY: Record<string, string> = {
  daily:           "ogni giorno",
  ogni_giorno:     "ogni giorno",
  weekly:          "ogni settimana",
  settimanale:     "ogni settimana",
  every_2_days:    "ogni 2 giorni",
  every_monday:    "ogni lunedì",
  every_tuesday:   "ogni martedì",
  every_wednesday: "ogni mercoledì",
  every_thursday:  "ogni giovedì",
  every_friday:    "ogni venerdì",
  every_saturday:  "ogni sabato",
  every_sunday:    "ogni domenica",
};

function scheduleToDisplay(schedule: string): string {
  return SCHEDULE_DISPLAY[schedule] ?? schedule;
}

function autoRoutineName(type: RoutineType, schedule: string): string {
  const typeLabel = ROUTINE_TYPE_LABEL[type] ?? type;
  const schedLabel = scheduleToDisplay(schedule);
  return `${typeLabel} — ${schedLabel}`;
}

export async function handleConfigureRoutine(
  args: {
    type?: string;
    schedule?: string;
    name?: string;
    output_channel?: string;
    parameters_json?: string;
    confirmed?: string;
  },
  userId: number,
): Promise<ToolResult> {
  if (!checkWriteRateLimit(userId, "configure_routine")) {
    return err("RATE_LIMIT", "Troppo veloce — riprova tra qualche minuto");
  }

  const rawType = args.type?.trim() ?? "";
  if (!ROUTINE_TYPES.includes(rawType as RoutineType)) {
    return err(
      "INVALID_TYPE",
      `Tipo routine non valido: "${rawType}". Valori ammessi: ${ROUTINE_TYPES.join(", ")}`,
    );
  }
  const validatedType = rawType as RoutineType;

  const schedule = args.schedule?.trim() ?? "";
  if (!schedule) {
    return err("INVALID_SCHEDULE", "Il campo schedule è obbligatorio");
  }

  const rawChannel = args.output_channel?.trim() ?? "in_app";
  const validatedChannel: RoutineOutputChannel = ROUTINE_OUTPUT_CHANNELS.includes(
    rawChannel as RoutineOutputChannel,
  )
    ? (rawChannel as RoutineOutputChannel)
    : "in_app";

  let parsedParameters: Record<string, unknown> = {};
  if (args.parameters_json) {
    try {
      const parsed = JSON.parse(args.parameters_json);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        parsedParameters = parsed as Record<string, unknown>;
      }
    } catch {
      // Non-fatal: default to empty object
    }
  }

  const scheduleDisplay = scheduleToDisplay(schedule);
  const name = args.name?.trim() || autoRoutineName(validatedType, schedule);

  // Phase 1 — preview / confirmation card
  if (args.confirmed !== "true") {
    const previewItems: Array<{ label: string; value: string }> = [
      { label: "Tipo", value: ROUTINE_TYPE_LABEL[validatedType] ?? validatedType },
      { label: "Frequenza", value: scheduleDisplay },
      { label: "Output", value: validatedChannel },
    ];
    for (const [k, v] of Object.entries(parsedParameters).slice(0, 4)) {
      previewItems.push({ label: k, value: typeof v === "string" ? v : JSON.stringify(v) });
    }
    return wendyAction({
      type: "configure_routine_preview",
      status: "needs_confirmation",
      risk: "low",
      label: "Crea routine",
      description: `Creare la routine "${name}" che si esegue ${scheduleDisplay}?`,
      requiresConfirmation: true,
      payload: { type: validatedType, schedule, name, outputChannel: validatedChannel, parameters: parsedParameters },
      preview: previewItems,
    });
  }

  // Phase 2 — actual DB insert
  try {
    const row: NewUserRoutine = {
      userId,
      type: validatedType,
      name,
      schedule,
      parameters: parsedParameters,
      outputChannel: validatedChannel,
      active: true,
      nextRunAt: new Date(Date.now() + 60_000),
    };

    const [created] = await db
      .insert(userRoutinesTable)
      .values(row)
      .returning({ id: userRoutinesTable.id });

    if (!created) {
      return err("DB_ERROR", "Errore durante la creazione della routine");
    }

    return {
      ok: true,
      data: {
        routineCreated: true,
        routineId: created.id,
        message: `Routine "${name}" creata! Si eseguirà ${scheduleDisplay}.`,
        type: validatedType,
        schedule,
        nextRun: new Date(Date.now() + 60_000).toISOString(),
      },
    };
  } catch (dbErr) {
    logger.error({ dbErr, userId }, "[configure_routine] DB insert failed");
    return err("DB_ERROR", "Errore durante il salvataggio della routine");
  }
}

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
    case "search_memory_graph":      result = await handleSearchMemoryGraph(typedArgs(args), userId); break;
    case "get_weak_signals":         result = await handleGetWeakSignals(typedArgs(args)); break;
    case "get_job_posting_trend":    result = await handleGetJobPostingTrend(typedArgs(args)); break;
    case "get_skill_cooccurrences":  result = await handleGetSkillCooccurrences(typedArgs(args)); break;

    // Firecrawl: web search / scrape / extract
    case "web_search":               result = await handleWebSearch(typedArgs(args)); break;
    case "web_scrape_url":           result = await handleWebScrapeUrl(typedArgs(args)); break;
    case "web_extract_structured":   result = await handleWebExtractStructured(typedArgs(args)); break;

    // ── AaaS: Autonomous Routines ────────────────────────────────────────────
    case "configure_routine":        result = await handleConfigureRoutine(typedArgs(args), userId); break;

    // ── Rabbit expert domain ──────────────────────────────────────────────────
    case "get_rabbit_care_guide": result = await handleGetRabbitCareGuide(typedArgs(args)); break;
    case "check_food_safety":     result = await handleCheckFoodSafety(typedArgs(args)); break;
    case "get_breed_info":        result = await handleGetBreedInfo(typedArgs(args)); break;
    case "search_rabbit_kb":      result = await handleSearchRabbitKb(typedArgs(args), userId); break;

    // 360° Profiling
    case "get_psychological_profile":       result = await handleGetPsychologicalProfile({}, userId); break;
    case "update_personality_observation": result = await handleUpdatePersonalityObservation(args, userId); break;

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
