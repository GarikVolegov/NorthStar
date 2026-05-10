/**
 * dm-router.ts — /api/dm
 *
 * Gestione messaggi diretti tra utenti connessi (friendships accepted).
 *
 * GET    /api/dm/conversations          — lista conversazioni con ultimo messaggio
 * GET    /api/dm/conversations/:userId  — messaggi con uno specifico utente (paginati)
 * POST   /api/dm/conversations/:userId  — invia messaggio (testo, max 2000 char)
 * DELETE /api/dm/messages/:messageId    — elimina proprio messaggio (soft delete)
 * GET    /api/dm/conversations/:userId/stream — SSE: nuovi messaggi in tempo reale
 *
 * Regole:
 *   - Solo utenti con friendship accepted possono scambiarsi DM
 *   - Max 2000 caratteri per messaggio
 *   - Paginazione offset-based: ?before=<messageId>&limit=<n> (default 30, max 100)
 */
import { Router, type Request, type Response } from 'express';
import { db } from '@workspace/db';
import {
  messagesTable,
  conversationsTable,
  friendshipsTable,
  usersTable,
  conversationParticipantsTable,
} from '@workspace/db';
import { eq, or, and, lt, desc, asc, sql } from 'drizzle-orm';

export const dmRouter = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function uid(req: Request): number {
  return (req as Request & { user: { id: number } }).user.id;
}

/**
 * Trova o crea una conversazione 1:1 tra due utenti.
 * Restituisce il conversationId.
 */
async function getOrCreateConversation(userA: number, userB: number): Promise<number> {
  const existing = await db
    .select({ id: conversationsTable.id })
    .from(conversationsTable)
    .innerJoin(
      conversationParticipantsTable,
      eq(conversationsTable.id, conversationParticipantsTable.conversationId),
    )
    .where(
      and(
        eq(conversationsTable.type, 'direct'),
        or(
          eq(conversationParticipantsTable.userId, userA),
          eq(conversationParticipantsTable.userId, userB),
        ),
      ),
    )
    .groupBy(conversationsTable.id)
    .having(sql`COUNT(DISTINCT ${conversationParticipantsTable.userId}) = 2`)
    .limit(1)
    .then((r) => r[0] ?? null);

  if (existing) return existing.id;

  const [conv] = await db
    .insert(conversationsTable)
    .values({ type: 'direct' })
    .returning();

  await db.insert(conversationParticipantsTable).values([
    { conversationId: conv.id, userId: userA },
    { conversationId: conv.id, userId: userB },
  ]);

  return conv.id;
}

/**
 * Verifica che i due utenti siano amici (accepted).
 */
async function areFriends(userA: number, userB: number): Promise<boolean> {
  const row = await db
    .select({ id: friendshipsTable.id })
    .from(friendshipsTable)
    .where(
      and(
        or(
          and(eq(friendshipsTable.requesterId, userA), eq(friendshipsTable.receiverId, userB)),
          and(eq(friendshipsTable.requesterId, userB), eq(friendshipsTable.receiverId, userA)),
        ),
        eq(friendshipsTable.status, 'accepted'),
      ),
    )
    .limit(1)
    .then((r) => r[0] ?? null);
  return row !== null;
}

// ── GET /api/dm/conversations — lista conversazioni ───────────────────────────

