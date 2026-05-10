import { Router } from "express";
import { db, testSessionsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getAuthenticatedUserId } from "../lib/plan-utils";
import { ai } from "../lib/ai/index.js";

const router = Router();

router.post("/cover-letter/generate", async (req, res): Promise<void> => {
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

  try {
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

    const text = await ai.chat({
      useCase: "agent_analysis",
      messages: [{ role: "user", content: prompt }],
      maxTokens: 600,
      temperature: 0.75,
    });

    res.json({ text: text.trim() });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Errore nella generazione";
    res.status(500).json({ error: errMsg });
  }
});

export default router;
