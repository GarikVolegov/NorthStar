import { Router, type IRouter } from "express";
import multer from "multer";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { ai } from "../lib/ai/index.js";
import { getAuthenticatedUserId } from "../lib/plan-utils.js";
// @ts-ignore
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { CvPdfDocument } from "../cv-pdf.js";
import { CoverLetterPdfDocument, type CoverLetterData } from "../cover-letter-pdf.js";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "text/plain"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Solo file PDF o TXT supportati"));
  },
});

interface CvData {
  personalInfo: {
    name: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
    website?: string;
    title?: string;
  };
  summary?: string;
  experience: Array<{
    id: string;
    title: string;
    company: string;
    period: string;
    location?: string;
    description: string;
    skills: string[];
  }>;
  education: Array<{
    id: string;
    degree: string;
    institution: string;
    year: string;
    description?: string;
  }>;
  skills: string[];
  tools: string[];
  languages: Array<{ language: string; level: string }>;
  certifications: string[];
  extractedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────

function stripCodeFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

async function aiJson<T>(prompt: string): Promise<T> {
  const raw = await ai.chat({
    useCase: "json_extraction",
    messages: [{ role: "user", content: prompt }],
  });
  return JSON.parse(stripCodeFences(raw)) as T;
}

// ── helpers: build CvMeta list from raw cvJson blob ───────────────────
/**
 * Normalises the flat cvJson blob into the CvMeta shape that
 * CvSection.tsx expects:  { cvs: CvMeta[] }
 *
 * Rules:
 *  - If cvJson has a `generated` sub-object  → one entry with source "generated"
 *  - If cvJson has top-level `extractedAt`    → one entry with source "upload"
 *  - Both can coexist; generated is listed first
 */
function buildCvMetaList(
  cvJson: Record<string, any> | null,
  cvText: string | null,
  userId: number,
): Array<{ id: string; filename: string; uploadedAt: string; source: "upload" | "generated"; hasPdf: boolean }> {
  if (!cvJson && !cvText) return [];
  const list: Array<{ id: string; filename: string; uploadedAt: string; source: "upload" | "generated"; hasPdf: boolean }> = [];

  if (cvJson?.generated) {
    list.push({
      id: `generated-${userId}`,
      filename: `CV_${(cvJson.generated.personalInfo?.name ?? "NorthStar").replace(/\s+/g, "_")}_generato.pdf`,
      uploadedAt: cvJson.lastGenerated ?? cvJson.generated.generatedAt ?? new Date().toISOString(),
      source: "generated",
      hasPdf: true,
    });
  }

  if (cvJson?.extractedAt || cvText) {
    list.push({
      id: `uploaded-${userId}`,
      filename: (cvJson?.personalInfo?.name
        ? `CV_${(cvJson.personalInfo.name as string).replace(/\s+/g, "_")}_caricato.pdf`
        : "CV_caricato.pdf"),
      uploadedAt: cvJson?.extractedAt ?? new Date().toISOString(),
      source: "upload",
      hasPdf: false,
    });
  }

  return list;
}

// ══════════════════════════════════════════════════════════════════════
// SESSION-AWARE endpoints  (/api/cv/mine/*)
// userId viene sempre da getAuthenticatedUserId(req) — nessun :userId
// ══════════════════════════════════════════════════════════════════════

// ── GET /api/cv/mine ──────────────────────────────────────────────────
router.get("/cv/mine", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

  const [user] = await db
    .select({ cvJson: usersTable.cvJson, cvText: usersTable.cvText })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }

  const cvs = buildCvMetaList(user.cvJson as any, user.cvText, userId);
  res.json({ cvs });
});

// ── POST /api/cv/mine/upload ───────────────────────────────────────────
const mineUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["application/pdf", "text/plain"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Solo PDF o TXT"));
  },
});

