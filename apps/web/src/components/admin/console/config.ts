import {
  Archive,
  BarChart3,
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  GraduationCap,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { SuggestionStatus } from "./types";

export const STATUS_CONFIG: Record<
  SuggestionStatus,
  { label: string; color: string; icon: LucideIcon }
> = {
  draft: {
    label: "Bozza",
    color: "bg-muted text-muted-foreground",
    icon: FileText,
  },
  pending_review: {
    label: "In Revisione",
    color: "bg-warning-surface text-warning",
    icon: Clock,
  },
  approved: {
    label: "Approvato",
    color: "bg-success-surface text-success",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rifiutato",
    color: "bg-danger-surface text-danger",
    icon: XCircle,
  },
  applied: {
    label: "Applicato",
    color: "bg-info-surface text-info",
    icon: CheckCircle2,
  },
  archived: {
    label: "Archiviato",
    color: "bg-muted text-muted-foreground",
    icon: Archive,
  },
};

export const ENTITY_CONFIG: Record<
  string,
  { label: string; icon: LucideIcon }
> = {
  sector: { label: "Settore", icon: BarChart3 },
  role: { label: "Ruolo", icon: Briefcase },
  education_path: { label: "Piano", icon: GraduationCap },
  calendar_plan: { label: "Calendario", icon: Calendar },
  growth_content: { label: "Crescita", icon: TrendingUp },
  work_mode: { label: "Work Mode", icon: Sparkles },
};

export const HEALTH_UI = {
  healthy: {
    label: "Tutto stabile",
    tone: "border-success-muted bg-success-surface text-success",
    dot: "bg-success",
    icon: CheckCircle2,
  },
  attention: {
    label: "Attenzione",
    tone: "border-warning-muted bg-warning-surface text-warning",
    dot: "bg-warning",
    icon: Clock,
  },
  critical: {
    label: "Intervento richiesto",
    tone: "border-danger-muted bg-danger-surface text-danger",
    dot: "bg-danger",
    icon: ShieldAlert,
  },
} as const;
