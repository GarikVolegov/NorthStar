import { Router, type IRouter } from "express";
import multer from "multer";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { openai } from "@workspace/integrations-openai-ai-server";
// @ts-ignore — react@19 ships its own types but TS cannot resolve them with `types:["node"]`
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

// ── CV data structure ─────────────────────────────────────────────────
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

// ── GET /api/cv/:userId — get stored CV ───────────────────────────────
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

// ── GET /api/cv/:userId/pdf — generate and stream a PDF ───────────────
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
    const buffer = await renderToBuffer(
      React.createElement(CvPdfDocument, { cv: generated })
    );

    const safeName = (generated.personalInfo?.name ?? "CV")
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .trim()
      .replace(/\s+/g, "_");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="CV_${safeName}_NorthStar.pdf"`);
    res.setHeader("Content-Length", buffer.length);
    res.end(buffer);
  } catch (err: any) {
    console.error("PDF generation error:", err);
    res.status(500).json({ error: "Errore nella generazione del PDF. Riprova." });
  }
});

// ── POST /api/cv/upload — parse PDF/TXT and structure with AI ─────────
router.post("/cv/upload", upload.single("file"), async (req, res): Promise<void> => {
  const { userId, rawText } = req.body;
  const uid = parseInt(userId, 10);
  if (isNaN(uid)) { res.status(400).json({ error: "userId non valido" }); return; }

  let text = "";

  if (req.file) {
    if (req.file.mimetype === "application/pdf") {
      try {
        // @ts-ignore — pdf-parse@2.4.5 types do not expose a callable default in CJS interop
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
  "personalInfo": {
    "name": "Nome Cognome",
    "email": "email@example.com",
    "phone": "+39 ...",
    "location": "Città, Paese",
    "linkedin": "url linkedin se presente",
    "website": "sito web se presente",
    "title": "Titolo professionale (es. Software Engineer, Marketing Manager)"
  },
  "summary": "Breve sommario professionale se presente nel CV, altrimenti stringa vuota",
  "experience": [
    {
      "id": "exp1",
      "title": "Nome ruolo",
      "company": "Nome azienda",
      "period": "Gen 2020 - Dic 2022",
      "location": "Città",
      "description": "Descrizione responsabilità e risultati",
      "skills": ["skill1", "skill2"]
    }
  ],
  "education": [
    {
      "id": "edu1",
      "degree": "Laurea Magistrale in Informatica",
      "institution": "Università di Milano",
      "year": "2018",
      "description": "Eventuale descrizione o voto"
    }
  ],
  "skills": ["skill1", "skill2", "skill3"],
  "tools": ["strumento1", "strumento2"],
  "languages": [
    { "language": "Italiano", "level": "Madrelingua" },
    { "language": "Inglese", "level": "C1" }
  ],
  "certifications": ["certificazione1", "certificazione2"]
}

Estrai tutte le informazioni presenti. Per i campi non trovati usa array vuoti o stringhe vuote.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.1,
    max_tokens: 3000,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";

  let cvData: CvData;
  try {
    cvData = JSON.parse(raw);
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

// ── POST /api/cv/generate — generate beautiful CV from graph + profile ─
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

GRAFO DELLE CONOSCENZE (nodi del settore):
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
  "personalInfo": {
    "name": "${profileData.name}",
    "email": "${profileData.email}",
    "phone": "${(cvData as any)?.personalInfo?.phone ?? ""}",
    "location": "${(cvData as any)?.personalInfo?.location ?? ""}",
    "linkedin": "${(cvData as any)?.personalInfo?.linkedin ?? ""}",
    "title": "Titolo professionale ottimizzato per il settore target"
  },
  "summary": "Sommario professionale di 3-4 righe ottimizzato per il settore target, che integra il profilo RIASEC con le competenze del grafo",
  "experience": [
    {
      "id": "exp1",
      "title": "Ruolo",
      "company": "Azienda",
      "period": "periodo",
      "location": "luogo",
      "description": "Descrizione ottimizzata con bullet points usando i simboli →",
      "skills": ["skill1"]
    }
  ],
  "education": [
    {
      "id": "edu1",
      "degree": "Titolo di studio",
      "institution": "Istituto",
      "year": "anno"
    }
  ],
  "skills": ["lista di tutte le competenze rilevanti dal CV e dal grafo"],
  "tools": ["lista di tutti gli strumenti dal CV e dal grafo"],
  "languages": [{"language": "lingua", "level": "livello"}],
  "certifications": ["certificazioni dal CV e suggerimenti dal grafo"],
  "targetRole": "Ruolo target suggerito basato sul grafo e profilo RIASEC",
  "generatedAt": "${new Date().toISOString()}"
}

Integra i dati del CV caricato con le informazioni del grafo. Se il CV è vuoto, genera contenuti plausibili basati sul profilo RIASEC e sul settore. Sii specifico e professionale.`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 4000,
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";

  let generated: any;
  try {
    generated = JSON.parse(raw);
  } catch {
    res.status(500).json({ error: "Errore nella generazione. Riprova." });
    return;
  }

  await db.update(usersTable)
    .set({ cvJson: { ...(cvData ?? {}), generated, lastGenerated: new Date().toISOString() } as any })
    .where(eq(usersTable.id, userId));

  res.json({ success: true, generated });
});

