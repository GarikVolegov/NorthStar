import { Router } from "express";
import { z } from "zod/v4";
import { requireAuth } from "../middleware/auth";
import {
  wendyLimiter,
  wendyIpLimiter,
  planQuotaLimiter,
} from "../middleware/rate-limit";
import { getRequestBody } from "../lib/request-context";

const router = Router();

const askSchema = z.object({
  message: z.string().min(1).max(5000),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
        phase: z.string().optional(),
      }),
    )
    .optional(),
  phase: z.enum(["question", "evaluate", "final"]).default("question"),
});

const evaluationSchema = z
  .object({
    score: z.number().optional(),
  })
  .passthrough();

type Evaluation = z.infer<typeof evaluationSchema>;

const MAX_TURNS = 5;

function parseEvaluation(content: string): Evaluation | null {
  try {
    const parsed: unknown = JSON.parse(content);
    const result = evaluationSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

// ── ASK (SSE streaming with ML evaluation + adaptation) ─────
router.post(
  "/:id/ask",
  requireAuth,
  wendyLimiter,
  wendyIpLimiter,
  planQuotaLimiter,
  async (req, res) => {
    const userId = req.user!.id;
    const sectorId = parseInt(req.params.id ?? "", 10);
    const data = askSchema.parse(getRequestBody(req));
    const log = req.log;

    const sectorName = `Settore ${sectorId}`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    try {
      const { generateQuestions, evaluateAnswer, adaptDifficulty } =
        await import("@workspace/ai-server");
      const { db, userProfileSettingsTable } = await import("@workspace/db");
      const { eq } = await import("drizzle-orm");

      const [userRow] = await db
        .select({ cvText: userProfileSettingsTable.cvText })
        .from(userProfileSettingsTable)
        .where(eq(userProfileSettingsTable.userId, userId))
        .limit(1);

      const history = data.history ?? [];

      if (data.phase === "question") {
        const answeredCount = history.filter(
          (m) => m.role === "assistant" && m.phase === "evaluate",
        ).length;

        if (answeredCount === 0) {
          const questions = await generateQuestions(
            sectorName,
            userRow?.cvText ?? undefined,
            MAX_TURNS,
          );
          const firstQ = questions[0];
          if (!firstQ) throw new Error("Nessuna domanda generata");
          res.write(
            `data: ${JSON.stringify({ type: "question", question: firstQ.question, difficulty: firstQ.difficulty, focus: firstQ.focus, turn: 1, total: MAX_TURNS })}\n\n`,
          );
          res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
          res.end();
          return;
        }

        const lastAssistantMsg = history.filter((m) => m.role === "assistant");
        const evaluations = lastAssistantMsg
          .filter((m) => m.phase === "evaluate")
          .map((m) => parseEvaluation(m.content))
          .filter(
            (evaluation): evaluation is Evaluation => evaluation !== null,
          );

        const avgScore =
          evaluations.length > 0
            ? evaluations.reduce((s, e) => s + (e.score ?? 5), 0) /
              evaluations.length
            : 5;

        const currentDifficulty = await adaptDifficulty(
          answeredCount <= 1
            ? "base"
            : answeredCount <= 3
              ? "media"
              : "avanzata",
          avgScore,
          answeredCount,
        );

        const questions = await generateQuestions(
          sectorName,
          userRow?.cvText ?? undefined,
          1,
        );
        const nextQ = questions[0];
        if (!nextQ) throw new Error("Nessuna domanda generata");
        nextQ.difficulty = currentDifficulty;

        res.write(
          `data: ${JSON.stringify({ type: "question", question: nextQ.question, difficulty: nextQ.difficulty, focus: nextQ.focus, turn: answeredCount + 1, total: MAX_TURNS })}\n\n`,
        );
        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        res.end();
        return;
      }

      if (data.phase === "evaluate") {
        const lastQuestion = history
          .filter((m) => m.role === "assistant" && m.phase === "question")
          .pop();

        const evaluation = await evaluateAnswer(
          lastQuestion?.content ?? "Domanda sconosciuta",
          data.message,
          "media",
          sectorName,
        );

        res.write(
          `data: ${JSON.stringify({ type: "evaluation", ...evaluation })}\n\n`,
        );
        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        res.end();
        return;
      }

      if (data.phase === "final") {
        const evaluations = history
          .filter((m) => m.role === "assistant" && m.phase === "evaluate")
          .map((m) => parseEvaluation(m.content))
          .filter(
            (evaluation): evaluation is Evaluation => evaluation !== null,
          );

        const avgScore =
          evaluations.length > 0
            ? evaluations.reduce((s, e) => s + (e.score ?? 5), 0) /
              evaluations.length
            : 0;

        const maxScore = evaluations.length * 10;
        const totalScore = evaluations.reduce((s, e) => s + (e.score ?? 0), 0);
        const percentage =
          maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

        res.write(
          `data: ${JSON.stringify({
            type: "final",
            totalScore: percentage,
            questionsAnswered: evaluations.length,
            averageScore: Math.round(avgScore * 10) / 10,
            details: evaluations,
          })}\n\n`,
        );
        res.write(`data: ${JSON.stringify({ type: "done" })}\n\n`);
        res.end();
        return;
      }

      res.write(
        `data: ${JSON.stringify({ type: "error", message: "Fase non valida" })}\n\n`,
      );
      res.end();
    } catch (err) {
      log.error({ err }, "interview ask error");
      res.write(
        `data: ${JSON.stringify({ type: "error", message: "Errore durante il colloquio" })}\n\n`,
      );
      res.end();
    }
  },
);

export default router;
