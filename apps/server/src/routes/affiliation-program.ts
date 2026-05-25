import { Router, type Request } from "express";
import { and, asc, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import {
  affiliationLeadsTable,
  auditLogTable,
  db,
  usersTable,
} from "@workspace/db";
import { requireAdminAccess } from "../middleware/auth";
import { getRequestBody } from "../lib/request-context";
import { asPlainRecord, isOneOf } from "../lib/type-guards";

const router = Router();

router.use("/leads", requireAdminAccess);

const LEAD_STATUSES = [
  "pending",
  "contacted",
  "converted",
  "rejected",
] as const;
type LeadStatus = (typeof LEAD_STATUSES)[number];

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function parseId(value: unknown) {
  const id = Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function normalizeLeadStatus(value: unknown): LeadStatus {
  const requested = stringValue(value, "contacted");
  const statusMap: Record<string, LeadStatus> = {
    nuovo: "pending",
    contattato: "contacted",
    in_trattativa: "contacted",
    attivo: "converted",
    convertito: "converted",
    pending: "pending",
    contacted: "contacted",
    converted: "converted",
    rejected: "rejected",
  };
  return statusMap[requested] ?? "contacted";
}

function isSql(condition: SQL | undefined): condition is SQL {
  return condition !== undefined;
}

function toAdminLead(lead: typeof affiliationLeadsTable.$inferSelect) {
  return {
    ...lead,
    institutionName: lead.name ?? lead.email,
    contactName: lead.name ?? "Contatto",
    partnerType: lead.source,
    message: lead.notes,
  };
}

async function getAdminAssignees() {
  return db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      email: usersTable.email,
    })
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

async function writeLeadAudit(
  req: Request,
  action: string,
  leadId: number,
  metadata: Record<string, unknown>,
) {
  await db.insert(auditLogTable).values({
    actorId: req.user?.id ?? null,
    targetId: null,
    action,
    category: "admin_action",
    metadata: { workflow: "affiliation_leads", leadId, ...metadata },
  });
}

function leadsWhere(req: Request) {
  const status = stringValue(req.query.status, "all");
  const read = stringValue(req.query.read, "all");
  const source = stringValue(req.query.source, "all");
  const assignedTo = stringValue(req.query.assignedTo, "all");
  const search = stringValue(req.query.search);
  const pattern = `%${search}%`;
  const where = [
    isOneOf(status, LEAD_STATUSES)
      ? eq(affiliationLeadsTable.status, status)
      : undefined,
    source !== "all" && source !== ""
      ? eq(affiliationLeadsTable.source, source)
      : undefined,
    read === "unread" ? eq(affiliationLeadsTable.read, false) : undefined,
    read === "read" ? eq(affiliationLeadsTable.read, true) : undefined,
    assignedTo !== "all" && assignedTo !== ""
      ? assignedTo === "unassigned"
        ? isNull(affiliationLeadsTable.assignedTo)
        : eq(affiliationLeadsTable.assignedTo, Number(assignedTo))
      : undefined,
    search
      ? or(
          ilike(affiliationLeadsTable.name, pattern),
          ilike(affiliationLeadsTable.email, pattern),
          ilike(affiliationLeadsTable.source, pattern),
          ilike(affiliationLeadsTable.notes, pattern),
        )
      : undefined,
  ].filter(isSql);
  return where.length ? and(...where) : undefined;
}

router.get("/leads", async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 100, 250));
    const [leads, statsRows, sourceRows, assignees] = await Promise.all([
      db
        .select()
        .from(affiliationLeadsTable)
        .where(leadsWhere(req))
        .orderBy(desc(affiliationLeadsTable.createdAt))
        .limit(limit),
      db
        .select({
          total: sql<number>`count(*)::int`,
          unread: sql<number>`count(*) filter (where ${affiliationLeadsTable.read} = false)::int`,
          read: sql<number>`count(*) filter (where ${affiliationLeadsTable.read} = true)::int`,
          pending: sql<number>`count(*) filter (where ${affiliationLeadsTable.status} = 'pending')::int`,
          contacted: sql<number>`count(*) filter (where ${affiliationLeadsTable.status} = 'contacted')::int`,
          converted: sql<number>`count(*) filter (where ${affiliationLeadsTable.status} = 'converted')::int`,
          rejected: sql<number>`count(*) filter (where ${affiliationLeadsTable.status} = 'rejected')::int`,
        })
        .from(affiliationLeadsTable),
      db
        .select({
          source: affiliationLeadsTable.source,
          count: sql<number>`count(*)::int`,
        })
        .from(affiliationLeadsTable)
        .groupBy(affiliationLeadsTable.source)
        .orderBy(affiliationLeadsTable.source),
      getAdminAssignees(),
    ]);

    res.json({
      items: leads.map(toAdminLead),
      stats: statsRows[0] ?? {
        total: 0,
        unread: 0,
        read: 0,
        pending: 0,
        contacted: 0,
        converted: 0,
        rejected: 0,
      },
      sources: sourceRows.map((row) => ({
        source: row.source,
        count: Number(row.count) || 0,
      })),
      assignees,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log?.warn?.({ err }, "affiliation leads unavailable");
    res.json({
      items: [],
      stats: {
        total: 0,
        unread: 0,
        read: 0,
        pending: 0,
        contacted: 0,
        converted: 0,
        rejected: 0,
      },
      sources: [],
      assignees: [],
      generatedAt: new Date().toISOString(),
      error: "Lead temporaneamente non disponibili",
    });
  }
});

