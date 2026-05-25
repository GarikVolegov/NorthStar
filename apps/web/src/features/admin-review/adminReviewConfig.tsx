import type { SidebarSection } from "@/components/admin/console";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  Briefcase,
  ClipboardList,
  Code2,
  CreditCard,
  FileText,
  GraduationCap,
  Handshake,
  Home,
  MessageCircle,
  Network,
  Settings,
  Sparkles,
} from "lucide-react";
import type React from "react";
import type {
  CatalogEntity,
  CatalogType,
  DashboardStats,
  GrowthArticle,
  GrowthArticleForm,
  GrowthQueueStatus,
} from "./adminReviewTypes";

export const CATALOG_TABS: Array<{
  type: CatalogType;
  label: string;
  icon: typeof BookOpen;
}> = [
  { type: "sectors", label: "Settori", icon: BarChart3 },
  { type: "professions", label: "Professioni", icon: Briefcase },
  { type: "education_paths", label: "Percorsi", icon: GraduationCap },
  { type: "growth_articles", label: "Articoli", icon: FileText },
];

export const GROWTH_STATUS_FILTERS: Array<{
  value: GrowthQueueStatus;
  label: string;
}> = [
  { value: "all", label: "Tutti" },
  { value: "draft", label: "Bozze" },
  { value: "pending", label: "Pending" },
  { value: "published", label: "Pubblicati" },
  { value: "rejected", label: "Rifiutati" },
];

const GROWTH_STATUS_UI: Record<
  Exclude<GrowthQueueStatus, "all">,
  { label: string; className: string }
> = {
  draft: {
    label: "Bozza",
    className: "bg-muted text-muted-foreground border-muted-border",
  },
  pending: {
    label: "Pending",
    className: "bg-warning-surface text-warning border-warning-muted",
  },
  published: {
    label: "Pubblicato",
    className: "bg-success-surface text-success border-success-muted",
  },
  rejected: {
    label: "Rifiutato",
    className: "bg-danger-surface text-danger border-danger-muted",
  },
};

const SECTION_BY_PATH: Record<string, SidebarSection> = {
  review: "queue",
  queue: "queue",
  suggestions: "suggestions",
  suggerimenti: "suggestions",
  runs: "agents",
  esecuzioni: "agents",
  logs: "logs",
  settings: "settings",
  impostazioni: "settings",
  agents: "agents",
  "lancia-agenti": "agents",
  prompts: "prompts",
  qualita: "qualita",
  quality: "qualita",
  cataloghi: "cataloghi",
  rag: "cataloghi",
  "agenti-salute": "agents",
  "agent-health": "agents",
  agenti: "agents",
  metriche: "metriche",
  abbonamenti: "abbonamenti",
  subscriptions: "abbonamenti",
  status: "status",
  messaggi: "messaggi",
  crescita: "crescita",
  affiliazione: "affiliazione",
  "cervello-wendy": "memory",
  "memory-graph": "memory",
};

export const PATH_BY_SECTION: Record<SidebarSection, string> = {
  home: "/admin",
  queue: "/admin/review",
  suggestions: "/admin/suggestions",
  runs: "/admin/runs",
  logs: "/admin/logs",
  settings: "/admin/settings",
  agents: "/admin/agenti",
  prompts: "/admin/prompts",
  qualita: "/admin/qualita",
  cataloghi: "/admin/cataloghi",
  "agenti-salute": "/admin/agenti",
  metriche: "/admin/metriche",
  abbonamenti: "/admin/abbonamenti",
  status: "/admin/status",
  messaggi: "/admin/messaggi",
  crescita: "/admin/crescita",
  affiliazione: "/admin/affiliazione",
  memory: "/admin/cervello-wendy",
};

export const TITLE_BY_SECTION: Record<SidebarSection, string> = {
  home: "Panoramica Admin",
  queue: "Queue Revisione",
  suggestions: "Tutti i Suggerimenti",
  runs: "Agenti",
  logs: "Audit Log",
  settings: "Impostazioni",
  agents: "Agenti",
  prompts: "Gestione Prompt AI",
  qualita: "Qualita Wendy",
  cataloghi: "Cataloghi",
  "agenti-salute": "Agenti",
  metriche: "Metriche Business",
  abbonamenti: "Abbonamenti Utenti",
  status: "Status & Setup",
  messaggi: "Messaggi",
  crescita: "Coda Crescita",
  affiliazione: "Partner & Affiliazioni",
  memory: "Cervello Wendy",
};

