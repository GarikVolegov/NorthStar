import { Router } from "express";
import { eq, and, or, desc, lt, sql } from "drizzle-orm";
import { db, friendshipsTable, usersTable, chatMessagesTable } from "@workspace/db";
import { userKeysTable, friendshipKeysTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { getWss } from "../ws";

const router = Router();

/* ────────────────────────────────────────────────────────────────────
 * Middleware: tutte le route richiedono autenticazione
 * ──────────────────────────────────────────────────────────────────── */
router.use(requireAuth);

/* ─── GET /api/friends/:userId  —  lista amici / richieste ─────────── */
router.get("/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId) || userId !== req.user!.id) {
    res.status(403).json({ error: "Accesso negato" });
    return;
  }

  // Amici accettati (dove l'utente è requester o receiver E status = accepted)
  const accepted = await db
    .select({
      friendshipId: friendshipsTable.id,
      id: sql<number>`CASE WHEN ${friendshipsTable.requesterId} = ${userId} THEN ${friendshipsTable.receiverId} ELSE ${friendshipsTable.requesterId} END`,
      name: usersTable.name,
      email: usersTable.email,
      isPublic: usersTable.isPublic,
    })
    .from(friendshipsTable)
    .innerJoin(usersTable, sql`(
      CASE WHEN ${friendshipsTable.requesterId} = ${userId} THEN ${friendshipsTable.receiverId}
      ELSE ${friendshipsTable.requesterId} END
    ) = ${usersTable.id}`)
    .where(and(
      or(
        eq(friendshipsTable.requesterId, userId),
        eq(friendshipsTable.receiverId, userId),
      ),
      eq(friendshipsTable.status, "accepted"),
    ));

  // Richieste in entrata (receiver = userId, status = pending)
  const incoming = await db
    .select({
      friendshipId: friendshipsTable.id,
      id: friendshipsTable.requesterId,
      name: usersTable.name,
      email: usersTable.email,
      isPublic: usersTable.isPublic,
      createdAt: friendshipsTable.createdAt,
    })
    .from(friendshipsTable)
    .innerJoin(usersTable, eq(friendshipsTable.requesterId, usersTable.id))
    .where(and(
      eq(friendshipsTable.receiverId, userId),
      eq(friendshipsTable.status, "pending"),
    ));

  // Richieste in uscita (requester = userId, status = pending)
  const outgoing = await db
    .select({
      friendshipId: friendshipsTable.id,
      id: friendshipsTable.receiverId,
      name: usersTable.name,
      email: usersTable.email,
      isPublic: usersTable.isPublic,
      createdAt: friendshipsTable.createdAt,
    })
    .from(friendshipsTable)
    .innerJoin(usersTable, eq(friendshipsTable.receiverId, usersTable.id))
    .where(and(
      eq(friendshipsTable.requesterId, userId),
      eq(friendshipsTable.status, "pending"),
    ));

  res.json({ friends: accepted, incoming, outgoing });
});

/* ─── POST /api/friends/request  —  invia richiesta amicizia ───────── */
router.post("/request", async (req, res) => {
  const { requesterId, receiverId } = req.body;
  if (requesterId !== req.user!.id) {
    res.status(403).json({ error: "Accesso negato" });
    return;
  }
  if (requesterId === receiverId) {
    res.status(400).json({ error: "Non puoi inviare richiesta a te stesso" });
    return;
  }

  const [existing] = await db
    .select()
    .from(friendshipsTable)
    .where(or(
      and(eq(friendshipsTable.requesterId, requesterId), eq(friendshipsTable.receiverId, receiverId)),
      and(eq(friendshipsTable.requesterId, receiverId), eq(friendshipsTable.receiverId, requesterId)),
    ))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "Richiesta già esistente" });
    return;
  }

  const [created] = await db
    .insert(friendshipsTable)
    .values({ requesterId, receiverId, status: "pending" })
    .returning();

  res.status(201).json(created);
});

/* ─── PATCH /api/friends/:id/accept  —  accetta richiesta ──────────── */
router.patch("/:id/accept", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const userId = req.user!.id;

  const [friendship] = await db
    .select()
    .from(friendshipsTable)
    .where(eq(friendshipsTable.id, id))
    .limit(1);

  if (!friendship || friendship.receiverId !== userId) {
    res.status(403).json({ error: "Non puoi accettare questa richiesta" });
    return;
  }

  const [updated] = await db
    .update(friendshipsTable)
    .set({ status: "accepted", updatedAt: new Date() })
    .where(eq(friendshipsTable.id, id))
    .returning();

  res.json(updated);
});

