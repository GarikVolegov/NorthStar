import { Router } from "express";
import { requireAuth } from "../middleware/auth";

const router = Router();

/* ─── GET /api/business-ideas  —  lista idee ─── */
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    res.json([]);
  } catch (err) {
    req.log?.error?.({ err }, "business-ideas get error");
    res.status(500).json({ error: "Errore nel caricamento delle idee di business" });
  }
});

/* ─── GET /api/business-ideas/:id  —  dettaglio idea ─── */
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const ideaId = parseInt(req.params.id, 10);
    res.json({
      id: ideaId,
      title: "Idea di esempio",
      description: "Descrizione dell'idea di esempio",
      targetMarket: "Mercato di riferimento",
      businessModel: "Modello di business",
      revenueStreams: [],
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    req.log?.error?.({ err }, "business-ideas get error");
    res.status(500).json({ error: "Errore nel caricamento dell'idea di business" });
  }
});

/* ─── DELETE /api/business-ideas/:id  —  elimina idea ─── */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const ideaId = parseInt(req.params.id, 10);
    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "business-ideas delete error");
    res.status(500).json({ error: "Errore nell'eliminazione dell'idea di business" });
  }
});

/* ─── POST /api/business-ideas/:id/find-incubators  —  trova incubatori ─── */
router.post("/:id/find-incubators", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const ideaId = parseInt(req.params.id, 10);
    res.json([]);
  } catch (err) {
    req.log?.error?.({ err }, "business-ideas find-incubators error");
    res.status(500).json({ error: "Errore nella ricerca degli incubatori" });
  }
});

export default router;