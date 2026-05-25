import { Router } from "express";
import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db, userProfileSettingsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import {
  isPersistenceSchemaError,
  sendPersistenceWriteError,
} from "../lib/persistence";
import { getRequestBody } from "../lib/request-context";
import { asPlainRecord } from "../lib/type-guards";

const router = Router();

const MAX_LIBRARY = 5;
const MAX_DATAURL_BYTES = 2_000_000; // ~1.5MB di file dopo overhead base64

interface BackgroundEntry {
  id: string;
  dataUrl: string;
  dataUrlMobile: string;
  createdAt: string;
  label?: string;
  luma?: number;
}

type BackgroundPosition = "center" | "top" | "bottom";

interface BackgroundAppearance {
  mode: "auto" | "manual";
  glassOpacity: number;
  blur: number;
  overlay: number;
  saturation: number;
  desktopPosition: BackgroundPosition;
  mobilePosition: BackgroundPosition;
}

const DEFAULT_APPEARANCE: BackgroundAppearance = {
  mode: "auto",
  glassOpacity: 0.72,
  blur: 18,
  overlay: 0.32,
  saturation: 1.08,
  desktopPosition: "center",
  mobilePosition: "center",
};

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function normalizePosition(value: unknown, fallback: BackgroundPosition): BackgroundPosition {
  return value === "top" || value === "bottom" || value === "center" ? value : fallback;
}

function normalizeAppearance(value: unknown): BackgroundAppearance {
  const record = asPlainRecord(value);
  return {
    mode: record.mode === "manual" ? "manual" : "auto",
    glassOpacity: clampNumber(record.glassOpacity, 0.42, 0.92, DEFAULT_APPEARANCE.glassOpacity),
    blur: clampNumber(record.blur, 8, 30, DEFAULT_APPEARANCE.blur),
    overlay: clampNumber(record.overlay, 0.12, 0.58, DEFAULT_APPEARANCE.overlay),
    saturation: clampNumber(record.saturation, 0.9, 1.35, DEFAULT_APPEARANCE.saturation),
    desktopPosition: normalizePosition(record.desktopPosition, DEFAULT_APPEARANCE.desktopPosition),
    mobilePosition: normalizePosition(record.mobilePosition, DEFAULT_APPEARANCE.mobilePosition),
  };
}

function isBackgroundEntryArray(value: unknown): value is BackgroundEntry[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (v) =>
      v &&
      typeof v === "object" &&
      typeof (v as Record<string, unknown>).id === "string" &&
      typeof (v as Record<string, unknown>).dataUrl === "string" &&
      typeof (v as Record<string, unknown>).dataUrlMobile === "string" &&
      typeof (v as Record<string, unknown>).createdAt === "string",
  );
}

async function readSettings(userId: number): Promise<{
  activeBackgroundId: string | null;
  library: BackgroundEntry[];
  appearance: BackgroundAppearance;
} | null> {
  try {
    const [row] = await db
      .select({
        activeBackgroundId: userProfileSettingsTable.activeBackgroundId,
        backgroundLibrary: userProfileSettingsTable.backgroundLibrary,
        backgroundAppearance: userProfileSettingsTable.backgroundAppearance,
      })
      .from(userProfileSettingsTable)
      .where(eq(userProfileSettingsTable.userId, userId))
      .limit(1);
    if (!row) {
      return {
        activeBackgroundId: null,
        library: [],
        appearance: DEFAULT_APPEARANCE,
      };
    }
    const library = isBackgroundEntryArray(row.backgroundLibrary)
      ? row.backgroundLibrary
      : [];
    return {
      activeBackgroundId: row.activeBackgroundId ?? null,
      library,
      appearance: normalizeAppearance(row.backgroundAppearance),
    };
  } catch (err) {
    if (isPersistenceSchemaError(err)) return null;
    throw err;
  }
}

async function upsertSettings(
  userId: number,
  values: Partial<typeof userProfileSettingsTable.$inferInsert>,
) {
  const now = new Date();
  await db
    .insert(userProfileSettingsTable)
    .values({ userId, ...values, updatedAt: now })
    .onConflictDoUpdate({
      target: userProfileSettingsTable.userId,
      set: { ...values, updatedAt: now },
    });
}

function ensureSameUser(req: { user?: { id: number } | undefined; params: Record<string, string | undefined> }): number | null {
  if (req.params.userId === "me") return req.user?.id ?? null;
  const userId = parseInt(req.params.userId ?? "", 10);
  if (!Number.isFinite(userId) || userId <= 0) return null;
  if (!req.user || req.user.id !== userId) return null;
  return userId;
}

function isDataUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.startsWith("data:image/") &&
    value.includes("base64,")
  );
}

function isValidActiveId(value: unknown, library: BackgroundEntry[]): boolean {
  if (value === null) return true;
  if (typeof value !== "string") return false;
  if (value.startsWith("preset:")) return true;
  if (value.startsWith("user:")) {
    const id = value.slice(5);
    return library.some((entry) => entry.id === id);
  }
  return false;
}

/* ─── GET /api/profile/:userId/backgrounds ─────────────────────────── */
router.get("/:userId/backgrounds", requireAuth, async (req, res) => {
  try {
    const userId = ensureSameUser(req);
    if (userId === null) {
      res.status(403).json({ error: "Accesso negato" });
      return;
    }
    const settings = await readSettings(userId);
    if (!settings) {
      res.json({ activeBackgroundId: null, library: [], appearance: DEFAULT_APPEARANCE });
      return;
    }
    res.json(settings);
  } catch (err) {
    req.log?.error?.({ err }, "background list error");
    res.status(500).json({ error: "Errore caricamento sfondi" });
  }
});

