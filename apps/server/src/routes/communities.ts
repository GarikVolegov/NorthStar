import { Router, type Response } from "express";
import { and, desc, eq, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import {
  communitiesTable,
  communityChannelsTable,
  communityMembersTable,
  communityMessagesTable,
  db,
  usersTable,
} from "@workspace/db";
import { getRequestBody } from "../lib/request-context";
import { asPlainRecord, isOneOf } from "../lib/type-guards";
import { getWss } from "../ws";

const router = Router();
const CHANNEL_TYPES = ["text", "announcement"] as const;

function readPositiveInteger(value: unknown): number | null {
  const numberValue = Number(value);
  return Number.isInteger(numberValue) && numberValue > 0 ? numberValue : null;
}

function readTrimmedString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function invalidId(res: Response) {
  res.status(400).json({ error: "ID non valido" });
}

async function getMembership(communityId: number, userId: number) {
  const [member] = await db
    .select()
    .from(communityMembersTable)
    .where(and(eq(communityMembersTable.communityId, communityId), eq(communityMembersTable.userId, userId)))
    .limit(1);
  return member ?? null;
}

async function canAccessCommunity(communityId: number, userId: number) {
  const [row] = await db
    .select({
      isPublic: communitiesTable.isPublic,
      memberUserId: communityMembersTable.userId,
    })
    .from(communitiesTable)
    .leftJoin(
      communityMembersTable,
      and(eq(communityMembersTable.communityId, communitiesTable.id), eq(communityMembersTable.userId, userId)),
    )
    .where(eq(communitiesTable.id, communityId))
    .limit(1);

  return Boolean(row && (row.isPublic || row.memberUserId === userId));
}

async function requireChannel(communityId: number, channelId: number) {
  const [channel] = await db
    .select()
    .from(communityChannelsTable)
    .where(and(eq(communityChannelsTable.id, channelId), eq(communityChannelsTable.communityId, communityId)))
    .limit(1);
  return channel ?? null;
}

router.get("/", async (req, res) => {
  const userId = req.user!.id;
  const rows = await db
    .select({
      id: communitiesTable.id,
      name: communitiesTable.name,
      description: communitiesTable.description,
      icon: communitiesTable.icon,
      isPublic: communitiesTable.isPublic,
      creatorId: communitiesTable.creatorId,
      memberCount: communitiesTable.memberCount,
      createdAt: communitiesTable.createdAt,
      role: communityMembersTable.role,
    })
    .from(communitiesTable)
    .leftJoin(
      communityMembersTable,
      and(eq(communityMembersTable.communityId, communitiesTable.id), eq(communityMembersTable.userId, userId)),
    )
    .where(or(eq(communitiesTable.isPublic, true), eq(communityMembersTable.userId, userId)))
    .orderBy(desc(communitiesTable.createdAt))
    .limit(50);

  res.json({
    communities: rows.map((row) => ({
      ...row,
      isMember: Boolean(row.role),
    })),
  });
});

router.post("/", async (req, res) => {
  const body = asPlainRecord(getRequestBody(req));
  const name = readTrimmedString(body.name);
  const description = readTrimmedString(body.description) || null;
  const icon = readTrimmedString(body.icon, "#").slice(0, 8) || "#";
  const isPublic = typeof body.isPublic === "boolean" ? body.isPublic : true;

  if (name.length < 2 || name.length > 80) {
    res.status(400).json({ error: "Il nome deve contenere tra 2 e 80 caratteri" });
    return;
  }

  const created = await db.transaction(async (tx) => {
    const [community] = await tx
      .insert(communitiesTable)
      .values({
        name,
        description,
        icon,
        isPublic,
        creatorId: req.user!.id,
        memberCount: 1,
      })
      .returning();

    if (!community) throw new Error("Comunita non creata");

    await tx.insert(communityMembersTable).values({
      communityId: community.id,
      userId: req.user!.id,
      role: "owner",
    });

    const [channel] = await tx
      .insert(communityChannelsTable)
      .values({
        communityId: community.id,
        name: "generale",
        description: "Discussione generale",
        type: "text",
        sortOrder: 0,
      })
      .returning();

    return { community, channel };
  });

  res.status(201).json(created);
});

router.post("/:id/join", async (req, res) => {
  const communityId = readPositiveInteger(req.params.id);
  if (communityId === null) {
    invalidId(res);
    return;
  }

  const [community] = await db.select().from(communitiesTable).where(eq(communitiesTable.id, communityId)).limit(1);
  if (!community) {
    res.status(404).json({ error: "Comunita non trovata" });
    return;
  }
  if (!community.isPublic) {
    res.status(403).json({ error: "Questa comunita e privata" });
    return;
  }

  const existing = await getMembership(communityId, req.user!.id);
  if (existing) {
    res.json({ ok: true, alreadyMember: true });
    return;
  }

  await db.transaction(async (tx) => {
    await tx.insert(communityMembersTable).values({ communityId, userId: req.user!.id, role: "member" });
    await tx
      .update(communitiesTable)
      .set({ memberCount: sql`${communitiesTable.memberCount} + 1`, updatedAt: new Date() })
      .where(eq(communitiesTable.id, communityId));
  });

  res.status(201).json({ ok: true });
});

router.delete("/:id/leave", async (req, res) => {
  const communityId = readPositiveInteger(req.params.id);
  if (communityId === null) {
    invalidId(res);
    return;
  }

  const member = await getMembership(communityId, req.user!.id);
  if (!member) {
    res.status(404).json({ error: "Iscrizione non trovata" });
    return;
  }
  if (member.role === "owner") {
    res.status(400).json({ error: "Il proprietario non puo uscire dalla comunita" });
    return;
  }

  await db.transaction(async (tx) => {
    await tx.delete(communityMembersTable).where(eq(communityMembersTable.id, member.id));
    await tx
      .update(communitiesTable)
      .set({ memberCount: sql`greatest(${communitiesTable.memberCount} - 1, 0)`, updatedAt: new Date() })
      .where(eq(communitiesTable.id, communityId));
  });

  res.json({ ok: true });
});

router.get("/:id/channels", async (req, res) => {
  const communityId = readPositiveInteger(req.params.id);
  if (communityId === null) {
    invalidId(res);
    return;
  }
  if (!(await canAccessCommunity(communityId, req.user!.id))) {
    res.status(403).json({ error: "Accesso negato" });
    return;
  }

  const channels = await db
    .select()
    .from(communityChannelsTable)
    .where(eq(communityChannelsTable.communityId, communityId))
    .orderBy(communityChannelsTable.sortOrder, communityChannelsTable.id);

  res.json({ channels });
});

router.get("/:id/channels/:channelId/messages", async (req, res) => {
  const communityId = readPositiveInteger(req.params.id);
  const channelId = readPositiveInteger(req.params.channelId);
  if (communityId === null || channelId === null) {
    invalidId(res);
    return;
  }
  if (!(await getMembership(communityId, req.user!.id)) || !(await requireChannel(communityId, channelId))) {
    res.status(403).json({ error: "Accesso negato" });
    return;
  }

  const requestedLimit = readPositiveInteger(req.query.limit);
  const limit = Math.min(requestedLimit ?? 50, 100);
  const before = readPositiveInteger(req.query.before);
  const conditions: SQL[] = [eq(communityMessagesTable.channelId, channelId), isNull(communityMessagesTable.deletedAt)];
  if (before !== null) conditions.push(lt(communityMessagesTable.id, before));

  const rows = await db
    .select({
      id: communityMessagesTable.id,
      channelId: communityMessagesTable.channelId,
      userId: communityMessagesTable.userId,
      content: communityMessagesTable.content,
      mediaUrl: communityMessagesTable.mediaUrl,
      createdAt: communityMessagesTable.createdAt,
      authorName: usersTable.name,
      authorAvatarUrl: usersTable.avatarUrl,
    })
    .from(communityMessagesTable)
    .innerJoin(usersTable, eq(communityMessagesTable.userId, usersTable.id))
    .where(and(...conditions))
    .orderBy(desc(communityMessagesTable.createdAt))
    .limit(limit);

  res.json({
    messages: rows.reverse().map(formatMessage),
  });
});

router.post("/:id/channels/:channelId/messages", async (req, res) => {
  const communityId = readPositiveInteger(req.params.id);
  const channelId = readPositiveInteger(req.params.channelId);
  if (communityId === null || channelId === null) {
    invalidId(res);
    return;
  }
  if (!(await getMembership(communityId, req.user!.id)) || !(await requireChannel(communityId, channelId))) {
    res.status(403).json({ error: "Accesso negato" });
    return;
  }

  const body = asPlainRecord(getRequestBody(req));
  const content = readTrimmedString(body.content);
  const mediaUrl = readTrimmedString(body.mediaUrl) || null;
  const type = readTrimmedString(body.type, "text");
  if (!isOneOf(type, CHANNEL_TYPES) && type) {
    res.status(400).json({ error: "Tipo canale non valido" });
    return;
  }
  if (content.length < 1 || content.length > 2000) {
    res.status(400).json({ error: "Il messaggio deve contenere tra 1 e 2000 caratteri" });
    return;
  }

  const [saved] = await db
    .insert(communityMessagesTable)
    .values({ channelId, userId: req.user!.id, content, mediaUrl })
    .returning();
  if (!saved) throw new Error("Messaggio non salvato");

  const [author] = await db
    .select({ id: usersTable.id, name: usersTable.name, avatarUrl: usersTable.avatarUrl })
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.id))
    .limit(1);

  const message = {
    id: saved.id,
    channelId: saved.channelId,
    userId: saved.userId,
    content: saved.content,
    mediaUrl: saved.mediaUrl,
    createdAt: saved.createdAt.toISOString(),
    author: {
      id: author?.id ?? req.user!.id,
      name: author?.name ?? "Utente",
      avatarUrl: author?.avatarUrl ?? null,
    },
  };

  const members = await db
    .select({ userId: communityMembersTable.userId })
    .from(communityMembersTable)
    .where(eq(communityMembersTable.communityId, communityId));
  const wss = getWss();
  if (wss) {
    for (const member of members) {
      wss.emit(member.userId, {
        type: "community_message",
        payload: { communityId, channelId, message },
      });
    }
  }

  res.status(201).json({ message });
});

function formatMessage(row: {
  id: number;
  channelId: number;
  userId: number;
  content: string;
  mediaUrl: string | null;
  createdAt: Date;
  authorName: string;
  authorAvatarUrl: string | null;
}) {
  return {
    id: row.id,
    channelId: row.channelId,
    userId: row.userId,
    content: row.content,
    mediaUrl: row.mediaUrl,
    createdAt: row.createdAt.toISOString(),
    author: {
      id: row.userId,
      name: row.authorName,
      avatarUrl: row.authorAvatarUrl,
    },
  };
}

export default router;
