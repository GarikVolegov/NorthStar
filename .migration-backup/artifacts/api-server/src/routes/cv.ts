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
import { CvPdfMinimal } from "../cv-pdf-minimal.js";
import { CvPdfBold } from "../cv-pdf-bold.js";
import { CoverLetterPdfDocument, type CoverLetterData } from "../cover-letter-pdf.js";
import {
  Document as DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  BorderStyle,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";

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

export type CvTemplate = "classic" | "minimal" | "bold";

// ── Template registry ─────────────────────────────────────────────────────────
function renderCvPdf(cv: any, template: CvTemplate): Promise<Buffer> {
  switch (template) {
    case "minimal": return renderToBuffer(React.createElement(CvPdfMinimal, { cv }));
    case "bold":    return renderToBuffer(React.createElement(CvPdfBold, { cv }));
    default:        return renderToBuffer(React.createElement(CvPdfDocument, { cv }));
  }
}

// ── DOCX generator ─────────────────────────────────────────────────────────
async function generateDocx(cv: any): Promise<Buffer> {
  const pi = cv.personalInfo ?? {};

  const heading = (text: string) =>
    new Paragraph({
      text,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "2d5a2d", space: 4 } },
    });

  const bold = (text: string) => new TextRun({ text, bold: true });
  const normal = (text: string) => new TextRun({ text });
  const muted = (text: string) => new TextRun({ text, color: "6b7280" });
  const italic = (text: string) => new TextRun({ text, italics: true, color: "6b7280" });

  function bulletLine(text: string) {
    return new Paragraph({
      children: [new TextRun({ text: `\u2192  ${text.replace(/^[\u2192\u2022\-]\s*/, "")}` })],
      spacing: { after: 40 },
      indent: { left: 360 },
    });
  }

  const children: any[] = [];

  // ─ Name + title
  children.push(
    new Paragraph({
      children: [bold(pi.name ?? "")],
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 40 },
      alignment: AlignmentType.LEFT,
    }),
  );
  if (pi.title) children.push(new Paragraph({ children: [italic(pi.title)], spacing: { after: 60 } }));

  // ─ Contacts
  const contacts = [
    pi.email && `Email: ${pi.email}`,
    pi.phone && `Tel: ${pi.phone}`,
    pi.location && `Sede: ${pi.location}`,
    pi.linkedin && `LinkedIn: ${pi.linkedin}`,
    pi.website && `Web: ${pi.website}`,
  ].filter(Boolean) as string[];
  if (contacts.length) {
    children.push(
      new Paragraph({
        children: contacts.map((c, i) => [
          muted(c),
          i < contacts.length - 1 ? muted("   \u00b7   ") : muted(""),
        ]).flat(),
        spacing: { after: 120 },
      }),
    );
  }

  // ─ Summary
  if (cv.summary) {
    children.push(heading("Profilo"));
    children.push(new Paragraph({ children: [normal(cv.summary)], spacing: { after: 80 } }));
  }

  // ─ Experience
  if ((cv.experience ?? []).length > 0) {
    children.push(heading("Esperienza"));
    for (const exp of cv.experience) {
      children.push(
        new Paragraph({
          children: [bold(exp.title), muted(`  \u00b7  ${exp.period}`)],
          spacing: { after: 20 },
        }),
      );
      children.push(
        new Paragraph({
          children: [italic(`${exp.company}${exp.location ? ` · ${exp.location}` : ""}`)],
          spacing: { after: 40 },
        }),
      );
      const lines = exp.description.split(/\n|(?=[\u2192\u2022])/).map((l: string) => l.trim()).filter(Boolean);
      for (const line of lines) {
        const isBullet = /^[\u2192\u2022\-]/.test(line);
        children.push(isBullet ? bulletLine(line) : new Paragraph({ children: [normal(line)], spacing: { after: 40 } }));
      }
      if ((exp.skills ?? []).length > 0) {
        children.push(
          new Paragraph({
            children: [muted(exp.skills.join("  \u00b7  "))],
            spacing: { after: 80 },
          }),
        );
      }
    }
  }

  // ─ Education
  if ((cv.education ?? []).length > 0) {
    children.push(heading("Formazione"));
    for (const edu of cv.education) {
      children.push(
        new Paragraph({
          children: [bold(edu.degree), muted(`  \u00b7  ${edu.year}`)],
          spacing: { after: 20 },
        }),
      );
      children.push(
        new Paragraph({ children: [italic(edu.institution)], spacing: { after: edu.description ? 20 : 80 } }),
      );
      if (edu.description) {
        children.push(new Paragraph({ children: [muted(edu.description)], spacing: { after: 80 } }));
      }
    }
  }

  // ─ Skills
  if ((cv.skills ?? []).length > 0 || (cv.tools ?? []).length > 0) {
    children.push(heading("Competenze & Strumenti"));
    const all = [...(cv.skills ?? []), ...(cv.tools ?? [])];
    children.push(new Paragraph({ children: [normal(all.join("   \u00b7   "))], spacing: { after: 80 } }));
  }

  // ─ Languages
  if ((cv.languages ?? []).length > 0) {
    children.push(heading("Lingue"));
    for (const l of cv.languages) {
      children.push(
        new Paragraph({
          children: [bold(l.language), muted(`  \u2014  ${l.level}`)],
          spacing: { after: 40 },
        }),
      );
    }
  }

  // ─ Certifications
  if ((cv.certifications ?? []).length > 0) {
    children.push(heading("Certificazioni"));
    for (const c of cv.certifications) {
      children.push(bulletLine(c));
    }
  }

  const doc = new DocxDocument({
    creator: "NorthStar",
    title: `CV – ${pi.name ?? "Candidato"}`,
    description: "Curriculum Vitae generato con NorthStar",
    sections: [{
      properties: {},
      children,
    }],
    styles: {
      default: {
        heading1: {
          run: { size: 36, bold: true, color: "111827" },
          paragraph: { spacing: { after: 40 } },
        },
        heading2: {
          run: { size: 22, bold: true, color: "2d5a2d" },
        },
        document: {
          run: { size: 20, font: "Calibri" },
          paragraph: { spacing: { after: 60 } },
        },
      },
    },
  });

  return Packer.toBuffer(doc);
}

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

