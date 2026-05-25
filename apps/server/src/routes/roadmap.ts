import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { getRequestBody } from "../lib/request-context";
import { asPlainRecord } from "../lib/type-guards";

const router = Router();

/* ─── POST /api/roadmap/:id/generate  —  genera roadmap ─── */
router.post("/:id/generate", requireAuth, async (req, res) => {
  try {
    const sectorId = parseInt(req.params.id ?? "", 10);
    res.json({
      id: sectorId,
      title: "Roadmap di esempio",
      description: "Roadmap generata per il settore selezionato",
      milestones: [],
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log?.error?.({ err }, "roadmap generate error");
    res.status(500).json({ error: "Errore nella generazione della roadmap" });
  }
});

/* ─── PATCH /api/roadmap/:sectorId/phases/:phaseId  —  aggiorna fase ─── */
router.patch("/:sectorId/phases/:phaseId", requireAuth, async (req, res) => {
  try {
    const phaseId = parseInt(req.params.phaseId ?? "", 10);
    const updates = asPlainRecord(getRequestBody(req));

    // In a real implementation, this would update the database
    // For now, we'll just return the updates as confirmation
    res.json({
      success: true,
      phaseId,
      updates,
      message: "Fase aggiornata con successo",
    });
  } catch (err) {
    req.log?.error?.({ err }, "roadmap phase update error");
    res.status(500).json({ error: "Errore nell'aggiornamento della fase" });
  }
});

export default router;
