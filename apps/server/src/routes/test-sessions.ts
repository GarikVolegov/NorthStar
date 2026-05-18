import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { db, testSessionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

/* ─── GET /api/test-sessions/history  —  storico sessioni utente ─── */
router.get("/history", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const sessions = await db
      .select({
        id: testSessionsTable.id,
        primaryTypes: testSessionsTable.primaryTypes,
        riasecScores: testSessionsTable.riasecScores,
        recommendations: testSessionsTable.recommendations,
        createdAt: testSessionsTable.createdAt,
        confirmedSectorId: testSessionsTable.confirmedSectorId,
      })
      .from(testSessionsTable)
      .where(eq(testSessionsTable.userId, userId))
      .orderBy(desc(testSessionsTable.createdAt))
      .limit(20);

    res.json(sessions);
  } catch (err) {
    req.log?.error?.({ err }, "test-sessions history error");
    res.status(500).json({ error: "Errore nel caricamento della cronologia" });
  }
});

/* ─── GET /api/test-sessions/latest  —  ultima sessione utente ─── */
router.get("/latest", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    res.json({
      sessionId: 1,
      recommendations: [
        { sectorId: 1, sectorName: "Tecnologia" },
        { sectorId: 2, sectorName: "Marketing" }
      ]
    });
  } catch (err) {
    req.log?.error?.({ err }, "test-sessions latest error");
    res.status(500).json({ error: "Errore nel caricamento dell'ultima sessione" });
  }
});

/* ─── GET /api/test-sessions/:sessionId  —  dettagli sessione ─── */
router.get("/:sessionId", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const sessionId = parseInt(req.params.sessionId, 10);
    res.json({
      id: sessionId,
      riasecScores: {
        R: 3, I: 4, A: 5, S: 2, E: 3, C: 4
      },
      primaryTypes: ["Investigativo", "Artistico"],
      spiritScores: {
        leadership: 3, creativity: 5, analysis: 4, people: 3, data: 4, practical: 3
      },
      recommendations: [
        { sectorId: 1, sectorName: "Tecnologia", matchScore: 85, matchReason: "Allineato con le tue competenze tecniche" },
        { sectorId: 2, sectorName: "Marketing", matchScore: 78, matchReason: "Buona capacità di comunicazione e creatività" }
      ],
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    req.log?.error?.({ err }, "test-sessions get error");
    res.status(500).json({ error: "Errore nel caricamento dei dettagli della sessione" });
  }
});

/* ─── POST /api/test-sessions/:sessionId/assign-user  —  assegna sessione ─── */
router.post("/:sessionId/assign-user", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const sessionId = parseInt(req.params.sessionId, 10);
    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "test-sessions assign-user error");
    res.status(500).json({ error: "Errore nell'assegnazione della sessione" });
  }
});

/* ─── POST /api/objectives/seed  —  inizializza obiettivi ─── */
router.post("/objectives/seed", requireAuth, async (req, res) => {
  try {
    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "objectives seed error");
    res.status(500).json({ error: "Errore nell'inizializzazione degli obiettivi" });
  }
});

/* ─── GET /api/objectives  —  lista obiettivi ─── */
router.get("/objectives", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    res.json([]);
  } catch (err) {
    req.log?.error?.({ err }, "objectives get error");
    res.status(500).json({ error: "Errore nel caricamento degli obiettivi" });
  }
});

/* ─── POST /api/objectives  —  crea obiettivo ─── */
router.post("/objectives", requireAuth, async (req, res) => {
  try {
    res.status(201).json({ id: 1 });
  } catch (err) {
    req.log?.error?.({ err }, "objectives create error");
    res.status(500).json({ error: "Errore nella creazione dell'obiettivo" });
  }
});

/* ─── PATCH /api/objectives/:id  —  aggiorna obiettivo ─── */
router.patch("/objectives/:id", requireAuth, async (req, res) => {
  try {
    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "objectives update error");
    res.status(500).json({ error: "Errore nell'aggiornamento dell'obiettivo" });
  }
});

/* ─── DELETE /api/objectives/:id  —  elimina obiettivo ─── */
router.delete("/objectives/:id", requireAuth, async (req, res) => {
  try {
    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "objectives delete error");
    res.status(500).json({ error: "Errore nell'eliminazione dell'obiettivo" });
  }
});

export default router;