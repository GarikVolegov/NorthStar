import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, userProfileSettingsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { isPersistenceSchemaError, sendPersistenceWriteError } from "../lib/persistence";

const router = Router();

async function upsertProfileSettings(userId: number, values: Partial<typeof userProfileSettingsTable.$inferInsert>) {
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
    const userId = parseInt(req.params.userId, 10);

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
          createdAt: usersTable.createdAt,
        })
        .from(usersTable)
        .leftJoin(userProfileSettingsTable, eq(usersTable.id, userProfileSettingsTable.userId))
        .where(eq(usersTable.id, userId))
        .limit(1);
    } catch (err) {
      if (!isPersistenceSchemaError(err)) throw err;
      req.log?.warn?.({ err, route: "profile.get", userId, setupAction: "run_migrations" }, "profile settings unavailable");
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
        .where(eq(usersTable.id, userId))
        .limit(1);
      user = baseUser ? { ...baseUser, bannerUrl: null } : undefined;
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
router.patch("/:userId/avatar", requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (userId !== req.user!.id) { res.status(403).json({ error: "Accesso negato" }); return; }

    const { avatarDataUrl } = req.body;
    if (!avatarDataUrl || typeof avatarDataUrl !== "string") {
      res.status(400).json({ error: "avatarDataUrl richiesto" }); return;
    }
    if (avatarDataUrl.length > 2_000_000) {
      res.status(400).json({ error: "Immagine troppo grande (max 1.5 MB)" }); return;
    }

    const [updated] = await db
      .update(usersTable)
      .set({ avatarUrl: avatarDataUrl, updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning({ avatarUrl: usersTable.avatarUrl });

    res.json({ avatarUrl: updated.avatarUrl });
  } catch (err) {
    req.log?.error?.({ err }, "avatar upload error");
    res.status(500).json({ error: "Errore upload avatar" });
  }
});

/* ─── DELETE /api/profile/:userId/avatar  —  rimuovi avatar ───────── */
router.delete("/:userId/avatar", requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (userId !== req.user!.id) { res.status(403).json({ error: "Accesso negato" }); return; }

    await db.update(usersTable).set({ avatarUrl: null, updatedAt: new Date() }).where(eq(usersTable.id, userId));
    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "avatar delete error");
    res.status(500).json({ error: "Errore rimozione avatar" });
  }
});

/* ─── PATCH /api/profile/:userId/banner  —  upload banner ──────────── */
router.patch("/:userId/banner", requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (userId !== req.user!.id) { res.status(403).json({ error: "Accesso negato" }); return; }

    const { bannerDataUrl } = req.body;
    if (!bannerDataUrl || typeof bannerDataUrl !== "string") {
      res.status(400).json({ error: "bannerDataUrl richiesto" }); return;
    }
    // base64 overhead: 1MB file → ~1.37MB string; cap at 2MB string (~1.5MB file)
    if (bannerDataUrl.length > 2_000_000) {
      res.status(400).json({ error: "Immagine troppo grande (max 1.5 MB)" }); return;
    }

    await upsertProfileSettings(userId, { bannerUrl: bannerDataUrl });

    res.json({ bannerUrl: bannerDataUrl });
  } catch (err) {
    req.log?.error?.({ err }, "banner upload error");
    if (sendPersistenceWriteError(req, res, err, "profile.banner.update")) return;
    res.status(500).json({ error: "Errore upload banner" });
  }
});

/* ─── DELETE /api/profile/:userId/banner  —  rimuovi banner ───────── */
router.delete("/:userId/banner", requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (userId !== req.user!.id) { res.status(403).json({ error: "Accesso negato" }); return; }

    await upsertProfileSettings(userId, { bannerUrl: null });

    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "banner delete error");
    if (sendPersistenceWriteError(req, res, err, "profile.banner.delete")) return;
    res.status(500).json({ error: "Errore rimozione banner" });
  }
});

/* ─── PATCH /api/profile/:userId/mode  —  aggiorna user mode ───────── */
router.patch("/:userId/mode", requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (userId !== req.user!.id) { res.status(403).json({ error: "Accesso negato" }); return; }

    const { mode } = req.body;
    if (!mode || typeof mode !== "string") {
      res.status(400).json({ error: "mode richiesto" }); return;
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
