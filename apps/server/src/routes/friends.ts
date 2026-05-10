import { Router, type IRouter } from "express";
import { db, usersTable, friendshipsTable } from "@workspace/db";
import { eq, or, and, ilike, inArray, not } from "drizzle-orm";
import { z } from "zod";
import { authMiddleware, optionalAuthMiddleware } from "../lib/auth-jwt.js";

const router: IRouter = Router();

type FriendshipStatus = "pending" | "accepted" | "rejected";

// ── GET /api/friends/:userId — lista amicizie (backward compat, optional auth) ─
router.get("/friends/:userId", optionalAuthMiddleware, async (req, res): Promise<void> => {
  const userId = parseInt(String(req.params.userId), 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const friendships = await db
    .select()
    .from(friendshipsTable)
    .where(or(
      eq(friendshipsTable.requesterId, userId),
      eq(friendshipsTable.receiverId, userId),
    ));

  const otherIds = [...new Set(friendships.map((f) =>
    f.requesterId === userId ? f.receiverId : f.requesterId,
  ))];

  const otherUsers = otherIds.length > 0
    ? await db
        .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, isPublic: usersTable.isPublic })
        .from(usersTable)
        .where(inArray(usersTable.id, otherIds))
    : [];

  const userMap = new Map(otherUsers.map((u) => [u.id, u]));

  const friends = friendships
    .filter((f) => f.status === "accepted")
    .map((f) => {
      const otherId = f.requesterId === userId ? f.receiverId : f.requesterId;
      return { friendshipId: f.id, ...userMap.get(otherId)! };
    });

  const incoming = friendships
    .filter((f) => f.status === "pending" && f.receiverId === userId)
    .map((f) => ({
      friendshipId: f.id,
      createdAt: f.createdAt,
      ...userMap.get(f.requesterId)!,
    }));

  const outgoing = friendships
    .filter((f) => f.status === "pending" && f.requesterId === userId)
    .map((f) => ({
      friendshipId: f.id,
      createdAt: f.createdAt,
      ...userMap.get(f.receiverId)!,
    }));

  res.json({ friends, incoming, outgoing });
});

// ── GET /api/friends — lista amicizie dell'utente autenticato (auth) ──────────
router.get("/friends", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;

  const friendships = await db
    .select()
    .from(friendshipsTable)
    .where(or(
      eq(friendshipsTable.requesterId, userId),
      eq(friendshipsTable.receiverId, userId),
    ));

  const otherIds = [...new Set(friendships.map((f) =>
    f.requesterId === userId ? f.receiverId : f.requesterId,
  ))];

  const otherUsers = otherIds.length > 0
    ? await db
        .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, isPublic: usersTable.isPublic })
        .from(usersTable)
        .where(inArray(usersTable.id, otherIds))
    : [];

  const userMap = new Map(otherUsers.map((u) => [u.id, u]));

  const friends = friendships
    .filter((f) => f.status === "accepted")
    .map((f) => {
      const otherId = f.requesterId === userId ? f.receiverId : f.requesterId;
      return { friendshipId: f.id, ...userMap.get(otherId)! };
    });

  const incoming = friendships
    .filter((f) => f.status === "pending" && f.receiverId === userId)
    .map((f) => ({
      friendshipId: f.id,
      createdAt: f.createdAt,
      ...userMap.get(f.requesterId)!,
    }));

  const outgoing = friendships
    .filter((f) => f.status === "pending" && f.requesterId === userId)
    .map((f) => ({
      friendshipId: f.id,
      createdAt: f.createdAt,
      ...userMap.get(f.receiverId)!,
    }));

  res.json({ friends, incoming, outgoing });
});

