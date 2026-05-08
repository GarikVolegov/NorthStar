/**
 * profile-router.ts — GET e PATCH /api/users/me
 *
 * GET  /api/users/me         → restituisce i campi profilo dell'utente
 * PATCH /api/users/me        → aggiorna partial i campi consentiti
 * POST /api/users/me/avatar  → upload avatar (multipart/form-data)
 *
 * Il PATCH accetta solo i campi nella whitelist PATCHABLE_FIELDS.
 * La validazione è fatta con Zod prima di toccare il DB.
 * Dopo ogni PATCH che include cvText, extractCvJson() viene chiamata
 * in background (non blocca la risposta).
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { extractCvJson } from "./cv-extractor";

export const profileRouter = Router();

// ── Auth helper (plug in your JWT middleware) ──────────────────────────────────
function requireAuth(req: Request, res: Response, next: () => void) {
  const userId = (req as Request & { user?: { id: number } }).user?.id;
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  next();
}
function userId(req: Request): number {
  return (req as Request & { user: { id: number } }).user.id;
}

// ── Validation schema ───────────────────────────────────────────────────────────

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
}).strict(); // rifiuta campi extra

// ── GET /api/users/me ────────────────────────────────────────────────────────────────

profileRouter.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await db
      .select({
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
      })
      .from(usersTable)
      .where(eq(usersTable.id, userId(req)))
      .limit(1)
      .then((r) => r[0]);

    if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});

// ── PATCH /api/users/me ────────────────────────────────────────────────────────────

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

    // Estrai CV in background se cvText è stato aggiornato
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

// ── POST /api/users/me/avatar ──────────────────────────────────────────────────────
// Requires multer or busboy. Example uses multer memory storage.
// Install: pnpm add multer @types/multer

import multer from "multer";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
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
      /**
       * Upload su storage (S3, Cloudflare R2, Supabase Storage, ecc.).
       * Sostituisci uploadToStorage() con la tua implementazione.
       * Deve restituire una URL pubblica.
       */
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

/**
 * Placeholder: sostituisci con S3, R2 o Supabase Storage.
 * Signature: (buffer: Buffer, mimeType: string, userId: number) => Promise<string (url)>
 */
async function uploadToStorage(
  buffer: Buffer,
  mimeType: string,
  uid: number,
): Promise<string> {
  // Example with Supabase Storage (uncomment and configure):
  // import { createClient } from '@supabase/supabase-js';
  // const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_KEY!);
  // const ext = mimeType === 'image/png' ? 'png' : 'jpg';
  // const path = `avatars/${uid}.${ext}`;
  // await supabase.storage.from('avatars').upload(path, buffer, { upsert: true, contentType: mimeType });
  // const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  // return data.publicUrl;
  throw new Error("uploadToStorage: configura il tuo storage provider in profile-router.ts");
}
