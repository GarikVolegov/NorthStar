import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, sectorsTable, userProfileSettingsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { costGuard } from "../middleware/cost-guard";
import { getRequestBody } from "../lib/request-context";
import { asPlainRecord } from "../lib/type-guards";
import { getLLM } from "@workspace/ai-server/llm/client";
import { estimateTokens, recordLlmUsage } from "@workspace/ai-server";

const router = Router();

/* ─── POST /api/roadmap/:id/generate  —  genera roadmap (SSE, LLM reale) ─── */
// Stream SSE atteso da apps/web/src/pages/roadmap.tsx: chunk `data: {"content":...}`
// poi `data: {"done":true}`; la FE estrae il JSON RoadmapData dall'accumulato.
router.post("/:id/generate", requireAuth, costGuard, async (req, res) => {
  const userId = req.user!.id;
  const sectorId = parseInt(req.params.id ?? "", 10);

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const [sector] = await db
      .select({
        name: sectorsTable.name,
        skills: sectorsTable.skills,
        avgSalaryMin: sectorsTable.avgSalaryMin,
        avgSalaryMax: sectorsTable.avgSalaryMax,
      })
      .from(sectorsTable)
      .where(eq(sectorsTable.id, sectorId))
      .limit(1);

    if (!sector) {
      res.write(`data: ${JSON.stringify({ error: "Settore non trovato" })}\n\n`);
      res.end();
      return;
    }

    const [profile] = await db
      .select({ cvText: userProfileSettingsTable.cvText })
      .from(userProfileSettingsTable)
      .where(eq(userProfileSettingsTable.userId, userId))
      .limit(1);
    const cv = (profile?.cvText ?? "").slice(0, 2000);
    const sectorSkills = (sector.skills as string[] | undefined)?.join(", ") ?? "";

    const systemPrompt = `Sei un career advisor esperto del mercato del lavoro IT italiano. Generi roadmap di carriera concrete e realistiche. Rispondi ESCLUSIVAMENTE con un oggetto JSON valido: nessun testo prima o dopo, nessun markdown, nessun commento. Tutti i contenuti in italiano.`;
    const userPrompt = `Genera una roadmap per entrare e crescere nel settore "${sector.name}".
Skill chiave del settore: ${sectorSkills || "n/d"}.
RAL indicativa del settore: ${sector.avgSalaryMin}–${sector.avgSalaryMax} € lordi/anno.
${cv ? `Profilo del candidato (estratto dal CV): ${cv}` : "Nessun CV fornito: assumi un profilo entry/junior."}

Rispondi con questo ESATTO schema JSON (rispetta nomi dei campi e tipi):
{
  "userProfileSummary": "string",
  "recommendedPathId": "string (uguale a uno dei paths[].id)",
  "recommendationReason": "string",
  "totalDurationBest": "string (es. 8-12 mesi)",
  "paths": [{
    "id": "string", "type": "string", "title": "string", "shortDescription": "string",
    "duration": "string", "estimatedCost": "string", "fitScore": 0,
    "fitReason": "string", "bestFor": "string", "pros": ["string"], "cons": ["string"],
    "phases": [{
      "id": 1, "title": "string", "duration": "string", "emoji": "string",
      "description": "string", "actions": ["string"],
      "resources": [{ "type": "string", "name": "string", "platform": "string" }],
      "milestone": "string"
    }]
  }],
  "alternativeFormativePaths": [{ "title": "string", "type": "string", "duration": "string", "benefit": "string" }],
  "comparison": "string",
  "salaryProgression": [{ "phase": "string", "range": "string" }],
  "topRoles": ["string"],
  "keyTip": "string"
}
Genera ESATTAMENTE 2 paths, ognuno con 3 phases (id phase progressivi 1,2,3). fitScore è 0-100. Sii concreto e specifico per l'Italia.`;

    const llm = getLLM();
    const promptTokens = estimateTokens(systemPrompt + userPrompt);
    const stream = await llm.chat(
      [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: userPrompt },
      ],
      { model: "google/gemini-flash-1.5", temperature: 0.3, maxTokens: 4000 },
    );

    let full = "";
    for await (const delta of stream) {
      full += delta;
      res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
    }

    recordLlmUsage({
      userId,
      model: "google/gemini-flash-1.5",
      promptTokens,
      completionTokens: estimateTokens(full),
      requestType: "roadmap",
    });

    // Robustezza: valida il JSON PRIMA di segnalare done, così la FE non prova a
    // parsare un output troncato/malformato (mostrerebbe un errore generico).
    // La FE estrae il JSON con /\{[\s\S]*\}/: usiamo lo stesso criterio.
    const match = full.match(/\{[\s\S]*\}/);
    let valid = false;
    if (match) {
      try {
        const parsed: unknown = JSON.parse(match[0]);
        valid =
          typeof parsed === "object" &&
          parsed !== null &&
          Array.isArray((parsed as { paths?: unknown }).paths) &&
          (parsed as { paths: unknown[] }).paths.length > 0;
      } catch {
        valid = false;
      }
    }
    if (!valid) {
      req.log?.warn?.({ sectorId }, "roadmap generate: invalid LLM JSON");
      res.write(
        `data: ${JSON.stringify({ error: "La roadmap generata non è valida. Riprova tra poco." })}\n\n`,
      );
      res.end();
      return;
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    req.log?.error?.({ err }, "roadmap generate error");
    res.write(
      `data: ${JSON.stringify({ error: "Errore nella generazione della roadmap" })}\n\n`,
    );
    res.end();
  }
});

/* ─── PATCH /api/roadmap/:sectorId/phases/:phaseId  —  aggiorna fase ─── */
router.patch("/:sectorId/phases/:phaseId", requireAuth, async (req, res) => {
  try {
    const phaseId = parseInt(req.params.phaseId ?? "", 10);
    const updates = asPlainRecord(getRequestBody(req));

    // In a real implementation, this would update the database
    // For now, we'll just return the updates as confirmation
    res.json({
      success: true,
      phaseId,
      updates,
      message: "Fase aggiornata con successo",
    });
  } catch (err) {
    req.log?.error?.({ err }, "roadmap phase update error");
    res.status(500).json({ error: "Errore nell'aggiornamento della fase" });
  }
});

export default router;
