import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, testSessionsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getAuthenticatedUserId } from "../lib/plan-utils";
import { rejectIfOpenAINotConfigured } from "../lib/openai-availability";

const router = Router();

router.post("/cover-letter/generate", async (req, res): Promise<void> => {
  const notConfigured = rejectIfOpenAINotConfigured(res);
  if (notConfigured) return;

  const userId = getAuthenticatedUserId(req);
  if (!userId) {
    res.status(401).json({ error: "Non autenticato" });
    return;
  }

  const { company, role, jobDescription = "" } = req.body as {
    company: string;
    role: string;
    jobDescription?: string;
  };
  if (!company?.trim() || !role?.trim()) {
    res.status(400).json({ error: "company e role sono richiesti" });
    return;
  }

  const [user] = await db
    .select({ name: usersTable.name, cvText: usersTable.cvText })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  const [session] = await db
    .select({
      primaryTypes: testSessionsTable.primaryTypes,
      profileSummary: testSessionsTable.profileSummary,
    })
    .from(testSessionsTable)
    .where(eq(testSessionsTable.userId, userId))
    .orderBy(desc(testSessionsTable.createdAt))
    .limit(1);

  const types = ((session?.primaryTypes as string[]) ?? []).join(", ") || "non specificato";
  const profileSummary = (session?.profileSummary as string) ?? "";
  const cvSnippet = user?.cvText
    ? `\n\nEstratto CV:\n${user.cvText.slice(0, 1200)}`
    : "";
  const jdSnippet = jobDescription.trim()
    ? `\n\nDescrizione posizione:\n${jobDescription.slice(0, 800)}`
    : "";

  const prompt = `Sei un esperto di carriera italiano. Scrivi una lettera di presentazione professionale in italiano.

Nome candidato: ${user?.name ?? "Candidato"}
Ruolo target: ${role}
Azienda: ${company}${jdSnippet}

Profilo RIASEC del candidato: ${types}${profileSummary ? ` — ${profileSummary}` : ""}${cvSnippet}

Istruzioni:
- Lunghezza: massimo 280 parole
- Tono: professionale ma autentico, non generico
- Struttura: apertura personalizzata per azienda e ruolo → competenze chiave collegate al profilo RIASEC → chiusura con disponibilità a colloquio
- Non includere data, intestazione formale o oggetto
- Inizia con "Gentile team di ${company}," o formula equivalente`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 600,
    temperature: 0.75,
  });

  const text = completion.choices[0]?.message?.content?.trim() ?? "";
  res.json({ text });
});

export default router;
