import {
  BadgeCheck,
  BookOpenText,
  Brain,
  Briefcase,
  Calendar,
  Layers,
  Lightbulb,
  Newspaper,
  Target,
  User,
  Users,
} from "lucide-react";

export const TYPE_CONFIG = {
  sector: { labelKey: "search.sectors", icon: Layers, className: "text-blue-400 bg-blue-500/10" },
  role: { labelKey: "search.roles", icon: Briefcase, className: "text-green-400 bg-green-500/10" },
  article: { labelKey: "search.articles", icon: BookOpenText, className: "text-amber-400 bg-amber-500/10" },
  news: { labelKey: "search.news", icon: Newspaper, className: "text-purple-400 bg-purple-500/10" },
  idea: { labelKey: "Idee", icon: Lightbulb, className: "text-yellow-400 bg-yellow-500/10" },
  objective: { labelKey: "Obiettivi", icon: Target, className: "text-emerald-400 bg-emerald-500/10" },
  calendar: { labelKey: "Calendario", icon: Calendar, className: "text-cyan-400 bg-cyan-500/10" },
  certification: { labelKey: "Certificazioni", icon: BadgeCheck, className: "text-blue-400 bg-blue-500/10" },
  memory: { labelKey: "Memoria Wendy", icon: Brain, className: "text-violet-400 bg-violet-500/10" },
  workspace: { labelKey: "Workspace", icon: Users, className: "text-teal-400 bg-teal-500/10" },
  profile: { labelKey: "Profilo", icon: User, className: "text-slate-400 bg-slate-500/10" },
} as const;

export const SUGGESTIONS_DEFAULTS = [
  { title: "Esplora i settori", description: "Scopri tutti i settori disponibili", url: "/settori" },
  { title: "Fai il test", description: "Scopri la tua personalita professionale", url: "/test" },
  { title: "Trend di mercato", description: "Le ultime tendenze del lavoro", url: "/news" },
  { title: "Chiedi a Wendy", description: "Parla con l'assistente AI di NorthStar", url: "#wendy" },
] as const;

export const ORDER: Array<keyof typeof TYPE_CONFIG> = [
  "idea",
  "objective",
  "calendar",
  "memory",
  "workspace",
  "profile",
  "certification",
  "sector",
  "role",
  "article",
  "news",
];
