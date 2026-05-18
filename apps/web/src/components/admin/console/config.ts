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
  applied: {
    label: "Applicato",
    color: "bg-blue-100 text-blue-700",
    icon: CheckCircle2,
  },
  archived: {
    label: "Archiviato",
    color: "bg-slate-100 text-slate-500",
    icon: Archive,
  },
};

export const ENTITY_CONFIG: Record<string, { label: string; icon: LucideIcon }> = {
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
    tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
    dot: "bg-emerald-500",
    icon: CheckCircle2,
  },
  attention: {
    label: "Attenzione",
    tone: "border-amber-200 bg-amber-50 text-amber-800",
    dot: "bg-amber-500",
    icon: Clock,
  },
  critical: {
    label: "Intervento richiesto",
    tone: "border-red-200 bg-red-50 text-red-800",
    dot: "bg-red-500",
    icon: ShieldAlert,
  },
} as const;
