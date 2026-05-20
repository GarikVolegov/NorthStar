import {
  Archive,
  BarChart3,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  Sparkles,
  TrendingUp,
  XCircle,
} from "lucide-react";

export type SuggestionStatus =
  | "draft"
  | "pending_review"
  | "approved"
  | "rejected"
  | "archived";
export type EntityType =
  | "sector"
  | "role"
  | "education_path"
  | "calendar_plan"
  | "growth_content"
  | "work_mode";

export interface Suggestion {
  id: number;
  agentRunId: number | null;
  entityType: string;
  entityName: string;
  payloadJson: Record<string, unknown> | null;
  confidenceScore: number | null;
  status: SuggestionStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRun {
  id: number;
  agentName: string;
  userId: number | null;
  inputSummary: string | null;
  outputSummary: string | null;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface AuditLogEntry {
  id: number;
  userId: string | null;
  action: string;
  targetType: string;
  targetId: number | null;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
}

export interface DashboardStats {
  pending: number;
  approved: number;
  rejected: number;
  archived: number;
  totalRuns: number;
}

export interface SuggestionDetail {
  suggestion: Suggestion;
  agentRun: AgentRun | null;
  queueItem: { id: number; queueStatus: string; priority: string } | null;
}

export type SidebarSection =
  | "queue"
  | "suggestions"
  | "runs"
  | "logs"
  | "settings"
  | "agents"
  | "prompts";

export interface AgentRunRecord {
  id: string;
  agent: "news" | "growth";
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  status: "running" | "completed" | "failed";
}

export const STATUS_CONFIG: Record<
  SuggestionStatus,
  { label: string; color: string; icon: any }
> = {
  draft: {
    label: "Bozza",
    color: "bg-slate-100 text-slate-700",
    icon: FileText,
  },
  pending_review: {
    label: "In Revisione",
    color: "bg-amber-100 text-amber-700",
    icon: Clock,
  },
  approved: {
    label: "Approvato",
    color: "bg-emerald-100 text-emerald-700",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rifiutato",
    color: "bg-red-100 text-red-700",
    icon: XCircle,
  },
  archived: {
    label: "Archiviato",
    color: "bg-slate-100 text-slate-500",
    icon: Archive,
  },
};

export const ENTITY_CONFIG: Record<string, { label: string; icon: any }> = {
  sector: { label: "Settore", icon: BarChart3 },
  role: { label: "Ruolo", icon: Briefcase },
  education_path: { label: "Percorso", icon: GraduationCap },
  calendar_plan: { label: "Calendario", icon: Calendar },
  growth_content: { label: "Crescita", icon: TrendingUp },
  work_mode: { label: "Work Mode", icon: Sparkles },
};