// ── Helpers
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

function buildCvMetaList(
  cvJson: Record<string, any> | null,
  cvText: string | null,
  userId: number,
): Array<{ id: string; filename: string; uploadedAt: string; source: "upload" | "generated"; hasPdf: boolean; template?: CvTemplate }> {
  if (!cvJson && !cvText) return [];
  const list: Array<{ id: string; filename: string; uploadedAt: string; source: "upload" | "generated"; hasPdf: boolean; template?: CvTemplate }> = [];

  if (cvJson?.generated) {
    list.push({
      id: `generated-${userId}`,
      filename: `CV_${(cvJson.generated.personalInfo?.name ?? "NorthStar").replace(/\s+/g, "_")}_generato.pdf`,
      uploadedAt: cvJson.lastGenerated ?? cvJson.generated.generatedAt ?? new Date().toISOString(),
      source: "generated",
      hasPdf: true,
      template: (cvJson.generated.template as CvTemplate) ?? "classic",
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

// ══ SESSION-AWARE endpoints (/api/cv/mine/*)

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

// ── POST /api/cv/mine/upload
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
  const merged = { ...cvData, generated: (existing?.cvJson as any)?.generated };

  await db.update(usersTable)
    .set({ cvJson: merged as any, cvText: text.slice(0, 50000) })
    .where(eq(usersTable.id, userId));

  const cvs = buildCvMetaList(merged as any, text, userId);
  res.json({ success: true, cvs });
});

// ── POST /api/cv/mine/generate
const GenerateMineBody = z.object({
  template: z.enum(["classic", "minimal", "bold"]).optional().default("classic"),
});

router.post("/cv/mine/generate", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

  const parsed = GenerateMineBody.safeParse(req.body ?? {});
  const template: CvTemplate = parsed.success ? parsed.data.template : "classic";

  const [user] = await db
    .select({ name: usersTable.name, email: usersTable.email, cvJson: usersTable.cvJson, cvText: usersTable.cvText, workPreference: usersTable.workPreference })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }

  let graphNodes: Array<{ type: string; label: string }> = [];
  try {
    const { knowledgeGraphTable } = await import("@workspace/db") as any;
    if (knowledgeGraphTable) {
      graphNodes = await db.select({ type: knowledgeGraphTable.type, label: knowledgeGraphTable.label })
        .from(knowledgeGraphTable).where(eq(knowledgeGraphTable.userId, userId));
    }
  } catch { /* proceed without graph */ }

  const cvData = user.cvJson as any;
  const graphRoles  = graphNodes.filter((n) => n.type === "role").map((n) => n.label);
  const graphSkills = graphNodes.filter((n) => n.type === "skill").map((n) => n.label);
  const graphTools  = graphNodes.filter((n) => n.type === "tool").map((n) => n.label);
  const graphCerts  = graphNodes.filter((n) => n.type === "certification").map((n) => n.label);
  const cvSummary = cvData ? `CV con ${(cvData.experience ?? []).length} esperienze` : "Nessun CV caricato";
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

DATO CV ESISTENTE: ${cvSummary}
${cvData?.experience ? `Esperienze: ${cvData.experience.map((e: any) => `${e.title} @ ${e.company} (${e.period})`).join("; ")}` : ""}
${cvData?.education ? `Formazione: ${cvData.education.map((e: any) => `${e.degree} - ${e.institution}`).join("; ")}` : ""}

Restituisci SOLO JSON (senza markdown):
{
  "personalInfo": { "name": "${user.name}", "email": "${user.email}", "phone": "${cvData?.personalInfo?.phone ?? ""}", "location": "${cvData?.personalInfo?.location ?? ""}", "linkedin": "${cvData?.personalInfo?.linkedin ?? ""}", "title": "" },
  "summary": "",
  "experience": [{ "id": "exp1", "title": "", "company": "", "period": "", "location": "", "description": "", "skills": [] }],
  "education": [{ "id": "edu1", "degree": "", "institution": "", "year": "" }],
  "skills": [], "tools": [],
  "languages": [{ "language": "", "level": "" }],
  "certifications": [], "targetRole": "", "generatedAt": "${now}"
}`;

  let generated: any;
  try { generated = await aiJson<any>(prompt); }
  catch { res.status(500).json({ error: "Errore nella generazione. Riprova." }); return; }

  generated.template = template;

  const updatedJson = { ...(cvData ?? {}), generated, lastGenerated: now };
  await db.update(usersTable).set({ cvJson: updatedJson as any }).where(eq(usersTable.id, userId));

  const cvs = buildCvMetaList(updatedJson, user.cvText, userId);
  res.json({ success: true, cvs, template });
});

// ── PATCH /api/cv/mine/generated  — salva modifiche manuali
router.patch("/cv/mine/generated", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }

  const { generated } = req.body;
  if (!generated || typeof generated !== "object") {
    res.status(400).json({ error: "Dati CV mancanti" }); return;
  }

  const [user] = await db.select({ cvJson: usersTable.cvJson }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }

  const now = new Date().toISOString();
  const updated = {
    ...((user.cvJson as any) ?? {}),
    generated: { ...generated, savedAt: now },
    lastSaved: now,
  };

  await db.update(usersTable).set({ cvJson: updated as any }).where(eq(usersTable.id, userId));
  res.json({ success: true, savedAt: now });
});

// ── DELETE /api/cv/mine
router.delete("/cv/mine", async (req, res): Promise<void> => {
  const userId = getAuthenticatedUserId(req);
  if (!userId) { res.status(401).json({ error: "Non autenticato" }); return; }
  await db.update(usersTable).set({ cvJson: null as any, cvText: null as any }).where(eq(usersTable.id, userId));
  res.json({ success: true });
});

// ══ LEGACY endpoints

router.get("/cv/:userId", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }
  const [user] = await db.select({ cvJson: usersTable.cvJson, cvText: usersTable.cvText }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }
  res.json({ cvData: user.cvJson ?? null, hasCv: !!user.cvJson });
});

// GET /api/cv/:userId/pdf?template=
router.get("/cv/:userId/pdf", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const [user] = await db.select({ cvJson: usersTable.cvJson }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }

  const generated = (user.cvJson as any)?.generated;
  if (!generated) { res.status(404).json({ error: "Nessun CV generato" }); return; }

  const validTemplates: CvTemplate[] = ["classic", "minimal", "bold"];
  const qTemplate = req.query.template as string | undefined;
  const template: CvTemplate = validTemplates.includes(qTemplate as CvTemplate)
    ? (qTemplate as CvTemplate)
    : (validTemplates.includes(generated.template) ? generated.template : "classic");

  try {
    const buffer = await renderCvPdf(generated, template);
    const safeName = (generated.personalInfo?.name ?? "CV").replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="CV_${safeName}_NorthStar.pdf"`);
    res.setHeader("Content-Length", buffer.length);
    res.end(buffer);
  } catch (err: any) {
    console.error("PDF generation error:", err);
    res.status(500).json({ error: "Errore PDF" });
  }
});