/* ─── POST /api/profile/:userId/backgrounds — aggiungi alla libreria ── */
router.post("/:userId/backgrounds", requireAuth, async (req, res) => {
  try {
    const userId = ensureSameUser(req);
    if (userId === null) {
      res.status(403).json({ error: "Accesso negato" });
      return;
    }

    const body = asPlainRecord(getRequestBody(req));
    const { dataUrl, dataUrlMobile, label, luma } = body;

    if (!isDataUrl(dataUrl) || !isDataUrl(dataUrlMobile)) {
      res.status(400).json({ error: "dataUrl e dataUrlMobile (image/*) sono richiesti" });
      return;
    }
    if (dataUrl.length > MAX_DATAURL_BYTES || dataUrlMobile.length > MAX_DATAURL_BYTES) {
      res.status(400).json({ error: "Immagine troppo grande (max 1.5 MB per variante)" });
      return;
    }
    if (label !== undefined && typeof label !== "string") {
      res.status(400).json({ error: "label deve essere stringa" });
      return;
    }

    const current = (await readSettings(userId)) ?? {
      activeBackgroundId: null,
      library: [],
      appearance: DEFAULT_APPEARANCE,
    };
    if (current.library.length >= MAX_LIBRARY) {
      res.status(400).json({
        error: `Hai raggiunto il massimo (${MAX_LIBRARY}). Rimuovi uno sfondo per caricarne un altro.`,
        code: "LIBRARY_FULL",
      });
      return;
    }

    const entry: BackgroundEntry = {
      id: randomUUID(),
      dataUrl,
      dataUrlMobile,
      createdAt: new Date().toISOString(),
      ...(typeof label === "string" && label.trim() ? { label: label.trim().slice(0, 80) } : {}),
      ...(typeof luma === "number" && Number.isFinite(luma) ? { luma: Math.min(1, Math.max(0, luma)) } : {}),
    };
    const nextLibrary = [...current.library, entry];

    await upsertSettings(userId, { backgroundLibrary: nextLibrary });

    res.status(201).json({ entry, library: nextLibrary });
  } catch (err) {
    req.log?.error?.({ err }, "background create error");
    if (sendPersistenceWriteError(req, res, err, "profile.background.create")) return;
    res.status(500).json({ error: "Errore salvataggio sfondo" });
  }
});

/* ─── PATCH /api/profile/:userId/backgrounds/active ─────────────────── */
router.patch("/:userId/backgrounds/active", requireAuth, async (req, res) => {
  try {
    const userId = ensureSameUser(req);
    if (userId === null) {
      res.status(403).json({ error: "Accesso negato" });
      return;
    }
    const body = asPlainRecord(getRequestBody(req));
    const { id } = body as { id?: unknown };
    const current = (await readSettings(userId)) ?? {
      activeBackgroundId: null,
      library: [],
      appearance: DEFAULT_APPEARANCE,
    };

    if (!isValidActiveId(id, current.library)) {
      res.status(400).json({ error: "id non valido (atteso preset:* o user:<id-in-libreria> o null)" });
      return;
    }

    const next = id === null ? null : (id as string);
    await upsertSettings(userId, { activeBackgroundId: next });
    res.json({ activeBackgroundId: next });
  } catch (err) {
    req.log?.error?.({ err }, "background set-active error");
    if (sendPersistenceWriteError(req, res, err, "profile.background.active")) return;
    res.status(500).json({ error: "Errore aggiornamento sfondo attivo" });
  }
});

router.patch("/:userId/backgrounds/appearance", requireAuth, async (req, res) => {
  try {
    const userId = ensureSameUser(req);
    if (userId === null) {
      res.status(403).json({ error: "Accesso negato" });
      return;
    }
    const appearance = normalizeAppearance(getRequestBody(req));
    await upsertSettings(userId, { backgroundAppearance: appearance });
    res.json({ appearance });
  } catch (err) {
    req.log?.error?.({ err }, "background appearance error");
    if (sendPersistenceWriteError(req, res, err, "profile.background.appearance")) return;
    res.status(500).json({ error: "Errore aggiornamento aspetto sfondo" });
  }
});

/* ─── DELETE /api/profile/:userId/backgrounds/:id ───────────────────── */
router.delete("/:userId/backgrounds/:id", requireAuth, async (req, res) => {
  try {
    const userId = ensureSameUser(req);
    if (userId === null) {
      res.status(403).json({ error: "Accesso negato" });
      return;
    }
    const entryId = req.params.id ?? "";
    if (!entryId) {
      res.status(400).json({ error: "id richiesto" });
      return;
    }
    const current = (await readSettings(userId)) ?? {
      activeBackgroundId: null,
      library: [],
      appearance: DEFAULT_APPEARANCE,
    };
    const nextLibrary = current.library.filter((e) => e.id !== entryId);
    if (nextLibrary.length === current.library.length) {
      res.status(404).json({ error: "Sfondo non trovato in libreria" });
      return;
    }
    const wasActive = current.activeBackgroundId === `user:${entryId}`;
    await upsertSettings(userId, {
      backgroundLibrary: nextLibrary,
      ...(wasActive ? { activeBackgroundId: null } : {}),
    });
    res.json({
      library: nextLibrary,
      activeBackgroundId: wasActive ? null : current.activeBackgroundId,
    });
  } catch (err) {
    req.log?.error?.({ err }, "background delete error");
    if (sendPersistenceWriteError(req, res, err, "profile.background.delete")) return;
    res.status(500).json({ error: "Errore rimozione sfondo" });
  }
});

export default router;
