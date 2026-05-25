import { Router } from "express";
import { aiPlugins } from "@workspace/ai-server";
import { db, userProfileSettingsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { getRequestBody } from "../lib/request-context";
import { asPlainRecord } from "../lib/type-guards";

const router = Router();
const MAX_DATA_URL_CHARS = 10_000_000;

interface VisionProfilePatch {
  cvText: string;
  cvJson: Record<string, unknown>;
}

interface VisionPluginOutput {
  rawText: string;
  structured: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isVisionOutput(value: unknown): value is VisionPluginOutput {
  return (
    isRecord(value) &&
    typeof value.rawText === "string" &&
    isRecord(value.structured)
  );
}

function parseBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === "1";
}

function parseDataUrl(value: unknown): { buffer: Buffer; mimeType: "image/png" | "image/jpeg" | "image/webp" } | null {
  if (typeof value !== "string" || value.length > MAX_DATA_URL_CHARS) return null;
  const match = /^data:(image\/png|image\/jpeg|image\/webp);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match) return null;
  const mimeType = match[1] as "image/png" | "image/jpeg" | "image/webp";
  return { buffer: Buffer.from(match[2] ?? "", "base64"), mimeType };
}

async function upsertCvProfile(userId: number, patch: VisionProfilePatch): Promise<void> {
  const now = new Date();
  await db
    .insert(userProfileSettingsTable)
    .values({
      userId,
      cvText: patch.cvText,
      cvJson: patch.cvJson,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: userProfileSettingsTable.userId,
      set: {
        cvText: patch.cvText,
        cvJson: patch.cvJson,
        updatedAt: now,
      },
    });
}

router.post("/analyze-cv", requireAuth, async (req, res) => {
  try {
    const plugin = aiPlugins.getBest("vision");
    if (!plugin) {
      res.status(503).json({
        status: "unavailable",
        error: "Vision plugin non configurato",
      });
      return;
    }

    const body = asPlainRecord(getRequestBody(req));
    const parsedFile = parseDataUrl(body.fileDataUrl);
    const pdfText = typeof body.pdfText === "string" ? body.pdfText.trim() : "";
    if (!parsedFile && !pdfText) {
      res.status(400).json({ error: "fileDataUrl o pdfText richiesto" });
      return;
    }

    const prompt =
      typeof body.prompt === "string" && body.prompt.trim()
        ? body.prompt.trim()
        : "Analizza questo CV e restituisci JSON con summary, skills, esperienze, formazione e suggerimenti profilo.";

    const output = await plugin.execute({
      ...(parsedFile ? { image: parsedFile.buffer, mimeType: parsedFile.mimeType } : {}),
      ...(pdfText ? { pdfText } : {}),
      prompt,
    });
    if (!isVisionOutput(output)) {
      res.status(502).json({ error: "Risposta vision non valida" });
      return;
    }

    const patch: VisionProfilePatch = {
      cvText: output.rawText,
      cvJson: output.structured,
    };
    const apply = parseBoolean(body.apply);
    if (apply) {
      await upsertCvProfile(req.user!.id, patch);
    }

    res.json({
      status: apply ? "applied" : "preview",
      source: "vision",
      profilePatch: patch,
    });
  } catch (err) {
    req.log?.error?.({ err }, "profile vision analyze error");
    res.status(500).json({ error: "Errore analisi CV" });
  }
});

export default router;