// GET /api/cv/:userId/docx — nuovo
router.get("/cv/:userId/docx", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const [user] = await db.select({ cvJson: usersTable.cvJson }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }

  const generated = (user.cvJson as any)?.generated;
  if (!generated) { res.status(404).json({ error: "Nessun CV generato" }); return; }

  try {
    const buffer = await generateDocx(generated);
    const safeName = (generated.personalInfo?.name ?? "CV").replace(/[^a-zA-Z0-9\s]/g, "").trim().replace(/\s+/g, "_");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", `attachment; filename="CV_${safeName}_NorthStar.docx"`);
    res.end(buffer);
  } catch (err: any) {
    console.error("DOCX generation error:", err);
    res.status(500).json({ error: "Errore DOCX" });
  }
});

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
    res.status(400).json({ error: "Il testo estratto \u00e8 troppo breve. Controlla il file." });
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

Restituisci SOLO un JSON valido (senza markdown):
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
}`;

  let generated: any;
  try { generated = await aiJson<any>(prompt); }
  catch { res.status(500).json({ error: "Errore nella generazione. Riprova." }); return; }

  await db.update(usersTable)
    .set({ cvJson: { ...(cvData ?? {}), generated, lastGenerated: new Date().toISOString() } as any })
    .where(eq(usersTable.id, userId));

  res.json({ success: true, generated });
});

router.post("/cv/:userId/tailor", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const { generated, jobPosting } = req.body;
  if (!generated || typeof generated !== "object") { res.status(400).json({ error: "CV mancante" }); return; }
  if (!jobPosting || jobPosting.trim().length < 30) { res.status(400).json({ error: "Offerta di lavoro troppo breve" }); return; }

  const prompt = `Sei un esperto recruiter italiano. Adatta il CV all'offerta.

