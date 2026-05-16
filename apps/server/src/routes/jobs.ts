import { Router } from "express";
import { requireAuth } from "../middleware/auth";

const router = Router();

/* ─── GET /api/jobs  —  lista lavori ─── */
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    res.json([]);
  } catch (err) {
    req.log?.error?.({ err }, "jobs get error");
    res.status(500).json({ error: "Errore nel caricamento dei lavori" });
  }
});

/* ─── GET /api/jobs/:id  —  dettaglio lavoro ─── */
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const jobId = parseInt(req.params.id, 10);
    res.json({
      id: jobId,
      title: "Posizione di esempio",
      company: "Azienda di esempio",
      location: "Milano, Italia",
      description: "Descrizione della posizione di lavoro",
      requirements: [],
      benefits: [],
      salaryRange: "30.000 - 50.000 €",
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    req.log?.error?.({ err }, "jobs get error");
    res.status(500).json({ error: "Errore nel caricamento del lavoro" });
  }
});

/* ─── POST /api/jobs  —  crea lavoro ─── */
router.post("/", requireAuth, async (req, res) => {
  try {
    res.status(201).json({ id: 1 });
  } catch (err) {
    req.log?.error?.({ err }, "jobs create error");
    res.status(500).json({ error: "Errore nella creazione del lavoro" });
  }
});

/* ─── PATCH /api/jobs/:id  —  aggiorna lavoro ─── */
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "jobs update error");
    res.status(500).json({ error: "Errore nell'aggiornamento del lavoro" });
  }
});

/* ─── DELETE /api/jobs/:id  —  elimina lavoro ─── */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "jobs delete error");
    res.status(500).json({ error: "Errore nell'eliminazione del lavoro" });
  }
});

export default router;