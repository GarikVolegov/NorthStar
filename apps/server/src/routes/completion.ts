import { Router } from "express";
import { requireAuth } from "../middleware/auth";

const router = Router();

/* ─── GET /api/completion/me  —  dati completamento profilo ───── */
router.get("/me", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    // Mock completion data
    res.json({
      hasTestSession: true,
      hasConfirmedSector: true,
      hasWorkPreference: true,
      hasCv: false,
      isPublic: true,
      streakDays: 0,
      totalObjectives: 0,
      completedObjectives: 0,
    });
  } catch (err) {
    req.log?.error?.({ err }, "completion get error");
    res.status(500).json({ error: "Errore nel caricamento dei dati di completamento" });
  }
});

export default router;