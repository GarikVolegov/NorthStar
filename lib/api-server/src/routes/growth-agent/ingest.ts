/**
 * POST /api/growth-agent/ingest
 *
 * Accepts:
 *   - multipart/form-data  file=<.txt|.pdf>           → text or PDF ingestion
 *   - application/json     { text, sourceName, ... }   → raw text
 *   - application/json     { url, ... }                → scrape URL
 *   - application/json     { sourceType:"persona_example", question, answer, tags }
 *
 * Response: { ok: true, chunksInserted: N, sourceName: string, sourceType: string }
 */
import { Router } from "express";
import multer from "multer";
import {
  ingestText,
  ingestPersonaExample,
  ingestUrl,
} from "@workspace/integrations-openai-ai-server/growth-agent";
import { ingestPdf } from "@workspace/integrations-openai-ai-server/growth-agent/pdf-parser";
import type { SourceType } from "@workspace/integrations-openai-ai-server/growth-agent";

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["text/plain", "application/pdf"];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Only .txt and .pdf files are supported"));
    }
  },
});

router.post("/", upload.single("file"), async (req, res) => {
  try {
    const userId: number = (req as any).user.id;

    // ── FILE UPLOAD ──────────────────────────────────────────────────────────
    if (req.file) {
      const sourceName = req.file.originalname;
      const sourceType = (req.body.sourceType as SourceType) ?? "document";
      const metadata   = req.body.metadata ? JSON.parse(req.body.metadata) : {};

      let result;

      if (req.file.mimetype === "application/pdf") {
        // ── PDF → extract text → chunk → embed → store ────────────────────
        result = await ingestPdf(req.file.buffer, {
          userId,
          sourceType,
          sourceName,
          metadata,
        });
      } else {
        // ── Plain text ────────────────────────────────────────────────────
        const text = req.file.buffer.toString("utf-8");
        result = await ingestText(text, {
          userId,
          sourceType,
          sourceName,
          metadata,
        });
      }

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

    // ── PERSONA EXAMPLE ──────────────────────────────────────────────────────
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

    // ── URL SCRAPE ───────────────────────────────────────────────────────────
    if (body.url) {
      const result = await ingestUrl(body.url, {
        userId,
        sourceType: body.sourceType ?? "document",
        sourceName: body.sourceName,
        metadata: body.metadata,
      });
      return res.json({ ok: true, ...result });
    }

    // ── RAW TEXT ─────────────────────────────────────────────────────────────
    if (body.text) {
      const result = await ingestText(body.text, {
        userId,
        sourceType: body.sourceType ?? "document",
        sourceName: body.sourceName ?? "Testo manuale",
        metadata: body.metadata,
      });
      return res.json({ ok: true, ...result });
    }

    return res.status(400).json({
      error: "Provide: file (.txt/.pdf), text, url, or persona_example fields",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Ingest error";
    return res.status(500).json({ error: msg });
  }
});

export default router;
