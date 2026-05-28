import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { rootLogger } from "../../middleware/logger";
import {
  cancelPipelineRun,
  confirmPipelineStep,
  createPipelineRunFromTemplate,
  getPipelineRunDetails,
} from "../../lib/pipeline-control-room";

const router = Router();

const CreatePipelineRunSchema = z.object({
  templateId: z.literal("research-review-publish"),
  input: z.record(z.string(), z.unknown()).optional(),
});

function adminUserId(req: Request, res: Response): number | null {
  const id = req.user?.id;
  if (!id) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return id;
}

router.post("/pipeline-runs", async (req, res) => {
  const parsed = CreatePipelineRunSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Richiesta non valida", details: parsed.error.flatten() });
    return;
  }
  const requestedBy = adminUserId(req, res);
  if (!requestedBy) return;

  try {
    const run = await createPipelineRunFromTemplate({
      templateId: parsed.data.templateId,
      requestedBy,
      input: parsed.data.input ?? {},
    });
    res.status(201).json({ ok: true, run });
  } catch (err) {
    rootLogger.error({ err, requestedBy }, "[admin/pipeline-runs] create error");
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/pipeline-runs/:id", async (req, res) => {
  try {
    const run = await getPipelineRunDetails({ runId: Number(req.params.id) });
    res.json({ ok: true, run });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pipeline run non trovata";
    res.status(message.includes("not found") ? 404 : 500).json({ ok: false, error: message });
  }
});

router.post("/pipeline-runs/:id/steps/:stepId/confirm", async (req, res) => {
  const confirmedBy = adminUserId(req, res);
  if (!confirmedBy) return;
  try {
    const run = await confirmPipelineStep({
      runId: Number(req.params.id),
      stepId: Number(req.params.stepId),
      confirmedBy,
    });
    res.json({ ok: true, run });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Conferma pipeline rifiutata";
    res.status(message.includes("not found") ? 404 : 400).json({ ok: false, error: message });
  }
});

router.post("/pipeline-runs/:id/cancel", async (req, res) => {
  const cancelledBy = adminUserId(req, res);
  if (!cancelledBy) return;
  try {
    const run = await cancelPipelineRun({ runId: Number(req.params.id), cancelledBy });
    res.json({ ok: true, run });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Annullamento pipeline non riuscito";
    res.status(message.includes("not found") ? 404 : 400).json({ ok: false, error: message });
  }
});

export default router;
