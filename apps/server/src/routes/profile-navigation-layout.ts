import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, userNavigationPreferencesTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { rootLogger } from "../middleware/logger";

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

export interface NavigationPreferencesStore {
  getNavigationLayout(userId: number): Promise<TopNavigationLayoutItem[] | null>;
  saveNavigationLayout(userId: number, layout: TopNavigationLayoutItem[]): Promise<TopNavigationLayoutItem[]>;
  resetNavigationLayout(userId: number): Promise<void>;
}

const ALL_AUTH_PHASES: NavPhase[] = ["new-user", "indeciso", "dipendente", "autonomo", "azienda", "investitore"];
const MAX_VISIBLE_ITEMS = 6;

const DASHBOARD_ITEM: TopNavigationCatalogItem = {
  id: "dashboard",
  label: "NorthStar",
  href: "/dashboard",
  iconKey: "brand",
  brand: true,
  locked: true,
  allowedPhases: ALL_AUTH_PHASES,
};

export const TOP_NAVIGATION_CATALOG: TopNavigationCatalogItem[] = [
  { id: "home", label: "Home", href: "/", iconKey: "home", brand: false, locked: false, allowedPhases: ["guest"] },
  DASHBOARD_ITEM,
  { id: "test", label: "Test", href: "/test", iconKey: "flask", brand: false, locked: false, allowedPhases: ["guest", "new-user", "indeciso"] },
  { id: "sectors", label: "Aree", href: "/settori", iconKey: "layers", brand: false, locked: false, allowedPhases: ["guest", "new-user", "indeciso", "autonomo", "azienda", "investitore"] },
  { id: "how-it-works", label: "Come funziona", href: "/come-funziona", iconKey: "book", brand: false, locked: false, allowedPhases: ["guest"] },
  { id: "plan", label: "Piano", href: "/percorso", iconKey: "map-pin", brand: false, locked: false, allowedPhases: ["new-user"] },
  { id: "roles", label: "Offerte", href: "/ruoli", iconKey: "briefcase", brand: false, locked: false, allowedPhases: ["indeciso"] },
  { id: "jobs", label: "Offerte", href: "/lavori", iconKey: "map-pin", brand: false, locked: false, allowedPhases: ["dipendente"] },
  { id: "coach", label: "Coach AI", href: "/coach", iconKey: "brain", brand: false, locked: false, allowedPhases: ["dipendente"] },
  { id: "idea-validator", label: "Idee", href: "/validatore-idea", iconKey: "compass", brand: false, locked: false, allowedPhases: ["autonomo"] },
  { id: "partner", label: "Partner", href: "/affiliazione", iconKey: "hand-coins", brand: false, locked: false, allowedPhases: ["azienda"] },
  { id: "news", label: "News", href: "/news", iconKey: "newspaper", brand: false, locked: false, allowedPhases: ["investitore"] },
  { id: "growth", label: "Crescita personale", href: "/crescita", iconKey: "sparkles", brand: false, locked: false, allowedPhases: ["guest", ...ALL_AUTH_PHASES] },
  { id: "social", label: "Social", href: "/social", iconKey: "message-circle", brand: false, locked: false, allowedPhases: ALL_AUTH_PHASES },
];

const DEFAULT_LAYOUTS: Record<NavPhase, string[]> = {
  guest: ["home", "test", "sectors", "growth", "how-it-works"],
  "new-user": ["dashboard", "test", "sectors", "plan", "growth", "social"],
  indeciso: ["dashboard", "test", "sectors", "roles", "growth", "social"],
  dipendente: ["dashboard", "jobs", "coach", "growth", "social"],
  autonomo: ["dashboard", "idea-validator", "sectors", "growth", "social"],
  azienda: ["dashboard", "sectors", "partner", "growth", "social"],
  investitore: ["dashboard", "sectors", "news", "growth", "social"],
};

const log = rootLogger.child({ module: "profile-navigation-layout" });

export const dbNavigationPreferencesStore: NavigationPreferencesStore = {
  async getNavigationLayout(userId) {
    const [row] = await db
      .select({ topNavLayout: userNavigationPreferencesTable.topNavLayout })
      .from(userNavigationPreferencesTable)
      .where(eq(userNavigationPreferencesTable.userId, userId))
      .limit(1);

    if (!row || !Array.isArray(row.topNavLayout)) return null;
    return row.topNavLayout as TopNavigationLayoutItem[];
  },

  async saveNavigationLayout(userId, layout) {
    const now = new Date();
    await db
      .insert(userNavigationPreferencesTable)
      .values({ userId, topNavLayout: layout, updatedAt: now })
      .onConflictDoUpdate({
        target: userNavigationPreferencesTable.userId,
        set: { topNavLayout: layout, updatedAt: now },
      });
    return layout;
  },

  async resetNavigationLayout(userId) {
    await db
      .delete(userNavigationPreferencesTable)
      .where(eq(userNavigationPreferencesTable.userId, userId));
  },
};

