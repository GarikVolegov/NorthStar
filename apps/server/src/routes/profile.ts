import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, userProfileSettingsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router = Router();

/* ─── GET /api/profile/:userId  —  dati profilo ───────────────────── */
router.get("/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);

    const [user] = await db
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
  const userId = parseInt(req.params.userId, 10);
  if (userId !== req.user!.id) {
    res.status(403).json({ error: "Accesso negato" });
    return;
  }

  const { avatarDataUrl } = req.body;
  if (!avatarDataUrl || typeof avatarDataUrl !== "string") {
    res.status(400).json({ error: "avatarDataUrl richiesto" });
    return;
  }

  if (avatarDataUrl.length > 600_000) {
    res.status(400).json({ error: "Immagine troppo grande (max 600 KB)" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ avatarUrl: avatarDataUrl, updatedAt: new Date() })
    .where(eq(usersTable.id, userId))
    .returning({ avatarUrl: usersTable.avatarUrl });

  res.json({ avatarUrl: updated.avatarUrl });
});

/* ─── DELETE /api/profile/:userId/avatar  —  rimuovi avatar ───────── */
router.delete("/:userId/avatar", requireAuth, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (userId !== req.user!.id) {
    res.status(403).json({ error: "Accesso negato" });
    return;
  }

  await db
    .update(usersTable)
    .set({ avatarUrl: null, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));

  res.json({ success: true });
});

/* ─── PATCH /api/profile/:userId/banner  —  upload banner ──────────── */
router.patch("/:userId/banner", requireAuth, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (userId !== req.user!.id) {
    res.status(403).json({ error: "Accesso negato" });
    return;
  }

  const { bannerDataUrl } = req.body;
  if (!bannerDataUrl || typeof bannerDataUrl !== "string") {
    res.status(400).json({ error: "bannerDataUrl richiesto" });
    return;
  }

  if (bannerDataUrl.length > 1_500_000) {
    res.status(400).json({ error: "Immagine troppo grande (max 1.5 MB)" });
    return;
  }

  const [updated] = await db
    .update(userProfileSettingsTable)
    .set({ bannerUrl: bannerDataUrl, updatedAt: new Date() })
    .where(eq(userProfileSettingsTable.userId, userId))
    .returning({ bannerUrl: userProfileSettingsTable.bannerUrl });

  res.json({ bannerUrl: updated.bannerUrl });
});

/* ─── DELETE /api/profile/:userId/banner  —  rimuovi banner ───────── */
router.delete("/:userId/banner", requireAuth, async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (userId !== req.user!.id) {
    res.status(403).json({ error: "Accesso negato" });
    return;
  }

  await db
    .update(userProfileSettingsTable)
    .set({ bannerUrl: null, updatedAt: new Date() })
    .where(eq(userProfileSettingsTable.userId, userId));

  res.json({ success: true });
});

export default router;
