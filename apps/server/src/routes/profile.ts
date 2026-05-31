import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, userProfileSettingsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import {
  isPersistenceSchemaError,
  sendPersistenceWriteError,
} from "../lib/persistence";
import { getRequestBody } from "../lib/request-context";
import { asPlainRecord } from "../lib/type-guards";

const router = Router();

async function upsertProfileSettings(
  userId: number,
  values: Partial<typeof userProfileSettingsTable.$inferInsert>,
) {
  const now = new Date();
  await db
    .insert(userProfileSettingsTable)
    .values({ userId, ...values, updatedAt: now })
    .onConflictDoUpdate({
      target: userProfileSettingsTable.userId,
      set: { ...values, updatedAt: now },
    });
}

/* ─── GET /api/profile/:userId  —  dati profilo ───────────────────── */
router.get("/:userId", async (req, res) => {
  try {
    const rawUserId = req.params.userId ?? "";
    const userId = rawUserId === "me"
      ? req.user?.id
      : Number.parseInt(rawUserId, 10);
    if (typeof userId !== "number" || !Number.isInteger(userId) || userId <= 0) {
      res.status(400).json({ error: "Invalid profile user id" });
      return;
    }
    const targetUserId = userId;

    let user;
    try {
      [user] = await db
        .select({
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          emailVerified: usersTable.emailVerified,
          avatarUrl: usersTable.avatarUrl,
          bannerUrl: userProfileSettingsTable.bannerUrl,
          bio: userProfileSettingsTable.bio,
          city: userProfileSettingsTable.city,
          username: userProfileSettingsTable.username,
          wendyTonePreference: userProfileSettingsTable.wendyTonePreference,
          activeBackgroundId: userProfileSettingsTable.activeBackgroundId,
          backgroundLibrary: userProfileSettingsTable.backgroundLibrary,
          createdAt: usersTable.createdAt,
        })
        .from(usersTable)
        .leftJoin(
          userProfileSettingsTable,
          eq(usersTable.id, userProfileSettingsTable.userId),
        )
        .where(eq(usersTable.id, targetUserId))
        .limit(1);
    } catch (err) {
      if (!isPersistenceSchemaError(err)) throw err;
      req.log?.warn?.(
        { err, route: "profile.get", userId: targetUserId, setupAction: "run_migrations" },
        "profile settings unavailable",
      );
      const [baseUser] = await db
        .select({
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          emailVerified: usersTable.emailVerified,
          avatarUrl: usersTable.avatarUrl,
          createdAt: usersTable.createdAt,
        })
        .from(usersTable)
        .where(eq(usersTable.id, targetUserId))
        .limit(1);
      user = baseUser
        ? {
            ...baseUser,
            bannerUrl: null,
            bio: null,
            city: null,
            username: null,
            wendyTonePreference: "auto",
            activeBackgroundId: null,
            backgroundLibrary: [] as unknown[],
          }
        : undefined;
    }

    if (!user) {
      res.status(404).json({ error: "Utente non trovato" });
      return;
    }

    res.json(user);
  } catch (err) {
    req.log?.error?.({ err }, "profile get error");
    res.status(500).json({ error: "Errore nel caricamento del profilo" });
  }
});

/* ─── PATCH /api/profile/:userId/avatar  —  upload avatar ──────────── */
router.patch("/:userId/info", requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId ?? "", 10);
    if (userId !== req.user!.id) {
      res.status(403).json({ error: "Accesso negato" });
      return;
    }

    const body = asPlainRecord(getRequestBody(req));
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const bio = typeof body.bio === "string" ? body.bio.trim() : "";
    const city = typeof body.city === "string" ? body.city.trim() : "";
    const username = typeof body.username === "string" ? body.username.trim() : "";

    if (name.length < 1 || name.length > 100) {
      res.status(400).json({ error: "Nome non valido" });
      return;
    }
    if (bio.length > 300 || city.length > 100 || username.length > 30 || !/^[a-zA-Z0-9_-]*$/.test(username)) {
      res.status(400).json({ error: "Dati profilo non validi" });
      return;
    }

    await db.update(usersTable).set({ name, updatedAt: new Date() }).where(eq(usersTable.id, userId));
    await upsertProfileSettings(userId, {
      bio: bio || null,
      city: city || null,
      username: username || null,
    });

    res.json({
      name,
      bio: bio || null,
      city: city || null,
      username: username || null,
    });
  } catch (err) {
    req.log?.error?.({ err }, "profile info update error");
    if (sendPersistenceWriteError(req, res, err, "profile.info.update")) return;
    res.status(500).json({ error: "Errore aggiornamento profilo" });
  }
});