export const ADMIN_NAV_GROUPS: Array<{
  label: string;
  items: Array<{
    key: SidebarSection;
    label: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    count?: (stats: DashboardStats | null) => number | undefined;
  }>;
}> = [
  {
    label: "Operativo",
    items: [
      { key: "home", label: "Panoramica", icon: Home },
      {
        key: "queue",
        label: "Queue Revisione",
        icon: ClipboardList,
        count: (stats) => stats?.pending,
      },
      { key: "suggestions", label: "Suggerimenti", icon: Bot },
      { key: "messaggi", label: "Messaggi", icon: MessageCircle },
    ],
  },
  {
    label: "AI / Wendy",
    items: [
      { key: "agents", label: "Agenti", icon: Activity },
      { key: "memory", label: "Cervello Wendy", icon: Network },
      { key: "prompts", label: "Prompt Agenti", icon: Code2 },
      { key: "qualita", label: "Qualita Wendy", icon: BarChart3 },
    ],
  },
  {
    label: "Contenuti",
    items: [
      { key: "cataloghi", label: "Cataloghi", icon: BookOpen },
      { key: "crescita", label: "Coda Crescita", icon: Sparkles },
    ],
  },
  {
    label: "Business",
    items: [
      { key: "metriche", label: "Metriche Business", icon: BarChart3 },
      { key: "abbonamenti", label: "Abbonamenti", icon: CreditCard },
      { key: "affiliazione", label: "Partner", icon: Handshake },
    ],
  },
  {
    label: "Sistema",
    items: [
      { key: "status", label: "Status & Setup", icon: Settings },
      { key: "logs", label: "Audit Log", icon: FileText },
      { key: "settings", label: "Impostazioni", icon: Settings },
    ],
  },
];

export function sectionFromLocation(pathname: string): SidebarSection {
  const segment = pathname.split("/").filter(Boolean)[1];
  return segment ? (SECTION_BY_PATH[segment] ?? "home") : "home";
}

export function defaultCatalogPayload(
  type: CatalogType,
): Record<string, unknown> {
  if (type === "sectors") {
    return {
      name: "",
      description: "",
      riasecTypes: [],
      skills: [],
      avgSalaryMin: 25000,
      avgSalaryMax: 45000,
      growthRate: 5,
      automationRisk: "medium",
      scalability: "medium",
      trend: "stable",
      timeToAutonomy: "6-12 mesi",
      advantages: [],
      disadvantages: [],
      opportunities: [],
      icon: "briefcase",
      color: "#6366f1",
      isActive: true,
      workMode: ["dipendente", "ibrido"],
      autonomyScore: 5,
      stabilityScore: 5,
      clientAcquisitionRequired: false,
      freelanceSteps: [],
      dipendentiSteps: [],
      remoteFriendly: true,
    };
  }
  if (type === "professions") {
    return {
      title: "",
      sector: "",
      sectorId: null,
      description: "",
      riasecFit: [],
      skills: [],
      workModes: [],
      salaryRange: "",
      growthOutlook: "",
      autonomyScore: 5,
      stabilityScore: 5,
      isActive: true,
    };
  }
  if (type === "education_paths") {
    return {
      path: "",
      type: "online",
      duration: "",
      cost: "",
      steps: [],
      careerOutcomes: [],
      sectorFit: [],
      professionIds: [],
      isActive: true,
    };
  }
  return {
    title: "",
    slug: "",
    category: "",
    subcategory: "",
    description: "",
    content: "",
    tags: [],
    difficulty: "base",
    personalityMatches: [],
    sectorLinks: [],
    status: "draft",
    readTimeMinutes: 3,
  };
}

export function catalogTitle(type: CatalogType, item: CatalogEntity) {
  const id = String(item.id ?? "");
  if (type === "sectors") return String(item.name ?? `Settore #${id}`);
  if (type === "professions") return String(item.title ?? `Professione #${id}`);
  if (type === "education_paths") return String(item.path ?? `Percorso #${id}`);
  return String(item.title ?? `Articolo #${id}`);
}

export function catalogDescription(type: CatalogType, item: CatalogEntity) {
  if (type === "education_paths")
    return `${item.type ?? "percorso"} · ${item.duration ?? "durata n/d"} · ${item.cost ?? "costo n/d"}`;
  if (type === "growth_articles")
    return `${item.category ?? "categoria"} · ${item.status ?? "draft"} · ${item.readTimeMinutes ?? 0} min`;
  return String(item.description ?? item.sector ?? "");
}

export function isCatalogArchived(type: CatalogType, item: CatalogEntity) {
  if (type === "growth_articles") return item.status === "archived";
  return item.isActive === false;
}

export function growthArticleToForm(
  article: GrowthArticle | null,
): GrowthArticleForm {
  return {
    title: article?.title ?? "",
    slug: article?.slug ?? "",
    category: article?.category ?? "",
    subcategory: article?.subcategory ?? "",
    description: article?.description ?? "",
    content: article?.content ?? "",
    tags: article?.tags ?? [],
    difficulty: article?.difficulty ?? "base",
    readTimeMinutes: article?.readTimeMinutes ?? 3,
  };
}

export function growthStatusBadge(status: GrowthArticle["status"]) {
  const cfg = GROWTH_STATUS_UI[status] ?? GROWTH_STATUS_UI.draft;
  return (
    <Badge variant="outline" className={cn("capitalize", cfg.className)}>
      {cfg.label}
    </Badge>
  );
}