/* ─── PATCH /api/friends/:id/reject  —  rifiuta richiesta ──────────── */
router.patch("/:id/reject", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const userId = req.user!.id;

  const [friendship] = await db
    .select()
    .from(friendshipsTable)
    .where(eq(friendshipsTable.id, id))
    .limit(1);

  if (!friendship || friendship.receiverId !== userId) {
    res.status(403).json({ error: "Non puoi rifiutare questa richiesta" });
    return;
  }

  const [updated] = await db
    .update(friendshipsTable)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(eq(friendshipsTable.id, id))
    .returning();

  res.json(updated);
});

/* ─── DELETE /api/friends/:id  —  elimina/cancella amicizia ────────── */
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const userId = req.user!.id;

  const [friendship] = await db
    .select()
    .from(friendshipsTable)
    .where(eq(friendshipsTable.id, id))
    .limit(1);

  if (!friendship) {
    res.status(404).json({ error: "Richiesta non trovata" });
    return;
  }

  if (friendship.requesterId !== userId && friendship.receiverId !== userId) {
    res.status(403).json({ error: "Accesso negato" });
    return;
  }

  await db.delete(friendshipsTable).where(eq(friendshipsTable.id, id));
  res.json({ success: true });
});

/* ═══════════════════════════════════════════════════════════════════
 * CHAT MESSAGES
 * ═══════════════════════════════════════════════════════════════════ */

/* ─── GET /api/friends/messages/:friendshipId  —  storico messaggi ── */
router.get("/messages/:friendshipId", async (req, res) => {
  const friendshipId = parseInt(req.params.friendshipId, 10);
  const userId = req.user!.id;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const before = req.query.before ? parseInt(req.query.before as string) : undefined;

  const [friendship] = await db
    .select()
    .from(friendshipsTable)
    .where(eq(friendshipsTable.id, friendshipId))
    .limit(1);

  if (!friendship || (friendship.requesterId !== userId && friendship.receiverId !== userId)) {
    res.status(403).json({ error: "Accesso negato" });
    return;
  }

  const conditions = [eq(chatMessagesTable.friendshipId, friendshipId)];
  if (before) conditions.push(lt(chatMessagesTable.id, before));

  const messages = await db
    .select()
    .from(chatMessagesTable)
    .where(and(...conditions))
    .orderBy(desc(chatMessagesTable.createdAt))
    .limit(limit);

  res.json({ messages: messages.reverse() });
});

/* ─── POST /api/friends/messages  —  invia messaggio criptato ─────── */
router.post("/messages", async (req, res) => {
  const userId = req.user!.id;
  const { friendshipId, encryptedContent, iv } = req.body;

  const [friendship] = await db
    .select()
    .from(friendshipsTable)
    .where(and(
      eq(friendshipsTable.id, friendshipId),
      eq(friendshipsTable.status, "accepted"),
    ))
    .limit(1);

  if (!friendship || (friendship.requesterId !== userId && friendship.receiverId !== userId)) {
    res.status(403).json({ error: "Accesso negato" });
    return;
  }

  const [saved] = await db
    .insert(chatMessagesTable)
    .values({
      friendshipId,
      senderId: userId,
      encryptedContent,
      iv,
    })
    .returning();

  // Determina il destinatario
  const receiverId = friendship.requesterId === userId
    ? friendship.receiverId
    : friendship.requesterId;

  const wss = getWss();
  if (wss) {
    wss.emit(receiverId, {
      type: "friend:message",
      payload: {
        friendshipId,
        message: {
          id: saved.id,
          senderId: userId,
          encryptedContent: saved.encryptedContent,
          iv: saved.iv,
          createdAt: saved.createdAt.toISOString(),
        },
      },
    });
    // Invia anche al mittente (per conferma)
    wss.emit(userId, {
      type: "friend:message",
      payload: {
        friendshipId,
        message: {
          id: saved.id,
          senderId: userId,
          encryptedContent: saved.encryptedContent,
          iv: saved.iv,
          createdAt: saved.createdAt.toISOString(),
        },
      },
    });
  }

  res.status(201).json(saved);
});

