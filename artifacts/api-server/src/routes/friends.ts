import { Router, type IRouter } from "express";
import { db, usersTable, friendshipsTable } from "@workspace/db";
import { eq, or, and, ilike, inArray, not } from "drizzle-orm";
import { z } from "zod";

const router: IRouter = Router();

type FriendshipStatus = "pending" | "accepted" | "rejected";

// ── GET /api/friends/:userId ────────────────────────────────────────────
router.get("/friends/:userId", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
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

// ── GET /api/users/search?q=...&userId=... ─────────────────────────────
router.get("/users/search", async (req, res): Promise<void> => {
  const q = (req.query.q as string || "").trim();
  const userId = parseInt(req.query.userId as string, 10);

  if (q.length < 2) { res.json({ users: [] }); return; }
  if (isNaN(userId)) { res.status(400).json({ error: "userId richiesto" }); return; }

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

// ── GET /api/users/:id/public ───────────────────────────────────────────
router.get("/users/:id/public", async (req, res): Promise<void> => {
  const targetId = parseInt(req.params.id, 10);
  const viewerId = parseInt(req.query.viewerId as string, 10);
  if (isNaN(targetId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const [target] = await db
    .select({ id: usersTable.id, name: usersTable.name, isPublic: usersTable.isPublic, createdAt: usersTable.createdAt })
    .from(usersTable)
    .where(eq(usersTable.id, targetId));

  if (!target) { res.status(404).json({ error: "Utente non trovato" }); return; }

  let areFriends = false;
  let friendshipStatus: FriendshipStatus | null = null;
  let friendshipId: number | null = null;

  if (!isNaN(viewerId) && viewerId !== targetId) {
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
    iAmRequester: friendshipId ? undefined : undefined,
  });
});

// ── POST /api/friends/request ──────────────────────────────────────────
const requestSchema = z.object({
  requesterId: z.number().int().positive(),
  receiverId: z.number().int().positive(),
});

router.post("/friends/request", async (req, res): Promise<void> => {
  const parsed = requestSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dati non validi" }); return; }

  const { requesterId, receiverId } = parsed.data;
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

// ── PATCH /api/friends/:id/accept ──────────────────────────────────────
router.patch("/friends/:id/accept", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const [updated] = await db
    .update(friendshipsTable)
    .set({ status: "accepted", updatedAt: new Date() })
    .where(eq(friendshipsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Richiesta non trovata" }); return; }
  res.json({ friendship: updated });
});

// ── PATCH /api/friends/:id/reject ─────────────────────────────────────
router.patch("/friends/:id/reject", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  const [updated] = await db
    .update(friendshipsTable)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(eq(friendshipsTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Richiesta non trovata" }); return; }
  res.json({ friendship: updated });
});

// ── DELETE /api/friends/:id ────────────────────────────────────────────
router.delete("/friends/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID non valido" }); return; }

  await db.delete(friendshipsTable).where(eq(friendshipsTable.id, id));
  res.json({ success: true });
});

// ── PATCH /api/users/:userId/privacy ──────────────────────────────────
router.patch("/users/:userId/privacy", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

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