router.post("/cv/mine/upload", mineUpload.single("file"), async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

  let text = "";

  if (req.file) {
    if (req.file.mimetype === "application/pdf") {
      try {
        const pdfParse = ((await import("pdf-parse")) as any).default ?? (await import("pdf-parse"));
        const parsed = await pdfParse(req.file.buffer);
        text = parsed.text;
      } catch {
        res.status(400).json({ error: "Impossibile leggere il PDF. Prova con un file TXT." });
        return;
      }
    } else {
      text = req.file.buffer.toString("utf-8");
    }
  } else {
    res.status(400).json({ error: "Nessun file fornito" });
    return;
  }

  if (text.trim().length < 50) {
    res.status(400).json({ error: "Testo estratto troppo breve. Controlla il file." });
    return;
  }

  const prompt = `Analizza il seguente curriculum vitae e restituisci un JSON strutturato.

CURRICULUM:
${text.slice(0, 8000)}

Restituisci SOLO un JSON valido con questa struttura (senza markdown, senza \`\`\`):
{
  "personalInfo": { "name": "", "email": "", "phone": "", "location": "", "linkedin": "", "website": "", "title": "" },
  "summary": "",
  "experience": [{ "id": "exp1", "title": "", "company": "", "period": "", "location": "", "description": "", "skills": [] }],
  "education": [{ "id": "edu1", "degree": "", "institution": "", "year": "", "description": "" }],
  "skills": [],
  "tools": [],
  "languages": [{ "language": "", "level": "" }],
  "certifications": []
}

Estrai tutte le informazioni presenti. Per i campi non trovati usa array vuoti o stringhe vuote.`;

  let cvData: CvData;
  try {
    cvData = await aiJson<CvData>(prompt);
    cvData.extractedAt = new Date().toISOString();
  } catch {
    res.status(500).json({ error: "Errore nel parsing della risposta AI. Riprova." });
    return;
  }

  const [existing] = await db.select({ cvJson: usersTable.cvJson }).from(usersTable).where(eq(usersTable.id, userId));
  // Preserve existing generated CV when uploading a new one
  const merged = { ...cvData, generated: (existing?.cvJson as any)?.generated };

  await db.update(usersTable)
    .set({ cvJson: merged as any, cvText: text.slice(0, 50000) })
    .where(eq(usersTable.id, userId));

  const cvs = buildCvMetaList(merged as any, text, userId);
  res.json({ success: true, cvs });
});

// ── POST /api/cv/mine/generate ─────────────────────────────────────────
router.post("/cv/mine/generate", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

  // Fetch everything we need from DB autonomously
  const [user] = await db
    .select({
      name: usersTable.name,
      email: usersTable.email,
      cvJson: usersTable.cvJson,
      cvText: usersTable.cvText,
      workPreference: usersTable.workPreference,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }

  // Fetch graph nodes
  let graphNodes: Array<{ type: string; label: string }> = [];
  try {
    const { knowledgeGraphTable } = await import("@workspace/db") as any;
    if (knowledgeGraphTable) {
      graphNodes = await db.select({ type: knowledgeGraphTable.type, label: knowledgeGraphTable.label })
        .from(knowledgeGraphTable)
        .where(eq(knowledgeGraphTable.userId, userId));
    }
  } catch { /* graph table may not exist, proceed without */ }

  const cvData = user.cvJson as any;
  const graphRoles  = graphNodes.filter((n) => n.type === "role").map((n) => n.label);
  const graphSkills = graphNodes.filter((n) => n.type === "skill").map((n) => n.label);
  const graphTools  = graphNodes.filter((n) => n.type === "tool").map((n) => n.label);
  const graphCerts  = graphNodes.filter((n) => n.type === "certification").map((n) => n.label);

  const cvSummary = cvData
    ? `CV caricato con ${(cvData.experience ?? []).length} esperienze, competenze: ${(cvData.skills ?? []).slice(0, 8).join(", ")}`
    : "Nessun CV caricato";

  const now = new Date().toISOString();
  const prompt = `Sei un career coach esperto. Genera un curriculum vitae professionale ottimizzato in italiano.

DATI UTENTE:
- Nome: ${user.name}
- Email: ${user.email}
- Preferenza lavorativa: ${user.workPreference ?? "non specificata"}

GRAFO DELLE CONOSCENZE:
- Ruoli target: ${graphRoles.join(", ") || "non specificati"}
- Competenze: ${graphSkills.join(", ") || "non specificate"}
- Strumenti: ${graphTools.join(", ") || "non specificati"}
- Certificazioni: ${graphCerts.join(", ") || "non specificate"}

DATO CV ESISTENTE:
${cvSummary}
${cvData?.experience ? `Esperienze: ${cvData.experience.map((e: any) => `${e.title} @ ${e.company} (${e.period})`).join("; ")}` : ""}
${cvData?.education ? `Formazione: ${cvData.education.map((e: any) => `${e.degree} - ${e.institution}`).join("; ")}` : ""}

Restituisci SOLO un JSON valido (senza markdown):
{
  "personalInfo": { "name": "${user.name}", "email": "${user.email}", "phone": "${cvData?.personalInfo?.phone ?? ""}", "location": "${cvData?.personalInfo?.location ?? ""}", "linkedin": "${cvData?.personalInfo?.linkedin ?? ""}", "title": "" },
  "summary": "",
  "experience": [{ "id": "exp1", "title": "", "company": "", "period": "", "location": "", "description": "", "skills": [] }],
  "education": [{ "id": "edu1", "degree": "", "institution": "", "year": "" }],
  "skills": [],
  "tools": [],
  "languages": [{ "language": "", "level": "" }],
  "certifications": [],
  "targetRole": "",
  "generatedAt": "${now}"
}

Integra i dati del CV caricato con le informazioni del grafo. Sii specifico e professionale.`;

  let generated: any;
  try {
    generated = await aiJson<any>(prompt);
  } catch {
    res.status(500).json({ error: "Errore nella generazione. Riprova." });
    return;
  }

  const updatedJson = { ...(cvData ?? {}), generated, lastGenerated: now };
  await db.update(usersTable)
    .set({ cvJson: updatedJson as any })
    .where(eq(usersTable.id, userId));

  const cvs = buildCvMetaList(updatedJson, user.cvText, userId);
  res.json({ success: true, cvs });
});

