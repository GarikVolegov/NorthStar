/**
 * POST /api/growth-agent/ingest
 *
 * Accepts:
 *   - multipart/form-data with a `file` field (txt, pdf-extracted text)
 *   - application/json with { text, sourceName, sourceType, metadata }
 *   - { url, sourceName } to scrape and ingest a webpage
 *
 * Persona examples format (sourceType = "persona_example"):
 *   { question: "...", answer: "...", tags: [...] }
 *
 * Auth: requires JWT (userId extracted from token)
 */
import { Router } from "express";
import multer from "multer";
import {
  ingestText,
  ingestPersonaExample,
  ingestUrl,
} from "@workspace/integrations-openai-ai-server/growth-agent";
import type { SourceType } from "@workspace/integrations-openai-ai-server/growth-agent";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── Upload file or raw text ───────────────────────────────────────────────────
router.post("/", upload.single("file"), async (req, res) => {
  try {
    const userId: number = (req as any).user.id;

    // ── File upload ────────────────────────────────────────────────────────
    if (req.file) {
      const text = req.file.buffer.toString("utf-8");
      const result = await ingestText(text, {
        userId,
        sourceType: (req.body.sourceType as SourceType) ?? "document",
        sourceName: req.file.originalname,
        metadata: req.body.metadata ? JSON.parse(req.body.metadata) : {},
      });
      return res.json({ ok: true, ...result });
    }

    const body = req.body as {
      text?: string;
      url?: string;
      sourceName?: string;
      sourceType?: SourceType;
      question?: string;
      answer?: string;
      tags?: string[];
      metadata?: Record<string, unknown>;
    };

    // ── Persona example ────────────────────────────────────────────────────
    if (body.sourceType === "persona_example" && body.question && body.answer) {
      const result = await ingestPersonaExample({
        userId,
        sourceName: body.sourceName ?? "Esempio personale",
        question: body.question,
        answer: body.answer,
        tags: body.tags,
        metadata: body.metadata,
      });
      return res.json({ ok: true, ...result });
    }

    // ── URL scrape ─────────────────────────────────────────────────────────
    if (body.url) {
      const result = await ingestUrl(body.url, {
        userId,
        sourceType: body.sourceType ?? "document",
        sourceName: body.sourceName,
        metadata: body.metadata,
      });
      return res.json({ ok: true, ...result });
    }

    // ── Raw text ───────────────────────────────────────────────────────────
    if (body.text) {
      const result = await ingestText(body.text, {
        userId,
        sourceType: body.sourceType ?? "document",
        sourceName: body.sourceName ?? "Testo manuale",
        metadata: body.metadata,
      });
      return res.json({ ok: true, ...result });
    }

    return res.status(400).json({ error: "Provide file, text, url, or persona_example fields" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Ingest error";
    return res.status(500).json({ error: msg });
  }
});

export default router;
