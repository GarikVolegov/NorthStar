import { Router } from "express";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { db, userProfileSettingsTable } from "@workspace/db";
import {
  sendOptionalReadFallback,
  sendPersistenceWriteError,
} from "../lib/persistence";
import { getRequestBody } from "../lib/request-context";
import { asPlainRecord } from "../lib/type-guards";

const router = Router();

type CvProfileRow = Pick<
  typeof userProfileSettingsTable.$inferSelect,
  "cvText" | "cvJson" | "userId" | "updatedAt"
>;

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function makeCvMeta(
  profile: CvProfileRow | null,
  source: "upload" | "generated",
) {
  if (!profile?.cvText && !profile?.cvJson) return null;
  const cvJson = asPlainRecord(profile.cvJson);
  const template =
    typeof cvJson.template === "string" ? cvJson.template : undefined;

  return {
    id: `cv-${profile.userId}`,
    filename: source === "generated" ? "CV Generato.pdf" : "CV Caricato",
    uploadedAt: profile.updatedAt?.toISOString() ?? new Date().toISOString(),
    source,
    hasPdf: false,
    template,
  };
}

async function upsertProfileSettings(
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

/* ─── GET /api/cv/mine ─── */
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const [profile] = await db
      .select({
        cvText: userProfileSettingsTable.cvText,
        cvJson: userProfileSettingsTable.cvJson,
        userId: userProfileSettingsTable.userId,
        updatedAt: userProfileSettingsTable.updatedAt,
      })
      .from(userProfileSettingsTable)
      .where(eq(userProfileSettingsTable.userId, req.user!.id))
      .limit(1);

    const cvs = [];
    if (profile?.cvJson) cvs.push(makeCvMeta(profile, "generated"));
    else if (profile?.cvText) cvs.push(makeCvMeta(profile, "upload"));

    res.json({ cvs: cvs.filter(Boolean) });
  } catch (err) {
    req.log?.error?.({ err }, "cv mine get error");
    if (sendOptionalReadFallback(req, res, err, "cv.mine", { cvs: [] })) return;
    res.status(500).json({ error: "Errore nel caricamento CV" });
  }
});

/* ─── POST /api/cv/mine/upload ─── */
router.post("/mine/upload", requireAuth, async (req, res) => {
  try {
    const body = asPlainRecord(getRequestBody(req));
    const fileDataUrl = readString(body.fileDataUrl);
    const filename = readString(body.filename, "CV");
    const mimeType = readString(body.mimeType);

    if (!fileDataUrl) {
      res.status(400).json({ error: "fileDataUrl richiesto" });
      return;
    }
    if (fileDataUrl.length > 3_000_000) {
      res.status(400).json({ error: "File troppo grande (max ~2 MB)" });
      return;
    }

    let cvText = "";
    if (mimeType === "text/plain") {
      const base64 = fileDataUrl.split(",")[1] ?? fileDataUrl;
      cvText = Buffer.from(base64, "base64").toString("utf-8");
    } else {
      cvText = `[PDF caricato: ${filename}]`;
    }

    await upsertProfileSettings(req.user!.id, { cvText, cvJson: null });

    res.json({
      success: true,
      cvs: [
        {
          id: `cv-${req.user!.id}`,
          filename,
          uploadedAt: new Date().toISOString(),
          source: "upload",
          hasPdf: false,
        },
      ],
    });
  } catch (err) {
    req.log?.error?.({ err }, "cv upload error");
    if (sendPersistenceWriteError(req, res, err, "cv.upload")) return;
    res.status(500).json({ error: "Errore upload CV" });
  }
});

/* ─── POST /api/cv/mine/generate ─── */
router.post("/mine/generate", requireAuth, async (req, res) => {
  try {
    const body = asPlainRecord(getRequestBody(req));
    const template = readString(body.template, "classic");
    const userId = req.user!.id;

    const generated: Record<string, unknown> = {
      template,
      generatedAt: new Date().toISOString(),
      sections: { summary: "", experience: [], education: [], skills: [] },
    };

    await upsertProfileSettings(userId, { cvJson: generated });

    res.json({
      success: true,
      generated,
      cvs: [
        {
          id: `cv-${userId}`,
          filename: "CV Generato.pdf",
          uploadedAt: new Date().toISOString(),
          source: "generated",
          hasPdf: false,
          template,
        },
      ],
    });
  } catch (err) {
    req.log?.error?.({ err }, "cv generate error");
    if (sendPersistenceWriteError(req, res, err, "cv.generate")) return;
    res.status(500).json({ error: "Errore generazione CV" });
  }
});

/* ─── PATCH /api/cv/mine/generated ─── */
router.patch("/mine/generated", requireAuth, async (req, res) => {
  try {
    const body = asPlainRecord(getRequestBody(req));
    const generatedInput = body.generated;
    const generated = asPlainRecord(generatedInput);
    if (
      !generatedInput ||
      typeof generatedInput !== "object" ||
      Array.isArray(generatedInput)
    ) {
      res.status(400).json({ error: "generated richiesto" });
      return;
    }

    await upsertProfileSettings(req.user!.id, { cvJson: generated });

    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "cv generated update error");
    if (sendPersistenceWriteError(req, res, err, "cv.generated.update")) return;
    res.status(500).json({ error: "Errore salvataggio CV" });
  }
});

/* ─── DELETE /api/cv/mine ─── */
router.delete("/mine", requireAuth, async (req, res) => {
  try {
    await upsertProfileSettings(req.user!.id, { cvText: null, cvJson: null });

    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "cv delete error");
    if (sendPersistenceWriteError(req, res, err, "cv.delete")) return;
    res.status(500).json({ error: "Errore eliminazione CV" });
  }
});

export default router;
