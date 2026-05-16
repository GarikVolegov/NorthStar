import { Router } from "express";
import { requireAuth } from "../middleware/auth";

const router = Router();

/* ─── PATCH /api/profile/:userId/journey-type  —  aggiorna tipo percorso ─── */
router.patch("/:userId/journey-type", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { journeyType } = req.body;
    // Here you would normally update the database
    res.json({ success: true, journeyType });
  } catch (err) {
    req.log?.error?.({ err }, "journey-type update error");
    res.status(500).json({ error: "Errore nell'aggiornamento del tipo di percorso" });
  }
});

export default router;