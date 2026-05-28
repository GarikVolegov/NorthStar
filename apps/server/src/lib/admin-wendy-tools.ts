import { randomUUID } from "node:crypto";
import type { Request } from "express";
import type { AdminWendyRisk } from "./admin-wendy-schemas";
import {
  createAdminWendyActionToken,
  getAdminWendyActionSecret,
  verifyAdminWendyActionToken,
} from "./admin-wendy-actions";
import { getAdminOpsStatus, queueDockerOperation, validateOpsAction } from "./admin-ops";
import { setMaintenanceMode } from "./maintenance-mode";
import { writeAdminWendyAudit, type AdminWendyAuditEvent } from "./admin-wendy-audit";
import {
  cancelPipelineRun,
  confirmPipelineStep,
  createPipelineRunFromTemplate,
} from "./pipeline-control-room";

type AdminToolKind = "read" | "write";
type EnvSource = Record<string, string | undefined>;

export interface AdminWendyToolParameter {
  name: string;
  type: "string" | "number" | "boolean" | "array";
  description: string;
  required?: boolean;
}

export interface AdminWendyToolDefinition {
  name: string;
  description: string;
  parameters: AdminWendyToolParameter[];
  risk: AdminWendyRisk;
  section: string;
  kind: AdminToolKind;
  requiresConfirmation: boolean;
  requiresStrongConfirmation: boolean;
  confirmationText?: string;
}

export type AdminWendyToolResult =
  | { ok: true; data: AdminWendyToolData }
  | { ok: false; code: string; message: string };

export interface AdminWendyActionData {
  clientSide: true;
  action: string;
  wendyAction: {
    id: string;
    type: string;
    status: "needs_confirmation";
    risk: AdminWendyRisk;
    label: string;
    description: string;
    preview: Array<{ label: string; value: string }>;
    requiresConfirmation: true;
    requiresStrongConfirmation: boolean;
    confirmationText?: string;
    actionToken: string;
    payload: Record<string, unknown>;
    sourceTool: string;
  };
}

export type AdminWendyToolData = AdminWendyActionData | Record<string, unknown>;

export interface ExecuteAdminWendyToolInput {
  name: string;
  args: Record<string, unknown>;
  adminUserId: number;
  requestId: string;
  secret?: string;
  now?: number;
  env?: EnvSource;
}

export interface ConfirmAdminWendyActionInput {
  actionToken: string;
  confirmationText?: string;
  adminUserId: number;
  secret?: string;
  now?: number;
  req?: Request | null;
  audit?: (event: AdminWendyAuditEvent) => Promise<void>;
}

export interface ConfirmAdminWendyActionResult {
  ok: true;
  toolName: string;
  status: "executed";
  result: Record<string, unknown>;
}

const ACTION_TTL_MS = 5 * 60 * 1000;
const PRINTING_PRESS_OPERATIONS = new Set([
  "generate_cli_from_spec",
  "publish_generated_artifact",
]);

