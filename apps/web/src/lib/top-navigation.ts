import { NAV_LABELS } from "@/lib/constants";
import {
  BookOpenText,
  BrainCircuit,
  Briefcase,
  Compass,
  FlaskConical,
  HandCoins,
  Home,
  Layers,
  MapPin,
  MessageCircle,
  Newspaper,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export type NavPhase =
  | "guest"
  | "new-user"
  | "indeciso"
  | "dipendente"
  | "autonomo"
  | "azienda"
  | "investitore";

export interface TopNavigationLayoutItem {
  id: string;
  position: number;
  visible: boolean;
}

export interface TopNavigationCatalogItem {
  id: string;
  label: string;
  href: string;
  iconKey: string;
  brand: boolean;
  locked: boolean;
  allowedPhases: NavPhase[];
}

export type TopNavigationDisplayItem = TopNavigationCatalogItem & TopNavigationLayoutItem & {
  icon?: LucideIcon;
  logoUrl?: string;
};

const ALL_AUTH_PHASES: NavPhase[] = ["new-user", "indeciso", "dipendente", "autonomo", "azienda", "investitore"];

export const TOP_NAVIGATION_ICONS: Record<string, LucideIcon> = {
  home: Home,
  flask: FlaskConical,
  layers: Layers,
  book: BookOpenText,
  "map-pin": MapPin,
  briefcase: Briefcase,
  brain: BrainCircuit,
  compass: Compass,
  "hand-coins": HandCoins,
  newspaper: Newspaper,
  sparkles: Sparkles,
  "message-circle": MessageCircle,
};

export const TOP_NAVIGATION_CATALOG: TopNavigationCatalogItem[] = [
  { id: "home", label: NAV_LABELS.home, href: "/", iconKey: "home", brand: false, locked: false, allowedPhases: ["guest"] },
  { id: "dashboard", label: NAV_LABELS.northStar, href: "/dashboard", iconKey: "brand", brand: true, locked: true, allowedPhases: ALL_AUTH_PHASES },
  { id: "test", label: NAV_LABELS.test, href: "/test", iconKey: "flask", brand: false, locked: false, allowedPhases: ["guest", "new-user", "indeciso"] },
  { id: "sectors", label: NAV_LABELS.aree, href: "/settori", iconKey: "layers", brand: false, locked: false, allowedPhases: ["guest", "new-user", "indeciso", "autonomo", "azienda", "investitore"] },
  { id: "how-it-works", label: NAV_LABELS.comeFunziona, href: "/come-funziona", iconKey: "book", brand: false, locked: false, allowedPhases: ["guest"] },
  { id: "plan", label: NAV_LABELS.piano, href: "/percorso", iconKey: "map-pin", brand: false, locked: false, allowedPhases: ["new-user"] },
  { id: "roles", label: NAV_LABELS.lavori, href: "/ruoli", iconKey: "briefcase", brand: false, locked: false, allowedPhases: ["indeciso"] },
  { id: "jobs", label: NAV_LABELS.offerte, href: "/lavori", iconKey: "map-pin", brand: false, locked: false, allowedPhases: ["dipendente"] },
  { id: "coach", label: NAV_LABELS.coach, href: "/coach", iconKey: "brain", brand: false, locked: false, allowedPhases: ["dipendente"] },
  { id: "idea-validator", label: NAV_LABELS.idea, href: "/validatore-idea", iconKey: "compass", brand: false, locked: false, allowedPhases: ["autonomo"] },
  { id: "partner", label: NAV_LABELS.partner, href: "/affiliazione", iconKey: "hand-coins", brand: false, locked: false, allowedPhases: ["azienda"] },
  { id: "news", label: NAV_LABELS.news, href: "/news", iconKey: "newspaper", brand: false, locked: false, allowedPhases: ["investitore"] },
  { id: "growth", label: "Crescita personale", href: "/crescita", iconKey: "sparkles", brand: false, locked: false, allowedPhases: ["guest", ...ALL_AUTH_PHASES] },
  { id: "social", label: NAV_LABELS.social, href: "/social", iconKey: "message-circle", brand: false, locked: false, allowedPhases: ALL_AUTH_PHASES },
];

export const DEFAULT_TOP_NAVIGATION_BY_PHASE: Record<NavPhase, string[]> = {
  guest: ["home", "test", "sectors", "growth", "how-it-works"],
  "new-user": ["dashboard", "test", "sectors", "plan", "growth", "social"],
  indeciso: ["dashboard", "test", "sectors", "roles", "growth", "social"],
  dipendente: ["dashboard", "jobs", "coach", "growth", "social"],
  autonomo: ["dashboard", "idea-validator", "sectors", "growth", "social"],
  azienda: ["dashboard", "sectors", "partner", "growth", "social"],
  investitore: ["dashboard", "sectors", "news", "growth", "social"],
};

export function navPhaseFromJourney(isLoggedIn: boolean, journeyType?: string | null): NavPhase {
  if (!isLoggedIn) return "guest";
  if (
    journeyType === "indeciso" ||
    journeyType === "dipendente" ||
    journeyType === "autonomo" ||
    journeyType === "azienda" ||
    journeyType === "investitore"
  ) {
    return journeyType;
  }
  return "new-user";
}

export function availableTopNavigationItems(phase: NavPhase): TopNavigationCatalogItem[] {
  return TOP_NAVIGATION_CATALOG.filter((item) => item.allowedPhases.includes(phase));
}

export function defaultTopNavigationLayout(phase: NavPhase): TopNavigationLayoutItem[] {
  return DEFAULT_TOP_NAVIGATION_BY_PHASE[phase].map((id, position) => ({
    id,
    position,
    visible: true,
  }));
}

export function resolveTopNavigationItems(
  layout: TopNavigationLayoutItem[],
  availableItems: TopNavigationCatalogItem[],
): TopNavigationDisplayItem[] {
  const byId = new Map(availableItems.map((item) => [item.id, item]));
  const resolved: TopNavigationDisplayItem[] = [];
  for (const item of [...layout].sort((a, b) => a.position - b.position)) {
    if (!item.visible) continue;
    const catalogItem = byId.get(item.id);
    if (!catalogItem) continue;
    resolved.push({
      ...catalogItem,
      ...item,
      ...(catalogItem.brand ? {} : { icon: TOP_NAVIGATION_ICONS[catalogItem.iconKey] }),
    });
  }
  return resolved;
}
