/**
 * profile-router.ts — GET /api/users/:id/public
 *
 * Restituisce il profilo pubblico di un utente per la pagina /profilo/:id.
 *
 * Risposta:
 * {
 *   user: PublicProfile,
 *   connectionStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted',
 *   friendshipId: number | null   // presente se connectionStatus !== 'none'
 * }
 *
 * - Solo utenti con isPublic = true sono visibili (403 altrimenti)
 * - L'utente autenticato vede anche il proprio profilo (bypass isPublic)
 * - connectionStatus calcolato rispetto all'utente autenticato
 */
import { Router, type Request, type Response } from 'express';
import { db } from '@workspace/db';
import {
  usersTable,
  testSessionsTable,
  sectorsTable,
  friendshipsTable,
  badgesTable,
  userBadgesTable,
} from '@workspace/db';
import { eq, or, and } from 'drizzle-orm';

export const profileRouter = Router();

// ── GET /api/users/:id/public ──────────────────────────────────────────────

profileRouter.get('/:id/public', async (req: Request, res: Response) => {
  try {
    const me = (req as Request & { user?: { id: number } }).user?.id ?? null;
    const targetId = parseInt(req.params.id, 10);

    if (isNaN(targetId)) {
      res.status(400).json({ error: 'ID utente non valido' });
      return;
    }

    // ── Dati base utente ────────────────────────────────────────────────────
    const userRow = await db
      .select({
        id:          usersTable.id,
        name:        usersTable.name,
        avatarUrl:   usersTable.avatarUrl,
        isPublic:    usersTable.isPublic,
        journeyType: usersTable.journeyType,
        totalXp:     usersTable.totalXp,
        createdAt:   usersTable.createdAt,
        bio:         usersTable.bio,
        linkedinUrl: usersTable.linkedinUrl,
        sectorName:  sectorsTable.name,
        sectorId:    testSessionsTable.confirmedSectorId,
        testSessionId: usersTable.testSessionId,
      })
      .from(usersTable)
      .leftJoin(testSessionsTable, eq(usersTable.testSessionId, testSessionsTable.id))
      .leftJoin(sectorsTable, eq(testSessionsTable.confirmedSectorId, sectorsTable.id))
      .where(eq(usersTable.id, targetId))
      .limit(1)
      .then((r) => r[0] ?? null);

    if (!userRow) {
      res.status(404).json({ error: 'Utente non trovato' });
      return;
    }

    // Profilo privato: visibile solo al proprietario
    const isOwner = me !== null && me === targetId;
    if (!userRow.isPublic && !isOwner) {
      res.status(403).json({ error: 'Profilo privato' });
      return;
    }

    // ── Stato connessione ────────────────────────────────────────────────────
    let connectionStatus: 'none' | 'pending_sent' | 'pending_received' | 'accepted' = 'none';
    let friendshipId: number | null = null;

    if (me !== null && !isOwner) {
      const friendship = await db
        .select()
        .from(friendshipsTable)
        .where(
          or(
            and(
              eq(friendshipsTable.requesterId, me),
              eq(friendshipsTable.receiverId, targetId),
            ),
            and(
              eq(friendshipsTable.requesterId, targetId),
              eq(friendshipsTable.receiverId, me),
            ),
          ),
        )
        .limit(1)
        .then((r) => r[0] ?? null);

      if (friendship) {
        friendshipId = friendship.id;
        if (friendship.status === 'accepted') {
          connectionStatus = 'accepted';
        } else if (friendship.status === 'pending') {
          connectionStatus = friendship.requesterId === me
            ? 'pending_sent'
            : 'pending_received';
        }
      }
    }

    // ── Badge (ultimi 6) ────────────────────────────────────────────────────
    const badges = await db
      .select({
        id:          badgesTable.id,
        name:        badgesTable.name,
        description: badgesTable.description,
        icon:        badgesTable.icon,
        earnedAt:    userBadgesTable.earnedAt,
      })
      .from(userBadgesTable)
      .innerJoin(badgesTable, eq(userBadgesTable.badgeId, badgesTable.id))
      .where(eq(userBadgesTable.userId, targetId))
      .limit(6);

    // ── Statistiche pubbliche ────────────────────────────────────────────────
    // Conta solo amici accettati
    const friendCount = await db
      .select()
      .from(friendshipsTable)
      .where(
        and(
          or(
            eq(friendshipsTable.requesterId, targetId),
            eq(friendshipsTable.receiverId, targetId),
          ),
          eq(friendshipsTable.status, 'accepted'),
        ),
      )
      .then((r) => r.length);

    // ── Risposta ─────────────────────────────────────────────────────────────
    res.json({
      user: {
        id:          userRow.id,
        name:        userRow.name,
        avatarUrl:   userRow.avatarUrl,
        bio:         userRow.bio ?? null,
        linkedinUrl: userRow.linkedinUrl ?? null,
        journeyType: userRow.journeyType,
        totalXp:     userRow.totalXp,
        sectorName:  userRow.sectorName ?? null,
        memberSince: userRow.createdAt,
        isPublic:    userRow.isPublic,
        isOwner,
      },
      stats: {
        friendCount,
        badgeCount: badges.length,
      },
      badges,
      connectionStatus,
      friendshipId,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Errore' });
  }
});