const ADMIN_TOOLS: Record<string, AdminWendyToolDefinition> = {
  admin_overview: readTool("admin_overview", "Panoramica compatta della console admin.", "home"),
  admin_ops_status: readTool("admin_ops_status", "Stato operativo server, database, Redis e maintenance mode.", "status"),
  admin_agent_health: readTool("admin_agent_health", "Sintesi salute agenti e run recenti.", "agents"),
  admin_recent_logs: readTool("admin_recent_logs", "Ultimi audit log e segnali amministrativi.", "logs"),
  admin_quality_overview: readTool("admin_quality_overview", "Qualita Wendy, metriche e alert.", "quality"),
  admin_prompts_overview: readTool("admin_prompts_overview", "Stato prompt e versioni.", "prompts"),
  admin_catalogs_overview: readTool("admin_catalogs_overview", "Stato cataloghi admin.", "cataloghi"),
  admin_growth_queue_overview: readTool("admin_growth_queue_overview", "Coda contenuti crescita.", "crescita"),
  admin_subscriptions_overview: readTool("admin_subscriptions_overview", "Abbonamenti e anomalie.", "abbonamenti"),
  admin_messages_overview: readTool("admin_messages_overview", "Messaggi contatto e assegnazioni.", "messaggi"),
  admin_affiliation_overview: readTool("admin_affiliation_overview", "Affiliazione e lead.", "affiliazione"),
  admin_memory_graph_overview: readTool("admin_memory_graph_overview", "Memory graph Wendy.", "memory"),
  admin_wendy_brain_search: readTool("admin_wendy_brain_search", "Cerca in Wendy Brain.", "wendy-brain"),
  admin_rag_search: readTool("admin_rag_search", "Cerca nel RAG admin.", "rag"),
  admin_graphify_search: readTool("admin_graphify_search", "Cerca nel grafo Graphify.", "graphify"),
  admin_run_agent: writeTool("admin_run_agent", "Prepara l'avvio di un agente allowlistato.", "agents", "medium"),
  admin_pipeline_start: writeTool("admin_pipeline_start", "Prepara la pipeline Research -> Review -> Publish nella Control Room.", "wendy-control-room", "medium"),
  admin_pipeline_confirm_step: writeTool("admin_pipeline_confirm_step", "Conferma uno step bloccato di una pipeline agentica.", "wendy-control-room", "medium"),
  admin_pipeline_cancel: writeTool("admin_pipeline_cancel", "Annulla una pipeline agentica in corso.", "wendy-control-room", "medium"),
  admin_refresh_data: writeTool("admin_refresh_data", "Prepara refresh dati admin.", "status", "medium"),
  admin_approve_item: writeTool("admin_approve_item", "Prepara approvazione elemento admin.", "queue", "medium"),
  admin_reject_item: writeTool("admin_reject_item", "Prepara rifiuto elemento admin.", "queue", "medium"),
  admin_publish_content: writeTool("admin_publish_content", "Prepara pubblicazione contenuto.", "crescita", "medium"),
  admin_update_notes: writeTool("admin_update_notes", "Prepara aggiornamento note admin.", "queue", "medium"),
  admin_update_status: writeTool("admin_update_status", "Prepara aggiornamento stato admin.", "status", "medium"),
  admin_restart_server: writeTool("admin_restart_server", "Riavvia il server NorthStar.", "status", "high", "RESTART SERVER"),
  admin_stop_server: writeTool("admin_stop_server", "Spegne il server NorthStar.", "status", "high", "STOP SERVER"),
  admin_restart_database: writeTool("admin_restart_database", "Riavvia il database Postgres.", "status", "high", "RESTART DATABASE"),
  admin_set_maintenance_mode: writeTool("admin_set_maintenance_mode", "Cambia maintenance mode.", "status", "high", "SET MAINTENANCE MODE"),
  admin_reset_prompt: writeTool("admin_reset_prompt", "Resetta un prompt.", "prompts", "high", "RESET PROMPT"),
  admin_rollback_prompt: writeTool("admin_rollback_prompt", "Rollback prompt a versione precedente.", "prompts", "high", "ROLLBACK PROMPT"),
  admin_modify_subscription: writeTool("admin_modify_subscription", "Modifica abbonamento utente.", "abbonamenti", "high", "MODIFY SUBSCRIPTION"),
  admin_printing_press_generate: writeTool("admin_printing_press_generate", "Esegue generazione Printing Press allowlistata.", "printing-press", "high", "RUN PRINTING PRESS"),
  admin_printing_press_publish: writeTool("admin_printing_press_publish", "Pubblica artefatto Printing Press allowlistato.", "printing-press", "high", "PUBLISH PRINTING PRESS"),
};

function readTool(name: string, description: string, section: string): AdminWendyToolDefinition {
  return {
    name,
    description,
    parameters: [],
    risk: "low",
    section,
    kind: "read",
    requiresConfirmation: false,
    requiresStrongConfirmation: false,
  };
}

function writeTool(
  name: string,
  description: string,
  section: string,
  risk: AdminWendyRisk,
  confirmationText?: string,
): AdminWendyToolDefinition {
  return {
    name,
    description,
    parameters: [{ name: "payload", type: "string", description: "Payload validato dal server" }],
    risk,
    section,
    kind: "write",
    requiresConfirmation: true,
    requiresStrongConfirmation: risk === "high",
    ...(confirmationText ? { confirmationText } : {}),
  };
}

