import { Router } from "express";
import { eq } from "drizzle-orm";
import {
  DEFAULT_LOGO_PRESET_ID,
  LOGO_PRESETS,
  findLogoPreset,
  resolveLogoPreset,
} from "@workspace/api-zod/logo-presets";
import { db, userProfileSettingsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import {
  isPersistenceSchemaError,
  sendPersistenceWriteError,
} from "../lib/persistence";
import { getRequestBody } from "../lib/request-context";
import { asPlainRecord } from "../lib/type-guards";

const router = Router();

async function readActiveLogoPreset(userId: number): Promise<string | null> {
  try {
    const [row] = await db
      .select({ activeLogoPreset: userProfileSettingsTable.activeLogoPreset })
      .from(userProfileSettingsTable)
      .where(eq(userProfileSettingsTable.userId, userId))
      .limit(1);
    return row?.activeLogoPreset ?? DEFAULT_LOGO_PRESET_ID;
  } catch (err) {
    if (isPersistenceSchemaError(err)) return null;
    throw err;
  }
}

async function upsertLogoPreset(userId: number, presetId: string) {
  const now = new Date();
  await db
    .insert(userProfileSettingsTable)
    .values({ userId, activeLogoPreset: presetId, updatedAt: now })
    .onConflictDoUpdate({
      target: userProfileSettingsTable.userId,
      set: { activeLogoPreset: presetId, updatedAt: now },
    });
}

router.get("/logo", requireAuth, async (req, res) => {
  try {
    const activePresetId = await readActiveLogoPreset(req.user!.id);
    res.json({
      activePreset: resolveLogoPreset(activePresetId),
      presets: LOGO_PRESETS,
    });
  } catch (err) {
    req.log?.error?.({ err }, "profile logo get error");
    res.status(500).json({ error: "Errore caricamento logo" });
  }
});

router.patch("/logo", requireAuth, async (req, res) => {
  try {
    const body = asPlainRecord(getRequestBody(req));
    const preset = findLogoPreset(body.presetId);
    if (!preset) {
      res.status(400).json({ error: "Preset logo non valido" });
      return;
    }

    await upsertLogoPreset(req.user!.id, preset.id);
    res.json({ activePreset: preset, presets: LOGO_PRESETS });
  } catch (err) {
    req.log?.error?.({ err }, "profile logo update error");
    if (sendPersistenceWriteError(req, res, err, "profile.logo.update")) return;
    res.status(500).json({ error: "Errore aggiornamento logo" });
  }
});

export default router;
