import { Router, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { rootLogger } from "../../middleware/logger";
import {
  AdminWendyConfirmRequestSchema,
  AdminWendyRequestSchema,
} from "../../lib/admin-wendy-schemas";
import {
  confirmAdminWendyAction,
  executeAdminWendyTool,
} from "../../lib/admin-wendy-tools";

const router = Router();

type AdminWendyContextSource =
  | "admin"
  | "rag"
  | "graphify"
  | "wendy-brain"
  | "printing-press";

function adminWendyEnabled(): boolean {
  return process.env.WENDY_ADMIN_ENABLED !== "false";
}

function selectAdminTool(message: string): string | null {
  const q = message.toLowerCase();
  if (/\b(pipeline|control room|research|review|publish|pubblica|revisione)\b/.test(q)) return "admin_pipeline_start";
  if (/\b(restart|riavvia).*\b(database|db|postgres)\b/.test(q)) return "admin_restart_database";
  if (/\b(restart|riavvia).*\b(server|backend)\b/.test(q)) return "admin_restart_server";
  if (/\b(stop|spegni).*\b(server|backend)\b/.test(q)) return "admin_stop_server";
  if (/\b(agent|agente|collector|collect|avvia)\b/.test(q)) return "admin_run_agent";
  if (/\b(status|stato|ops|operativ)\b/.test(q)) return "admin_ops_status";
  if (/\b(printing press|cli|sdk)\b/.test(q)) return "admin_printing_press_generate";
  return null;
}

function sendSse(res: Response, data: object): void {
  if (!res.writableEnded) {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }
}

function beginSse(res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
}

function contextSourcesFor(toolName: string | null, usedTool: boolean): AdminWendyContextSource[] {
  const sources = new Set<AdminWendyContextSource>();
  if (usedTool) sources.add("admin");
  if (toolName?.includes("rag")) sources.add("rag");
  if (toolName?.includes("graphify")) sources.add("graphify");
  if (toolName?.includes("wendy_brain")) sources.add("wendy-brain");
  if (toolName?.includes("printing_press")) sources.add("printing-press");
  return [...sources];
}

router.post("/wendy", async (req: Request, res: Response) => {
  if (!adminWendyEnabled()) {
    res.status(503).json({ error: "Wendy Admin non abilitata" });
    return;
  }

  const parsed = AdminWendyRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Richiesta non valida", details: parsed.error.flatten() });
    return;
  }

  const requestId = randomUUID();
  const adminUserId = req.user?.id;
  if (!adminUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  beginSse(res);
  const selectedTool = selectAdminTool(parsed.data.message);
  let usedTool = false;

  try {
    sendSse(res, { type: "status", value: "Analizzo la console admin..." });

    if (selectedTool) {
      const toolResult = await executeAdminWendyTool({
        name: selectedTool,
        args: {
          ...(parsed.data.adminContext ? { adminContext: parsed.data.adminContext } : {}),
          agentKey: "collector",
          templateId: "research-review-publish",
        },
        adminUserId,
        requestId,
      });
      usedTool = true;
      sendSse(res, {
        type: "tool_call",
        name: selectedTool,
        args: {},
        result: toolResult.ok ? toolResult.data : { error: toolResult.message, code: toolResult.code },
      });
    }

    const section = parsed.data.adminContext?.section ?? "admin";
    const response = selectedTool
      ? `Ho preparato il contesto per ${section}. Le azioni operative passano da conferma esplicita.`
      : `Sono Wendy Admin. Posso aiutarti a leggere, diagnosticare e guidare la sezione ${section}.`;
    sendSse(res, { type: "token", value: response });
    sendSse(res, {
      type: "done",
      requestId,
      contextSources: contextSourcesFor(selectedTool, usedTool),
    });
  } catch (err) {
    rootLogger.error({ err, requestId, adminUserId }, "[admin/wendy] stream error");
    sendSse(res, {
      type: "error",
      message: "Wendy Admin non riesce a completare la risposta.",
    });
  } finally {
    if (!res.writableEnded) res.end();
  }
});

router.post("/wendy/actions/confirm", async (req: Request, res: Response) => {
  const parsed = AdminWendyConfirmRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Richiesta non valida", details: parsed.error.flatten() });
    return;
  }

  const adminUserId = req.user?.id;
  if (!adminUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const confirmInput = {
      actionToken: parsed.data.actionToken,
      adminUserId,
      req,
      ...(parsed.data.confirmationText ? { confirmationText: parsed.data.confirmationText } : {}),
    };
    const result = await confirmAdminWendyAction(confirmInput);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Azione admin rifiutata";
    const status = message.includes("expired") || message.includes("Invalid") ? 403 : 400;
    res.status(status).json({ error: message });
  }
});

export default router;
