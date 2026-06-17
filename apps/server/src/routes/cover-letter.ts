/**
 * cover-letter.ts — generatore AI di lettere di presentazione (US-006).
 *
 * POST /api/cover-letter/generate  { company, role, jobDescription? } -> { text } | { error }
 * Chiamato da apps/web/src/features/applications/CoverLetterDialog.tsx.
 *
 * PRIVACY: al LLM va SOLO il CV dell'utente stesso + i dati che ha inserito.
 * FREEMIUM: 1 lettera/mese gratis, poi Pro (Redis cacheIncr, fail-open).
 */
import { Router } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod/v4";
import { db, userProfileSettingsTable } from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import { wendyLimiter } from "../middleware/rate-limit";
import { getEffectivePlan, planMeets } from "../middleware/check-feature";
import { cacheIncr } from "../lib/redis";
import { getRequestBody } from "../lib/request-context";
import { getLLM } from "@workspace/ai-server/llm/client";
import { estimateTokens, recordLlmUsage } from "@workspace/ai-server";

const router = Router();

const FREE_MONTHLY_COVERLETTER = parseInt(
  process.env.COVERLETTER_FREE_MONTHLY_LIMIT ?? "1",
  10,
);
const QUOTA_TTL_SECONDS = 35 * 24 * 60 * 60;

const schema = z.object({
  company: z.string().min(1).max(200),
  role: z.string().min(1).max(200),
  jobDescription: z.string().max(5000).optional().default(""),
});

router.post("/generate", requireAuth, wendyLimiter, async (req, res) => {
  const userId = req.user!.id;
  const parsed = schema.safeParse(getRequestBody(req));
  if (!parsed.success) {
    res.status(400).json({ error: "Dati non validi" });
    return;
  }
  const { company, role, jobDescription } = parsed.data;

  // ── Freemium gate: 1 lettera/mese gratis, poi Pro ───────────────────────────
  const plan = await getEffectivePlan(userId);
  if (!planMeets(plan, "pro")) {
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM
    const used = await cacheIncr(
      `coverletter:month:${userId}:${month}`,
      QUOTA_TTL_SECONDS,
    );
    if (used !== null && used > FREE_MONTHLY_COVERLETTER) {
      // Soft gate: il dialog mostra il messaggio. La parola "Pro" attiva il link upgrade (US-007).
      res.json({
        error:
          "Hai usato la tua lettera gratuita di questo mese. Passa a Pro per generarne quante vuoi.",
      });
      return;
    }
  }

  // Solo dati dell'utente al LLM (il proprio CV).
  const [profile] = await db
    .select({ cvText: userProfileSettingsTable.cvText })
    .from(userProfileSettingsTable)
    .where(eq(userProfileSettingsTable.userId, userId))
    .limit(1);
  const cv = (profile?.cvText ?? "").slice(0, 4000);

  const systemPrompt = `Sei un career coach esperto del mercato del lavoro italiano. Scrivi lettere di presentazione in italiano: concise (max ~250 parole), professionali, concrete e personalizzate. NON usare placeholder tipo [Nome] o [Azienda]: usa solo le informazioni fornite; se un dato manca, ometti la frase.`;
  const userPrompt = `Posizione: ${role} presso ${company}.
${jobDescription ? `Descrizione dell'annuncio:\n${jobDescription}\n` : ""}${
    cv
      ? `Profilo del candidato (estratto dal suo CV):\n${cv}\n`
      : "Il candidato non ha caricato un CV: scrivi una lettera generica ma efficace, basata sulla posizione.\n"
  }
Scrivi la lettera di presentazione, pronta all'uso.`;

  try {
    const llm = getLLM();
    const promptTokens = estimateTokens(systemPrompt + userPrompt);
    const stream = await llm.chat(
      [
        { role: "system" as const, content: systemPrompt },
        { role: "user" as const, content: userPrompt },
      ],
      { model: "google/gemini-flash-1.5", temperature: 0.6, maxTokens: 700 },
    );

    let text = "";
    for await (const delta of stream) text += delta;

    recordLlmUsage({
      userId,
      model: "google/gemini-flash-1.5",
      promptTokens,
      completionTokens: estimateTokens(text),
      requestType: "cover-letter",
    });

    res.json({ text: text.trim() });
  } catch (err) {
    req.log?.error?.({ err }, "cover-letter generate failed");
    res.status(500).json({ error: "Errore nella generazione della lettera. Riprova." });
  }
});

export default router;
