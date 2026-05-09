/**
 * profile-router.ts — GET e PATCH /api/users/me
 *
 * GET  /api/users/me         → profilo completo (objectives, sectorName, isPremium, isAffiliate)
 * PATCH /api/users/me        → aggiorna partial i campi consentiti
 * POST /api/users/me/avatar  → upload avatar (multipart/form-data)
 *
 * CAMPI RESTITUITI DA GET /api/users/me (e alias /api/auth/me):
 *   id, name, email, avatarUrl, timezone, journeyType, userMode,
 *   workPreference, autonomyPreference, stabilityPreference,
 *   cvText, isPublic, streakDays, totalXp, createdAt,
 *   isAffiliate,             ← era nello schema ma non nel select
 *   isPremium,               ← derivato: stripeSubscriptionId != null
 *   sectorName,              ← sectors.name via testSession.confirmedSectorId
 *   sectorId,                ← testSessions.confirmedSectorId
 *   objectives               ← array da userObjectives (non completati)
 *
 * PATCH: accetta solo campi nella whitelist patchSchema (.strict()).
 * Dopo ogni PATCH che include cvText, extractCvJson() viene chiamata
 * in background senza bloccare la risposta.
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { usersTable, userObjectivesTable, testSessionsTable, sectorsTable } from "@workspace/db";
import { eq, and, isNull, isNotNull } from "drizzle-orm";
import { extractCvJson } from "./cv-extractor";

export const profileRouter = Router();

// ── Auth helpers ────────────────────────────────────────────────────────────
function requireAuth(req: Request, res: Response, next: () => void) {
  const uid = (req as Request & { user?: { id: number } }).user?.id;
  if (!uid) { res.status(401).json({ error: "Non autenticato" }); return; }
  next();
}
function userId(req: Request): number {
  return (req as Request & { user: { id: number } }).user.id;
}

// ── Validation schema ────────────────────────────────────────────────────────
const patchSchema = z.object({
  name:                z.string().min(1).max(100).optional(),
  timezone:            z.string().max(60).optional(),
  journeyType:         z.enum(["indeciso", "in_transizione", "in_crescita", "autonomo"]).optional(),
  userMode:            z.enum(["explorer", "builder", "achiever"]).optional(),
  workPreference:      z.enum(["remote", "hybrid", "office", "unknown"]).optional(),
  autonomyPreference:  z.number().int().min(1).max(10).optional(),
  stabilityPreference: z.number().int().min(1).max(10).optional(),
  cvText:              z.string().max(20_000).nullable().optional(),
  isPublic:            z.boolean().optional(),
}).strict();

// ── GET /api/users/me (e alias GET /api/auth/me registrato in index.ts) ─────
//
// Strategia query:
//   1. Fetch dati utente base + stripeSubscriptionId (per isPremium)
//   2. LEFT JOIN testSessionsTable su users.testSessionId
//   3. LEFT JOIN sectorsTable su testSessions.confirmedSectorId → sectorName
//   4. Subquery separata: userObjectives attivi (completed = false)
//
// Usiamo due query separate invece di un unico mega-join perché Drizzle
// non supporta nativamente array_agg in una singola query typed.
// Due round-trip su DB locale < 1ms: tradeoff accettabile.
profileRouter.get("/me", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);

    // ── Query 1: utente + sector via testSession ───────────────────────────
    const row = await db
      .select({
        // Campi base utente
        id:                  usersTable.id,
        name:                usersTable.name,
        email:               usersTable.email,
        avatarUrl:           usersTable.avatarUrl,
        timezone:            usersTable.timezone,
        journeyType:         usersTable.journeyType,
        userMode:            usersTable.userMode,
        workPreference:      usersTable.workPreference,
        autonomyPreference:  usersTable.autonomyPreference,
        stabilityPreference: usersTable.stabilityPreference,
        cvText:              usersTable.cvText,
        isPublic:            usersTable.isPublic,
        streakDays:          usersTable.streakDays,
        totalXp:             usersTable.totalXp,
        createdAt:           usersTable.createdAt,
        isAffiliate:         usersTable.isAffiliate,
        // Per calcolare isPremium lato JS (non esponiamo stripe IDs al client)
        _stripeSubId:        usersTable.stripeSubscriptionId,
        // Per sectorName fallback da recommendations JSONB
        _testSessionId:      usersTable.testSessionId,
        // Da JOIN testSessions
        sectorId:            testSessionsTable.confirmedSectorId,
        _recommendations:    testSessionsTable.recommendations,
        // Da JOIN sectors
        sectorName:          sectorsTable.name,
      })
      .from(usersTable)
      // LEFT JOIN: se l'utente non ha ancora fatto il test, testSessionId è NULL
      .leftJoin(
        testSessionsTable,
        eq(usersTable.testSessionId, testSessionsTable.id),
      )
      // LEFT JOIN: se confirmedSectorId è NULL (settore non confermato), sectorName è NULL
      .leftJoin(
        sectorsTable,
        eq(testSessionsTable.confirmedSectorId, sectorsTable.id),
      )
      .where(eq(usersTable.id, uid))
      .limit(1)
      .then((r) => r[0]);

    if (!row) { res.status(404).json({ error: "Utente non trovato" }); return; }

    // ── Query 2: objectives attivi (non completati) ────────────────────────
    const objectives = await db
      .select({
        id:       userObjectivesTable.id,
        text:     userObjectivesTable.text,
        category: userObjectivesTable.category,
        progress: userObjectivesTable.progress,
        dueDate:  userObjectivesTable.dueDate,
      })
      .from(userObjectivesTable)
      .where(
        and(
          eq(userObjectivesTable.userId, uid),
          eq(userObjectivesTable.completed, false),
        ),
      )
      .orderBy(userObjectivesTable.createdAt);

    // ── Calcola sectorName con fallback ────────────────────────────────────
    // Priority: sectors.name (authoritative) > recommendations[0].sectorName (denormalized)
    const recs = row._recommendations as Array<{ sectorName: string }> | null;
    const resolvedSectorName =
      row.sectorName ??
      (Array.isArray(recs) && recs.length > 0 ? recs[0].sectorName : null);

    // ── Costruisci risposta (non esporre campi privati _*) ─────────────────
    const { _stripeSubId, _testSessionId, _recommendations, sectorName: _sn, ...rest } = row;

    res.json({
      ...rest,
      isPremium:  _stripeSubId != null,
      sectorName: resolvedSectorName ?? null,
      objectives,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});

// ── PATCH /api/users/me ──────────────────────────────────────────────────────
profileRouter.patch("/me", requireAuth, async (req, res) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi", issues: parsed.error.issues }); return;
  }

  const patch = parsed.data;
  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: "Nessun campo da aggiornare" }); return;
  }

  try {
    const uid = userId(req);
    await db
      .update(usersTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(usersTable.id, uid));

    // Estrai CV in background se cvText aggiornato
    if (patch.cvText) {
      (async () => {
        try {
          const cvJson = await extractCvJson(patch.cvText!);
          await db
            .update(usersTable)
            .set({ cvJson })
            .where(eq(usersTable.id, uid));
        } catch (e) {
          console.warn("[cv-extractor] background extraction failed:", e);
        }
      })();
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});

// ── POST /api/users/me/objectives ────────────────────────────────────────────
// Aggiunge un nuovo obiettivo per l'utente autenticato.
const objectiveSchema = z.object({
  text:     z.string().min(1).max(500),
  category: z.string().max(50).optional(),
  dueDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

profileRouter.post("/me/objectives", requireAuth, async (req, res) => {
  const parsed = objectiveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi", issues: parsed.error.issues }); return;
  }
  try {
    const [obj] = await db
      .insert(userObjectivesTable)
      .values({
        userId:   userId(req),
        text:     parsed.data.text,
        category: parsed.data.category ?? "altro",
        dueDate:  parsed.data.dueDate ?? null,
      })
      .returning();
    res.status(201).json(obj);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});

// ── POST /api/users/me/avatar ────────────────────────────────────────────────
import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    if (["image/jpeg", "image/png"].includes(file.mimetype)) cb(null, true);
    else cb(new Error("Solo JPG e PNG"));
  },
});

profileRouter.post(
  "/me/avatar",
  requireAuth,
  upload.single("avatar"),
  async (req, res) => {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) { res.status(400).json({ error: "Nessun file" }); return; }
    try {
      const avatarUrl = await uploadToStorage(file.buffer, file.mimetype, userId(req));
      await db
        .update(usersTable)
        .set({ avatarUrl, updatedAt: new Date() })
        .where(eq(usersTable.id, userId(req)));
      res.json({ avatarUrl });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Errore upload" });
    }
  },
);

async function uploadToStorage(
  _buffer: Buffer,
  _mimeType: string,
  _uid: number,
): Promise<string> {
  throw new Error("uploadToStorage: configura il tuo storage provider in profile-router.ts");
}
