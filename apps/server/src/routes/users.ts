import { Router } from "express";
import { eq, and, or, like, sql, ne } from "drizzle-orm";
import jwt from "jsonwebtoken";
const { sign } = jwt;
import { db, pool, usersTable, userProfileSettingsTable, friendshipsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router = Router();

const JWT_SECRET: string = process.env.JWT_SECRET ?? "";

function generateToken(userId: number): string {
  return sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

/* ─── POST /api/users  —  registrazione rapida (solo nome + email) ── */
router.post("/", async (req, res) => {
  try {
    const { name, email, testSessionId } = req.body;
    if (!name || !email) {
      res.status(400).json({ error: "Nome e email richiesti" });
      return;
    }

    const { rows: existing } = await pool.query<{ id: number }>(
      `SELECT id FROM users WHERE lower(email) = $1 LIMIT 1`,
      [email.toLowerCase()],
    );

    if (existing.length > 0) {
      const token = generateToken(existing[0].id);
      res.json({
        id: existing[0].id,
        name,
        email: email.toLowerCase(),
        token,
      });
      return;
    }

    const { rows: user } = await pool.query<{
      id: number; name: string; email: string;
      test_session_id: number | null; created_at: string;
    }>(
      `INSERT INTO users (name, email, email_verified, test_session_id)
       VALUES ($1, $2, true, $3)
       RETURNING id, name, email, test_session_id, created_at`,
      [name, email.toLowerCase(), testSessionId ?? null],
    );

    const u = user[0];
    const token = generateToken(u.id);

    res.status(201).json({
      id: u.id,
      name: u.name,
      email: u.email,
      testSessionId: u.test_session_id,
      createdAt: new Date(u.created_at).toISOString(),
      token,
    });
  } catch (err) {
    req.log?.error?.({ err }, "register user error");
    res.status(500).json({ error: "Errore durante la registrazione" });
  }
});

router.patch("/onboarding", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  await db
    .update(usersTable)
    .set({ onboardingCompleted: true, updatedAt: new Date() })
    .where(eq(usersTable.id, userId));

  res.json({ onboardingCompleted: true });
});

/* ─── GET /api/users/:userId/public  —  profilo pubblico ──────────── */
router.get("/:userId/public", async (req, res) => {
  try {
    const targetId = parseInt(req.params.userId, 10);
    const viewerId = req.query.viewerId ? parseInt(req.query.viewerId as string, 10) : null;

    const [user] = await db
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        avatarUrl: usersTable.avatarUrl,
        createdAt: usersTable.createdAt,
        journeyType: usersTable.journeyType,
        isPublic: userProfileSettingsTable.isPublic,
        workPreference: userProfileSettingsTable.workPreference,
        bannerUrl: userProfileSettingsTable.bannerUrl,
        bio: userProfileSettingsTable.bio,
        city: userProfileSettingsTable.city,
        userMode: userProfileSettingsTable.userMode,
      })
      .from(usersTable)
      .leftJoin(userProfileSettingsTable, eq(usersTable.id, userProfileSettingsTable.userId))
      .where(eq(usersTable.id, targetId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "Utente non trovato" });
      return;
    }

    let canView = user.isPublic ?? false;
    let areFriends = false;
    let friendshipStatus: string | null = null;
    let friendshipId: number | null = null;

    if (viewerId && viewerId !== targetId) {
      const { rows: friendships } = await pool.query<{
        id: number; status: string; requester_id: number; receiver_id: number;
      }>(
        `SELECT id, status, requester_id, receiver_id
         FROM friendships
         WHERE (requester_id = $1 AND receiver_id = $2)
            OR (requester_id = $2 AND receiver_id = $1)
         LIMIT 1`,
        [viewerId, targetId],
      );

      const friendship = friendships[0];
      if (friendship) {
        friendshipStatus = friendship.status;
        friendshipId = friendship.id;
        if (friendship.status === "accepted") {
          canView = true;
          areFriends = true;
        }
      }
    }

    if (viewerId === targetId) {
      canView = true;
    }

    const base = {
      id: user.id,
      name: user.name,
      isPublic: user.isPublic,
      createdAt: user.createdAt,
      // camelCase versions for frontend compatibility
      is_public: user.isPublic,
      created_at: user.createdAt,
      canView,
      areFriends,
      friendshipStatus,
      friendshipId,
    };

    if (canView) {
      res.json({
        ...base,
        email: user.email,
        avatarUrl: user.avatarUrl,
        workPreference: user.workPreference,
        bannerUrl: user.bannerUrl,
        bio: user.bio,
        city: user.city,
        journeyType: user.journeyType,
        userMode: user.userMode,
      });
    } else {
      res.json(base);
    }
  } catch (err) {
    req.log?.error?.({ err }, "user public profile error");
    res.status(500).json({ error: "Errore nel recupero del profilo" });
  }
});

