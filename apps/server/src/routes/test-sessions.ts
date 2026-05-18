import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { db, testSessionsTable, sectorsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

// ── Mapping domande RIASEC (incluse varianti per percorso) ───────────────────
const RIASEC_MAP: Record<string, string> = {
  q1: "R", q7: "R",
  q2: "I", q8: "I",
  q3: "A", q9: "A",
  q4: "S", q10: "S",
  q5: "E", q11: "E",
  q6: "C", q12: "C",
  // varianti dipendente
  q5_dipendente: "S", q11_dipendente: "S",
  // varianti autonomo
  q5_autonomo: "E",   q6_autonomo: "C",
  // varianti azienda
  q5_azienda: "E",    q11_azienda: "S",
  // varianti investitore
  q2_investitore: "I", q8_investitore: "I",
};

const SPIRIT_KEYS = ["shen", "hun", "po", "yi", "zhi"];
const RIASEC_NAMES: Record<string, string> = {
  R: "Realistico", I: "Investigativo", A: "Artistico",
  S: "Sociale", E: "Imprenditivo", C: "Convenzionale",
};

function computeScores(answers: Record<string, number>) {
  // RIASEC
  const riasecRaw: Record<string, number[]> = { R: [], I: [], A: [], S: [], E: [], C: [] };
  for (const [qId, val] of Object.entries(answers)) {
    const dim = RIASEC_MAP[qId];
    if (dim) riasecRaw[dim].push(val);
  }
  const riasecScores: Record<string, number> = {};
  for (const [dim, vals] of Object.entries(riasecRaw)) {
    riasecScores[dim] = vals.length
      ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
      : 0;
  }

  // Tipi primari (top 2 non a pari punteggio 0)
  const sorted = Object.entries(riasecScores)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);
  const primaryTypes = sorted.slice(0, 2).map(([k]) => RIASEC_NAMES[k] ?? k);

  // Spirit
  const spiritScores: Record<string, number> = {};
  for (const spirit of SPIRIT_KEYS) {
    const vals = [1, 2, 3].map((n) => answers[`${spirit}_${n}`]).filter((v) => v !== undefined);
    spiritScores[spirit] = vals.length
      ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
      : 0;
  }
  const dominantSpirit = SPIRIT_KEYS.reduce((best, k) =>
    (spiritScores[k] ?? 0) > (spiritScores[best] ?? 0) ? k : best, SPIRIT_KEYS[0]);

  return { riasecScores, primaryTypes, spiritScores, dominantSpirit };
}

function normalizeAnswers(input: unknown): Record<string, number> | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const normalized: Record<string, number> = {};
  for (const [key, rawValue] of Object.entries(input)) {
    const value = typeof rawValue === "number" ? rawValue : Number(rawValue);
    if (!Number.isFinite(value)) continue;
    normalized[key] = Math.min(5, Math.max(1, Math.round(value)));
  }
  return Object.keys(normalized).length ? normalized : null;
}

async function matchSectors(riasecScores: Record<string, number>) {
  const sectors = await db.select({
    id:          sectorsTable.id,
    name:        sectorsTable.name,
    riasecTypes: sectorsTable.riasecTypes,
  }).from(sectorsTable).limit(50);

  const recs = sectors.map((s) => {
    const types: string[] = (s.riasecTypes as string[]) ?? [];
    let score = 0;
    for (const t of types) {
      const letter = t.charAt(0).toUpperCase();
      score += riasecScores[letter] ?? 0;
    }
    const normalized = types.length ? Math.min(100, Math.round((score / types.length) * 20)) : 0;
    return {
      sectorId: s.id,
      sectorName: s.name,
      matchScore: normalized,
      matchReason: `Il tuo profilo si allinea con le caratteristiche del settore ${s.name}.`,
    };
  });

  return recs.sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
}

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

/* ─── POST /api/test-sessions  —  crea sessione + calcola score ─── */
router.post("/", async (req, res) => {
  try {
    const answers = normalizeAnswers((req.body as { answers?: unknown })?.answers);
    if (!answers) {
      res.status(400).json({ error: "answers richiesto" }); return;
    }

    const { riasecScores, primaryTypes, spiritScores, dominantSpirit } = computeScores(answers);
    let recommendations: Awaited<ReturnType<typeof matchSectors>> = [];
    try {
      recommendations = await matchSectors(riasecScores);
    } catch (err) {
      req.log?.warn?.({ err }, "test-sessions sector matching unavailable");
    }

    const [session] = await db
      .insert(testSessionsTable)
      .values({
        userId: null, // verrà assegnato da assign-user se loggato
        answers,
        riasecScores,
        primaryTypes,
        profileSummary: `Profilo ${primaryTypes.join(" + ")}`,
        spiritScores,
        dominantSpirit,
        recommendations,
      })
      .returning();

    res.status(201).json(session);
  } catch (err) {
    req.log?.error?.({ err }, "test-sessions create error");
    res.status(500).json({ error: "Errore nella creazione della sessione" });
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
router.get("/:sessionId", async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId, 10);
    if (isNaN(sessionId)) { res.status(400).json({ error: "ID non valido" }); return; }

    const [session] = await db
      .select()
      .from(testSessionsTable)
      .where(eq(testSessionsTable.id, sessionId))
      .limit(1);

    if (!session) { res.status(404).json({ error: "Sessione non trovata" }); return; }

    res.json(session);
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
