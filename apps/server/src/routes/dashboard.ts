import { Router } from "express";

const router = Router();

/* ─── GET /api/dashboard  —  dati dashboard ─── */
router.get("/", async (req, res) => {
  try {
    res.json({
      user: {
        journeyType: "dipendente",
        name: "Nome Utente",
        email: "utente@example.com",
        isPremium: false,
        onboardingCompleted: true
      },
      session: {
        id: 1,
        riasecScores: { R: 3, I: 4, A: 5, S: 2, E: 3, C: 4 },
        primaryTypes: ["Investigativo", "Artistico"],
        spiritScores: {
          leadership: 3, creativity: 5, analysis: 4, people: 3, data: 4, practical: 3
        },
        recommendations: [
          { sectorId: 1, sectorName: "Tecnologia", matchScore: 85 },
          { sectorId: 2, sectorName: "Marketing", matchScore: 78 }
        ],
        createdAt: new Date().toISOString()
      },
      objectives: [],
      objectivesProgress: {
        done: 0,
        total: 0,
        percent: 0
      },
      upcomingEvents: []
    });
  } catch (err) {
    req.log?.error?.({ err }, "dashboard get error");
    res.status(500).json({ error: "Errore nel caricamento della dashboard" });
  }
});

export default router;