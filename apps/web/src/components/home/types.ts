import {
  Briefcase,
  Laptop,
  GitMerge,
  HelpCircle,
  Rocket,
  Building2,
  TrendingUp,
  Bot,
  DollarSign,
} from "lucide-react";

export type TrendingSector = {
  id: number;
  name: string;
  icon: string;
  description: string;
  trend: string;
  growthRate: number;
  automationRisk: string;
  avgSalaryMin: number;
  avgSalaryMax: number;
  riasecTypes: string[];
  weeklyPicks: number;
  totalPicks: number;
};

export type HomeNewsItem = {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  publishedAt: string;
  image: string | null;
  category: string;
  tags: string[];
};

export type LatestRec = {
  sectorId: number;
  sectorName: string;
  matchScore: number;
  matchReason: string;
};

export type LatestResult = {
  sessionId: number;
  workPreference: string;
  recommendations: LatestRec[];
  confirmedSectorId: number | null;
};

export type JourneyId =
  | "indeciso"
  | "dipendente"
  | "autonomo"
  | "azienda"
  | "investitore";

export interface Persona {
  id: JourneyId;
  icon: React.ElementType;
  label: string;
  tagline: string;
  ctaLabel: string;
  ctaHref: string;
  tools: string[];
  accentClass: string;
  borderClass: string;
}

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
  technology: "💻",
  business: "📈",
  education: "🎓",
  science: "🔬",
  health: "❤️",
  finance: "💰",
  general: "🌍",
};

export const WORK_MODE_ICON: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  dipendente: Briefcase,
  autonomo: Laptop,
  ibrido: GitMerge,
};

export const WORK_MODE_COLOR: Record<string, string> = {
  dipendente: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  autonomo: "text-violet-400 bg-violet-400/10 border-violet-400/20",
  ibrido: "text-primary bg-primary/10 border-primary/20",
};

export const PERSONAS: Persona[] = [
  {
    id: "indeciso",
    icon: HelpCircle,
    label: "Indeciso",
    tagline: "Non so ancora cosa fare",
    ctaLabel: "Fai il test gratuito",
    ctaHref: "/test",
    tools: ["Test RIASEC", "Esplora settori", "Coach AI"],
    accentClass: "text-primary",
    borderClass: "border-primary/20",
  },
  {
    id: "dipendente",
    icon: Briefcase,
    label: "Dipendente",
    tagline: "Cerco un lavoro dipendente",
    ctaLabel: "Trova il tuo ruolo",
    ctaHref: "/settori",
    tools: ["Match intelligente", "Analisi stipendio", "Percorsi formativi"],
    accentClass: "text-blue-400",
    borderClass: "border-blue-400/20",
  },
  {
    id: "autonomo",
    icon: Rocket,
    label: "Autonomo",
    tagline: "Voglio avviare un'attività",
    ctaLabel: "Valida la tua idea",
    ctaHref: "/validatore-idea",
    tools: ["Idea", "Business plan", "Analisi mercato"],
    accentClass: "text-violet-400",
    borderClass: "border-violet-400/20",
  },
  {
    id: "azienda",
    icon: Building2,
    label: "Azienda",
    tagline: "Cerco talenti per la mia azienda",
    ctaLabel: "Trova candidati",
    ctaHref: "/affiliazione",
    tools: ["Database CV", "Test competenze", "Valutazioni"],
    accentClass: "text-amber-400",
    borderClass: "border-amber-400/20",
  },
  {
    id: "investitore",
    icon: TrendingUp,
    label: "Investitore",
    tagline: "Investo in startup innovative",
    ctaLabel: "Scopri opportunità",
    ctaHref: "/news",
    tools: ["Analisi trend", "Valutazioni startup", "Report mercato"],
    accentClass: "text-emerald-400",
    borderClass: "border-emerald-400/20",
  },
];
