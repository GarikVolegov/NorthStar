import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, userDashboardLayoutTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { rootLogger } from "../middleware/logger";

const router = Router();
const log = rootLogger.child({ module: "dashboard-layout" });

export interface WidgetLayout {
  id: string;
  position: number;
  visible: boolean;
  size: "sm" | "md" | "lg";
}

const INDECISO_SECTION_IDS = [
  "clarity_path",
  "next_routine",
  "discovery_feed",
  "personality",
  "career_comparison",
  "wendy_prompts",
  "tools",
  "analysis",
] as const;

const STANDARD_SECTION_IDS = [
  "kpi_strip",
  "next_routine",
  "week_timeline",
  "diary_objectives",
  "personality",
  "wendy_insights",
  "tools",
  "analysis",
] as const;

const SECTION_SIZE: Record<string, WidgetLayout["size"]> = {
  clarity_path: "lg",
  next_routine: "md",
  discovery_feed: "lg",
  personality: "md",
  career_comparison: "lg",
  wendy_prompts: "lg",
  tools: "lg",
  analysis: "lg",
  kpi_strip: "lg",
  week_timeline: "lg",
  diary_objectives: "lg",
  wendy_insights: "md",
};

const VALID_SIZES = new Set(["sm", "md", "lg"]);

function getValidSectionIds(journeyType: string | null | undefined): string[] {
  return journeyType === "indeciso" ? [...INDECISO_SECTION_IDS] : [...STANDARD_SECTION_IDS];
}

export function getDefaultDashboardLayout(journeyType: string | null | undefined): WidgetLayout[] {
  return getValidSectionIds(journeyType).map((id, position) => ({
    id,
    position,
    visible: true,
    size: SECTION_SIZE[id] ?? "md",
  }));
}

export function validateDashboardLayout(
  raw: unknown,
  journeyType: string | null | undefined,
): WidgetLayout[] | { error: string } {
  if (!Array.isArray(raw)) return { error: "layout deve essere un array" };
  if (raw.length > 20) return { error: "layout: massimo 20 sezioni" };

  const validIds = new Set(getValidSectionIds(journeyType));
  const seen = new Set<string>();
  const validated: WidgetLayout[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") return { error: "Ogni sezione deve essere un oggetto" };
    const section = item as Record<string, unknown>;

    if (typeof section.id !== "string") return { error: "sezione.id deve essere una stringa" };
    if (!validIds.has(section.id)) return { error: `sezione dashboard non riconosciuta: ${section.id}` };
    if (seen.has(section.id)) return { error: `sezione dashboard duplicata: ${section.id}` };
    if (typeof section.position !== "number" || !Number.isFinite(section.position)) {
      return { error: "sezione.position deve essere un numero" };
    }
    if (typeof section.visible !== "boolean") return { error: "sezione.visible deve essere un booleano" };
    if (typeof section.size !== "string" || !VALID_SIZES.has(section.size)) {
      return { error: `sezione.size non valido: ${section.size}. Valori: sm, md, lg` };
    }

    seen.add(section.id);
    validated.push({
      id: section.id,
      position: Math.max(0, Math.floor(section.position)),
      visible: section.visible,
      size: SECTION_SIZE[section.id] ?? (section.size as WidgetLayout["size"]),
    });
  }

  for (const id of getValidSectionIds(journeyType)) {
    if (!seen.has(id)) {
      validated.push({
        id,
        position: validated.length,
        visible: false,
        size: SECTION_SIZE[id] ?? "md",
      });
    }
  }

  return validated.sort((a, b) => a.position - b.position).map((item, position) => ({ ...item, position }));
}

export function normalizeDashboardLayout(raw: unknown, journeyType: string | null | undefined): WidgetLayout[] {
  const validated = validateDashboardLayout(raw, journeyType);
  return "error" in validated ? getDefaultDashboardLayout(journeyType) : validated;
}

router.get("/layout", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  try {
    const [row] = await db
      .select({ layout: userDashboardLayoutTable.layout, updatedAt: userDashboardLayoutTable.updatedAt })
      .from(userDashboardLayoutTable)
      .where(eq(userDashboardLayoutTable.userId, userId))
      .limit(1);

    const layout = row?.layout
      ? normalizeDashboardLayout(row.layout, req.user!.journeyType)
      : getDefaultDashboardLayout(req.user!.journeyType);

    res.json({ layout, isDefault: !row, updatedAt: row?.updatedAt ?? null });
  } catch (e) {
    log.error({ e, userId }, "[dashboard-layout] get error");
    res.status(500).json({ error: "Errore nel recupero del layout" });
  }
});

router.put("/layout", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const validated = validateDashboardLayout((req.body as { layout?: unknown })?.layout, req.user!.journeyType);
  if ("error" in validated) {
    res.status(400).json({ error: validated.error });
    return;
  }

  try {
    await db
      .insert(userDashboardLayoutTable)
      .values({ userId, layout: validated, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: userDashboardLayoutTable.userId,
        set: { layout: validated, updatedAt: new Date() },
      });

    log.info({ userId, sectionCount: validated.length }, "[dashboard-layout] saved");
    res.json({ ok: true, layout: validated });
  } catch (e) {
    log.error({ e, userId }, "[dashboard-layout] put error");
    res.status(500).json({ error: "Errore nel salvataggio del layout" });
  }
});

export default router;