─── CV (JSON) ───
${JSON.stringify(generated, null, 2)}

─── OFFERTA ───
${jobPosting.slice(0, 4000)}

ISTRUZIONI: Aggiorna targetRole, riscrivi summary con keyword chiave, riscrivi description esperienze, riordina skills. NON inventare esperienze. Mantieni schema JSON. Restituisci SOLO JSON.`;

  let tailored: any;
  try { tailored = await aiJson<any>(prompt); }
  catch { res.status(500).json({ error: "Errore nell'adattamento" }); return; }

  res.json({ success: true, tailored });
});

router.patch("/cv/:userId/save", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const { generated } = req.body;
  if (!generated || typeof generated !== "object") { res.status(400).json({ error: "Dati CV mancanti" }); return; }

  const [user] = await db.select({ cvJson: usersTable.cvJson }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }

  const now = new Date().toISOString();
  const updated = { ...((user.cvJson as any) ?? {}), generated: { ...generated, savedAt: now }, lastGenerated: (user.cvJson as any)?.lastGenerated ?? now, lastSaved: now };
  await db.update(usersTable).set({ cvJson: updated as any }).where(eq(usersTable.id, userId));
  res.json({ success: true, savedAt: now });
});

router.get("/cv/:userId/versions", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }
  const [user] = await db.select({ cvJson: usersTable.cvJson }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }
  const versions = ((user.cvJson as any)?.versions ?? []).map((v: any) => ({ id: v.id, name: v.name, targetRole: v.targetRole, savedAt: v.savedAt }));
  res.json({ versions });
});

router.post("/cv/:userId/versions", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }
  const { generated, name } = req.body;
  if (!generated || typeof generated !== "object") { res.status(400).json({ error: "Dati CV mancanti" }); return; }
  const [user] = await db.select({ cvJson: usersTable.cvJson }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }
  const now = new Date().toISOString();
  const newVersion = { id: crypto.randomUUID(), name: (name as string)?.trim() || `CV ${new Date().toLocaleDateString("it-IT")}`, targetRole: generated.targetRole ?? "", savedAt: now, data: generated };
  const existing: any[] = (user.cvJson as any)?.versions ?? [];
  const versions = [newVersion, ...existing].slice(0, 20);
  const updated = { ...((user.cvJson as any) ?? {}), versions };
  await db.update(usersTable).set({ cvJson: updated as any }).where(eq(usersTable.id, userId));
  res.json({ success: true, version: { id: newVersion.id, name: newVersion.name, targetRole: newVersion.targetRole, savedAt: newVersion.savedAt } });
});

router.get("/cv/:userId/versions/:versionId", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }
  const [user] = await db.select({ cvJson: usersTable.cvJson }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }
  const version = ((user.cvJson as any)?.versions ?? []).find((v: any) => v.id === req.params.versionId);
  if (!version) { res.status(404).json({ error: "Versione non trovata" }); return; }
  res.json({ version });
});

router.patch("/cv/:userId/versions/:versionId", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }
  const { name } = req.body;
  if (!name?.trim()) { res.status(400).json({ error: "Nome mancante" }); return; }
  const [user] = await db.select({ cvJson: usersTable.cvJson }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }
  const versions = ((user.cvJson as any)?.versions ?? []).map((v: any) => v.id === req.params.versionId ? { ...v, name: name.trim() } : v);
  const updated = { ...((user.cvJson as any) ?? {}), versions };
  await db.update(usersTable).set({ cvJson: updated as any }).where(eq(usersTable.id, userId));
  res.json({ success: true });
});

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

router.post("/cv/:userId/cover-letter", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }
  const { generated, jobPosting, companyName, roleTitle, extraInfo } = req.body;
  if (!generated || !jobPosting?.trim()) { res.status(400).json({ error: "Dati CV e offerta richiesti" }); return; }

  const today = new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  const prompt = `Sei un esperto di scrittura professionale italiana. Scrivi una cover letter eccellente.

