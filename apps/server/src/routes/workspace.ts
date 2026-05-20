/**
 * workspace.ts — CRUD per workspace condivisi.
 *
 * GET    /api/workspaces              — lista workspace dell'utente
 * POST   /api/workspaces             — crea workspace (richiede plan Team)
 * GET    /api/workspaces/:id         — dettaglio workspace
 * PATCH  /api/workspaces/:id         — aggiorna workspace (solo owner/admin)
 * DELETE /api/workspaces/:id         — archivia workspace (solo owner)
 * POST   /api/workspaces/:id/members — invita membro
 * PATCH  /api/workspaces/:id/members/:userId — cambia ruolo
 * DELETE /api/workspaces/:id/members/:userId — rimuovi membro
 * GET    /api/workspaces/:id/plans   — piani condivisi nel workspace
 * POST   /api/workspaces/:id/plans   — condividi un piano
 *
 * SECURITY: ogni query filtra su membership verificata (no IDOR).
 */
import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { requireFeature } from "../middleware/check-feature";
import { rootLogger } from "../middleware/logger";
import {
  db,
  workspacesTable,
  workspaceMembersTable,
  sharedPlansTable,
} from "@workspace/db";

const router = Router();
const log    = rootLogger.child({ module: "workspace" });

// ── Helpers ────────────────────────────────────────────────────────────────────

async function getMembership(workspaceId: number, userId: number) {
  const [m] = await db
    .select({ role: workspaceMembersTable.role })
    .from(workspaceMembersTable)
    .where(and(
      eq(workspaceMembersTable.workspaceId, workspaceId),
      eq(workspaceMembersTable.userId, userId),
    ))
    .limit(1);
  return m ?? null;
}

const ROLE_RANK = { owner: 3, admin: 2, member: 1, viewer: 0 };
function canManage(role: string) { return ROLE_RANK[role as keyof typeof ROLE_RANK] >= 2; }

// ── GET /api/workspaces ────────────────────────────────────────────────────────

router.get("/", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  try {
    const memberships = await db
      .select({
        workspaceId: workspaceMembersTable.workspaceId,
        role:        workspaceMembersTable.role,
        joinedAt:    workspaceMembersTable.joinedAt,
        name:        workspacesTable.name,
        type:        workspacesTable.type,
        ownerId:     workspacesTable.ownerId,
        isActive:    workspacesTable.isActive,
      })
      .from(workspaceMembersTable)
      .innerJoin(workspacesTable, eq(workspaceMembersTable.workspaceId, workspacesTable.id))
      .where(and(
        eq(workspaceMembersTable.userId, userId),
        eq(workspacesTable.isActive, true),
      ));

    res.json({ workspaces: memberships });
  } catch (e) {
    log.error({ e, userId }, "[workspace] list error");
    res.status(500).json({ error: "Errore nel recupero workspace" });
  }
});

// ── POST /api/workspaces ───────────────────────────────────────────────────────

const CreateWorkspaceSchema = z.object({
  name:        z.string().min(2).max(80),
  type:        z.enum(["team", "mentor_mentee"]).default("team"),
  description: z.string().max(300).optional(),
});

router.post(
  "/",
  requireAuth,
  requireFeature("workspace_shared", "json"),
  async (req, res) => {
    const userId = req.user!.id;
    const parsed = CreateWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

    try {
      const [workspace] = await db
        .insert(workspacesTable)
        .values({ ...parsed.data, ownerId: userId })
        .returning({ id: workspacesTable.id, name: workspacesTable.name });

      if (!workspace) {
        throw new Error("Workspace non creato");
      }

      // Owner diventa automaticamente membro con ruolo owner
      await db.insert(workspaceMembersTable).values({
        workspaceId: workspace.id,
        userId,
        role: "owner",
      });

      log.info({ userId, workspaceId: workspace.id, type: parsed.data.type }, "[workspace] created");
      res.status(201).json({ ok: true, workspace });
    } catch (e) {
      log.error({ e, userId }, "[workspace] create error");
      res.status(500).json({ error: "Errore nella creazione workspace" });
    }
  },
);

// ── GET /api/workspaces/:id ────────────────────────────────────────────────────

