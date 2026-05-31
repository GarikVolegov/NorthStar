import { Router } from "express";
import { requireAuth } from "../middleware/auth";

const router = Router();

/* ─── GET /api/applications/:userId  —  lista applicazioni ───── */
router.get("/:userId", requireAuth, async (req, res) => {
  try {
    const requestedUserId = Number.parseInt(req.params.userId ?? "", 10);
    if (!Number.isInteger(requestedUserId) || requestedUserId <= 0) {
      res.status(400).json({ error: "userId non valido" });
      return;
    }

    if (req.user?.role !== "admin" && req.user?.id !== requestedUserId) {
      res.status(403).json({
        code: "APPLICATIONS_USER_MISMATCH",
        error: "Puoi consultare solo le tue candidature",
      });
      return;
    }

    res.json({ applications: [], status: "empty", totalCount: 0 });
  } catch (err) {
    req.log?.error?.({ err }, "applications get error");
    res.status(500).json({ error: "Errore nel caricamento delle applicazioni" });
  }
});

/* ─── POST /api/applications  —  crea applicazione ──────────── */
router.post("/", requireAuth, async (req, res) => {
  try {
    res.status(201).json({ id: 1 });
  } catch (err) {
    req.log?.error?.({ err }, "applications create error");
    res.status(500).json({ error: "Errore nella creazione dell'applicazione" });
  }
});

/* ─── PATCH /api/applications/:id  —  aggiorna applicazione ─── */
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "applications update error");
    res.status(500).json({ error: "Errore nell'aggiornamento dell'applicazione" });
  }
});

/* ─── DELETE /api/applications/:id  —  elimina applicazione ─── */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "applications delete error");
    res.status(500).json({ error: "Errore nell'eliminazione dell'applicazione" });
  }
});

export default router;
