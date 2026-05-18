import { Router } from "express";
import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { auditLogTable, contactMessagesTable, db, usersTable } from "@workspace/db";
import { requireAdminAccess } from "../middleware/auth";

const router = Router();

router.use("/messages", requireAdminAccess);

const MESSAGE_STATUSES = ["new", "in_progress", "resolved", "archived"] as const;
type MessageStatus = (typeof MESSAGE_STATUSES)[number];

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function parseId(value: unknown) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function normalizeMessageStatus(value: unknown): MessageStatus | null {
  const status = stringValue(value);
  return MESSAGE_STATUSES.includes(status as MessageStatus) ? (status as MessageStatus) : null;
}

async function getAdminAssignees() {
  return db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.role, "admin"))
    .orderBy(asc(usersTable.name));
}

async function ensureAdminUser(id: number | null) {
  if (id == null) return null;
  const [admin] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.id, id), eq(usersTable.role, "admin")))
    .limit(1);
  return admin ?? null;
}

async function writeContactAudit(req: any, action: string, messageId: number, metadata: Record<string, unknown>) {
  await db.insert(auditLogTable).values({
    actorId: req.user?.id ?? null,
    targetId: null,
    action,
    category: "admin_action",
    metadata: { workflow: "contact_messages", messageId, ...metadata },
  });
}

function messageWhere(req: any) {
  const status = normalizeMessageStatus(req.query.status);
  const read = stringValue(req.query.read, "all");
  const assignedTo = stringValue(req.query.assignedTo, "all");
  const search = stringValue(req.query.search);
  const pattern = `%${search}%`;
  const where = [
    isNull(contactMessagesTable.deletedAt),
    status ? eq(contactMessagesTable.status, status) : undefined,
    read === "unread" ? eq(contactMessagesTable.read, false) : undefined,
    read === "read" ? eq(contactMessagesTable.read, true) : undefined,
    assignedTo !== "all" && assignedTo !== ""
      ? assignedTo === "unassigned"
        ? isNull(contactMessagesTable.assignedTo)
        : eq(contactMessagesTable.assignedTo, Number(assignedTo))
      : undefined,
    search
      ? or(
          ilike(contactMessagesTable.name, pattern),
          ilike(contactMessagesTable.email, pattern),
          ilike(contactMessagesTable.subject, pattern),
          ilike(contactMessagesTable.message, pattern),
        )
      : undefined,
  ].filter(Boolean) as any[];
  return and(...where);
}

router.get("/messages", async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 100, 250));
    const [items, statsRows, assignees] = await Promise.all([
      db
        .select()
        .from(contactMessagesTable)
        .where(messageWhere(req))
        .orderBy(desc(contactMessagesTable.createdAt))
        .limit(limit),
      db
        .select({
          total: sql<number>`count(*)::int`,
          unread: sql<number>`count(*) filter (where ${contactMessagesTable.read} = false)::int`,
          read: sql<number>`count(*) filter (where ${contactMessagesTable.read} = true)::int`,
          new: sql<number>`count(*) filter (where ${contactMessagesTable.status} = 'new')::int`,
          inProgress: sql<number>`count(*) filter (where ${contactMessagesTable.status} = 'in_progress')::int`,
          resolved: sql<number>`count(*) filter (where ${contactMessagesTable.status} = 'resolved')::int`,
          archived: sql<number>`count(*) filter (where ${contactMessagesTable.status} = 'archived')::int`,
        })
        .from(contactMessagesTable)
        .where(isNull(contactMessagesTable.deletedAt)),
      getAdminAssignees(),
    ]);

    res.json({
      items,
      stats: statsRows[0] ?? { total: 0, unread: 0, read: 0, new: 0, inProgress: 0, resolved: 0, archived: 0 },
      assignees,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log?.warn?.({ err }, "contact messages unavailable");
    res.json({
      items: [],
      stats: { total: 0, unread: 0, read: 0, new: 0, inProgress: 0, resolved: 0, archived: 0 },
      assignees: [],
      generatedAt: new Date().toISOString(),
      error: "Messaggi temporaneamente non disponibili",
    });
  }
});

router.patch("/messages/:id/read", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID non valido" });
      return;
    }

    const read = req.body?.read === false ? false : true;
    const [message] = await db
      .update(contactMessagesTable)
      .set({ read, readAt: read ? new Date() : null, updatedAt: new Date() })
      .where(and(eq(contactMessagesTable.id, id), isNull(contactMessagesTable.deletedAt)))
      .returning();

    if (!message) {
      res.status(404).json({ error: "Messaggio non trovato" });
      return;
    }

    await writeContactAudit(req, "contact_message_read", id, { read });
    res.json(message);
  } catch (err) {
    req.log?.warn?.({ err }, "contact message mark read unavailable");
    res.status(503).json({ error: "Messaggi temporaneamente non disponibili" });
  }
});

router.patch("/messages/:id/status", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const status = normalizeMessageStatus(req.body?.status);
    if (!id || !status) {
      res.status(400).json({ error: "Status non valido" });
      return;
    }

    const [message] = await db
      .update(contactMessagesTable)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(contactMessagesTable.id, id), isNull(contactMessagesTable.deletedAt)))
      .returning();

    if (!message) {
      res.status(404).json({ error: "Messaggio non trovato" });
      return;
    }

    await writeContactAudit(req, "contact_message_status_changed", id, { status });
    res.json(message);
  } catch (err) {
    req.log?.warn?.({ err }, "contact message status unavailable");
    res.status(503).json({ error: "Messaggi temporaneamente non disponibili" });
  }
});

router.patch("/messages/:id/notes", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      res.status(400).json({ error: "ID non valido" });
      return;
    }
    const internalNotes = stringValue(req.body?.internalNotes);
    const [message] = await db
      .update(contactMessagesTable)
      .set({ internalNotes: internalNotes || null, updatedAt: new Date() })
      .where(and(eq(contactMessagesTable.id, id), isNull(contactMessagesTable.deletedAt)))
      .returning();
    if (!message) {
      res.status(404).json({ error: "Messaggio non trovato" });
      return;
    }
    await writeContactAudit(req, "contact_message_notes_updated", id, { hasNotes: Boolean(internalNotes) });
    res.json(message);
  } catch (err) {
    req.log?.warn?.({ err }, "contact message notes unavailable");
    res.status(503).json({ error: "Messaggi temporaneamente non disponibili" });
  }
});

router.patch("/messages/:id/assign", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const assignedTo = req.body?.assignedTo === null || req.body?.assignedTo === "" ? null : parseId(req.body?.assignedTo);
    if (!id) {
      res.status(400).json({ error: "ID non valido" });
      return;
    }
    const admin = await ensureAdminUser(assignedTo);
    if (assignedTo != null && !admin) {
      res.status(400).json({ error: "Assegnatario admin non valido" });
      return;
    }
    const [message] = await db
      .update(contactMessagesTable)
      .set({ assignedTo: assignedTo ?? null, updatedAt: new Date() })
      .where(and(eq(contactMessagesTable.id, id), isNull(contactMessagesTable.deletedAt)))
      .returning();
    if (!message) {
      res.status(404).json({ error: "Messaggio non trovato" });
      return;
    }
    await writeContactAudit(req, "contact_message_assigned", id, { assignedTo: assignedTo ?? null });
    res.json(message);
  } catch (err) {
    req.log?.warn?.({ err }, "contact message assign unavailable");
    res.status(503).json({ error: "Messaggi temporaneamente non disponibili" });
  }
});

export default router;
