import { cn } from "@/lib/utils";
import { Archive, CheckCircle2, Pencil, XCircle } from "lucide-react";
import type { AuditLogEntry } from "../adminReviewTypes";

type AdminLogsSectionProps = {
  logs: AuditLogEntry[];
  fmtDate: (value: string) => string;
};

export function AdminLogsSection({ logs, fmtDate }: AdminLogsSectionProps) {
  return (
    <div className="divide-y">
      {logs.length === 0 ? (
        <div className="p-12 text-center text-muted-foreground">
          Nessun log registrato
        </div>
      ) : (
        logs.map((log) => (
          <div key={log.id} className="p-4 flex items-center gap-3">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                log.action === "approve" && "bg-emerald-100",
                log.action === "reject" && "bg-red-100",
                log.action === "archive" && "bg-slate-100",
                log.action === "edit" && "bg-blue-100",
              )}
            >
              {log.action === "approve" && (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              )}
              {log.action === "reject" && (
                <XCircle className="w-4 h-4 text-red-600" />
              )}
              {log.action === "archive" && (
                <Archive className="w-4 h-4 text-slate-500" />
              )}
              {log.action === "edit" && (
                <Pencil className="w-4 h-4 text-blue-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium capitalize">
                {log.action} - {log.targetType} #{log.targetId}
              </p>
              <p className="text-xs text-muted-foreground">
                {fmtDate(log.createdAt)}
              </p>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
