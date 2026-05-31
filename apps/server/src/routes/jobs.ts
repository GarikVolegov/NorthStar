import { Router } from "express";
import { requireAuth } from "../middleware/auth";

const router = Router();

const JOBS_NOT_CONFIGURED = {
  status: "not_configured",
  reason: "jobs_provider_not_connected",
  action: "connect_jobs_provider",
} as const;

/* GET /api/jobs - lista lavori */
router.get("/", requireAuth, async (req, res) => {
  try {
    res.json({ jobs: [], basedOnSector: null, totalCount: 0, ...JOBS_NOT_CONFIGURED });
  } catch (err) {
    req.log?.error?.({ err }, "jobs get error");
    res.status(500).json({ error: "Errore nel caricamento dei lavori" });
  }
});

/* GET /api/jobs/:id - dettaglio lavoro */
router.get("/:id", requireAuth, async (req, res) => {
  try {
    res.json(JOBS_NOT_CONFIGURED);
  } catch (err) {
    req.log?.error?.({ err }, "jobs get error");
    res.status(500).json({ error: "Errore nel caricamento del lavoro" });
  }
});

/* POST /api/jobs - crea lavoro */
router.post("/", requireAuth, async (req, res) => {
  try {
    res.status(201).json(JOBS_NOT_CONFIGURED);
  } catch (err) {
    req.log?.error?.({ err }, "jobs create error");
    res.status(500).json({ error: "Errore nella creazione del lavoro" });
  }
});

/* PATCH /api/jobs/:id - aggiorna lavoro */
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    res.json(JOBS_NOT_CONFIGURED);
  } catch (err) {
    req.log?.error?.({ err }, "jobs update error");
    res.status(500).json({ error: "Errore nell'aggiornamento del lavoro" });
  }
});

/* DELETE /api/jobs/:id - elimina lavoro */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    res.json(JOBS_NOT_CONFIGURED);
  } catch (err) {
    req.log?.error?.({ err }, "jobs delete error");
    res.status(500).json({ error: "Errore nell'eliminazione del lavoro" });
  }
});

export default router;