function stringArg(args: Record<string, unknown>, key: string): string | null {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function boolArg(args: Record<string, unknown>, key: string): boolean | null {
  const value = args[key];
  return typeof value === "boolean" ? value : null;
}

function previewFromPayload(payload: Record<string, unknown>): Array<{ label: string; value: string }> {
  return Object.entries(payload)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .slice(0, 5)
    .map(([label, value]) => ({
      label,
      value: typeof value === "string" ? value : JSON.stringify(value),
    }));
}

function actionLabel(definition: AdminWendyToolDefinition): string {
  if (definition.risk === "high") return "Conferma azione ad alto rischio";
  return "Conferma azione admin";
}

function payloadSummary(payload: Record<string, unknown>): string {
  return JSON.stringify(payload).slice(0, 500);
}

function isPrintingPressEnabled(env: EnvSource): boolean {
  return env.WENDY_ADMIN_PRINTING_PRESS_ENABLED === "true" && Boolean(env.PRINTING_PRESS_BRIDGE_URL);
}

async function runPrintingPressBridge(
  toolName: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  if (!isPrintingPressEnabled(process.env)) {
    return { accepted: false, error: "Printing Press bridge non configurato per Wendy Admin." };
  }
  const bridgeUrl = process.env.PRINTING_PRESS_BRIDGE_URL;
  const operation = typeof payload.operation === "string" ? payload.operation : "";
  if (!bridgeUrl || !PRINTING_PRESS_OPERATIONS.has(operation)) {
    return { accepted: false, error: "Operazione Printing Press non consentita." };
  }
  const response = await fetch(bridgeUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      toolName,
      operation,
      input: payload.input && typeof payload.input === "object" && !Array.isArray(payload.input)
        ? payload.input
        : {},
    }),
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    return {
      accepted: false,
      error: typeof body.error === "string" ? body.error : "Printing Press bridge ha rifiutato la richiesta.",
    };
  }
  return { accepted: true, bridge: body };
}

function actionPayloadFor(name: string, args: Record<string, unknown>): Record<string, unknown> {
  if (name === "admin_pipeline_start") {
    return {
      templateId: stringArg(args, "templateId") ?? "research-review-publish",
      ...(Array.isArray(args.topics) ? { topics: args.topics } : {}),
      input: args.input && typeof args.input === "object" && !Array.isArray(args.input) ? args.input : {},
    };
  }
  if (name === "admin_pipeline_confirm_step") {
    return {
      runId: Number(args.runId),
      stepId: Number(args.stepId),
    };
  }
  if (name === "admin_pipeline_cancel") {
    return { runId: Number(args.runId) };
  }
  if (name === "admin_run_agent") {
    return { agentKey: stringArg(args, "agentKey") ?? stringArg(args, "agent") ?? "collector" };
  }
  if (name === "admin_set_maintenance_mode") {
    return {
      enabled: boolArg(args, "enabled") ?? true,
      reason: stringArg(args, "reason") ?? "Requested by Wendy Admin",
    };
  }
  if (name.startsWith("admin_printing_press_")) {
    return {
      operation: stringArg(args, "operation") ?? "generate_cli_from_spec",
      input: args.input && typeof args.input === "object" && !Array.isArray(args.input) ? args.input : {},
    };
  }
  return { ...args };
}