// ── DELETE /api/cv/mine ────────────────────────────────────────────────
router.delete("/cv/mine", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

  await db.update(usersTable)
    .set({ cvJson: null as any, cvText: null as any })
    .where(eq(usersTable.id, userId));

  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════
// LEGACY endpoints (mantengono compatibilità con CvBuilder esistente)
// ══════════════════════════════════════════════════════════════════════

// ── GET /api/cv/:userId ────────────────────────────────────────────────
router.get("/cv/:userId", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const [user] = await db
    .select({ cvJson: usersTable.cvJson, cvText: usersTable.cvText })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }
  res.json({ cvData: user.cvJson ?? null, hasCv: !!user.cvJson });
});

// ── GET /api/cv/:userId/pdf ────────────────────────────────────────────
router.get("/cv/:userId/pdf", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const [user] = await db
    .select({ cvJson: usersTable.cvJson })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }

  const generated = (user.cvJson as any)?.generated;
  if (!generated) { res.status(404).json({ error: "Nessun CV generato. Genera il CV prima di scaricarlo." }); return; }

  try {
    const buffer = await renderToBuffer(React.createElement(CvPdfDocument, { cv: generated }));
    const safeName = (generated.personalInfo?.name ?? "CV")
      .replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="CV_${safeName}_NorthStar.pdf"`);
    res.setHeader("Content-Length", buffer.length);
    res.end(buffer);
  } catch (err: any) {
    console.error("PDF generation error:", err);
    res.status(500).json({ error: "Errore nella generazione del PDF. Riprova." });
  }
});

// ── POST /api/cv/upload ────────────────────────────────────────────────
router.post("/cv/upload", upload.single("file"), async (req, res): Promise<void> => {
  const { userId, rawText } = req.body;
  const uid = parseInt(userId, 10);
  if (isNaN(uid)) { res.status(400).json({ error: "userId non valido" }); return; }

  let text = "";

  if (req.file) {
    if (req.file.mimetype === "application/pdf") {
      try {
        const pdfParse = ((await import("pdf-parse")) as any).default ?? (await import("pdf-parse"));
        const parsed = await pdfParse(req.file.buffer);
        text = parsed.text;
      } catch {
        res.status(400).json({ error: "Impossibile leggere il PDF. Prova a incollare il testo direttamente." });
        return;
      }
    } else {
      text = req.file.buffer.toString("utf-8");
    }
  } else if (rawText && typeof rawText === "string") {
    text = rawText;
  } else {
    res.status(400).json({ error: "Nessun file o testo fornito" });
    return;
  }

  if (text.trim().length < 50) {
    res.status(400).json({ error: "Il testo estratto è troppo breve. Controlla il file." });
    return;
  }

  const prompt = `Analizza il seguente curriculum vitae e restituisci un JSON strutturato.

CURRICULUM:
${text.slice(0, 8000)}

Restituisci SOLO un JSON valido con questa struttura (senza markdown, senza \`\`\`):
{
  "personalInfo": { "name": "", "email": "", "phone": "", "location": "", "linkedin": "", "website": "", "title": "" },
  "summary": "",
  "experience": [{ "id": "exp1", "title": "", "company": "", "period": "", "location": "", "description": "", "skills": [] }],
  "education": [{ "id": "edu1", "degree": "", "institution": "", "year": "", "description": "" }],
  "skills": [],
  "tools": [],
  "languages": [{ "language": "", "level": "" }],
  "certifications": []
}

Estrai tutte le informazioni presenti. Per i campi non trovati usa array vuoti o stringhe vuote.`;

  let cvData: CvData;
  try {
    cvData = await aiJson<CvData>(prompt);
    cvData.extractedAt = new Date().toISOString();
  } catch {
    res.status(500).json({ error: "Errore nel parsing della risposta AI. Riprova." });
    return;
  }

  await db.update(usersTable)
    .set({ cvJson: cvData as any, cvText: text.slice(0, 50000) })
    .where(eq(usersTable.id, uid));

  res.json({ success: true, cvData });
});