CANDIDATO: ${generated.personalInfo?.name}, ${generated.personalInfo?.title}
Sommario: ${generated.summary}
Esperienze: ${JSON.stringify(generated.experience?.slice(0, 3))}
Competenze: ${[...(generated.skills ?? []), ...(generated.tools ?? [])].join(", ")}
${extraInfo ? `Note: ${extraInfo}` : ""}

OFFERTA:
${jobPosting}${companyName ? `\nAzienda: ${companyName}` : ""}${roleTitle ? `\nRuolo: ${roleTitle}` : ""}

JSON puro: { "subject": "", "salutation": "", "paragraphs": [], "closing": "" }`;

  let letter: { subject: string; salutation: string; paragraphs: string[]; closing: string };
  try { letter = await aiJson<typeof letter>(prompt); }
  catch { res.status(500).json({ error: "Errore AI" }); return; }

  const letterData: CoverLetterData = {
    senderName: generated.personalInfo?.name, senderTitle: generated.personalInfo?.title,
    senderEmail: generated.personalInfo?.email, senderPhone: generated.personalInfo?.phone,
    senderLocation: generated.personalInfo?.location, recipientCompany: companyName,
    recipientRole: roleTitle, date: today, subject: letter.subject,
    salutation: letter.salutation, paragraphs: letter.paragraphs, closing: letter.closing,
  };

  const row = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (row.length) {
    const current = (row[0].cvJson as Record<string, any>) ?? {};
    await db.update(usersTable).set({ cvJson: { ...current, coverLetter: { ...letterData, generatedAt: new Date().toISOString() } } as any }).where(eq(usersTable.id, userId));
  }
  res.json({ success: true, letter: letterData });
});

router.get("/cv/:userId/cover-letter/pdf", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }
  const letterParam = req.query.data as string | undefined;
  let letter: CoverLetterData | null = null;
  if (letterParam) {
    try { letter = JSON.parse(Buffer.from(decodeURIComponent(letterParam), "base64").toString("utf-8")); } catch {}
  }
  if (!letter) {
    const row = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!row.length || !(row[0].cvJson as any)?.coverLetter) { res.status(404).json({ error: "Nessuna lettera trovata" }); return; }
    letter = (row[0].cvJson as any).coverLetter as CoverLetterData;
  }
  const buffer = await renderToBuffer(React.createElement(CoverLetterPdfDocument, { letter }));
  const safeFileName = `lettera-${(letter.senderName ?? "cv").replace(/\s+/g, "-").toLowerCase()}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}"`);
  res.send(buffer);
});

router.post("/cv/:userId/ats-score", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }
  const { generated, jobPosting } = req.body;
  if (!generated || !jobPosting?.trim()) { res.status(400).json({ error: "Dati CV e offerta richiesti" }); return; }

  const cvText = [generated.personalInfo?.title, generated.summary,
    (generated.experience ?? []).map((e: any) => `${e.title} ${e.company} ${e.description} ${(e.skills ?? []).join(" ")}`).join(" "),
    (generated.skills ?? []).join(" "), (generated.tools ?? []).join(" "),
    (generated.education ?? []).map((e: any) => `${e.degree} ${e.institution}`).join(" "),
    (generated.certifications ?? []).join(" "),
  ].join("\n");

  const prompt = `Analizza compatibilità CV-offerta e restituisci JSON puro:
{
  "score": 78, "label": "Buono",
  "sections": [{ "name": "Riepilogo", "score": 80, "feedback": "" }, ...],
  "missingKeywords": [], "strengths": [], "tips": []
}
Label: "Eccellente"(85+), "Buono"(70-84), "Sufficiente"(55-69), "Da migliorare"(<55).

CV:
${cvText}

OFFERTA:
${jobPosting}`;

  let result: any;
  try { result = await aiJson<any>(prompt); }
  catch { res.status(500).json({ error: "Errore AI" }); return; }
  res.json({ success: true, result });
});

router.delete("/cv/:userId", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }
  await db.update(usersTable).set({ cvJson: null as any, cvText: null as any }).where(eq(usersTable.id, userId));
  res.json({ success: true });
});

export default router;