// ── GET /api/users/search — ricerca utenti pubblici ─────────────────────────────
// Supporta sia ?userId=... (legacy) che token Bearer (nuovo)
router.get("/users/search", optionalAuthMiddleware, async (req, res): Promise<void> => {
  const q = (req.query.q as string || "").trim();
  // userId può venire dall'auth token (nuovo) o dal query param (legacy)
  const userId = res.locals.userId as number | undefined
    ?? parseInt(String(req.query.userId as string), 10);

  if (q.length < 2) { res.json({ users: [] }); return; }
  if (!userId || isNaN(userId)) { res.status(400).json({ error: "userId richiesto" }); return; }

  const found = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, isPublic: usersTable.isPublic })
    .from(usersTable)
    .where(and(
      not(eq(usersTable.id, userId)),
      eq(usersTable.isPublic, true),
      or(
        ilike(usersTable.name, `%${q}%`),
        ilike(usersTable.email, `%${q}%`),
      ),
    ))
    .limit(20);

  const existingFriendships = await db
    .select()
    .from(friendshipsTable)
    .where(or(
      eq(friendshipsTable.requesterId, userId),
      eq(friendshipsTable.receiverId, userId),
    ));

  const usersWithStatus = found.map((u) => {
    const f = existingFriendships.find(
      (fr) => fr.requesterId === u.id || fr.receiverId === u.id,
    );
    return {
      ...u,
      friendshipId: f?.id ?? null,
      friendshipStatus: (f?.status ?? null) as FriendshipStatus | null,
      iAmRequester: f ? f.requesterId === userId : null,
    };
  });

  res.json({ users: usersWithStatus });
});

// ── GET /api/users/:id/public — profilo pubblico (optional auth) ──────────────
router.get("/users/:id/public", optionalAuthMiddleware, async (req, res): Promise<void> => {
  const targetId = parseInt(String(req.params.id), 10);
  // viewerId può venire dall'auth token (nuovo) o dal query param (legacy)
  const viewerId = res.locals.userId as number | undefined
    ?? (req.query.viewerId ? parseInt(String(req.query.viewerId), 10) : undefined);

  if (isNaN(targetId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const [target] = await db
    .select({ id: usersTable.id, name: usersTable.name, isPublic: usersTable.isPublic, createdAt: usersTable.createdAt })
    .from(usersTable)
    .where(eq(usersTable.id, targetId));

  if (!target) { res.status(404).json({ error: "Utente non trovato" }); return; }

  let areFriends = false;
  let friendshipStatus: FriendshipStatus | null = null;
  let friendshipId: number | null = null;

  if (viewerId && !isNaN(viewerId) && viewerId !== targetId) {
    const [friendship] = await db
      .select()
      .from(friendshipsTable)
      .where(or(
        and(eq(friendshipsTable.requesterId, viewerId), eq(friendshipsTable.receiverId, targetId)),
        and(eq(friendshipsTable.requesterId, targetId), eq(friendshipsTable.receiverId, viewerId)),
      ));
    if (friendship) {
      friendshipStatus = friendship.status as FriendshipStatus;
      friendshipId = friendship.id;
      areFriends = friendship.status === "accepted";
    }
  }

  const canView = target.isPublic || areFriends || viewerId === targetId;

  res.json({
    id: target.id,
    name: target.name,
    isPublic: target.isPublic,
    createdAt: target.createdAt,
    canView,
    areFriends,
    friendshipStatus,
    friendshipId,
  });
});

// ── POST /api/friends/request — richiesta amicizia (auth obbligatoria) ─────────
// Supporta sia auth token che requesterId nel body (legacy)
const requestSchema = z.object({
  receiverId: z.number().int().positive(),
  requesterId: z.number().int().positive().optional(), // legacy — ignorato se auth presente
});

router.post("/friends/request", optionalAuthMiddleware, async (req, res): Promise<void> => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dati non validi" }); return; }

  // requesterId dal token se disponibile, altrimenti dal body (legacy)
  const requesterId = (res.locals.userId as number | undefined) ?? parsed.data.requesterId;
  if (!requesterId) {
    res.status(401).json({ error: "Autenticazione richiesta" });
    return;
  }

  const { receiverId } = parsed.data;
  if (requesterId === receiverId) { res.status(400).json({ error: "Non puoi aggiungerti come amico" }); return; }

  const [existing] = await db
    .select()
    .from(friendshipsTable)
    .where(or(
      and(eq(friendshipsTable.requesterId, requesterId), eq(friendshipsTable.receiverId, receiverId)),
      and(eq(friendshipsTable.requesterId, receiverId), eq(friendshipsTable.receiverId, requesterId)),
    ));

  if (existing) {
    if (existing.status === "accepted") { res.status(409).json({ error: "Siete già amici" }); return; }
    if (existing.status === "pending") { res.status(409).json({ error: "Richiesta già inviata" }); return; }
    if (existing.status === "rejected") {
      const [updated] = await db
        .update(friendshipsTable)
        .set({ status: "pending", requesterId, receiverId, updatedAt: new Date() })
        .where(eq(friendshipsTable.id, existing.id))
        .returning();
      res.status(201).json({ friendship: updated });
      return;
    }
  }

  const [created] = await db
    .insert(friendshipsTable)
    .values({ requesterId, receiverId, status: "pending" })
    .returning();

  res.status(201).json({ friendship: created });
});

// ── PATCH /api/friends/:id/accept ──────────────────────────────────────────────
router.patch("/friends/:id/accept", optionalAuthMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const [friendship] = await db
    .select()
    .from(friendshipsTable)
    .where(eq(friendshipsTable.id, id));

  if (!friendship) { res.status(404).json({ error: "Richiesta non trovata" }); return; }

  // Se autenticato, verifica che sia il ricevente
  const authUserId = res.locals.userId as number | undefined;
  if (authUserId && friendship.receiverId !== authUserId) {
    res.status(403).json({ error: "Non puoi accettare questa richiesta" });
    return;
  }

  const [updated] = await db
    .update(friendshipsTable)
    .set({ status: "accepted", updatedAt: new Date() })
    .where(eq(friendshipsTable.id, id))
    .returning();

  res.json({ friendship: updated });
});

