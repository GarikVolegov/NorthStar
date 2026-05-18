import { Router } from "express";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import {
  db,
  friendshipsTable,
  socialPostsTable,
  socialStoriesTable,
  userProfileSettingsTable,
  usersTable,
} from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router = Router();
const VISIBILITIES = new Set(["public", "friends"]);

router.use(requireAuth);

function normalizeVisibility(value: unknown): "public" | "friends" {
  return VISIBILITIES.has(String(value)) ? String(value) as "public" | "friends" : "public";
}

async function getFriendIds(userId: number): Promise<Set<number>> {
  const rows = await db
    .select({
      requesterId: friendshipsTable.requesterId,
      receiverId: friendshipsTable.receiverId,
    })
    .from(friendshipsTable)
    .where(and(
      or(eq(friendshipsTable.requesterId, userId), eq(friendshipsTable.receiverId, userId)),
      eq(friendshipsTable.status, "accepted"),
    ));

  return new Set(rows.map((row) => row.requesterId === userId ? row.receiverId : row.requesterId));
}

function canSeeItem(
  item: { userId: number; visibility: string; authorIsPublic: boolean | null },
  viewerId: number,
  friendIds: Set<number>,
) {
  if (item.userId === viewerId) return true;
  if (item.visibility === "friends") return friendIds.has(item.userId);
  return item.authorIsPublic === true;
}

function formatPost(row: {
  id: number;
  userId: number;
  content: string;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
  authorName: string;
  authorEmail: string;
  authorAvatarUrl: string | null;
  authorBannerUrl: string | null;
  authorBio: string | null;
  authorCity: string | null;
}) {
  return {
    id: row.id,
    userId: row.userId,
    content: row.content,
    visibility: row.visibility,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    author: {
      id: row.userId,
      name: row.authorName,
      email: row.authorEmail,
      avatarUrl: row.authorAvatarUrl,
      bannerUrl: row.authorBannerUrl,
      bio: row.authorBio,
      city: row.authorCity,
    },
  };
}

function formatStory(row: {
  id: number;
  userId: number;
  content: string | null;
  mediaUrl: string | null;
  visibility: string;
  expiresAt: Date;
  createdAt: Date;
  authorName: string;
  authorAvatarUrl: string | null;
}) {
  return {
    id: row.id,
    userId: row.userId,
    content: row.content,
    mediaUrl: row.mediaUrl,
    visibility: row.visibility,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    author: {
      id: row.userId,
      name: row.authorName,
      avatarUrl: row.authorAvatarUrl,
    },
  };
}

async function loadPostRows(limit: number, userId?: number) {
  return db
    .select({
      id: socialPostsTable.id,
      userId: socialPostsTable.userId,
      content: socialPostsTable.content,
      visibility: socialPostsTable.visibility,
      createdAt: socialPostsTable.createdAt,
      updatedAt: socialPostsTable.updatedAt,
      authorName: usersTable.name,
      authorEmail: usersTable.email,
      authorAvatarUrl: usersTable.avatarUrl,
      authorBannerUrl: userProfileSettingsTable.bannerUrl,
      authorBio: userProfileSettingsTable.bio,
      authorCity: userProfileSettingsTable.city,
      authorIsPublic: userProfileSettingsTable.isPublic,
    })
    .from(socialPostsTable)
    .innerJoin(usersTable, eq(socialPostsTable.userId, usersTable.id))
    .leftJoin(userProfileSettingsTable, eq(socialPostsTable.userId, userProfileSettingsTable.userId))
    .where(userId
      ? and(eq(socialPostsTable.userId, userId), isNull(socialPostsTable.deletedAt))
      : isNull(socialPostsTable.deletedAt))
    .orderBy(desc(socialPostsTable.createdAt))
    .limit(limit);
}

router.get("/feed", async (req, res) => {
  const viewerId = req.user!.id;
  const limit = Math.min(Math.max(Number(req.query.limit) || 30, 1), 50);
  const friendIds = await getFriendIds(viewerId);
  const rows = await loadPostRows(100);
  const posts = rows
    .filter((row) => canSeeItem(row, viewerId, friendIds))
    .slice(0, limit)
    .map(formatPost);

  res.json({ posts, generatedAt: new Date().toISOString() });
});

