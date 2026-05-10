/**
 * notifications-router.ts — /api/notifications
 *
 * Sistema notifiche in-app: nessuna tabella dedicata.
 * Le notifiche vengono derivate da:
 *   - friendshipsTable  (richieste in arrivo pending)
 *   - messagesTable     (messaggi DM non letti, raggruppati per mittente)
 *
 * Endpoint:
 *   GET  /api/notifications         — snapshot corrente (polling fallback)
 *   GET  /api/notifications/stream  — SSE stream
 *                                     - evento "update" ogni 15s (o alla connessione)
 *                                     - keepalive ":ping" ogni 25s
 *   POST /api/notifications/friend-request/:id/accept  — shortcut accetta
 *   POST /api/notifications/friend-request/:id/decline — shortcut rifiuta
 */
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  friendshipsTable,
  usersTable,
  testSessionsTable,
  sectorsTable,
  messagesTable,
  conversationsTable,
  conversationParticipantsTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

export const notificationsRouter = Router();

// ── Tipi ─────────────────────────────────────────────────────────────────────

export interface FriendRequestNotification {
  id: string;          // `friend-request-${friendshipId}`
  type: "friend_request";
  friendshipId: number;
  from: {
    id: number;
    name: string;
    avatarUrl: string | null;
    sectorName: string | null;
  };
  sentAt: string;
  read: boolean;
}

export interface DMNotification {
  id: string;          // `dm-${senderId}`
  type: "new_message";
  from: {
    id: number;
    name: string;
    avatarUrl: string | null;
  };
  unreadCount: number;  // numero messaggi non letti da questo mittente
  lastMessageAt: string;
  read: boolean;        // sempre false (derivato da isRead=false)
}

export type AppNotification = FriendRequestNotification | DMNotification;

// ── Helper: richieste di amicizia pending ──────────────────────────────────────

async function loadFriendRequestNotifications(
  userId: number,
): Promise<FriendRequestNotification[]> {
  const rows = await db
    .select({
      id:          friendshipsTable.id,
      requesterId: friendshipsTable.requesterId,
      createdAt:   friendshipsTable.createdAt,
      name:        usersTable.name,
      avatarUrl:   usersTable.avatarUrl,
      sectorName:  sectorsTable.name,
    })
    .from(friendshipsTable)
    .leftJoin(usersTable,        eq(usersTable.id, friendshipsTable.requesterId))
    .leftJoin(testSessionsTable, eq(usersTable.testSessionId, testSessionsTable.id))
    .leftJoin(sectorsTable,      eq(testSessionsTable.confirmedSectorId, sectorsTable.id))
    .where(
      and(
        eq(friendshipsTable.receiverId, userId),
        eq(friendshipsTable.status, "pending"),
      ),
    )
    .orderBy(sql`${friendshipsTable.createdAt} DESC`);

  return rows.map((r) => ({
    id:           `friend-request-${r.id}`,
    type:         "friend_request" as const,
    friendshipId: r.id,
    from: {
      id:         r.requesterId,
      name:       r.name ?? "Utente",
      avatarUrl:  r.avatarUrl ?? null,
      sectorName: r.sectorName ?? null,
    },
    sentAt: r.createdAt instanceof Date
      ? r.createdAt.toISOString()
      : String(r.createdAt),
    read: false,
  }));
}

// ── Helper: messaggi DM non letti, raggruppati per mittente ─────────────────────
//
// Strategia:
//   1. Trova tutte le conversazioni dirette di cui l'utente fa parte
//   2. Per ciascuna, conta i messaggi non letti inviati dall'altro partecipante
//   3. Emette una DMNotification per ogni conversazione con unread > 0

async function loadDMNotifications(userId: number): Promise<DMNotification[]> {
  // Step 1: trova i conversationId delle conversazioni dirette dell'utente
  const myConvs = await db
    .select({ conversationId: conversationParticipantsTable.conversationId })
    .from(conversationParticipantsTable)
    .innerJoin(
      conversationsTable,
      and(
        eq(conversationsTable.id, conversationParticipantsTable.conversationId),
        eq(conversationsTable.type, "direct"),
      ),
    )
    .where(eq(conversationParticipantsTable.userId, userId));

  if (myConvs.length === 0) return [];

  const notifications: DMNotification[] = [];

  await Promise.all(
    myConvs.map(async ({ conversationId }) => {
      // Step 2: trova l'altro partecipante
      const other = await db
        .select({ userId: conversationParticipantsTable.userId })
        .from(conversationParticipantsTable)
        .where(
          and(
            eq(conversationParticipantsTable.conversationId, conversationId),
            sql`${conversationParticipantsTable.userId} != ${userId}`,
          ),
        )
        .limit(1)
        .then((r) => r[0] ?? null);

      if (!other) return;

      // Step 3: conta messaggi non letti inviati dall'altro
      const unreadRows = await db
        .select({
          count:         sql<number>`COUNT(*)`,
          lastMessageAt: sql<string>`MAX(${messagesTable.createdAt})`,
        })
        .from(messagesTable)
        .where(
          and(
            eq(messagesTable.conversationId, conversationId),
            eq(messagesTable.senderId, other.userId),
            eq(messagesTable.isRead, false),
            eq(messagesTable.isDeleted, false),
          ),
        )
        .then((r) => r[0] ?? null);

      const unreadCount = Number(unreadRows?.count ?? 0);
      if (unreadCount === 0) return;

      // Step 4: recupera dati mittente
      const sender = await db
        .select({ id: usersTable.id, name: usersTable.name, avatarUrl: usersTable.avatarUrl })
        .from(usersTable)
        .where(eq(usersTable.id, other.userId))
        .limit(1)
        .then((r) => r[0] ?? null);

      if (!sender) return;

      notifications.push({
        id:            `dm-${sender.id}`,
        type:          "new_message",
        from:          { id: sender.id, name: sender.name ?? "Utente", avatarUrl: sender.avatarUrl ?? null },
        unreadCount,
        lastMessageAt: unreadRows?.lastMessageAt
          ? new Date(unreadRows.lastMessageAt).toISOString()
          : new Date().toISOString(),
        read: false,
      });
    }),
  );

  return notifications.sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  );
}