function phaseFromJourney(journeyType: string | null | undefined): NavPhase {
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

function availableItemsForPhase(phase: NavPhase) {
  return TOP_NAVIGATION_CATALOG.filter((item) => item.allowedPhases.includes(phase));
}

function defaultLayoutForPhase(phase: NavPhase): TopNavigationLayoutItem[] {
  return DEFAULT_LAYOUTS[phase].map((id, position) => ({
    id,
    position,
    visible: true,
  }));
}

function normalizeLayout(
  raw: unknown,
  phase: NavPhase,
): TopNavigationLayoutItem[] | { error: string } {
  if (!Array.isArray(raw)) return { error: "layout deve essere un array" };
  if (raw.length > TOP_NAVIGATION_CATALOG.length) return { error: "layout troppo grande" };

  const availableById = new Map(availableItemsForPhase(phase).map((item) => [item.id, item]));
  const seen = new Set<string>();
  const normalized: TopNavigationLayoutItem[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") return { error: "Ogni voce deve essere un oggetto" };
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string") return { error: "id voce non valido" };
    if (!availableById.has(row.id)) return { error: `voce non disponibile: ${row.id}` };
    if (seen.has(row.id)) return { error: `voce duplicata: ${row.id}` };
    if (typeof row.position !== "number" || !Number.isFinite(row.position)) return { error: "position non valido" };
    if (typeof row.visible !== "boolean") return { error: "visible non valido" };

    const catalogItem = availableById.get(row.id)!;
    if (catalogItem.locked && row.visible === false) {
      return { error: `${catalogItem.label} non puo essere nascosto` };
    }

    seen.add(row.id);
    normalized.push({
      id: row.id,
      position: Math.max(0, Math.floor(row.position)),
      visible: row.visible,
    });
  }

  if (!seen.has("dashboard") && phase !== "guest") return { error: "NorthStar deve restare nella barra" };
  const visibleCount = normalized.filter((item) => item.visible).length;
  if (visibleCount > MAX_VISIBLE_ITEMS) return { error: `massimo ${MAX_VISIBLE_ITEMS} voci visibili` };

  return normalized.sort((a, b) => a.position - b.position).map((item, position) => ({ ...item, position }));
}

function responsePayload(
  layout: TopNavigationLayoutItem[],
  phase: NavPhase,
  isDefault: boolean,
  updatedAt: Date | null = null,
) {
  return {
    layout,
    availableItems: availableItemsForPhase(phase),
    isDefault,
    updatedAt,
  };
}

export function createProfileNavigationLayoutRouter({
  store = dbNavigationPreferencesStore,
}: {
  store?: NavigationPreferencesStore;
} = {}) {
  const router = Router();

  router.get("/navigation-layout", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    const phase = phaseFromJourney(req.user!.journeyType);

    try {
      const saved = await store.getNavigationLayout(userId);
      const layout = saved ?? defaultLayoutForPhase(phase);
      res.json(responsePayload(layout, phase, !saved));
    } catch (e) {
      log.error({ e, userId }, "[profile-navigation-layout] get error");
      res.status(500).json({ error: "Errore nel recupero della navigazione" });
    }
  });

  router.put("/navigation-layout", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    const phase = phaseFromJourney(req.user!.journeyType);
    const validated = normalizeLayout(req.body?.layout, phase);

    if ("error" in validated) {
      res.status(400).json({ error: validated.error });
      return;
    }

    try {
      const saved = await store.saveNavigationLayout(userId, validated);
      res.json(responsePayload(saved, phase, false, new Date()));
    } catch (e) {
      log.error({ e, userId }, "[profile-navigation-layout] put error");
      res.status(500).json({ error: "Errore nel salvataggio della navigazione" });
    }
  });

  router.post("/navigation-layout/reset", requireAuth, async (req, res) => {
    const userId = req.user!.id;
    const phase = phaseFromJourney(req.user!.journeyType);

    try {
      await store.resetNavigationLayout(userId);
      res.json(responsePayload(defaultLayoutForPhase(phase), phase, true, new Date()));
    } catch (e) {
      log.error({ e, userId }, "[profile-navigation-layout] reset error");
      res.status(500).json({ error: "Errore nel reset della navigazione" });
    }
  });

  return router;
}

export default createProfileNavigationLayoutRouter();