router.patch("/leads/:id/read", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }
  const body = asPlainRecord(getRequestBody(req));
  const read = body.read === false ? false : true;
  const [lead] = await db
    .update(affiliationLeadsTable)
    .set({ read, readAt: read ? new Date() : null, updatedAt: new Date() })
    .where(eq(affiliationLeadsTable.id, id))
    .returning();
  if (!lead) {
    res.status(404).json({ error: "Lead non trovato" });
    return;
  }
  await writeLeadAudit(req, "affiliation_lead_read", id, { read });
  res.json(toAdminLead(lead));
});

router.patch("/leads/:id/status", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }
  const body = asPlainRecord(getRequestBody(req));
  const status = normalizeLeadStatus(body.status);

  const [lead] = await db
    .update(affiliationLeadsTable)
    .set({ status, converted: status === "converted", updatedAt: new Date() })
    .where(eq(affiliationLeadsTable.id, id))
    .returning();

  if (!lead) {
    res.status(404).json({ error: "Lead non trovato" });
    return;
  }

  await writeLeadAudit(req, "affiliation_lead_status_changed", id, { status });
  res.json(toAdminLead(lead));
});

router.patch("/leads/:id/notes", async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }
  const body = asPlainRecord(getRequestBody(req));
  const internalNotes = stringValue(body.internalNotes);
  const [lead] = await db
    .update(affiliationLeadsTable)
    .set({ internalNotes: internalNotes || null, updatedAt: new Date() })
    .where(eq(affiliationLeadsTable.id, id))
    .returning();
  if (!lead) {
    res.status(404).json({ error: "Lead non trovato" });
    return;
  }
  await writeLeadAudit(req, "affiliation_lead_notes_updated", id, {
    hasNotes: Boolean(internalNotes),
  });
  res.json(toAdminLead(lead));
});

router.patch("/leads/:id/assign", async (req, res) => {
  const id = parseId(req.params.id);
  const body = asPlainRecord(getRequestBody(req));
  const assignedTo =
    body.assignedTo === null || body.assignedTo === ""
      ? null
      : parseId(body.assignedTo);
  if (!id) {
    res.status(400).json({ error: "ID non valido" });
    return;
  }
  const admin = await ensureAdminUser(assignedTo);
  if (assignedTo != null && !admin) {
    res.status(400).json({ error: "Assegnatario admin non valido" });
    return;
  }
  const [lead] = await db
    .update(affiliationLeadsTable)
    .set({ assignedTo: assignedTo ?? null, updatedAt: new Date() })
    .where(eq(affiliationLeadsTable.id, id))
    .returning();
  if (!lead) {
    res.status(404).json({ error: "Lead non trovato" });
    return;
  }
  await writeLeadAudit(req, "affiliation_lead_assigned", id, {
    assignedTo: assignedTo ?? null,
  });
  res.json(toAdminLead(lead));
});

export default router;
