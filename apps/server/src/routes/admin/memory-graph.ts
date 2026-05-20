import { Router, type Request, type Response } from "express";
import { db, knowledgeEdgesTable, knowledgeNodesTable } from "@workspace/db";
import { desc, eq, inArray, sql } from "drizzle-orm";
import {
  getMemoryGraphHealth,
  ingestUserMemoryGraph,
} from "@workspace/ai-server";
import { writeAuditLog } from "../../middleware/audit";
import { rootLogger } from "../../middleware/logger";
import { getRequestBody } from "../../lib/request-context";
import { asPlainRecord } from "../../lib/type-guards";

const router = Router();

router.get("/memory-graph/overview", async (req: Request, res: Response) => {
  try {
    const userId =
      typeof req.query.userId === "string"
        ? Number(req.query.userId)
        : undefined;
    const health = await getMemoryGraphHealth(
      Number.isFinite(userId) ? userId : undefined,
    );

    const candidateEdges = await db
      .select({
        id: knowledgeEdgesTable.id,
        userId: knowledgeEdgesTable.userId,
        sourceId: knowledgeEdgesTable.sourceId,
        targetId: knowledgeEdgesTable.targetId,
        label: knowledgeEdgesTable.label,
        relationType: knowledgeEdgesTable.relationType,
        confidence: knowledgeEdgesTable.confidence,
        reason: knowledgeEdgesTable.reason,
        createdAt: knowledgeEdgesTable.createdAt,
      })
      .from(knowledgeEdgesTable)
      .where(eq(knowledgeEdgesTable.status, "candidate"))
      .orderBy(desc(knowledgeEdgesTable.createdAt))
      .limit(50);

    const nodeIds = Array.from(
      new Set(candidateEdges.flatMap((edge) => [edge.sourceId, edge.targetId])),
    );
    const nodes = nodeIds.length
      ? await db
          .select({
            id: knowledgeNodesTable.id,
            title: knowledgeNodesTable.title,
            type: knowledgeNodesTable.type,
            sourceType: knowledgeNodesTable.sourceType,
            confidence: knowledgeNodesTable.confidence,
            status: knowledgeNodesTable.status,
          })
          .from(knowledgeNodesTable)
          .where(inArray(knowledgeNodesTable.id, nodeIds))
      : [];
    const nodesById = new Map(nodes.map((node) => [node.id, node]));

    const sourceBreakdown = await db.execute<{
      source_type: string;
      count: string;
    }>(sql`
      SELECT source_type, count(*)::text AS count
      FROM knowledge_nodes
      GROUP BY source_type
      ORDER BY count(*) DESC
      LIMIT 12
    `);

    res.json({
      generatedAt: new Date().toISOString(),
      health,
      sourceBreakdown: sourceBreakdown.rows.map((row) => ({
        sourceType: row.source_type,
        count: Number(row.count),
      })),
      candidateRelations: candidateEdges.map((edge) => ({
        ...edge,
        source: nodesById.get(edge.sourceId) ?? null,
        target: nodesById.get(edge.targetId) ?? null,
      })),
      controls: [
        {
          key: "backfill_user",
          label: "Backfill utente",
          description: "Crea o aggiorna il grafo memoria di un utente.",
        },
        {
          key: "approve_relation",
          label: "Approva relazione",
          description: "Promuove una relazione candidate ad active.",
        },
        {
          key: "reject_relation",
          label: "Rifiuta relazione",
          description: "Marca una relazione candidate come rejected.",
        },
      ],
    });
  } catch (err) {
    rootLogger.error({ err }, "[admin/memory-graph/overview] error");
    res.status(500).json({ error: "Memory graph non disponibile" });
  }
});

router.post(
  "/memory-graph/backfill-user",
  async (req: Request, res: Response) => {
    const body = asPlainRecord(getRequestBody(req));
    const userId = Number(body.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      res.status(400).json({ error: "userId obbligatorio" });
      return;
    }

    try {
      const result = await ingestUserMemoryGraph(userId);
      await writeAuditLog(req, {
        action: "admin_memory_graph_backfill_user",
        category: "admin_action",
        targetId: userId,
        metadata: result,
      });
      res.json(result);
    } catch (err) {
      rootLogger.error(
        { err, userId },
        "[admin/memory-graph/backfill-user] error",
      );
      res.status(500).json({ error: "Backfill memoria non riuscito" });
    }
  },
);

router.post(
  "/memory-graph/relations/:id/approve",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "ID relazione non valido" });
      return;
    }

    try {
      const metadata = {
        approvedBy: req.user?.id ?? null,
        approvedAt: new Date().toISOString(),
      };
      const [edge] = await db
        .update(knowledgeEdgesTable)
        .set({
          status: "active",
          updatedAt: new Date(),
          metadata: sql`metadata || ${JSON.stringify(metadata)}::jsonb`,
        })
        .where(eq(knowledgeEdgesTable.id, id))
        .returning();
      if (!edge) {
        res.status(404).json({ error: "Relazione non trovata" });
        return;
      }
      await writeAuditLog(req, {
        action: "admin_memory_relation_approved",
        category: "admin_action",
        targetId: edge.userId,
        metadata: {
          edgeId: edge.id,
          sourceId: edge.sourceId,
          targetId: edge.targetId,
        },
      });
      res.json({ ok: true, edge });
    } catch (err) {
      rootLogger.error(
        { err, id },
        "[admin/memory-graph/relations/approve] error",
      );
      res.status(500).json({ error: "Approvazione relazione non riuscita" });
    }
  },
);

router.post(
  "/memory-graph/relations/:id/reject",
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const body = asPlainRecord(getRequestBody(req));
    const reason =
      typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
    if (!Number.isInteger(id)) {
      res.status(400).json({ error: "ID relazione non valido" });
      return;
    }

    try {
      const metadata = {
        rejectedBy: req.user?.id ?? null,
        rejectedAt: new Date().toISOString(),
        reason,
      };
      const [edge] = await db
        .update(knowledgeEdgesTable)
        .set({
          status: "rejected",
          reason: reason || null,
          updatedAt: new Date(),
          metadata: sql`metadata || ${JSON.stringify(metadata)}::jsonb`,
        })
        .where(eq(knowledgeEdgesTable.id, id))
        .returning();
      if (!edge) {
        res.status(404).json({ error: "Relazione non trovata" });
        return;
      }
      await writeAuditLog(req, {
        action: "admin_memory_relation_rejected",
        category: "admin_action",
        targetId: edge.userId,
        metadata: {
          edgeId: edge.id,
          sourceId: edge.sourceId,
          targetId: edge.targetId,
          reason,
        },
      });
      res.json({ ok: true, edge });
    } catch (err) {
      rootLogger.error(
        { err, id },
        "[admin/memory-graph/relations/reject] error",
      );
      res.status(500).json({ error: "Rifiuto relazione non riuscito" });
    }
  },
);

export default router;
