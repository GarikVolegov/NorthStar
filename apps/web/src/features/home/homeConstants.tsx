import type React from "react";
import { Briefcase, GitMerge, Laptop } from "lucide-react";

export const ONBOARDING_KEY = "northstar_onboarding_done";

export const BASE = import.meta.env.BASE_URL || "/";
export const TREND_COLOR: Record<string, string> = {
  booming: "text-primary bg-primary/10 border-primary/30",
  growing: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  stable: "text-muted-foreground bg-muted border-border",
  declining: "text-red-400 bg-red-400/10 border-red-400/30",
};
export const RISK_COLOR: Record<string, string> = {
  low: "text-primary",
  medium: "text-amber-400",
  high: "text-red-400",
};
export const CAT_COLOR: Record<string, string> = {
  technology: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  business: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  education: "text-violet-400 bg-violet-400/10 border-violet-400/20",
  science: "text-teal-400 bg-teal-400/10 border-teal-400/20",
  health: "text-rose-400 bg-rose-400/10 border-rose-400/20",
  finance: "text-primary bg-primary/10 border-primary/20",
  general: "text-muted-foreground bg-muted border-border",
};
export const CAT_EMOJI: Record<string, string> = {
  technology: "ðŸ’»",
  business: "ðŸ“ˆ",
  education: "ðŸŽ“",
  science: "ðŸ”¬",
  health: "❤️",
  finance: "ðŸ’°",
  general: "ðŸŒ",
};
export const WORK_MODE_ICON: Record<string, React.ReactNode> = {
  dipendente: <Briefcase className="w-3.5 h-3.5" />,
  autonomo: <Laptop className="w-3.5 h-3.5" />,
  ibrido: <GitMerge className="w-3.5 h-3.5" />,
};
export const WORK_MODE_COLOR: Record<string, string> = {
  dipendente: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  autonomo: "text-violet-400 bg-violet-400/10 border-violet-400/20",
  ibrido: "text-primary bg-primary/10 border-primary/20",
};
