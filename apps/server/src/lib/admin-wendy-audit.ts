import type { Request } from "express";
import { writeAuditLog } from "../middleware/audit";
import type { AdminWendyRisk } from "./admin-wendy-schemas";

export interface AdminWendyAuditEvent {
  userId: number;
  toolName: string;
  risk: AdminWendyRisk;
  section: string;
  payloadSummary: string;
  confirmedAt: string;
  requestId: string;
  phase: "before" | "after";
  status: "pending" | "success" | "failed";
  errorCode?: string;
}

export async function writeAdminWendyAudit(
  req: Request | null,
  event: AdminWendyAuditEvent,
): Promise<void> {
  await writeAuditLog(req, {
    action: `admin_wendy_${event.toolName}_${event.phase}`,
    category: "admin_action",
    metadata: { ...event },
  });
}
