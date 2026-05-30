import { Monitor, Moon, Sun } from "lucide-react";

export const BASE = import.meta.env.BASE_URL || "/";

export const LANGUAGE_LABELS: Record<string, string> = {
  it: "Italiano",
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
};

export const MOBILE_THEME_OPTIONS = [
  { value: "system", label: "Auto", icon: Monitor },
  { value: "light", label: "Chiaro", icon: Sun },
  { value: "dark", label: "Scuro", icon: Moon },
] as const;

export const JOURNEY_LABELS: Record<string, { label: string; color: string }> = {
  indeciso: {
    label: "Indeciso",
    color: "text-primary bg-primary/10 border-primary/30",
  },
  dipendente: {
    label: "Dipendente",
    color: "text-growth bg-growth/10 border-growth/30",
  },
  autonomo: {
    label: "Autonomo",
    color: "text-primary bg-primary/10 border-primary/30",
  },
  azienda: {
    label: "Azienda",
    color: "text-growth bg-growth/10 border-growth/30",
  },
  investitore: {
    label: "Investitore",
    color: "text-primary bg-primary/10 border-primary/30",
  },
};

export type NavPhase =
  | "guest"
  | "new-user"
  | "indeciso"
  | "dipendente"
  | "autonomo"
  | "azienda"
  | "investitore";

const PREFETCH_MAP: Record<string, () => Promise<unknown>> = {
  "/news": () => import("@/pages/news"),
  "/percorso": () => import("@/pages/percorso"),
  "/profilo": () => import("@/pages/profilo"),
  "/candidature": () => import("@/pages/applications"),
  "/dashboard": () => import("@/pages/dashboard"),
  "/affiliazione/dashboard": () => import("@/pages/affiliazione-dashboard"),
  "/wendy/memoria": () => import("@/pages/memoria-wendy"),
  "/profilo/briefing": () => import("@/pages/briefing"),
  "/workspace": () => import("@/pages/workspace"),
  "/sign-in": () => import("@/pages/sign-in"),
};

export const JOURNEY_CATEGORIES: Record<NavPhase, string[]> = {
  guest: ["technology", "business", "education"],
  "new-user": ["technology", "education", "general"],
  indeciso: ["education", "technology", "general"],
  dipendente: ["technology", "business", "education"],
  autonomo: ["business", "technology", "finance"],
  azienda: ["business", "finance", "technology"],
  investitore: ["finance", "business", "technology"],
};

export const DEFAULT_NEWS_TICKER_ITEMS = [
  "Cybersecurity: competenze richieste in crescita negli ultimi 12 mesi",
];

export function prefetchRoute(path: string) {
  PREFETCH_MAP[path]?.();
}
