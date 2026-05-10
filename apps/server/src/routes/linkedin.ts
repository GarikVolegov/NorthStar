import { Router } from "express";
import { db } from "@workspace/db";
import { linkedinImportsTable, certificationsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "../lib/auth-jwt.js";

const router = Router();
const AI_AGENTS_URL = process.env.AI_AGENTS_URL ?? "http://localhost:8000";

async function callLinkedInAgent(profileText: string) {
  const res = await fetch(`${AI_AGENTS_URL}/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      task_type: "linkedin_extractor",
      payload: { profileText },
      plan: "premium",
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AI agent error ${res.status}: ${err}`);
  }
  return res.json();
}

/**
 * POST /api/linkedin/extract
 * Accepts raw LinkedIn profile text and returns structured extraction via AI.
 * Does NOT save to DB yet — user reviews first.
 */
router.post("/linkedin/extract", authMiddleware, async (req, res): Promise<void> => {
  const { profileText } = req.body as { profileText?: string };

  if (!profileText?.trim() || profileText.length < 50) {
    res.status(400).json({ error: "Testo del profilo troppo corto (minimo 50 caratteri)" });
    return;
  }

  try {
    const agentResult = await callLinkedInAgent(profileText);
    if (!agentResult.success) {
      res.status(422).json({ error: agentResult.error ?? "Estrazione fallita" });
      return;
    }
    res.json({ data: agentResult.data, ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/linkedin/import
 * Confirms import: saves extractedData to DB, writes certifications, updates user fields.
 */
router.post("/linkedin/import", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const {
    profileText,
    extractedData,
    importCertifications = true,
    importSummary = true,
  } = req.body as {
    profileText: string;
    extractedData: Record<string, unknown>;
    importCertifications?: boolean;
    importSummary?: boolean;
  };

  if (!extractedData) {
    res.status(400).json({ error: "extractedData mancante" });
    return;
  }

  let certsImported = 0;

  try {
    const certs = (extractedData.certifications ?? []) as Array<{
      name: string; issuer: string; issued_date?: string; credential_url?: string;
    }>;

    const skills = (extractedData.skills ?? []) as string[];

    if (importCertifications && certs.length > 0) {
      for (const cert of certs) {
        if (!cert.name?.trim() || !cert.issuer?.trim()) continue;
        await db.insert(certificationsTable).values({
          userId,
          name: cert.name,
          issuer: cert.issuer,
          issuedDate: cert.issued_date || null,
          credentialUrl: cert.credential_url || null,
          skills: skills.slice(0, 5),
          sector: (extractedData.sector_suggestion as string) || null,
        }).onConflictDoNothing();
        certsImported++;
      }
    }

    if (importSummary) {
      const summary = extractedData.summary as string;
      const headline = extractedData.headline as string;
      const name = extractedData.full_name as string;

      const updateData: Record<string, unknown> = {};
      if (name && name.trim()) {
        // Don't override name if already set meaningfully
      }

      await db.update(usersTable)
        .set({
          cvText: [
            headline ? `**${headline}**` : "",
            summary ?? "",
            skills.length > 0 ? `\n**Skill:** ${skills.slice(0, 15).join(", ")}` : "",
          ].filter(Boolean).join("\n\n"),
        })
        .where(eq(usersTable.id, userId));
    }

    const [importRecord] = await db.insert(linkedinImportsTable).values({
      userId,
      rawText: (profileText ?? "").slice(0, 5000),
      extractedData,
      certsImported,
    }).returning();

    res.json({
      ok: true,
      importId: importRecord.id,
      certsImported,
      skillsFound: ((extractedData.skills ?? []) as string[]).length,
      experiencesFound: ((extractedData.work_experiences ?? []) as unknown[]).length,
      educationFound: ((extractedData.education ?? []) as unknown[]).length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/linkedin/imports — list previous imports for the user
 */
router.get("/linkedin/imports", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const imports = await db
    .select()
    .from(linkedinImportsTable)
    .where(eq(linkedinImportsTable.userId, userId))
    .orderBy(desc(linkedinImportsTable.createdAt));
  res.json(imports);
});

export default router;
