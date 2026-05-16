import { Router } from "express";
import { requireAuth } from "../middleware/auth";

const router = Router();

/* ─── GET /api/roles  —  lista ruoli ─── */
router.get("/", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    res.json([
      { id: 1, name: "Sviluppatore Software", description: "Ruolo tecnico di programmazione e sviluppo software" },
      { id: 2, name: "Data Scientist", description: "Ruolo di analisi dati e machine learning" },
      { id: 3, name: "Product Manager", description: "Ruolo di gestione prodotto e strategia" },
      { id: 4, name: "UX/UI Designer", description: "Ruolo di design dell'esperienza utente e interfaccia" },
      { id: 5, name: "DevOps Engineer", description: "Ruolo di infrastruttura, deployment e automazione" },
      { id: 6, name: "Marketing Specialist", description: "Ruolo di marketing digitale e tradizionale" },
      { id: 7, name: "Financial Analyst", description: "Ruolo di analisi finanziaria e investimenti" },
      { id: 8, name: "HR Manager", description: "Ruolo di gestione risorse umane e organizzazione" }
    ]);
  } catch (err) {
    req.log?.error?.({ err }, "roles get error");
    res.status(500).json({ error: "Errore nel caricamento dei ruoli" });
  }
});

export default router;