function buildActionCard(input: {
  definition: AdminWendyToolDefinition;
  payload: Record<string, unknown>;
  adminUserId: number;
  requestId: string;
  secret: string;
  now: number;
}): AdminWendyActionData {
  const actionId = `admin-wendy-${input.definition.name}-${randomUUID()}`;
  const actionToken = createAdminWendyActionToken({
    secret: input.secret,
    now: input.now,
    ttlMs: ACTION_TTL_MS,
    action: {
      actionId,
      toolName: input.definition.name,
      risk: input.definition.risk,
      section: input.definition.section,
      adminUserId: input.adminUserId,
      payload: input.payload,
      requestId: input.requestId,
    },
  });
  return {
    clientSide: true,
    action: input.definition.name,
    wendyAction: {
      id: actionId,
      type: input.definition.name,
      status: "needs_confirmation",
      risk: input.definition.risk,
      label: actionLabel(input.definition),
      description: input.definition.description,
      preview: previewFromPayload(input.payload),
      requiresConfirmation: true,
      requiresStrongConfirmation: input.definition.requiresStrongConfirmation,
      ...(input.definition.confirmationText
        ? { confirmationText: input.definition.confirmationText }
        : {}),
      actionToken,
      payload: input.payload,
      sourceTool: input.definition.name,
    },
  };
}

export function getAdminWendyToolDefinition(name: string): AdminWendyToolDefinition | null {
  return ADMIN_TOOLS[name] ?? null;
}

export function getAdminWendyToolDefinitions(): AdminWendyToolDefinition[] {
  return Object.values(ADMIN_TOOLS);
}

export function adminWendyToolsToOpenAIFormat(): Array<{
  type: "function";
  function: { name: string; description: string; parameters: object };
}> {
  return getAdminWendyToolDefinitions().map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        properties: Object.fromEntries(
          tool.parameters.map((param) => [
            param.name,
            { type: param.type === "array" ? "array" : param.type, description: param.description },
          ]),
        ),
        required: tool.parameters.filter((param) => param.required).map((param) => param.name),
      },
    },
  }));
}

export async function executeAdminWendyTool(input: ExecuteAdminWendyToolInput): Promise<AdminWendyToolResult> {
  const definition = getAdminWendyToolDefinition(input.name);
  if (!definition) {
    return { ok: false, code: "TOOL_NOT_FOUND", message: `Tool admin "${input.name}" non riconosciuto.` };
  }

  const env = input.env ?? process.env;
  if (definition.name.startsWith("admin_printing_press_") && !isPrintingPressEnabled(env)) {
    return {
      ok: false,
      code: "PRINTING_PRESS_DISABLED",
      message: "Printing Press bridge non configurato per Wendy Admin.",
    };
  }

  if (definition.kind === "read") {
    if (definition.name === "admin_ops_status") {
      const status = await getAdminOpsStatus();
      return { ok: true, data: { source: "admin", toolName: definition.name, status } };
    }
    return {
      ok: true,
      data: {
        source: "admin",
        toolName: definition.name,
        section: definition.section,
        summary: "Tool read admin disponibile. I dettagli completi verranno collegati progressivamente alle query interne.",
      },
    };
  }

  return {
    ok: true,
    data: buildActionCard({
      definition,
      payload: actionPayloadFor(definition.name, input.args),
      adminUserId: input.adminUserId,
      requestId: input.requestId,
      secret: input.secret ?? getAdminWendyActionSecret(),
      now: input.now ?? Date.now(),
    }),
  };
}