dmRouter.get('/conversations', async (req: Request, res: Response) => {
  try {
    const me = uid(req);

    const myConvs = await db
      .select({ conversationId: conversationParticipantsTable.conversationId })
      .from(conversationParticipantsTable)
      .where(eq(conversationParticipantsTable.userId, me));

    if (myConvs.length === 0) {
      res.json({ conversations: [] });
      return;
    }

    const convIds = myConvs.map((c) => c.conversationId);

    const conversations = await Promise.all(
      convIds.map(async (convId) => {
        const otherParticipant = await db
          .select({ userId: conversationParticipantsTable.userId })
          .from(conversationParticipantsTable)
          .where(
            and(
              eq(conversationParticipantsTable.conversationId, convId),
              sql`${conversationParticipantsTable.userId} != ${me}`,
            ),
          )
          .limit(1)
          .then((r) => r[0] ?? null);

        if (!otherParticipant) return null;

        const otherUser = await db
          .select({
            id: usersTable.id,
            name: usersTable.name,
            avatarUrl: usersTable.avatarUrl,
          })
          .from(usersTable)
          .where(eq(usersTable.id, otherParticipant.userId))
          .limit(1)
          .then((r) => r[0] ?? null);

        if (!otherUser) return null;

        const lastMessage = await db
          .select()
          .from(messagesTable)
          .where(
            and(
              eq(messagesTable.conversationId, convId),
              eq(messagesTable.isDeleted, false),
            ),
          )
          .orderBy(desc(messagesTable.createdAt))
          .limit(1)
          .then((r) => r[0] ?? null);

        const unreadCount = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(messagesTable)
          .where(
            and(
              eq(messagesTable.conversationId, convId),
              eq(messagesTable.senderId, otherParticipant.userId),
              eq(messagesTable.isDeleted, false),
              eq(messagesTable.isRead, false),
            ),
          )
          .then((r) => Number(r[0]?.count ?? 0));

        return {
          conversationId: convId,
          participant: otherUser,
          lastMessage: lastMessage
            ? {
                id: lastMessage.id,
                content: lastMessage.content,
                senderId: lastMessage.senderId,
                createdAt: lastMessage.createdAt,
              }
            : null,
          unreadCount,
          updatedAt: lastMessage?.createdAt ?? null,
        };
      }),
    );

    const result = conversations
      .filter(Boolean)
      .sort((a, b) => {
        const aTime = a?.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b?.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTime - aTime;
      });

    res.json({ conversations: result });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Errore' });
  }
});

// ── GET /api/dm/conversations/:userId — messaggi con utente ───────────────────