// ── POST /api/cv/generate ──────────────────────────────────────────────
const GenerateBody = z.object({
  userId: z.number(),
  profileData: z.object({
    name: z.string(),
    email: z.string(),
    riasecTypes: z.array(z.string()).optional(),
    confirmedSector: z.string().optional(),
    skills: z.array(z.string()).optional(),
  }),
  graphNodes: z.array(z.object({
    id: z.string(),
    label: z.string(),
    type: z.enum(["role", "skill", "tool", "certification"]),
    description: z.string(),
    userAdded: z.boolean().optional(),
  })).optional(),
  cvData: z.any().optional(),
});

router.post("/cv/generate", async (req, res): Promise<void> => {
  const parsed = GenerateBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Dati non validi", details: parsed.error.issues }); return; }

  const { userId, profileData, graphNodes = [], cvData } = parsed.data;

  const graphRoles = graphNodes.filter((n) => n.type === "role").map((n) => n.label);
  const graphSkills = graphNodes.filter((n) => n.type === "skill").map((n) => n.label);
  const graphTools = graphNodes.filter((n) => n.type === "tool").map((n) => n.label);
  const graphCerts = graphNodes.filter((n) => n.type === "certification").map((n) => n.label);

  const cvSummary = cvData
    ? `CV caricato con ${(cvData.experience ?? []).length} esperienze, competenze: ${(cvData.skills ?? []).slice(0, 8).join(", ")}`
    : "Nessun CV caricato";

  const prompt = `Sei un career coach esperto. Genera un curriculum vitae professionale ottimizzato in italiano per il seguente profilo.

DATI UTENTE:
- Nome: ${profileData.name}
- Email: ${profileData.email}
- Profilo RIASEC: ${(profileData.riasecTypes ?? []).join(", ") || "non specificato"}
- Settore confermato: ${profileData.confirmedSector || "non specificato"}

GRAFO DELLE CONOSCENZE:
- Ruoli target: ${graphRoles.join(", ") || "non specificati"}
- Competenze rilevate: ${graphSkills.join(", ") || "non specificate"}
- Strumenti/tecnologie: ${graphTools.join(", ") || "non specificati"}
- Certificazioni consigliate: ${graphCerts.join(", ") || "non specificate"}

DATI CV CARICATO:
${cvSummary}
${cvData?.experience ? `Esperienze: ${cvData.experience.map((e: any) => `${e.title} @ ${e.company} (${e.period})`).join("; ")}` : ""}
${cvData?.education ? `Formazione: ${cvData.education.map((e: any) => `${e.degree} - ${e.institution}`).join("; ")}` : ""}

Restituisci SOLO un JSON valido (senza markdown) con questa struttura:
{
  "personalInfo": { "name": "${profileData.name}", "email": "${profileData.email}", "phone": "${(cvData as any)?.personalInfo?.phone ?? ""}", "location": "${(cvData as any)?.personalInfo?.location ?? ""}", "linkedin": "${(cvData as any)?.personalInfo?.linkedin ?? ""}", "title": "" },
  "summary": "",
  "experience": [{ "id": "exp1", "title": "", "company": "", "period": "", "location": "", "description": "", "skills": [] }],
  "education": [{ "id": "edu1", "degree": "", "institution": "", "year": "" }],
  "skills": [],
  "tools": [],
  "languages": [{ "language": "", "level": "" }],
  "certifications": [],
  "targetRole": "",
  "generatedAt": "${new Date().toISOString()}"
}

Integra i dati del CV caricato con le informazioni del grafo. Sii specifico e professionale.`;

  let generated: any;
  try {
    generated = await aiJson<any>(prompt);
  } catch {
    res.status(500).json({ error: "Errore nella generazione. Riprova." });
    return;
  }

  await db.update(usersTable)
    .set({ cvJson: { ...(cvData ?? {}), generated, lastGenerated: new Date().toISOString() } as any })
    .where(eq(usersTable.id, userId));

  res.json({ success: true, generated });
});