/* ─── PATCH /api/users/:userId/privacy  —  imposta privacy ────────── */
router.patch("/:userId/privacy", requireAuth, async (req, res) => {
  const targetId = parseInt(req.params.userId, 10);
  if (targetId !== req.user!.id) {
    res.status(403).json({ error: "Accesso negato" });
    return;
  }

  const { isPublic } = req.body;
  if (typeof isPublic !== "boolean") {
    res.status(400).json({ error: "isPublic deve essere boolean" });
    return;
  }

  const [updated] = await db
    .update(userProfileSettingsTable)
    .set({ isPublic, updatedAt: new Date() })
    .where(eq(userProfileSettingsTable.userId, targetId))
    .returning({ isPublic: userProfileSettingsTable.isPublic });

  res.json({ isPublic: updated.isPublic });
});

/* ─── GET /api/users/search  —  cerca utenti per nome/email ───────── */
router.get("/search", requireAuth, async (req, res) => {
  const q = req.query.q as string;
  const userId = req.user!.id;

  if (!q || q.length < 2) {
    res.json({ users: [] });
    return;
  }

  const likePattern = `%${q}%`;

  // Trova amici accettati dell'utente
  const friendIds = await db
    .select({
      friendId: sql<number>`CASE WHEN ${friendshipsTable.requesterId} = ${userId} THEN ${friendshipsTable.receiverId} ELSE ${friendshipsTable.requesterId} END`,
    })
    .from(friendshipsTable)
    .where(and(
      or(
        eq(friendshipsTable.requesterId, userId),
        eq(friendshipsTable.receiverId, userId),
      ),
      eq(friendshipsTable.status, "accepted"),
    ));

  const friendIdSet = new Set(friendIds.map((r) => r.friendId));

  const found = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
      isPublic: userProfileSettingsTable.isPublic,
      avatarUrl: usersTable.avatarUrl,
      city: userProfileSettingsTable.city,
    })
    .from(usersTable)
    .leftJoin(userProfileSettingsTable, eq(usersTable.id, userProfileSettingsTable.userId))
    .where(and(
      ne(usersTable.id, userId),
      or(
        like(usersTable.name, likePattern),
        like(usersTable.email, likePattern),
        like(userProfileSettingsTable.city, likePattern),
      ),
      or(
        eq(userProfileSettingsTable.isPublic, true),
        sql`${usersTable.id} = ANY(${friendIdSet.size > 0 ? [...friendIdSet] : [0]}::int[])`,
      ),
    ))
    .limit(20);

  // Arricchisci con friendship status
  const users = await Promise.all(found.map(async (u) => {
    const [fs] = await db
      .select()
      .from(friendshipsTable)
      .where(or(
        and(eq(friendshipsTable.requesterId, userId), eq(friendshipsTable.receiverId, u.id)),
        and(eq(friendshipsTable.requesterId, u.id), eq(friendshipsTable.receiverId, userId)),
      ))
      .limit(1);

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      isPublic: u.isPublic,
      avatarUrl: u.avatarUrl,
      city: u.city,
      friendshipId: fs?.id ?? null,
      friendshipStatus: fs?.status ?? null,
      iAmRequester: fs ? fs.requesterId === userId : null,
    };
  }));

  res.json({ users });
});

export default router;