router.patch("/:userId/tone", requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId ?? "", 10);
    if (userId !== req.user!.id) {
      res.status(403).json({ error: "Accesso negato" });
      return;
    }

    const body = asPlainRecord(getRequestBody(req));
    const tone = typeof body.tone === "string" ? body.tone : "auto";
    if (!["auto", "concise", "detailed", "formal", "casual"].includes(tone)) {
      res.status(400).json({ error: "Tono non valido" });
      return;
    }

    await upsertProfileSettings(userId, {
      wendyTonePreference: tone as "auto" | "concise" | "detailed" | "formal" | "casual",
    });
    res.json({ tone });
  } catch (err) {
    req.log?.error?.({ err }, "profile tone update error");
    if (sendPersistenceWriteError(req, res, err, "profile.tone.update")) return;
    res.status(500).json({ error: "Errore aggiornamento tono Wendy" });
  }
});

router.patch("/:userId/avatar", requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId ?? "", 10);
    if (userId !== req.user!.id) {
      res.status(403).json({ error: "Accesso negato" });
      return;
    }

    const body = asPlainRecord(getRequestBody(req));
    const avatarDataUrl = body.avatarDataUrl;
    if (!avatarDataUrl || typeof avatarDataUrl !== "string") {
      res.status(400).json({ error: "avatarDataUrl richiesto" });
      return;
    }
    if (avatarDataUrl.length > 2_000_000) {
      res.status(400).json({ error: "Immagine troppo grande (max 1.5 MB)" });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set({ avatarUrl: avatarDataUrl, updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning({ avatarUrl: usersTable.avatarUrl });

    if (!updated) {
      res.status(404).json({ error: "Utente non trovato" });
      return;
    }

    res.json({ avatarUrl: updated.avatarUrl });
  } catch (err) {
    req.log?.error?.({ err }, "avatar upload error");
    res.status(500).json({ error: "Errore upload avatar" });
  }
});

/* ─── DELETE /api/profile/:userId/avatar  —  rimuovi avatar ───────── */
router.delete("/:userId/avatar", requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId ?? "", 10);
    if (userId !== req.user!.id) {
      res.status(403).json({ error: "Accesso negato" });
      return;
    }

    await db
      .update(usersTable)
      .set({ avatarUrl: null, updatedAt: new Date() })
      .where(eq(usersTable.id, userId));
    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "avatar delete error");
    res.status(500).json({ error: "Errore rimozione avatar" });
  }
});

/* ─── PATCH /api/profile/:userId/banner  —  upload banner ──────────── */
router.patch("/:userId/banner", requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId ?? "", 10);
    if (userId !== req.user!.id) {
      res.status(403).json({ error: "Accesso negato" });
      return;
    }

    const body = asPlainRecord(getRequestBody(req));
    const bannerDataUrl = body.bannerDataUrl;
    if (!bannerDataUrl || typeof bannerDataUrl !== "string") {
      res.status(400).json({ error: "bannerDataUrl richiesto" });
      return;
    }
    // base64 overhead: 1MB file → ~1.37MB string; cap at 2MB string (~1.5MB file)
    if (bannerDataUrl.length > 2_000_000) {
      res.status(400).json({ error: "Immagine troppo grande (max 1.5 MB)" });
      return;
    }

    await upsertProfileSettings(userId, { bannerUrl: bannerDataUrl });

    res.json({ bannerUrl: bannerDataUrl });
  } catch (err) {
    req.log?.error?.({ err }, "banner upload error");
    if (sendPersistenceWriteError(req, res, err, "profile.banner.update"))
      return;
    res.status(500).json({ error: "Errore upload banner" });
  }
});

/* ─── DELETE /api/profile/:userId/banner  —  rimuovi banner ───────── */
router.delete("/:userId/banner", requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId ?? "", 10);
    if (userId !== req.user!.id) {
      res.status(403).json({ error: "Accesso negato" });
      return;
    }

    await upsertProfileSettings(userId, { bannerUrl: null });

    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "banner delete error");
    if (sendPersistenceWriteError(req, res, err, "profile.banner.delete"))
      return;
    res.status(500).json({ error: "Errore rimozione banner" });
  }
});

/* ─── PATCH /api/profile/:userId/mode  —  aggiorna user mode ───────── */
router.patch("/:userId/mode", requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId ?? "", 10);
    if (userId !== req.user!.id) {
      res.status(403).json({ error: "Accesso negato" });
      return;
    }

    const body = asPlainRecord(getRequestBody(req));
    const mode = body.mode;
    if (!mode || typeof mode !== "string") {
      res.status(400).json({ error: "mode richiesto" });
      return;
    }

    await upsertProfileSettings(userId, { userMode: mode });

    res.json({ userMode: mode });
  } catch (err) {
    req.log?.error?.({ err }, "user mode update error");
    if (sendPersistenceWriteError(req, res, err, "profile.mode.update")) return;
    res.status(500).json({ error: "Errore nel salvataggio modalità" });
  }
});

export default router;
