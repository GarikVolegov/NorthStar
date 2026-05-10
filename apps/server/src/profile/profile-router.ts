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
 *   city,                    ← città impostata tramite CityAutocomplete
 *   cityPlaceId,             ← place_id Nominatim per ricerche future
 *   bio,                     ← bio breve max 300 char
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
import { eq, and } from "drizzle-orm";
import { extractCvJson } from "./cv-extractor";
import { getProfileCache, invalidateProfileCache, setProfileCache } from "../lib/cache";

export const profileRouter = Router();

function requireAuth(req: Request, res: Response, next: () => void) {
  const uid = (req as Request & { user?: { id: number } }).user?.id;
  if (!uid) { res.status(401).json({ error: "Non autenticato" }); return; }
  next();
}
function userId(req: Request): number {
  return (req as Request & { user: { id: number } }).user.id;
}

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
  // ── Network Step 2: Posizione + Bio ──────────────────────────────────
  city:                z.string().max(200).nullable().optional(),
  cityPlaceId:         z.string().max(100).nullable().optional(),
  bio:                 z.string().max(300).nullable().optional(),
}).strict();

type ProfileResponse = {
  id: number;
  name: string | null;
  email: string;
  avatarUrl: string | null;
  timezone: string | null;
  journeyType: string | null;
  userMode: string | null;
  workPreference: string | null;
  autonomyPreference: number | null;
  stabilityPreference: number | null;
  cvText: string | null;
  isPublic: boolean | null;
  streakDays: number | null;
  totalXp: number | null;
  createdAt: Date | string;
  isAffiliate: boolean | null;
  sectorId: number | null;
  isPremium: boolean;
  sectorName: string | null;
  city: string | null;
  cityPlaceId: string | null;
  bio: string | null;
  objectives: Array<{
    id: number;
    text: string;
    category: string | null;
    progress: number | null;
    dueDate: Date | string | null;
  }>;
};

profileRouter.get("/me", requireAuth, async (req, res) => {
  try {
    const uid = userId(req);
    const cached = await getProfileCache<ProfileResponse>(uid);

    if (cached) {
      res.json(cached);
      return;
    }

    const row = await db
      .select({
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
        city:                usersTable.city,
        cityPlaceId:         usersTable.cityPlaceId,
        bio:                 usersTable.bio,
        _stripeSubId:        usersTable.stripeSubscriptionId,
        _testSessionId:      usersTable.testSessionId,
        sectorId:            testSessionsTable.confirmedSectorId,
        _recommendations:    testSessionsTable.recommendations,
        sectorName:          sectorsTable.name,
      })
      .from(usersTable)
      .leftJoin(
        testSessionsTable,
        eq(usersTable.testSessionId, testSessionsTable.id),
      )
      .leftJoin(
        sectorsTable,
        eq(testSessionsTable.confirmedSectorId, sectorsTable.id),
      )
      .where(eq(usersTable.id, uid))
      .limit(1)
      .then((r) => r[0]);

    if (!row) { res.status(404).json({ error: "Utente non trovato" }); return; }

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

    const recs = row._recommendations as Array<{ sectorName: string }> | null;
    const resolvedSectorName =
      row.sectorName ??
      (Array.isArray(recs) && recs.length > 0 ? recs[0].sectorName : null);

    const { _stripeSubId, _testSessionId, _recommendations, sectorName: _sn, ...rest } = row;

    const payload: ProfileResponse = {
      ...rest,
      isPremium: _stripeSubId != null,
      sectorName: resolvedSectorName ?? null,
      city: row.city ?? null,
      cityPlaceId: row.cityPlaceId ?? null,
      bio: row.bio ?? null,
      objectives,
    };

    await setProfileCache(uid, payload);
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});

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

    await invalidateProfileCache(uid);

    if (patch.cvText) {
      (async () => {
        try {
          const cvJson = await extractCvJson(patch.cvText!);
          await db
            .update(usersTable)
            .set({ cvJson })
            .where(eq(usersTable.id, uid));
          await invalidateProfileCache(uid);
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
    const uid = userId(req);
    const [obj] = await db
      .insert(userObjectivesTable)
      .values({
        userId:   uid,
        text:     parsed.data.text,
        category: parsed.data.category ?? "altro",
        dueDate:  parsed.data.dueDate ?? null,
      })
      .returning();

    await invalidateProfileCache(uid);
    res.status(201).json(obj);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});

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
      const uid = userId(req);
      const avatarUrl = await uploadToStorage(file.buffer, file.mimetype, uid);
      await db
        .update(usersTable)
        .set({ avatarUrl, updatedAt: new Date() })
        .where(eq(usersTable.id, uid));
      await invalidateProfileCache(uid);
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