async function executeConfirmedHandler(
  toolName: string,
  payload: Record<string, unknown>,
  adminUserId: number,
): Promise<Record<string, unknown>> {
  if (toolName === "admin_pipeline_start") {
    const templateId = typeof payload.templateId === "string" ? payload.templateId : "research-review-publish";
    if (templateId !== "research-review-publish") {
      return { accepted: false, error: "Template pipeline non consentito." };
    }
    const input = payload.input && typeof payload.input === "object" && !Array.isArray(payload.input)
      ? payload.input as Record<string, unknown>
      : {};
    const topics = Array.isArray(payload.topics) ? payload.topics : undefined;
    const run = await createPipelineRunFromTemplate({
      templateId,
      requestedBy: adminUserId,
      input: { ...input, ...(topics ? { topics } : {}) },
    });
    return { accepted: true, run };
  }
  if (toolName === "admin_pipeline_confirm_step") {
    const runId = Number(payload.runId);
    const stepId = Number(payload.stepId);
    if (!Number.isFinite(runId) || !Number.isFinite(stepId)) {
      return { accepted: false, error: "runId e stepId sono obbligatori." };
    }
    const run = await confirmPipelineStep({ runId, stepId, confirmedBy: adminUserId });
    return { accepted: true, run };
  }
  if (toolName === "admin_pipeline_cancel") {
    const runId = Number(payload.runId);
    if (!Number.isFinite(runId)) return { accepted: false, error: "runId obbligatorio." };
    const run = await cancelPipelineRun({ runId, cancelledBy: adminUserId });
    return { accepted: true, run };
  }
  if (toolName === "admin_restart_database") {
    const validation = validateOpsAction({
      service: "postgres",
      action: "restart",
      confirmation: "RIAVVIA DATABASE",
    });
    if (!validation.ok) return { accepted: false, error: validation.error };
    const operation = queueDockerOperation({ service: "postgres", action: "restart", requestedBy: adminUserId });
    return { accepted: true, operation };
  }
  if (toolName === "admin_restart_server") {
    const validation = validateOpsAction({
      service: "northstar-server",
      action: "restart",
      confirmation: "RIAVVIA SERVER",
    });
    if (!validation.ok) return { accepted: false, error: validation.error };
    const operation = queueDockerOperation({ service: "northstar-server", action: "restart", requestedBy: adminUserId });
    return { accepted: true, operation };
  }
  if (toolName === "admin_stop_server") {
    const validation = validateOpsAction({
      service: "northstar-server",
      action: "stop",
      confirmation: "SPEGNI SERVER",
    });
    if (!validation.ok) return { accepted: false, error: validation.error };
    const operation = queueDockerOperation({ service: "northstar-server", action: "stop", requestedBy: adminUserId });
    return { accepted: true, operation };
  }
  if (toolName === "admin_set_maintenance_mode") {
    const maintenance = await setMaintenanceMode({
      enabled: payload.enabled === true,
      reason: typeof payload.reason === "string" ? payload.reason : null,
      updatedBy: adminUserId,
    });
    return { accepted: true, maintenance };
  }
  if (toolName.startsWith("admin_printing_press_")) {
    return runPrintingPressBridge(toolName, payload);
  }
  return { accepted: true, queued: true, payload };
}

export async function confirmAdminWendyAction(
  input: ConfirmAdminWendyActionInput,
): Promise<ConfirmAdminWendyActionResult> {
  const token = verifyAdminWendyActionToken({
    token: input.actionToken,
    secret: input.secret ?? getAdminWendyActionSecret(),
    now: input.now ?? Date.now(),
    adminUserId: input.adminUserId,
  });
  const definition = getAdminWendyToolDefinition(token.toolName);
  if (!definition || definition.kind !== "write") {
    throw new Error("Admin action is not allowlisted");
  }
  if (
    definition.requiresStrongConfirmation &&
    input.confirmationText !== definition.confirmationText
  ) {
    throw new Error(`Strong confirmation required: type "${definition.confirmationText}"`);
  }

  const audit = input.audit ?? ((event: AdminWendyAuditEvent) => writeAdminWendyAudit(input.req ?? null, event));
  const confirmedAt = new Date(input.now ?? Date.now()).toISOString();
  await audit({
    userId: input.adminUserId,
    toolName: definition.name,
    risk: definition.risk,
    section: definition.section,
    payloadSummary: payloadSummary(token.payload),
    confirmedAt,
    requestId: token.requestId,
    phase: "before",
    status: "pending",
  });

  try {
    const result = await executeConfirmedHandler(definition.name, token.payload, input.adminUserId);
    await audit({
      userId: input.adminUserId,
      toolName: definition.name,
      risk: definition.risk,
      section: definition.section,
      payloadSummary: payloadSummary(token.payload),
      confirmedAt,
      requestId: token.requestId,
      phase: "after",
      status: "success",
    });
    return { ok: true, toolName: definition.name, status: "executed", result };
  } catch (err) {
    await audit({
      userId: input.adminUserId,
      toolName: definition.name,
      risk: definition.risk,
      section: definition.section,
      payloadSummary: payloadSummary(token.payload),
      confirmedAt,
      requestId: token.requestId,
      phase: "after",
      status: "failed",
      errorCode: err instanceof Error ? err.message.slice(0, 120) : "unknown_error",
    });
    throw err;
  }
}
