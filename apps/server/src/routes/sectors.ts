import { Router } from "express";
import { requireAuth } from "../middleware/auth";

const router = Router();

/* ─── GET /api/sectors  —  lista settori ─── */
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    res.json([
      { id: 1, name: "Tecnologia", description: "Settore tecnologico e informatico" },
      { id: 2, name: "Marketing", description: "Settore del marketing e della comunicazione" },
      { id: 3, name: "Finanza", description: "Settore finanziario e bancario" },
      { id: 4, name: "Sanità", description: "Settore sanitario e farmaceutico" },
      { id: 5, name: "Istruzione", description: "Settore dell'istruzione e della formazione" }
    ]);
  } catch (err) {
    req.log?.error?.({ err }, "sectors get error");
    res.status(500).json({ error: "Errore nel caricamento dei settori" });
  }
});

export default router;