// ── POST /api/cv/:userId/tailor ────────────────────────────────────────
router.post("/cv/:userId/tailor", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const { generated, jobPosting } = req.body;
  if (!generated || typeof generated !== "object") {
    res.status(400).json({ error: "CV mancante. Genera prima il CV base." }); return;
  }
  if (!jobPosting || jobPosting.trim().length < 30) {
    res.status(400).json({ error: "Incolla il testo dell'offerta di lavoro (almeno 30 caratteri)." }); return;
  }

  const cvJson = JSON.stringify(generated, null, 2);
  const prompt = `Sei un esperto recruiter e career coach italiano. Adatta il CV all'offerta di lavoro.

─── CV ATTUALE (JSON) ───
${cvJson}

─── OFFERTA DI LAVORO ───
${jobPosting.slice(0, 4000)}

ISTRUZIONI:
1. Aggiorna "targetRole" con il titolo esatto del ruolo
2. Riscrivi "summary" integrando 3-5 keyword chiave dell'offerta
3. Per ogni esperienza, riscrivi "description" evidenziando le responsabilità che corrispondono ai requisiti
4. Riordina "skills" e "tools" mettendo prima quelle che matchano l'offerta
5. Aggiorna "personalInfo.title" con il titolo del ruolo target
6. NON inventare esperienze o competenze non presenti nel CV
7. Mantieni TUTTI i campi JSON originali invariati

Restituisci SOLO il JSON aggiornato (stesso schema, senza markdown).`;

  let tailored: any;
  try {
    tailored = await aiJson<any>(prompt);
  } catch (err) {
    console.error("Tailor error:", err);
    res.status(500).json({ error: "Errore nell'adattamento. Riprova." }); return;
  }

  res.json({ success: true, tailored });
});

// ── PATCH /api/cv/:userId/save ─────────────────────────────────────────
router.patch("/cv/:userId/save", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const { generated } = req.body;
  if (!generated || typeof generated !== "object") {
    res.status(400).json({ error: "Dati CV mancanti" }); return;
  }

  const [user] = await db
    .select({ cvJson: usersTable.cvJson })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }

  const now = new Date().toISOString();
  const updated = {
    ...((user.cvJson as any) ?? {}),
    generated: { ...generated, savedAt: now },
    lastGenerated: (user.cvJson as any)?.lastGenerated ?? now,
    lastSaved: now,
  };

  await db.update(usersTable).set({ cvJson: updated as any }).where(eq(usersTable.id, userId));
  res.json({ success: true, savedAt: now });
});

// ── GET /api/cv/:userId/versions ──────────────────────────────────────
router.get("/cv/:userId/versions", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const [user] = await db.select({ cvJson: usersTable.cvJson }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }

  const versions: any[] = ((user.cvJson as any)?.versions ?? []).map((v: any) => ({
    id: v.id, name: v.name, targetRole: v.targetRole, savedAt: v.savedAt,
  }));
  res.json({ versions });
});

