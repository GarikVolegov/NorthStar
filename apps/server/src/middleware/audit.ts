import type { Request } from "express";
import { db, auditLogTable, hashIp } from "@workspace/db";
import { rootLogger } from "./logger";

interface AuditOptions {
  action: string;
  category: "financial" | "agent_action" | "admin_action" | "auth" | "system" | "data";
  targetId?: number | null;
  metadata?: Record<string, unknown>;
}

export async function writeAuditLog(req: Request | null, opts: AuditOptions): Promise<void> {
  try {
    await db.insert(auditLogTable).values({
      actorId: req?.user?.id ?? null,
      targetId: opts.targetId ?? null,
      action: opts.action,
      category: opts.category,
      metadata: opts.metadata ?? null,
      ipAddress: req ? hashIp(req.ip) : null,
      userAgent: req?.headers?.["user-agent"] ?? null,
    });
  } catch (err) {
    const log = req?.log ?? rootLogger;
    log.error({ err }, "failed to write audit log");
  }
}