// ── POST /api/cv/:userId/tailor — rewrite CV for a specific job posting ─
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

  const prompt = `Sei un esperto recruiter e career coach italiano. Il candidato ti ha fornito il suo CV strutturato e un'offerta di lavoro.
Il tuo compito è ADATTARE il CV all'offerta: riscrivi le sezioni rilevanti per massimizzare le possibilità di superare i filtri ATS e impressionare il recruiter.

─── CV ATTUALE (JSON) ───
${cvJson}

─── OFFERTA DI LAVORO ───
${jobPosting.slice(0, 4000)}

ISTRUZIONI:
1. Aggiorna "targetRole" con il titolo esatto del ruolo nell'offerta
2. Riscrivi "summary" di 3-4 righe: menziona esplicitamente il ruolo e integra 3-5 keyword chiave dell'offerta
3. Per ogni esperienza, riscrivi "description" usando bullet → per evidenziare responsabilità che corrispondono ai requisiti dell'offerta
4. Riordina "skills": metti prima le competenze che matchano l'offerta, mantieni tutte le altre
5. Riordina "tools": stessa logica delle skills
6. Aggiorna "personalInfo.title" con il titolo del ruolo target
7. NON inventare esperienze o competenze che non sono nel CV originale
8. Mantieni TUTTI i campi JSON originali (id, company, period, education, languages, certifications ecc.) invariati
9. Usa un tono professionale in italiano

Restituisci SOLO il JSON aggiornato (stesso schema del CV attuale, senza markdown, senza spiegazioni).`;

  let tailored: any;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.25,
      max_tokens: 4500,
    });

    const raw = (completion.choices[0]?.message?.content ?? "{}").trim()
      .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");

    tailored = JSON.parse(raw);
  } catch (err) {
    console.error("Tailor error:", err);
    res.status(500).json({ error: "Errore nell'adattamento. Riprova." }); return;
  }

  res.json({ success: true, tailored });
});

// ── PATCH /api/cv/:userId/save — persist edited generated CV ──────────
router.patch("/cv/:userId/save", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const { generated } = req.body;
  if (!generated || typeof generated !== "object") {
    res.status(400).json({ error: "Dati CV mancanti" });
    return;
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

  await db.update(usersTable)
    .set({ cvJson: updated as any })
    .where(eq(usersTable.id, userId));

  res.json({ success: true, savedAt: now });
});

// ── GET /api/cv/:userId/versions — list saved versions (metadata only) ─
router.get("/cv/:userId/versions", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const [user] = await db.select({ cvJson: usersTable.cvJson }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }

  const versions: any[] = ((user.cvJson as any)?.versions ?? []).map((v: any) => ({
    id: v.id,
    name: v.name,
    targetRole: v.targetRole,
    savedAt: v.savedAt,
  }));

  res.json({ versions });
});

// ── POST /api/cv/:userId/versions — save current generated as new version ─
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

// ── GET /api/cv/:userId/versions/:versionId — load a specific version ──
router.get("/cv/:userId/versions/:versionId", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const [user] = await db.select({ cvJson: usersTable.cvJson }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(404).json({ error: "Utente non trovato" }); return; }

  const version = ((user.cvJson as any)?.versions ?? []).find((v: any) => v.id === req.params.versionId);
  if (!version) { res.status(404).json({ error: "Versione non trovata" }); return; }

  res.json({ version });
});

// ── PATCH /api/cv/:userId/versions/:versionId — rename a version ───────
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

// ── DELETE /api/cv/:userId/versions/:versionId — delete a version ───────
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