// ── POST /api/cv/:userId/versions ─────────────────────────────────────
router.post("/cv/:userId/versions", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const { generated, name } = req.body;
  if (!generated || typeof generated !== "object") { res.status(400).json({ error: "Dati CV mancanti" }); return; }

  const [user] = await db.select({ cvJson: usersTable.cvJson }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }

  const now = new Date().toISOString();
  const newVersion = {
    id: crypto.randomUUID(),
    name: (name as string)?.trim() || `CV ${new Date().toLocaleDateString("it-IT")}`,
    targetRole: generated.targetRole ?? "",
    savedAt: now,
    data: generated,
  };

  const existing: any[] = (user.cvJson as any)?.versions ?? [];
  const versions = [newVersion, ...existing].slice(0, 20);
  const updated = { ...((user.cvJson as any) ?? {}), versions };
  await db.update(usersTable).set({ cvJson: updated as any }).where(eq(usersTable.id, userId));

  res.json({ success: true, version: { id: newVersion.id, name: newVersion.name, targetRole: newVersion.targetRole, savedAt: newVersion.savedAt } });
});

// ── GET /api/cv/:userId/versions/:versionId ───────────────────────────
router.get("/cv/:userId/versions/:versionId", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const [user] = await db.select({ cvJson: usersTable.cvJson }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }

  const version = ((user.cvJson as any)?.versions ?? []).find((v: any) => v.id === req.params.versionId);
  if (!version) { res.status(404).json({ error: "Versione non trovata" }); return; }
  res.json({ version });
});

// ── PATCH /api/cv/:userId/versions/:versionId ─────────────────────────
router.patch("/cv/:userId/versions/:versionId", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const { name } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "Nome mancante" }); return; }

  const [user] = await db.select({ cvJson: usersTable.cvJson }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }

  const versions = ((user.cvJson as any)?.versions ?? []).map((v: any) =>
    v.id === req.params.versionId ? { ...v, name: name.trim() } : v
  );
  const updated = { ...((user.cvJson as any) ?? {}), versions };
  await db.update(usersTable).set({ cvJson: updated as any }).where(eq(usersTable.id, userId));
  res.json({ success: true });
});

// ── DELETE /api/cv/:userId/versions/:versionId ────────────────────────
router.delete("/cv/:userId/versions/:versionId", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const [user] = await db.select({ cvJson: usersTable.cvJson }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }

  const versions = ((user.cvJson as any)?.versions ?? []).filter((v: any) => v.id !== req.params.versionId);
  const updated = { ...((user.cvJson as any) ?? {}), versions };
  await db.update(usersTable).set({ cvJson: updated as any }).where(eq(usersTable.id, userId));
  res.json({ success: true });
});

// ── POST /api/cv/:userId/cover-letter ─────────────────────────────────
router.post("/cv/:userId/cover-letter", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const { generated, jobPosting, companyName, roleTitle, extraInfo } = req.body;
  if (!generated || !jobPosting?.trim()) {
    res.status(400).json({ error: "Dati CV e offerta di lavoro richiesti" }); return;
  }

  const today = new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });

  const prompt = `Sei un esperto di scrittura professionale italiana. Scrivi una cover letter eccellente in italiano formale-professionale.

CANDIDATO:
Nome: ${generated.personalInfo?.name ?? "Candidato"}
Titolo: ${generated.personalInfo?.title ?? ""}
Sommario: ${generated.summary ?? ""}
Esperienze: ${JSON.stringify(generated.experience?.slice(0, 3) ?? [])}
Competenze: ${[...(generated.skills ?? []), ...(generated.tools ?? [])].join(", ")}
${extraInfo ? `Note aggiuntive: ${extraInfo}` : ""}

OFFERTA:
${jobPosting}
${companyName ? `Azienda: ${companyName}` : ""}
${roleTitle ? `Ruolo: ${roleTitle}` : ""}

STRUTTURA:
1. Saluto: "Gentile Team ${companyName ?? "HR"}"
2. Paragrafo 1: apertura forte + ruolo candidato
3. Paragrafo 2: 2-3 esperienze/competenze concrete legate all'offerta
4. Paragrafo 3: motivazione autentica per questo ruolo e azienda
5. Paragrafo 4: chiusura con invito a colloquio
6. Congedo: "Cordiali saluti"
7. Lunghezza: 220-320 parole
8. NON inventare esperienze non presenti nel CV

Risposta JSON puro:
{
  "subject": "Candidatura per il ruolo di [ruolo]",
  "salutation": "Gentile ...",
  "paragraphs": ["p1", "p2", "p3", "p4"],
  "closing": "Cordiali saluti,"
}`;

  let letter: { subject: string; salutation: string; paragraphs: string[]; closing: string };
  try {
    letter = await aiJson<typeof letter>(prompt);
  } catch {
    res.status(500).json({ error: "Errore nel parsing della risposta AI" }); return;
  }

  const letterData: CoverLetterData = {
    senderName: generated.personalInfo?.name ?? "Candidato",
    senderTitle: generated.personalInfo?.title,
    senderEmail: generated.personalInfo?.email,
    senderPhone: generated.personalInfo?.phone,
    senderLocation: generated.personalInfo?.location,
    recipientCompany: companyName,
    recipientRole: roleTitle,
    date: today,
    subject: letter.subject,
    salutation: letter.salutation,
    paragraphs: letter.paragraphs,
    closing: letter.closing,
  };

  const row = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (row.length) {
    const current = (row[0].cvJson as Record<string, any>) ?? {};
    await db.update(usersTable)
      .set({ cvJson: { ...current, coverLetter: { ...letterData, generatedAt: new Date().toISOString() } } as any })
      .where(eq(usersTable.id, userId));
  }

  res.json({ success: true, letter: letterData });
});