// ── Helper composto ─────────────────────────────────────────────────────────────────

async function loadAllNotifications(userId: number) {
  const [friendRequests, dmNotifications] = await Promise.all([
    loadFriendRequestNotifications(userId),
    loadDMNotifications(userId),
  ]);

  const notifications: AppNotification[] = [
    ...friendRequests,
    ...dmNotifications,
  ].sort((a, b) => {
    const aTime = a.type === "friend_request" ? a.sentAt : a.lastMessageAt;
    const bTime = b.type === "friend_request" ? b.sentAt : b.lastMessageAt;
    return new Date(bTime).getTime() - new Date(aTime).getTime();
  });

  return {
    notifications,
    unreadCount:          notifications.length,
    friendRequestCount:   friendRequests.length,
    unreadMessagesCount:  dmNotifications.reduce((s, n) => s + n.unreadCount, 0),
  };
}

function uid(req: Request): number {
  return (req as Request & { user: { id: number } }).user.id;
}

// ── GET /api/notifications — snapshot JSON ───────────────────────────────────────

notificationsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const data = await loadAllNotifications(uid(req));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});

// ── GET /api/notifications/stream — SSE ──────────────────────────────────────────

notificationsRouter.get("/stream", async (req: Request, res: Response) => {
  const me = uid(req);

  res.setHeader("Content-Type",       "text/event-stream");
  res.setHeader("Cache-Control",      "no-cache, no-transform");
  res.setHeader("Connection",         "keep-alive");
  res.setHeader("X-Accel-Buffering",  "no");
  res.flushHeaders();

  const sendUpdate = async () => {
    try {
      const data    = await loadAllNotifications(me);
      const payload = JSON.stringify(data);
      res.write(`event: update\ndata: ${payload}\n\n`);
    } catch {
      res.write(`event: error\ndata: {}\n\n`);
    }
  };

  // Snapshot immediato alla connessione
  await sendUpdate();

  // Poll ogni 15 secondi (copre sia friend_requests che DM non letti)
  const pollInterval = setInterval(() => { void sendUpdate(); }, 15_000);

  // Keepalive ogni 25s
  const pingInterval = setInterval(() => { res.write(":ping\n\n"); }, 25_000);

  const cleanup = () => {
    clearInterval(pollInterval);
    clearInterval(pingInterval);
  };

  req.on("close",   cleanup);
  req.on("aborted", cleanup);
  res.on("finish",  cleanup);
});

// ── POST /api/notifications/friend-request/:id/accept ───────────────────────────

notificationsRouter.post(
  "/friend-request/:id/accept",
  async (req: Request, res: Response) => {
    try {
      const me           = uid(req);
      const friendshipId = parseInt(req.params.id, 10);

      const [row] = await db
        .select()
        .from(friendshipsTable)
        .where(eq(friendshipsTable.id, friendshipId))
        .limit(1);

      if (!row)                     { res.status(404).json({ error: "Non trovata" });   return; }
      if (row.receiverId !== me)    { res.status(403).json({ error: "Non autorizzato" }); return; }
      if (row.status !== "pending") { res.status(409).json({ error: "Stato non valido" }); return; }

      const [updated] = await db
        .update(friendshipsTable)
        .set({ status: "accepted", updatedAt: new Date() })
        .where(eq(friendshipsTable.id, friendshipId))
        .returning();

      res.json({ friendship: updated });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
    }
  },
);

// ── POST /api/notifications/friend-request/:id/decline ──────────────────────────

notificationsRouter.post(
  "/friend-request/:id/decline",
  async (req: Request, res: Response) => {
    try {
      const me           = uid(req);
      const friendshipId = parseInt(req.params.id, 10);

      const [row] = await db
        .select()
        .from(friendshipsTable)
        .where(eq(friendshipsTable.id, friendshipId))
        .limit(1);

      if (!row)                  { res.status(404).json({ error: "Non trovata" });    return; }
      if (row.receiverId !== me) { res.status(403).json({ error: "Non autorizzato" }); return; }

      await db.delete(friendshipsTable).where(eq(friendshipsTable.id, friendshipId));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
    }
  },
);