// ── POST /api/cv/:userId/cover-letter — AI generate cover letter ───────
router.post("/cv/:userId/cover-letter", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  const { generated, jobPosting, companyName, roleTitle, extraInfo } = req.body;
  if (!generated || !jobPosting?.trim()) {
    res.status(400).json({ error: "Dati CV e offerta di lavoro richiesti" });
    return;
  }

  const today = new Date().toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });

  const prompt = `Sei un esperto di scrittura professionale italiana. Devi scrivere una lettera di presentazione (cover letter) ECCELLENTE in italiano formale-professionale, basandoti sul CV del candidato e sull'offerta di lavoro.

CANDIDATO:
Nome: ${generated.personalInfo?.name ?? "Candidato"}
Titolo attuale: ${generated.personalInfo?.title ?? ""}
Sommario: ${generated.summary ?? ""}
Esperienze principali: ${JSON.stringify(generated.experience?.slice(0, 3) ?? [])}
Competenze: ${[...(generated.skills ?? []), ...(generated.tools ?? [])].join(", ")}
${extraInfo ? `Informazioni aggiuntive fornite dal candidato: ${extraInfo}` : ""}

OFFERTA DI LAVORO:
${jobPosting}
${companyName ? `Azienda: ${companyName}` : ""}
${roleTitle ? `Ruolo: ${roleTitle}` : ""}

REQUISITI DELLA LETTERA:
1. Scrivi in italiano formale ma non rigido, naturale e coinvolgente
2. Saluto: "Gentile Team ${companyName ?? "HR"}" oppure "Egregio/a Responsabile Selezione" se non c'è azienda
3. Paragrafo 1 (APERTURA): suscita interesse con una frase forte; indica il ruolo a cui si candida; mostra conoscenza dell'azienda
4. Paragrafo 2 (VALORE): collega 2-3 esperienze/competenze concrete del CV ai requisiti specifici dell'offerta; usa dati/risultati dove possibili
5. Paragrafo 3 (MOTIVAZIONE): mostra autenticità e motivazione genuina per questo ruolo e azienda
6. Paragrafo 4 (CHIUSURA): invito a colloquio, disponibilità, tono fiducioso ma non arrogante
7. Congedo: "Cordiali saluti"
8. NON inventare esperienze, numeri o aziende non presenti nel CV
9. Lunghezza: 220-320 parole totali nei paragrafi

RISPOSTA JSON (solo JSON, nessun testo extra):
{
  "subject": "Candidatura per il ruolo di [ruolo]",
  "salutation": "Gentile ...",
  "paragraphs": ["paragrafo 1", "paragrafo 2", "paragrafo 3", "paragrafo 4"],
  "closing": "Cordiali saluti,"
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 1200,
  });

  let raw = completion.choices[0].message.content ?? "{}";
  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  let letter: { subject: string; salutation: string; paragraphs: string[]; closing: string };
  try {
    letter = JSON.parse(raw);
  } catch {
    res.status(500).json({ error: "Errore nel parsing della risposta AI" });
    return;
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

// ── GET /api/cv/:userId/cover-letter/pdf — render cover letter PDF ─────
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
      res.status(404).json({ error: "Nessuna lettera trovata" });
      return;
    }
    letter = (row[0].cvJson as any).coverLetter as CoverLetterData;
  }

  const buffer = await renderToBuffer(
    React.createElement(CoverLetterPdfDocument, { letter })
  );

  const safeFileName = `lettera-${(letter.senderName ?? "cv").replace(/\s+/g, "-").toLowerCase()}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}"`);
  res.send(buffer);
});

// ── POST /api/cv/:userId/ats-score — AI ATS compatibility analysis ────
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

  const prompt = `Sei un esperto ATS (Applicant Tracking System) e recruiter HR senior. Analizza la compatibilità tra il CV e l'offerta di lavoro e fornisci un punteggio dettagliato.

CV DEL CANDIDATO:
${cvText}

OFFERTA DI LAVORO:
${jobPosting}

ISTRUZIONI:
1. Calcola un punteggio globale ATS da 0 a 100 (basato su keyword match, rilevanza dell'esperienza, competenze, istruzione, formato)
2. Valuta 5 sezioni specifiche con punteggio 0-100 e feedback breve (max 80 caratteri)
3. Elenca le keyword importanti presenti nell'offerta ma ASSENTI nel CV (max 8)
4. Elenca 2 punti di forza del CV rispetto all'offerta
5. Fornisci 3 consigli pratici e specifici per migliorare il punteggio (max 100 caratteri ciascuno)
6. Assegna un label: "Eccellente" (85+), "Buono" (70-84), "Sufficiente" (55-69), "Da migliorare" (<55)

RISPOSTA JSON puro (nessun testo extra):
{
  "score": 78,
  "label": "Buono",
  "sections": [
    {"name": "Riepilogo", "score": 80, "feedback": "Breve feedback specifico"},
    {"name": "Esperienza", "score": 72, "feedback": "Breve feedback specifico"},
    {"name": "Competenze", "score": 85, "feedback": "Breve feedback specifico"},
    {"name": "Parole chiave", "score": 65, "feedback": "Breve feedback specifico"},
    {"name": "Istruzione", "score": 90, "feedback": "Breve feedback specifico"}
  ],
  "missingKeywords": ["keyword1", "keyword2"],
  "strengths": ["Punto di forza 1", "Punto di forza 2"],
  "tips": ["Consiglio pratico 1", "Consiglio pratico 2", "Consiglio pratico 3"]
}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    max_tokens: 800,
  });

  let raw = completion.choices[0].message.content ?? "{}";
  raw = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  let result: any;
  try {
    result = JSON.parse(raw);
  } catch {
    res.status(500).json({ error: "Errore nel parsing della risposta AI" });
    return;
  }

  res.json({ success: true, result });
});

// ── DELETE /api/cv/:userId — delete stored CV ─────────────────────────
router.delete("/cv/:userId", async (req, res): Promise<void> => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) { res.status(400).json({ error: "ID non valido" }); return; }

  await db.update(usersTable)
    .set({ cvJson: null as any, cvText: null as any })
    .where(eq(usersTable.id, userId));

  res.json({ success: true });
});

export default router;