// ── GET /api/cv/:userId/cover-letter/pdf ──────────────────────────────
router.get("/cv/:userId/cover-letter/pdf", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const letterParam = req.query.data as string | undefined;
  let letter: CoverLetterData | null = null;

  if (letterParam) {
    try {
      letter = JSON.parse(Buffer.from(decodeURIComponent(letterParam), "base64").toString("utf-8"));
    } catch { /* fallback to DB */ }
  }

  if (!letter) {
    const row = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!row.length || !(row[0].cvJson as any)?.coverLetter) {
      res.status(404).json({ error: "Nessuna lettera trovata" }); return;
    }
    letter = (row[0].cvJson as any).coverLetter as CoverLetterData;
  }

  const buffer = await renderToBuffer(React.createElement(CoverLetterPdfDocument, { letter }));
  const safeFileName = `lettera-${(letter.senderName ?? "cv").replace(/\s+/g, "-").toLowerCase()}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}"`);
  res.send(buffer);
});

// ── POST /api/cv/:userId/ats-score ────────────────────────────────────
router.post("/cv/:userId/ats-score", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const { generated, jobPosting } = req.body;
  if (!generated || !jobPosting?.trim()) {
    res.status(400).json({ error: "Dati CV e offerta richiesti" });
    return;
  }

  const cvText = [
    generated.personalInfo?.title ?? "",
    generated.summary ?? "",
    (generated.experience ?? []).map((e: any) => `${e.title} ${e.company} ${e.description} ${(e.skills ?? []).join(" ")}`).join(" "),
    (generated.skills ?? []).join(" "),
    (generated.tools ?? []).join(" "),
    (generated.education ?? []).map((e: any) => `${e.degree} ${e.institution}`).join(" "),
    (generated.certifications ?? []).join(" "),
  ].join("\n");

  const prompt = `Sei un esperto ATS e recruiter HR senior. Analizza la compatibilità tra il CV e l'offerta.

CV:
${cvText}

OFFERTA:
${jobPosting}

Restituisci SOLO JSON puro:
{
  "score": 78,
  "label": "Buono",
  "sections": [
    { "name": "Riepilogo", "score": 80, "feedback": "..." },
    { "name": "Esperienza", "score": 72, "feedback": "..." },
    { "name": "Competenze", "score": 85, "feedback": "..." },
    { "name": "Parole chiave", "score": 65, "feedback": "..." },
    { "name": "Istruzione", "score": 90, "feedback": "..." }
  ],
  "missingKeywords": [],
  "strengths": [],
  "tips": []
}

Label: "Eccellente" (85+), "Buono" (70-84), "Sufficiente" (55-69), "Da migliorare" (<55).`;

  let result: any;
  try {
    result = await aiJson<any>(prompt);
  } catch {
    res.status(500).json({ error: "Errore nel parsing della risposta AI" });
    return;
  }

  res.json({ success: true, result });
});

// ── DELETE /api/cv/:userId ─────────────────────────────────────────────
router.delete("/cv/:userId", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  await db.update(usersTable)
    .set({ cvJson: null as any, cvText: null as any })
    .where(eq(usersTable.id, userId));

  res.json({ success: true });
});

export default router;