router.get("/users/:id/posts", async (req, res) => {
  const viewerId = req.user!.id;
  const targetId = Number(req.params.id);
  if (!Number.isInteger(targetId)) {
    res.status(400).json({ error: "ID utente non valido" });
    return;
  }

  const friendIds = await getFriendIds(viewerId);
  const rows = await loadPostRows(50, targetId);
  const posts = rows
    .filter((row) => canSeeItem(row, viewerId, friendIds))
    .map(formatPost);

  res.json({ posts });
});

router.post("/posts", async (req, res) => {
  const content = String(req.body?.content ?? "").trim();
  if (content.length < 2 || content.length > 2000) {
    res.status(400).json({ error: "Il post deve contenere tra 2 e 2000 caratteri" });
    return;
  }

  const [post] = await db
    .insert(socialPostsTable)
    .values({
      userId: req.user!.id,
      content,
      visibility: normalizeVisibility(req.body?.visibility),
    })
    .returning();

  res.status(201).json({ post });
});

router.patch("/posts/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(socialPostsTable).where(eq(socialPostsTable.id, id)).limit(1);
  if (!existing || existing.deletedAt || existing.userId !== req.user!.id) {
    res.status(404).json({ error: "Post non trovato" });
    return;
  }

  const content = String(req.body?.content ?? existing.content).trim();
  if (content.length < 2 || content.length > 2000) {
    res.status(400).json({ error: "Il post deve contenere tra 2 e 2000 caratteri" });
    return;
  }

  const [post] = await db
    .update(socialPostsTable)
    .set({
      content,
      visibility: normalizeVisibility(req.body?.visibility ?? existing.visibility),
      updatedAt: new Date(),
    })
    .where(eq(socialPostsTable.id, id))
    .returning();

  res.json({ post });
});

router.delete("/posts/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(socialPostsTable).where(eq(socialPostsTable.id, id)).limit(1);
  if (!existing || existing.userId !== req.user!.id) {
    res.status(404).json({ error: "Post non trovato" });
    return;
  }

  await db
    .update(socialPostsTable)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(socialPostsTable.id, id));

  res.json({ ok: true });
});

router.get("/stories", async (req, res) => {
  const viewerId = req.user!.id;
  const friendIds = await getFriendIds(viewerId);
  const rows = await db
    .select({
      id: socialStoriesTable.id,
      userId: socialStoriesTable.userId,
      content: socialStoriesTable.content,
      mediaUrl: socialStoriesTable.mediaUrl,
      visibility: socialStoriesTable.visibility,
      expiresAt: socialStoriesTable.expiresAt,
      createdAt: socialStoriesTable.createdAt,
      authorName: usersTable.name,
      authorAvatarUrl: usersTable.avatarUrl,
      authorIsPublic: userProfileSettingsTable.isPublic,
    })
    .from(socialStoriesTable)
    .innerJoin(usersTable, eq(socialStoriesTable.userId, usersTable.id))
    .leftJoin(userProfileSettingsTable, eq(socialStoriesTable.userId, userProfileSettingsTable.userId))
    .where(and(
      isNull(socialStoriesTable.deletedAt),
      gt(socialStoriesTable.expiresAt, new Date()),
    ))
    .orderBy(desc(socialStoriesTable.createdAt))
    .limit(100);

  const stories = rows
    .filter((row) => canSeeItem(row, viewerId, friendIds))
    .map(formatStory);

  res.json({ stories, generatedAt: new Date().toISOString() });
});

router.post("/stories", async (req, res) => {
  const content = String(req.body?.content ?? "").trim();
  const mediaUrl = req.body?.mediaUrl ? String(req.body.mediaUrl).trim() : null;
  if (!content && !mediaUrl) {
    res.status(400).json({ error: "Aggiungi testo o media alla storia" });
    return;
  }
  if (content.length > 600) {
    res.status(400).json({ error: "La storia non puo superare 600 caratteri" });
    return;
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const [story] = await db
    .insert(socialStoriesTable)
    .values({
      userId: req.user!.id,
      content: content || null,
      mediaUrl,
      visibility: normalizeVisibility(req.body?.visibility),
      expiresAt,
    })
    .returning();

  res.status(201).json({ story });
});

router.delete("/stories/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [existing] = await db.select().from(socialStoriesTable).where(eq(socialStoriesTable.id, id)).limit(1);
  if (!existing || existing.userId !== req.user!.id) {
    res.status(404).json({ error: "Storia non trovata" });
    return;
  }

  await db
    .update(socialStoriesTable)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(socialStoriesTable.id, id));

  res.json({ ok: true });
});

export default router;
