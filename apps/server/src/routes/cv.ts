import { Router } from "express";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { db, userProfileSettingsTable } from "@workspace/db";

const router = Router();

function makeCvMeta(profile: typeof userProfileSettingsTable.$inferSelect | null, source: "upload" | "generated") {
  if (!profile?.cvText && !profile?.cvJson) return null;
  return {
    id:         `cv-${profile.userId}`,
    filename:   source === "generated" ? "CV Generato.pdf" : "CV Caricato",
    uploadedAt: profile.updatedAt?.toISOString() ?? new Date().toISOString(),
    source,
    hasPdf:     false,
    template:   (profile.cvJson as Record<string, unknown>)?.template as string | undefined,
  };
}

/* ─── GET /api/cv/mine ─── */
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const [profile] = await db
      .select({ cvText: userProfileSettingsTable.cvText, cvJson: userProfileSettingsTable.cvJson, userId: userProfileSettingsTable.userId, updatedAt: userProfileSettingsTable.updatedAt })
      .from(userProfileSettingsTable)
      .where(eq(userProfileSettingsTable.userId, req.user!.id))
      .limit(1);

    const cvs = [];
    if (profile?.cvJson) cvs.push(makeCvMeta(profile as unknown as typeof userProfileSettingsTable.$inferSelect, "generated"));
    else if (profile?.cvText) cvs.push(makeCvMeta(profile as unknown as typeof userProfileSettingsTable.$inferSelect, "upload"));

    res.json({ cvs: cvs.filter(Boolean) });
  } catch (err) {
    req.log?.error?.({ err }, "cv mine get error");
    res.status(500).json({ error: "Errore nel caricamento CV" });
  }
});

/* ─── POST /api/cv/mine/upload ─── */
router.post("/mine/upload", requireAuth, async (req, res) => {
  try {
    const { fileDataUrl, filename, mimeType } = req.body;
    if (!fileDataUrl || typeof fileDataUrl !== "string") {
      res.status(400).json({ error: "fileDataUrl richiesto" }); return;
    }
    if (fileDataUrl.length > 3_000_000) {
      res.status(400).json({ error: "File troppo grande (max ~2 MB)" }); return;
    }

    let cvText = "";
    if (mimeType === "text/plain") {
      const base64 = fileDataUrl.split(",")[1] ?? fileDataUrl;
      cvText = Buffer.from(base64, "base64").toString("utf-8");
    } else {
      cvText = `[PDF caricato: ${filename ?? "CV"}]`;
    }

    await db
      .update(userProfileSettingsTable)
      .set({ cvText, cvJson: null, updatedAt: new Date() })
      .where(eq(userProfileSettingsTable.userId, req.user!.id));

    res.json({ success: true, cvs: [{ id: `cv-${req.user!.id}`, filename: filename ?? "CV", uploadedAt: new Date().toISOString(), source: "upload", hasPdf: false }] });
  } catch (err) {
    req.log?.error?.({ err }, "cv upload error");
    res.status(500).json({ error: "Errore upload CV" });
  }
});

/* ─── POST /api/cv/mine/generate ─── */
router.post("/mine/generate", requireAuth, async (req, res) => {
  try {
    const { template } = req.body;
    const userId = req.user!.id;

    const [profile] = await db
      .select()
      .from(userProfileSettingsTable)
      .where(eq(userProfileSettingsTable.userId, userId))
      .limit(1);

    const generated = {
      template: template ?? "classic",
      generatedAt: new Date().toISOString(),
      sections: { summary: "", experience: [], education: [], skills: [] },
    };

    await db
      .update(userProfileSettingsTable)
      .set({ cvJson: generated, updatedAt: new Date() })
      .where(eq(userProfileSettingsTable.userId, userId));

    res.json({
      success: true,
      generated,
      cvs: [{ id: `cv-${userId}`, filename: "CV Generato.pdf", uploadedAt: new Date().toISOString(), source: "generated", hasPdf: false, template }],
    });
  } catch (err) {
    req.log?.error?.({ err }, "cv generate error");
    res.status(500).json({ error: "Errore generazione CV" });
  }
});

/* ─── PATCH /api/cv/mine/generated ─── */
router.patch("/mine/generated", requireAuth, async (req, res) => {
  try {
    const { generated } = req.body;
    if (!generated) { res.status(400).json({ error: "generated richiesto" }); return; }

    await db
      .update(userProfileSettingsTable)
      .set({ cvJson: generated, updatedAt: new Date() })
      .where(eq(userProfileSettingsTable.userId, req.user!.id));

    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "cv generated update error");
    res.status(500).json({ error: "Errore salvataggio CV" });
  }
});

/* ─── DELETE /api/cv/mine ─── */
router.delete("/mine", requireAuth, async (req, res) => {
  try {
    await db
      .update(userProfileSettingsTable)
      .set({ cvText: null, cvJson: null, updatedAt: new Date() })
      .where(eq(userProfileSettingsTable.userId, req.user!.id));

    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "cv delete error");
    res.status(500).json({ error: "Errore eliminazione CV" });
  }
});

export default router;
