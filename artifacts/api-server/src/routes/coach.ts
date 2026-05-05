import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, coachSessionsTable, usersTable, testSessionsTable, userObjectivesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "../lib/auth-jwt.js";
import { aiChatRateLimiter } from "../lib/rate-limiter.js";

const router = Router();

router.get("/coach/sessions", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const sessions = await db
    .select({ id: coachSessionsTable.id, title: coachSessionsTable.title, updatedAt: coachSessionsTable.updatedAt })
    .from(coachSessionsTable)
    .where(eq(coachSessionsTable.userId, userId))
    .orderBy(desc(coachSessionsTable.updatedAt))
    .limit(20);
  res.json(sessions);
});

router.post("/coach/sessions", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const [session] = await db.insert(coachSessionsTable).values({ userId }).returning();
  res.status(201).json(session);
});

router.get("/coach/sessions/:id", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const id = parseInt(req.params.id, 10);
  const [session] = await db.select().from(coachSessionsTable).where(eq(coachSessionsTable.id, id));
  if (!session || session.userId !== userId) { res.status(404).json({ error: "Non trovata" }); return; }
  res.json(session);
});

router.delete("/coach/sessions/:id", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const id = parseInt(req.params.id, 10);
  const [session] = await db.select().from(coachSessionsTable).where(eq(coachSessionsTable.id, id));
  if (!session || session.userId !== userId) { res.status(404).json({ error: "Non trovata" }); return; }
  await db.delete(coachSessionsTable).where(eq(coachSessionsTable.id, id));
  res.json({ ok: true });
});

router.post("/coach/sessions/:id/ask", authMiddleware, aiChatRateLimiter, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const sessionId = parseInt(req.params.id, 10);
  const { message } = req.body as { message: string };

  if (!message?.trim()) { res.status(400).json({ error: "message obbligatorio" }); return; }

  const [session] = await db.select().from(coachSessionsTable).where(eq(coachSessionsTable.id, sessionId));
  if (!session || session.userId !== userId) { res.status(404).json({ error: "Non trovata" }); return; }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  let testSession = null;
  if (user?.testSessionId) {
    const [ts] = await db.select().from(testSessionsTable).where(eq(testSessionsTable.id, user.testSessionId));
    testSession = ts;
  }
  const objectives = await db.select().from(userObjectivesTable)
    .where(eq(userObjectivesTable.userId, userId)).limit(10);

  const systemPrompt = `Sei il Career Coach AI personale di ${user?.name ?? "questo utente"} su NorthStar — piattaforma italiana di orientamento professionale.

PROFILO UTENTE:
- Nome: ${user?.name ?? "N/D"}
- Preferenza lavoro: ${user?.workPreference ?? "N/D"}
${testSession ? `- Tipi RIASEC primari: ${(testSession.primaryTypes as string[] | null)?.join(", ") ?? "N/D"}
- Spirito dominante: ${testSession.dominantSpirit ?? "N/D"}
- Settore confermato: ${testSession.confirmedSectorId ? `ID ${testSession.confirmedSectorId}` : "Non ancora scelto"}
- Sintesi profilo: ${testSession.profileSummary ?? "N/D"}` : "- Test non ancora completato"}
${objectives.length > 0 ? `- Obiettivi attuali: ${objectives.map((o) => `${o.text} (${o.progress}%)`).join("; ")}` : ""}
${user?.cvText ? `- CV in possesso: sì (${user.cvText.slice(0, 200)}...)` : ""}

ISTRUZIONI:
- Sei un coach professionale, empatico e diretto.
- Conosci bene il mercato del lavoro italiano.
- Ricorda il contesto della conversazione e fai riferimento alle sessioni precedenti quando rilevante.
- Fai domande di follow-up pertinenti per approfondire.
- Non ripetere informazioni del profilo a meno che non siano direttamente rilevanti.
- Rispondi SEMPRE in italiano.
- Risposte concise ma sostanziali (max 3-4 paragrafi salvo necessità).`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let assistantContent = "";

  try {
    const history = (session.messages as Array<{ role: string; content: string }>).slice(-20);
    const messages = [
      { role: "system" as const, content: systemPrompt },
      ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: message },
    ];

    const stream = await openai.chat.completions.create({
      model: "gpt-4.1",
      max_tokens: 1024,
      messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        assistantContent += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }
  } catch {
    res.write(`data: ${JSON.stringify({ error: "Errore AI. Riprova." })}\n\n`);
  }

  try {
    const now = new Date().toISOString();
    const updatedMessages = [
      ...(session.messages as Array<{ role: string; content: string; createdAt: string }>),
      { role: "user", content: message, createdAt: now },
      { role: "assistant", content: assistantContent, createdAt: now },
    ];

    const title = (session.messages as unknown[])?.length === 0
      ? message.slice(0, 60) + (message.length > 60 ? "…" : "")
      : session.title;

    await db.update(coachSessionsTable)
      .set({ messages: updatedMessages, title, updatedAt: new Date() })
      .where(eq(coachSessionsTable.id, sessionId));
  } catch { /* non bloccare la risposta */ }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
