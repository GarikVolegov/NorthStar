import { Router, type Response } from "express";
import { eq, and, or, desc, lt, sql, type SQL } from "drizzle-orm";
import {
  db,
  friendshipsTable,
  usersTable,
  userProfileSettingsTable,
  chatMessagesTable,
} from "@workspace/db";
import { userKeysTable, friendshipKeysTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { emitToUser } from "../ws";
import { getRequestBody } from "../lib/request-context";
import { asPlainRecord } from "../lib/type-guards";

const router = Router();

function readInteger(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) ? numberValue : null;
}

function readPositiveInteger(value: unknown): number | null {
  const numberValue = readInteger(value);
  return numberValue !== null && numberValue > 0 ? numberValue : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function invalidId(res: Response) {
  res.status(400).json({ error: "ID non valido" });
}

/* ────────────────────────────────────────────────────────────────────
 * Middleware: tutte le route richiedono autenticazione
 * ──────────────────────────────────────────────────────────────────── */
router.use(requireAuth);

/* ─── GET /api/friends/:userId  —  lista amici / richieste ─────────── */
router.get("/:userId", async (req, res) => {
  const userId = readPositiveInteger(req.params.userId);
  if (userId === null || userId !== req.user!.id) {
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
      isPublic: userProfileSettingsTable.isPublic,
    })
    .from(friendshipsTable)
    .innerJoin(
      usersTable,
      sql`(
      CASE WHEN ${friendshipsTable.requesterId} = ${userId} THEN ${friendshipsTable.receiverId}
      ELSE ${friendshipsTable.requesterId} END
    ) = ${usersTable.id}`,
    )
    .leftJoin(
      userProfileSettingsTable,
      eq(usersTable.id, userProfileSettingsTable.userId),
    )
    .where(
      and(
        or(
          eq(friendshipsTable.requesterId, userId),
          eq(friendshipsTable.receiverId, userId),
        ),
        eq(friendshipsTable.status, "accepted"),
      ),
    );

  // Richieste in entrata (receiver = userId, status = pending)
  const incoming = await db
    .select({
      friendshipId: friendshipsTable.id,
      id: friendshipsTable.requesterId,
      name: usersTable.name,
      email: usersTable.email,
      isPublic: userProfileSettingsTable.isPublic,
      createdAt: friendshipsTable.createdAt,
    })
    .from(friendshipsTable)
    .innerJoin(usersTable, eq(friendshipsTable.requesterId, usersTable.id))
    .leftJoin(
      userProfileSettingsTable,
      eq(usersTable.id, userProfileSettingsTable.userId),
    )
    .where(
      and(
        eq(friendshipsTable.receiverId, userId),
        eq(friendshipsTable.status, "pending"),
      ),
    );

  // Richieste in uscita (requester = userId, status = pending)
  const outgoing = await db
    .select({
      friendshipId: friendshipsTable.id,
      id: friendshipsTable.receiverId,
      name: usersTable.name,
      email: usersTable.email,
      isPublic: userProfileSettingsTable.isPublic,
      createdAt: friendshipsTable.createdAt,
    })
    .from(friendshipsTable)
    .innerJoin(usersTable, eq(friendshipsTable.receiverId, usersTable.id))
    .leftJoin(
      userProfileSettingsTable,
      eq(usersTable.id, userProfileSettingsTable.userId),
    )
    .where(
      and(
        eq(friendshipsTable.requesterId, userId),
        eq(friendshipsTable.status, "pending"),
      ),
    );

  res.json({ friends: accepted, incoming, outgoing });
});