/* ─── PATCH /api/friends/messages/:id/read  —  marca come letto ────── */
router.patch("/messages/:id/read", async (req, res) => {
  const messageId = parseInt(req.params.id, 10);
  const userId = req.user!.id;

  const [msg] = await db
    .select({
      id: chatMessagesTable.id,
      friendshipId: chatMessagesTable.friendshipId,
      senderId: chatMessagesTable.senderId,
    })
    .from(chatMessagesTable)
    .where(eq(chatMessagesTable.id, messageId))
    .limit(1);

  if (!msg) {
    res.status(404).json({ error: "Messaggio non trovato" });
    return;
  }

  const [friendship] = await db
    .select()
    .from(friendshipsTable)
    .where(eq(friendshipsTable.id, msg.friendshipId))
    .limit(1);

  if (!friendship || (friendship.requesterId !== userId && friendship.receiverId !== userId)) {
    res.status(403).json({ error: "Accesso negato" });
    return;
  }

  const readAt = new Date();
  const [updated] = await db
    .update(chatMessagesTable)
    .set({ readAt })
    .where(eq(chatMessagesTable.id, messageId))
    .returning();

  const wss = getWss();
  if (wss) {
    wss.emit(msg.senderId, {
      type: "friend:message:read",
      payload: {
        friendshipId: msg.friendshipId,
        messageId,
        readAt: readAt.toISOString(),
      },
    });
  }

  res.json(updated);
});

/* ═══════════════════════════════════════════════════════════════════
 * CRITTOGRAFIA (chiavi)
 * ═══════════════════════════════════════════════════════════════════ */

/* ─── GET /api/friends/keys/:userId  —  chiave pubblica utente ─────── */
router.get("/keys/:userId", async (req, res) => {
  const targetId = parseInt(req.params.userId, 10);
  const [key] = await db
    .select()
    .from(userKeysTable)
    .where(eq(userKeysTable.userId, targetId))
    .limit(1);

  if (!key) {
    res.status(404).json({ error: "Chiave non trovata" });
    return;
  }

  res.json({ publicKey: key.publicKey });
});

/* ─── POST /api/friends/keys  —  salva chiave pubblica ────────────── */
router.post("/keys", async (req, res) => {
  const userId = req.user!.id;
  const { publicKey } = req.body;

  await db
    .insert(userKeysTable)
    .values({ userId, publicKey })
    .onConflictDoUpdate({
      target: [userKeysTable.userId],
      set: { publicKey },
    });

  res.json({ success: true });
});

/* ─── POST /api/friends/keys/exchange  —  salva chiavi conversazione ─ */
router.post("/keys/exchange", async (req, res) => {
  const userId = req.user!.id;
  const { friendshipId, keyForRequester, keyForReceiver } = req.body;

  const [friendship] = await db
    .select()
    .from(friendshipsTable)
    .where(and(
      eq(friendshipsTable.id, friendshipId),
      eq(friendshipsTable.status, "accepted"),
    ))
    .limit(1);

  if (!friendship || (friendship.requesterId !== userId && friendship.receiverId !== userId)) {
    res.status(403).json({ error: "Accesso negato" });
    return;
  }

  await db
    .insert(friendshipKeysTable)
    .values({ friendshipId, keyForRequester, keyForReceiver })
    .onConflictDoUpdate({
      target: [friendshipKeysTable.friendshipId],
      set: { keyForRequester, keyForReceiver },
    });

  res.json({ success: true });
});

/* ─── GET /api/friends/keys/exchange/:friendshipId  —  leggi chiavi ── */
router.get("/keys/exchange/:friendshipId", async (req, res) => {
  const friendshipId = parseInt(req.params.friendshipId, 10);
  const userId = req.user!.id;

  const [friendship] = await db
    .select()
    .from(friendshipsTable)
    .where(eq(friendshipsTable.id, friendshipId))
    .limit(1);

  if (!friendship || (friendship.requesterId !== userId && friendship.receiverId !== userId)) {
    res.status(403).json({ error: "Accesso negato" });
    return;
  }

  const [keys] = await db
    .select()
    .from(friendshipKeysTable)
    .where(eq(friendshipKeysTable.friendshipId, friendshipId))
    .limit(1);

  if (!keys) {
    res.status(404).json({ error: "Chiavi non trovate" });
    return;
  }

  const myEncryptedKey = userId === friendship.requesterId
    ? keys.keyForRequester
    : keys.keyForReceiver;

  res.json({ encryptedKey: myEncryptedKey });
});

export default router;
