import { Router } from "express";
import { eq, and, or, like, sql, ne } from "drizzle-orm";
import jwt from "jsonwebtoken";
const { sign } = jwt;
import {
  db,
  pool,
  usersTable,
  userProfileSettingsTable,
  friendshipsTable,
} from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import {
  isPersistenceSchemaError,
  sendOptionalReadFallback,
  sendPersistenceWriteError,
} from "../lib/persistence";
import { JWT_SECRET } from "../lib/jwt-secret";
import { getRequestBody } from "../lib/request-context";
import { asPlainRecord } from "../lib/type-guards";

const router = Router();

type PublicUserRow = {
  id: number;
  name: string;
  email: string;
  avatarUrl: string | null;
  createdAt: Date;
  journeyType: string;
  isPublic: boolean | null;
  workPreference: string | null;
  bannerUrl: string | null;
  bio: string | null;
  city: string | null;
  userMode: string | null;
};

function generateToken(userId: number): string {
  return sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readInteger(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) ? numberValue : null;
}

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

/* ─── POST /api/users  —  registrazione rapida (solo nome + email) ── */
router.post("/", async (req, res) => {
  try {
    const body = asPlainRecord(getRequestBody(req));
    const name = readString(body.name);
    const email = readString(body.email);
    const normalizedEmail = email?.toLowerCase() ?? null;
    const testSessionId = readInteger(body.testSessionId);
    if (!name || !email) {
      res.status(400).json({ error: "Nome e email richiesti" });
      return;
    }

    const { rows: existing } = await pool.query<{ id: number }>(
      `SELECT id FROM users WHERE lower(email) = $1 LIMIT 1`,
      [normalizedEmail],
    );

    if (existing.length > 0) {
      const existingUser = existing[0];
      if (!existingUser) {
        res.status(500).json({ error: "Errore durante la registrazione" });
        return;
      }
      const token = generateToken(existingUser.id);
      res.json({
        id: existingUser.id,
        name,
        email: normalizedEmail,
        token,
      });
      return;
    }

    const { rows: user } = await pool.query<{
      id: number;
      name: string;
      email: string;
      test_session_id: number | null;
      created_at: string;
    }>(
      `INSERT INTO users (name, email, email_verified, test_session_id)
       VALUES ($1, $2, true, $3)
       RETURNING id, name, email, test_session_id, created_at`,
      [name, normalizedEmail, testSessionId],
    );

    const u = user[0];
    if (!u) {
      res.status(500).json({ error: "Errore durante la registrazione" });
      return;
    }
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
    const targetId = readInteger(req.params.userId);
    const viewerId = req.user?.id ?? null;
    if (targetId === null) {
      res.status(400).json({ error: "ID utente non valido" });
      return;
    }

    let user: PublicUserRow | undefined;
    try {
      [user] = await db
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
        .leftJoin(
          userProfileSettingsTable,
          eq(usersTable.id, userProfileSettingsTable.userId),
        )
        .where(eq(usersTable.id, targetId))
        .limit(1);
    } catch (err) {
      if (!isPersistenceSchemaError(err)) throw err;
      req.log?.warn?.(
        { err, route: "users.public", targetId, setupAction: "run_migrations" },
        "profile settings unavailable",
      );
      const [baseUser] = await db
        .select({
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          avatarUrl: usersTable.avatarUrl,
          createdAt: usersTable.createdAt,
          journeyType: usersTable.journeyType,
        })
        .from(usersTable)
        .where(eq(usersTable.id, targetId))
        .limit(1);
      user = baseUser
        ? {
            ...baseUser,
            isPublic: false,
            workPreference: "unknown",
            bannerUrl: null,
            bio: null,
            city: null,
            userMode: "explorer",
          }
        : undefined;
    }

    if (!user) {
      res.status(404).json({ error: "Utente non trovato" });
      return;
    }

    let canView = user.isPublic ?? false;
    let areFriends = false;
    let friendshipStatus: string | null = null;
    let friendshipId: number | null = null;

    if (viewerId && viewerId !== targetId) {
      try {
        const { rows: friendships } = await pool.query<{
          id: number;
          status: string;
          requester_id: number;
          receiver_id: number;
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
      } catch (err) {
        if (!isPersistenceSchemaError(err)) throw err;
        req.log?.warn?.(
          {
            err,
            route: "users.public.friendship",
            targetId,
            viewerId,
            setupAction: "run_migrations",
          },
          "friendships unavailable",
        );
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
  const targetId = readInteger(req.params.userId);
  if (targetId === null) {
    res.status(400).json({ error: "ID utente non valido" });
    return;
  }
  if (targetId !== req.user!.id) {
    res.status(403).json({ error: "Accesso negato" });
    return;
  }

  const body = asPlainRecord(getRequestBody(req));
  const isPublic = body.isPublic;
  if (typeof isPublic !== "boolean") {
    res.status(400).json({ error: "isPublic deve essere boolean" });
    return;
  }

  try {
    await upsertProfileSettings(targetId, { isPublic });
    res.json({ isPublic });
  } catch (err) {
    req.log?.error?.({ err }, "privacy update error");
    if (sendPersistenceWriteError(req, res, err, "users.privacy.update"))
      return;
    res.status(500).json({ error: "Errore nel salvataggio privacy" });
  }
});

/* ─── GET /api/users/search  —  cerca utenti per nome/email ───────── */
router.get("/search", requireAuth, async (req, res) => {
  const q = readString(req.query.q);
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
    .where(
      and(
        or(
          eq(friendshipsTable.requesterId, userId),
          eq(friendshipsTable.receiverId, userId),
        ),
        eq(friendshipsTable.status, "accepted"),
      ),
    );

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
    .leftJoin(
      userProfileSettingsTable,
      eq(usersTable.id, userProfileSettingsTable.userId),
    )
    .where(
      and(
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
      ),
    )
    .limit(20);

  // Arricchisci con friendship status
  const users = await Promise.all(
    found.map(async (u) => {
      const [fs] = await db
        .select()
        .from(friendshipsTable)
        .where(
          or(
            and(
              eq(friendshipsTable.requesterId, userId),
              eq(friendshipsTable.receiverId, u.id),
            ),
            and(
              eq(friendshipsTable.requesterId, u.id),
              eq(friendshipsTable.receiverId, userId),
            ),
          ),
        )
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
    }),
  );

  res.json({ users });
});

/* ─── GET /api/users/me/work-preference  —  preferenza lavoro ──────── */
router.get("/me/work-preference", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const [profile] = await db
      .select({ workPreference: userProfileSettingsTable.workPreference })
      .from(userProfileSettingsTable)
      .where(eq(userProfileSettingsTable.userId, userId))
      .limit(1);
    res.json({ workPreference: profile?.workPreference ?? "unknown" });
  } catch (err) {
    req.log?.error?.({ err }, "work-preference get error");
    if (
      sendOptionalReadFallback(req, res, err, "users.workPreference.get", {
        workPreference: "unknown",
      })
    )
      return;
    res.status(500).json({ error: "Errore nel caricamento preferenza" });
  }
});

/* ─── PATCH /api/users/me/work-preference  —  aggiorna preferenza ───── */
router.patch("/me/work-preference", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const body = asPlainRecord(getRequestBody(req));
    const workPreference = readString(body.workPreference);
    if (!workPreference) {
      res.status(400).json({ error: "workPreference richiesto" });
      return;
    }

    await upsertProfileSettings(userId, { workPreference });

    res.json({ workPreference });
  } catch (err) {
    req.log?.error?.({ err }, "work-preference update error");
    if (sendPersistenceWriteError(req, res, err, "users.workPreference.update"))
      return;
    res.status(500).json({ error: "Errore nel salvataggio preferenza" });
  }
});

export default router;