/* ─── POST /api/friends/request  —  invia richiesta amicizia ───────── */
router.post("/request", async (req, res) => {
  const body = asPlainRecord(getRequestBody(req));
  const requesterId = readPositiveInteger(body.requesterId);
  const receiverId = readPositiveInteger(body.receiverId);
  if (requesterId === null || receiverId === null) {
    invalidId(res);
    return;
  }
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
    .where(
      or(
        and(
          eq(friendshipsTable.requesterId, requesterId),
          eq(friendshipsTable.receiverId, receiverId),
        ),
        and(
          eq(friendshipsTable.requesterId, receiverId),
          eq(friendshipsTable.receiverId, requesterId),
        ),
      ),
    )
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
  const id = readPositiveInteger(req.params.id);
  if (id === null) {
    invalidId(res);
    return;
  }
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
  const id = readPositiveInteger(req.params.id);
  if (id === null) {
    invalidId(res);
    return;
  }
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
  const id = readPositiveInteger(req.params.id);
  if (id === null) {
    invalidId(res);
    return;
  }
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
  const friendshipId = readPositiveInteger(req.params.friendshipId);
  if (friendshipId === null) {
    invalidId(res);
    return;
  }
  const userId = req.user!.id;
  const requestedLimit = readPositiveInteger(req.query.limit);
  const limit = Math.min(requestedLimit ?? 50, 100);
  const before = readPositiveInteger(req.query.before);

  const [friendship] = await db
    .select()
    .from(friendshipsTable)
    .where(eq(friendshipsTable.id, friendshipId))
    .limit(1);

  if (
    !friendship ||
    (friendship.requesterId !== userId && friendship.receiverId !== userId)
  ) {
    res.status(403).json({ error: "Accesso negato" });
    return;
  }

  const conditions: SQL[] = [eq(chatMessagesTable.friendshipId, friendshipId)];
  if (before !== null) conditions.push(lt(chatMessagesTable.id, before));

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
  const body = asPlainRecord(getRequestBody(req));
  const friendshipId = readPositiveInteger(body.friendshipId);
  const encryptedContent = readString(body.encryptedContent);
  const iv = readString(body.iv);
  if (friendshipId === null || encryptedContent === null || iv === null) {
    res.status(400).json({ error: "Payload messaggio non valido" });
    return;
  }

  const [friendship] = await db
    .select()
    .from(friendshipsTable)
    .where(
      and(
        eq(friendshipsTable.id, friendshipId),
        eq(friendshipsTable.status, "accepted"),
      ),
    )
    .limit(1);

  if (
    !friendship ||
    (friendship.requesterId !== userId && friendship.receiverId !== userId)
  ) {
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

  if (!saved) {
    throw new Error("Messaggio non salvato");
  }

  // Determina il destinatario
  const receiverId =
    friendship.requesterId === userId
      ? friendship.receiverId
      : friendship.requesterId;

  const messageEvent = {
    type: "friend:message" as const,
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
  };
  emitToUser(receiverId, messageEvent);
  emitToUser(userId, messageEvent); // anche al mittente (conferma)

  res.status(201).json(saved);
});

/* ─── PATCH /api/friends/messages/:id/read  —  marca come letto ────── */
router.patch("/messages/:id/read", async (req, res) => {
  const messageId = readPositiveInteger(req.params.id);
  if (messageId === null) {
    invalidId(res);
    return;
  }
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

  if (
    !friendship ||
    (friendship.requesterId !== userId && friendship.receiverId !== userId)
  ) {
    res.status(403).json({ error: "Accesso negato" });
    return;
  }

  const readAt = new Date();
  const [updated] = await db
    .update(chatMessagesTable)
    .set({ readAt })
    .where(eq(chatMessagesTable.id, messageId))
    .returning();

  emitToUser(msg.senderId, {
    type: "friend:message:read",
    payload: {
      friendshipId: msg.friendshipId,
      messageId,
      readAt: readAt.toISOString(),
    },
  });

  res.json(updated);
});

/* ═══════════════════════════════════════════════════════════════════
 * CRITTOGRAFIA (chiavi)
 * ═══════════════════════════════════════════════════════════════════ */

/* ─── GET /api/friends/keys/:userId  —  chiave pubblica utente ─────── */
router.get("/keys/:userId", async (req, res) => {
  const targetId = readPositiveInteger(req.params.userId);
  if (targetId === null) {
    invalidId(res);
    return;
  }
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
  const body = asPlainRecord(getRequestBody(req));
  const publicKey = readString(body.publicKey);
  if (publicKey === null) {
    res.status(400).json({ error: "publicKey richiesto" });
    return;
  }

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
  const body = asPlainRecord(getRequestBody(req));
  const friendshipId = readPositiveInteger(body.friendshipId);
  const keyForRequester = readString(body.keyForRequester);
  const keyForReceiver = readString(body.keyForReceiver);
  if (
    friendshipId === null ||
    keyForRequester === null ||
    keyForReceiver === null
  ) {
    res.status(400).json({ error: "Payload chiavi non valido" });
    return;
  }

  const [friendship] = await db
    .select()
    .from(friendshipsTable)
    .where(
      and(
        eq(friendshipsTable.id, friendshipId),
        eq(friendshipsTable.status, "accepted"),
      ),
    )
    .limit(1);

  if (
    !friendship ||
    (friendship.requesterId !== userId && friendship.receiverId !== userId)
  ) {
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
  const friendshipId = readPositiveInteger(req.params.friendshipId);
  if (friendshipId === null) {
    invalidId(res);
    return;
  }
  const userId = req.user!.id;

  const [friendship] = await db
    .select()
    .from(friendshipsTable)
    .where(eq(friendshipsTable.id, friendshipId))
    .limit(1);

  if (
    !friendship ||
    (friendship.requesterId !== userId && friendship.receiverId !== userId)
  ) {
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

  const myEncryptedKey =
    userId === friendship.requesterId
      ? keys.keyForRequester
      : keys.keyForReceiver;

  res.json({ encryptedKey: myEncryptedKey });
});

export default router;