dmRouter.get('/conversations/:userId', async (req: Request, res: Response) => {
  try {
    const me = uid(req);
    const otherId = parseInt(req.params.userId, 10);

    if (isNaN(otherId) || otherId === me) {
      res.status(400).json({ error: 'ID utente non valido' });
      return;
    }

    const friends = await areFriends(me, otherId);
    if (!friends) {
      res.status(403).json({ error: 'Puoi messaggiare solo le tue connessioni' });
      return;
    }

    const convId = await getOrCreateConversation(me, otherId);

    const limit = Math.min(
      parseInt(typeof req.query.limit === 'string' ? req.query.limit : '30', 10) || 30,
      100,
    );
    const before = typeof req.query.before === 'string'
      ? parseInt(req.query.before, 10)
      : null;

    const whereClause = and(
      eq(messagesTable.conversationId, convId),
      eq(messagesTable.isDeleted, false),
      ...(before !== null && !isNaN(before) ? [lt(messagesTable.id, before)] : []),
    );

    const messages = await db
      .select()
      .from(messagesTable)
      .where(whereClause)
      .orderBy(desc(messagesTable.createdAt))
      .limit(limit + 1);

    const hasMore = messages.length > limit;
    const result = messages.slice(0, limit).reverse();

    await db
      .update(messagesTable)
      .set({ isRead: true })
      .where(
        and(
          eq(messagesTable.conversationId, convId),
          eq(messagesTable.senderId, otherId),
          eq(messagesTable.isRead, false),
        ),
      );

    res.json({
      conversationId: convId,
      messages: result,
      hasMore,
      oldestId: result[0]?.id ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Errore' });
  }
});

// ── POST /api/dm/conversations/:userId — invia messaggio ──────────────────────

dmRouter.post('/conversations/:userId', async (req: Request, res: Response) => {
  try {
    const me = uid(req);
    const otherId = parseInt(req.params.userId, 10);

    if (isNaN(otherId) || otherId === me) {
      res.status(400).json({ error: 'ID utente non valido' });
      return;
    }

    const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
    if (!content) {
      res.status(400).json({ error: 'Il messaggio non può essere vuoto' });
      return;
    }
    if (content.length > 2000) {
      res.status(400).json({ error: 'Messaggio troppo lungo (max 2000 caratteri)' });
      return;
    }

    const friends = await areFriends(me, otherId);
    if (!friends) {
      res.status(403).json({ error: 'Puoi messaggiare solo le tue connessioni' });
      return;
    }

    const convId = await getOrCreateConversation(me, otherId);

    const [message] = await db
      .insert(messagesTable)
      .values({
        conversationId: convId,
        senderId: me,
        content,
        isRead: false,
        isDeleted: false,
      })
      .returning();

    res.status(201).json({ message });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Errore' });
  }
});

// ── DELETE /api/dm/messages/:messageId — elimina messaggio ────────────────────

dmRouter.delete('/messages/:messageId', async (req: Request, res: Response) => {
  try {
    const me = uid(req);
    const messageId = parseInt(req.params.messageId, 10);

    if (isNaN(messageId)) {
      res.status(400).json({ error: 'ID messaggio non valido' });
      return;
    }

    const row = await db
      .select()
      .from(messagesTable)
      .where(eq(messagesTable.id, messageId))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!row) { res.status(404).json({ error: 'Messaggio non trovato' }); return; }
    if (row.senderId !== me) { res.status(403).json({ error: 'Non autorizzato' }); return; }
    if (row.isDeleted) { res.status(409).json({ error: 'Messaggio già eliminato' }); return; }

    await db
      .update(messagesTable)
      .set({ isDeleted: true, content: '' })
      .where(eq(messagesTable.id, messageId));

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Errore' });
  }
});

// ── GET /api/dm/conversations/:userId/stream — SSE polling ────────────────────
//
// SSE semplificato: polling ogni 3s per nuovi messaggi dopo lastId.
// Parametro: ?after=<messageId>
//
// Emette eventi:
//   data: { type: 'message', message: {...} }
//   data: { type: 'ping' }                   ← keepalive ogni 25s

dmRouter.get('/conversations/:userId/stream', async (req: Request, res: Response) => {
  try {
    const me = uid(req);
    const otherId = parseInt(req.params.userId, 10);

    if (isNaN(otherId) || otherId === me) {
      res.status(400).json({ error: 'ID utente non valido' });
      return;
    }

    const friends = await areFriends(me, otherId);
    if (!friends) {
      res.status(403).json({ error: 'Non autorizzato' });
      return;
    }

    const convId = await getOrCreateConversation(me, otherId);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    let lastId = typeof req.query.after === 'string'
      ? parseInt(req.query.after, 10)
      : 0;

    const send = (data: unknown) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const pollInterval = setInterval(async () => {
      try {
        const newMessages = await db
          .select()
          .from(messagesTable)
          .where(
            and(
              eq(messagesTable.conversationId, convId),
              eq(messagesTable.isDeleted, false),
              sql`${messagesTable.id} > ${lastId}`,
            ),
          )
          .orderBy(asc(messagesTable.id))
          .limit(20);

        for (const msg of newMessages) {
          send({ type: 'message', message: msg });
          lastId = msg.id;
        }

        if (newMessages.some((m) => m.senderId === otherId)) {
          await db
            .update(messagesTable)
            .set({ isRead: true })
            .where(
              and(
                eq(messagesTable.conversationId, convId),
                eq(messagesTable.senderId, otherId),
                eq(messagesTable.isRead, false),
              ),
            );
        }
      } catch {
        // ignora errori transitori nel poll
      }
    }, 3000);

    const pingInterval = setInterval(() => {
      send({ type: 'ping' });
    }, 25000);

    req.on('close', () => {
      clearInterval(pollInterval);
      clearInterval(pingInterval);
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Errore' });
  }
});