router.get("/:id", requireAuth, async (req, res) => {
  const userId      = req.user!.id;
  const workspaceId = parseInt(req.params.id ?? "", 10);
  if (isNaN(workspaceId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const membership = await getMembership(workspaceId, userId);
  if (!membership) { res.status(404).json({ error: "Workspace non trovato" }); return; }

  try {
    const [ws] = await db
      .select()
      .from(workspacesTable)
      .where(eq(workspacesTable.id, workspaceId))
      .limit(1);

    const members = await db
      .select({
        userId:   workspaceMembersTable.userId,
        role:     workspaceMembersTable.role,
        joinedAt: workspaceMembersTable.joinedAt,
      })
      .from(workspaceMembersTable)
      .where(eq(workspaceMembersTable.workspaceId, workspaceId));

    res.json({ workspace: ws, members, myRole: membership.role });
  } catch (e) {
    log.error({ e, workspaceId }, "[workspace] get error");
    res.status(500).json({ error: "Errore nel recupero workspace" });
  }
});

// ── POST /api/workspaces/:id/members ─────────────────────────────────────────

const InviteMemberSchema = z.object({
  userId: z.number().int().positive(),
  role:   z.enum(["admin", "member", "viewer"]).default("member"),
});

router.post("/:id/members", requireAuth, async (req, res) => {
  const actorId     = req.user!.id;
  const workspaceId = parseInt(req.params.id ?? "", 10);
  if (isNaN(workspaceId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const actorMembership = await getMembership(workspaceId, actorId);
  if (!actorMembership || !canManage(actorMembership.role)) {
    res.status(403).json({ error: "Permessi insufficienti" }); return;
  }

  const parsed = InviteMemberSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
    await db.insert(workspaceMembersTable).values({
      workspaceId,
      userId:    parsed.data.userId,
      role:      parsed.data.role,
      invitedBy: actorId,
    }).onConflictDoNothing();

    log.info({ actorId, workspaceId, invitedUserId: parsed.data.userId }, "[workspace] member invited");
    res.json({ ok: true });
  } catch (e) {
    log.error({ e, workspaceId }, "[workspace] invite member error");
    res.status(500).json({ error: "Errore nell'invito membro" });
  }
});

// ── DELETE /api/workspaces/:id/members/:userId ───────────────────────────────

router.delete("/:id/members/:memberId", requireAuth, async (req, res) => {
  const actorId     = req.user!.id;
  const workspaceId = parseInt(req.params.id ?? "", 10);
  const memberId    = parseInt(req.params.memberId ?? "", 10);
  if (isNaN(workspaceId) || isNaN(memberId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const actorMembership = await getMembership(workspaceId, actorId);
  // Può rimuovere se: è admin+ oppure si sta rimuovendo da solo
  if (!actorMembership || (!canManage(actorMembership.role) && actorId !== memberId)) {
    res.status(403).json({ error: "Permessi insufficienti" }); return;
  }

  try {
    await db.delete(workspaceMembersTable).where(and(
      eq(workspaceMembersTable.workspaceId, workspaceId),
      eq(workspaceMembersTable.userId, memberId),
    ));
    res.json({ ok: true });
  } catch (e) {
    log.error({ e, workspaceId, memberId }, "[workspace] remove member error");
    res.status(500).json({ error: "Errore nella rimozione membro" });
  }
});

// ── GET /api/workspaces/:id/plans ─────────────────────────────────────────────

router.get("/:id/plans", requireAuth, async (req, res) => {
  const userId      = req.user!.id;
  const workspaceId = parseInt(req.params.id ?? "", 10);
  if (isNaN(workspaceId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const membership = await getMembership(workspaceId, userId);
  if (!membership) { res.status(404).json({ error: "Workspace non trovato" }); return; }

  try {
    const plans = await db
      .select({
        id:          sharedPlansTable.id,
        title:       sharedPlansTable.title,
        description: sharedPlansTable.description,
        permissions: sharedPlansTable.permissions,
        ownerId:     sharedPlansTable.ownerId,
        createdAt:   sharedPlansTable.createdAt,
        updatedAt:   sharedPlansTable.updatedAt,
      })
      .from(sharedPlansTable)
      .where(eq(sharedPlansTable.workspaceId, workspaceId));

    res.json({ plans });
  } catch (e) {
    log.error({ e, workspaceId }, "[workspace] list plans error");
    res.status(500).json({ error: "Errore nel recupero piani" });
  }
});

// ── POST /api/workspaces/:id/plans ───────────────────────────────────────────

const SharePlanSchema = z.object({
  title:       z.string().min(2).max(150),
  description: z.string().max(400).optional(),
  planData:    z.object({
    objectives:  z.array(z.object({
      id:       z.number(),
      text:     z.string(),
      category: z.string(),
      progress: z.number(),
      dueDate:  z.string().nullable(),
    })),
    horizon:     z.string(),
    journeyType: z.string(),
  }).optional(),
  permissions: z.enum(["view", "comment", "fork"]).default("comment"),
});

router.post("/:id/plans", requireAuth, async (req, res) => {
  const userId      = req.user!.id;
  const workspaceId = parseInt(req.params.id ?? "", 10);
  if (isNaN(workspaceId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const membership = await getMembership(workspaceId, userId);
  if (!membership || membership.role === "viewer") {
    res.status(403).json({ error: "Permessi insufficienti" }); return;
  }

  const parsed = SharePlanSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  try {
      const [plan] = await db
        .insert(sharedPlansTable)
        .values({ ...parsed.data, workspaceId, ownerId: userId })
        .returning({ id: sharedPlansTable.id, title: sharedPlansTable.title });

    if (!plan) {
      throw new Error("Piano non condiviso");
    }

    log.info({ userId, workspaceId, planId: plan.id }, "[workspace] plan shared");
    res.status(201).json({ ok: true, plan });
  } catch (e) {
    log.error({ e, workspaceId }, "[workspace] share plan error");
    res.status(500).json({ error: "Errore nella condivisione piano" });
  }
});

export default router;
