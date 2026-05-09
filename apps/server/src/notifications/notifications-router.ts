/**
 * notifications-router.ts — /api/notifications
 *
 * Sistema notifiche in-app leggero: nessuna tabella dedicata.
 * Le notifiche vengono derivate da:
 *   - friendshipsTable (richieste in arrivo pending)
 *   - (future) messages, achievements, ecc.
 *
 * Endpoint:
 *   GET  /api/notifications/stream  — SSE stream (text/event-stream)
 *                                     Invia evento "ping" ogni 25s + "update" quando
 *                                     cambiano le richieste pending.
 *   GET  /api/notifications         — snapshot corrente (polling fallback)
 *   POST /api/notifications/friend-request/:id/accept  — shortcut accetta da notifica
 *   POST /api/notifications/friend-request/:id/decline — shortcut rifiuta da notifica
 *
 * NOTA: per il SSE usiamo lo stesso pattern di onboarding-router.ts (già in progetto).
 * Il client mantiene una singola connessione aperta; il server fa poll sul DB ogni 15s
 * e manda un evento "update" solo se il count è cambiato.
 */
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  friendshipsTable,
  usersTable,
  testSessionsTable,
  sectorsTable,
} from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";

export const notificationsRouter = Router();

// ── Tipi ──────────────────────────────────────────────────────────────────────

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

export type AppNotification = FriendRequestNotification;

// ── Helper: carica tutte le notifiche per un utente ──────────────────────────

async function loadNotifications(userId: number): Promise<AppNotification[]> {
  // Richieste di amicizia pendenti ricevute
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
    .leftJoin(usersTable,       eq(usersTable.id, friendshipsTable.requesterId))
    .leftJoin(testSessionsTable, eq(usersTable.testSessionId, testSessionsTable.id))
    .leftJoin(sectorsTable,     eq(testSessionsTable.confirmedSectorId, sectorsTable.id))
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

function uid(req: Request): number {
  return (req as Request & { user: { id: number } }).user.id;
}

// ── GET /api/notifications — snapshot JSON (polling fallback) ─────────────────

notificationsRouter.get("/", async (req: Request, res: Response) => {
  try {
    const notifications = await loadNotifications(uid(req));
    res.json({ notifications, unreadCount: notifications.length });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
  }
});

// ── GET /api/notifications/stream — SSE ──────────────────────────────────────

notificationsRouter.get("/stream", async (req: Request, res: Response) => {
  const me = uid(req);

  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable nginx buffering
  res.flushHeaders();

  // Invia subito lo snapshot iniziale
  const sendUpdate = async () => {
    try {
      const notifications = await loadNotifications(me);
      const payload = JSON.stringify({ notifications, unreadCount: notifications.length });
      res.write(`event: update\ndata: ${payload}\n\n`);
    } catch {
      res.write(`event: error\ndata: {}\n\n`);
    }
  };

  await sendUpdate();

  // Poll ogni 15 secondi
  const pollInterval = setInterval(() => {
    void sendUpdate();
  }, 15_000);

  // Ping ogni 25s per tenere viva la connessione (evita timeout proxy)
  const pingInterval = setInterval(() => {
    res.write(":ping\n\n");
  }, 25_000);

  // Cleanup alla chiusura connessione
  const cleanup = () => {
    clearInterval(pollInterval);
    clearInterval(pingInterval);
  };

  req.on("close",   cleanup);
  req.on("aborted", cleanup);
  res.on("finish",  cleanup);
});

// ── POST /api/notifications/friend-request/:id/accept ────────────────────────

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

      if (!row)                   { res.status(404).json({ error: "Non trovata" }); return; }
      if (row.receiverId !== me)  { res.status(403).json({ error: "Non autorizzato" }); return; }
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

// ── POST /api/notifications/friend-request/:id/decline ───────────────────────

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

      if (!row)                   { res.status(404).json({ error: "Non trovata" }); return; }
      if (row.receiverId !== me)  { res.status(403).json({ error: "Non autorizzato" }); return; }

      await db.delete(friendshipsTable).where(eq(friendshipsTable.id, friendshipId));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Errore" });
    }
  },
);