// ── PATCH /api/friends/:id/reject ──────────────────────────────────────────────
router.patch("/friends/:id/reject", optionalAuthMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const [friendship] = await db
    .select()
    .from(friendshipsTable)
    .where(eq(friendshipsTable.id, id));

  if (!friendship) { res.status(404).json({ error: "Richiesta non trovata" }); return; }

  const authUserId = res.locals.userId as number | undefined;
  if (authUserId && friendship.receiverId !== authUserId) {
    res.status(403).json({ error: "Non puoi rifiutare questa richiesta" });
    return;
  }

  const [updated] = await db
    .update(friendshipsTable)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(eq(friendshipsTable.id, id))
    .returning();

  res.json({ friendship: updated });
});

// ── DELETE /api/friends/:id ────────────────────────────────────────────────────
router.delete("/friends/:id", optionalAuthMiddleware, async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const [friendship] = await db
    .select()
    .from(friendshipsTable)
    .where(eq(friendshipsTable.id, id));

  if (!friendship) { res.status(404).json({ error: "Amicizia non trovata" }); return; }

  const authUserId = res.locals.userId as number | undefined;
  if (authUserId && friendship.requesterId !== authUserId && friendship.receiverId !== authUserId) {
    res.status(403).json({ error: "Non autorizzato" });
    return;
  }

  await db.delete(friendshipsTable).where(eq(friendshipsTable.id, id));
  res.json({ success: true });
});

// ── PATCH /api/users/:userId/privacy — backward compat ────────────────────────
router.patch("/users/:userId/privacy", optionalAuthMiddleware, async (req, res): Promise<void> => {
  const paramUserId = parseInt(String(req.params.userId), 10);
  const authUserId = res.locals.userId as number | undefined;

  // Usa l'utente autenticato se disponibile, altrimenti il parametro (legacy)
  const userId = authUserId ?? paramUserId;
  if (!userId || isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  // Se autenticato, può solo modificare il proprio profilo
  if (authUserId && authUserId !== paramUserId) {
    res.status(403).json({ error: "Non puoi modificare la privacy di un altro utente" });
    return;
  }

  const { isPublic } = req.body;
  if (typeof isPublic !== "boolean") { res.status(400).json({ error: "isPublic deve essere boolean" }); return; }

  const [updated] = await db
    .update(usersTable)
    .set({ isPublic })
    .where(eq(usersTable.id, userId))
    .returning({ id: usersTable.id, isPublic: usersTable.isPublic });

  if (!updated) { res.status(404).json({ error: "Utente non trovato" }); return; }
  res.json({ isPublic: updated.isPublic });
});

export default router;
