import { Router } from "express";
import { eq } from "drizzle-orm";
import { getLLM } from "@workspace/ai-server/llm/client";
import { requireAuth } from "../middleware/auth";
import { requireFeature } from "../middleware/check-feature";
import {
  db,
  userProfileSettingsTable,
  usersTable,
  sectorsTable,
} from "@workspace/db";
import {
  sendOptionalReadFallback,
  sendPersistenceWriteError,
} from "../lib/persistence";
import { getRequestBody } from "../lib/request-context";
import { asPlainRecord } from "../lib/type-guards";

const router = Router();

type CvProfileRow = Pick<
  typeof userProfileSettingsTable.$inferSelect,
  "cvText" | "cvJson" | "userId" | "updatedAt"
>;

// ── Generated CV shape (mirrors apps/web GeneratedCv) ──────────────────────────

interface CvExperience {
  id: string;
  title: string;
  company: string;
  period: string;
  location?: string | undefined;
  description: string;
  skills: string[];
}
interface CvEducation {
  id: string;
  degree: string;
  institution: string;
  year: string;
  description?: string | undefined;
}
interface GeneratedCv {
  personalInfo: {
    name: string;
    title?: string | undefined;
    email?: string | undefined;
    phone?: string | undefined;
    location?: string | undefined;
    linkedin?: string | undefined;
    website?: string | undefined;
  };
  summary: string;
  experience: CvExperience[];
  education: CvEducation[];
  skills: string[];
  tools: string[];
  languages: Array<{ language: string; level: string }>;
  certifications: string[];
  targetRole?: string | undefined;
  template: string;
  generatedAt: string;
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}
function strArray(value: unknown, max = 20): string[] {
  return Array.isArray(value)
    ? value.filter((x): x is string => typeof x === "string").map((s) => s.trim()).filter(Boolean).slice(0, max)
    : [];
}
function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function makeCvMeta(profile: CvProfileRow | null, source: "upload" | "generated") {
  if (!profile?.cvText && !profile?.cvJson) return null;
  const cvJson = asPlainRecord(profile.cvJson);
  const template = typeof cvJson.template === "string" ? cvJson.template : undefined;

  return {
    id: `cv-${profile.userId}`,
    filename: source === "generated" ? "CV Generato.pdf" : "CV Caricato",
    uploadedAt: profile.updatedAt?.toISOString() ?? new Date().toISOString(),
    source,
    hasPdf: source === "generated",
    template,
  };
}

async function upsertProfileSettings(
  userId: number,
  values: Partial<typeof userProfileSettingsTable.$inferInsert>,
) {
  const now = new Date();
  await db
    .insert(userProfileSettingsTable)
    .values({ userId, ...values, updatedAt: now })
    .onConflictDoUpdate({
      target: userProfileSettingsTable.userId,
      set: { ...values, updatedAt: now },
    });
}

// ── AI CV generation ───────────────────────────────────────────────────────────

function extractJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const cleaned = raw.replace(/```json\s*|```/g, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    const parsed: unknown = JSON.parse(cleaned.slice(start, end + 1));
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function normalizeExperience(value: unknown): CvExperience[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "object" && item !== null ? (item as Record<string, unknown>) : null))
    .filter((x): x is Record<string, unknown> => x !== null)
    .slice(0, 8)
    .map((e) => ({
      id: uid(),
      title: readString(e.title),
      company: readString(e.company),
      period: readString(e.period),
      location: readString(e.location) || undefined,
      description: readString(e.description),
      skills: strArray(e.skills, 12),
    }))
    .filter((e) => e.title || e.company || e.description);
}

function normalizeEducation(value: unknown): CvEducation[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "object" && item !== null ? (item as Record<string, unknown>) : null))
    .filter((x): x is Record<string, unknown> => x !== null)
    .slice(0, 6)
    .map((e) => ({
      id: uid(),
      degree: readString(e.degree),
      institution: readString(e.institution),
      year: readString(e.year),
      description: readString(e.description) || undefined,
    }))
    .filter((e) => e.degree || e.institution);
}

function normalizeLanguages(value: unknown): Array<{ language: string; level: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "object" && item !== null ? (item as Record<string, unknown>) : null))
    .filter((x): x is Record<string, unknown> => x !== null)
    .slice(0, 6)
    .map((l) => ({ language: readString(l.language), level: readString(l.level) }))
    .filter((l) => l.language);
}

/**
 * Builds a real CV from the user's NorthStar data (profile, target sector, and an
 * uploaded CV text if present) via a single LLM call. Falls back to a scaffold
 * from the known data if the LLM is unavailable — generation never hard-fails.
 */
async function buildGeneratedCv(userId: number, template: string): Promise<GeneratedCv> {
  const [user] = await db
    .select({ name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  const [profile] = await db
    .select({
      bio: userProfileSettingsTable.bio,
      city: userProfileSettingsTable.city,
      sectorId: userProfileSettingsTable.sectorId,
      cvText: userProfileSettingsTable.cvText,
    })
    .from(userProfileSettingsTable)
    .where(eq(userProfileSettingsTable.userId, userId))
    .limit(1);

  let sectorName = "";
  let sectorSkills: string[] = [];
  if (profile?.sectorId) {
    const [sector] = await db
      .select({ name: sectorsTable.name, skills: sectorsTable.skills })
      .from(sectorsTable)
      .where(eq(sectorsTable.id, profile.sectorId))
      .limit(1);
    sectorName = sector?.name ?? "";
    sectorSkills = Array.isArray(sector?.skills) ? (sector.skills as string[]) : [];
  }

  const cv: GeneratedCv = {
    personalInfo: {
      name: user?.name ?? "Il tuo nome",
      email: user?.email ?? "",
      location: profile?.city ?? undefined,
      title: sectorName || undefined,
    },
    summary: "",
    experience: [],
    education: [],
    skills: sectorSkills.slice(0, 8),
    tools: [],
    languages: [{ language: "Italiano", level: "Madrelingua" }],
    certifications: [],
    targetRole: sectorName || undefined,
    template,
    generatedAt: new Date().toISOString(),
  };

  try {
    const cvSection = profile?.cvText
      ? `\nTesto del CV caricato (estrai da qui esperienze e formazione REALI):\n${profile.cvText.slice(0, 3000)}`
      : "";
    const prompt = `Sei un career coach esperto. Crea un CV professionale in italiano per ${cv.personalInfo.name}.
Dati noti:
- Settore/ruolo target: ${sectorName || "non specificato"}
- Competenze chiave del settore: ${sectorSkills.slice(0, 15).join(", ") || "n/d"}
- Bio: ${profile?.bio ?? "n/d"}
- Città: ${profile?.city ?? "n/d"}${cvSection}

Istruzioni:
- Scrivi un "summary" professionale di 3-4 righe in prima persona, convincente e orientato al ruolo target.
- Proponi un "title" professionale e un "targetRole".
- Cura "skills" e "tools" pertinenti al settore (no duplicati).
- Se è presente il testo del CV, estrai "experience" ed "education" reali da esso; altrimenti lasciali come array vuoti (li compilerà l'utente).
Rispondi SOLO con JSON valido in questo formato esatto:
{"title":"","summary":"","targetRole":"","skills":[],"tools":[],"certifications":[],"languages":[{"language":"","level":""}],"experience":[{"title":"","company":"","period":"","location":"","description":"","skills":[]}],"education":[{"degree":"","institution":"","year":"","description":""}]}`;

    const raw = await getLLM().chatOnce([{ role: "system", content: prompt }], {
      temperature: 0.5,
      maxTokens: 1300,
    });
    const json = extractJsonObject(raw);
    if (json) {
      cv.personalInfo.title = readString(json.title, cv.personalInfo.title ?? "") || cv.personalInfo.title;
      cv.summary = readString(json.summary, cv.summary);
      const target = readString(json.targetRole);
      if (target) cv.targetRole = target;
      const skills = strArray(json.skills, 14);
      if (skills.length) cv.skills = skills;
      cv.tools = strArray(json.tools, 14);
      cv.certifications = strArray(json.certifications, 8);
      cv.experience = normalizeExperience(json.experience);
      cv.education = normalizeEducation(json.education);
      const langs = normalizeLanguages(json.languages);
      if (langs.length) cv.languages = langs;
    }
  } catch {
    /* fallback: the scaffold above is already a valid CV to edit */
  }

  return cv;
}

// ── Print-ready HTML (no PDF dependency; the browser saves it as PDF) ──────────

function esc(value: unknown): string {
  return readString(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const TEMPLATE_ACCENT: Record<string, string> = {
  classic: "#2f6f4f",
  minimal: "#374151",
  bold: "#d2691e",
};

function renderCvHtml(cvJson: Record<string, unknown>, template: string): string {
  const cv = cvJson as unknown as GeneratedCv;
  const pi = cv.personalInfo ?? { name: "" };
  const accent = TEMPLATE_ACCENT[template] ?? TEMPLATE_ACCENT.classic;

  const contact = [pi.email, pi.phone, pi.location, pi.linkedin, pi.website]
    .filter(Boolean)
    .map((c) => esc(c))
    .join(" · ");

  const experience = (cv.experience ?? [])
    .map(
      (e) => `
      <div class="item">
        <div class="item-head">
          <span class="item-title">${esc(e.title)}${e.company ? ` · ${esc(e.company)}` : ""}</span>
          <span class="item-period">${esc(e.period)}</span>
        </div>
        ${e.location ? `<div class="item-sub">${esc(e.location)}</div>` : ""}
        ${e.description ? `<p class="item-desc">${esc(e.description)}</p>` : ""}
        ${e.skills?.length ? `<div class="tags">${e.skills.map((s) => `<span class="tag">${esc(s)}</span>`).join("")}</div>` : ""}
      </div>`,
    )
    .join("");

  const education = (cv.education ?? [])
    .map(
      (e) => `
      <div class="item">
        <div class="item-head">
          <span class="item-title">${esc(e.degree)}${e.institution ? ` · ${esc(e.institution)}` : ""}</span>
          <span class="item-period">${esc(e.year)}</span>
        </div>
        ${e.description ? `<p class="item-desc">${esc(e.description)}</p>` : ""}
      </div>`,
    )
    .join("");

  const chips = (items: string[] | undefined) =>
    (items ?? []).map((s) => `<span class="tag">${esc(s)}</span>`).join("");

  const languages = (cv.languages ?? [])
    .map((l) => `${esc(l.language)}${l.level ? ` (${esc(l.level)})` : ""}`)
    .join(" · ");

  const section = (title: string, body: string) =>
    body.trim() ? `<section><h2>${title}</h2>${body}</section>` : "";

  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8" />
<title>CV — ${esc(pi.name)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; color: #1f2937; margin: 0; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.5; }
  header { border-bottom: 3px solid ${accent}; padding-bottom: 12px; margin-bottom: 20px; }
  h1 { margin: 0 0 4px; font-size: 28px; color: ${accent}; }
  .title { font-size: 15px; color: #4b5563; font-weight: 600; }
  .contact { font-size: 12px; color: #6b7280; margin-top: 6px; }
  section { margin-bottom: 18px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .06em; color: ${accent}; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin: 0 0 10px; }
  p { margin: 0 0 6px; }
  .summary { font-size: 13.5px; }
  .item { margin-bottom: 12px; }
  .item-head { display: flex; justify-content: space-between; gap: 12px; }
  .item-title { font-weight: 600; font-size: 13.5px; }
  .item-period { font-size: 12px; color: #6b7280; white-space: nowrap; }
  .item-sub { font-size: 12px; color: #6b7280; }
  .item-desc { font-size: 13px; }
  .tags { margin-top: 4px; }
  .tag { display: inline-block; background: #f3f4f6; color: #374151; font-size: 11px; padding: 2px 8px; border-radius: 10px; margin: 2px 4px 2px 0; }
  @media print { body { padding: 0; } @page { margin: 16mm; } }
</style></head>
<body>
  <header>
    <h1>${esc(pi.name)}</h1>
    ${pi.title ? `<div class="title">${esc(pi.title)}</div>` : ""}
    ${contact ? `<div class="contact">${contact}</div>` : ""}
  </header>
  ${cv.summary ? `<section><h2>Profilo</h2><p class="summary">${esc(cv.summary)}</p></section>` : ""}
  ${section("Esperienza", experience)}
  ${section("Formazione", education)}
  ${section("Competenze", chips(cv.skills))}
  ${section("Strumenti", chips(cv.tools))}
  ${section("Certificazioni", chips(cv.certifications))}
  ${section("Lingue", languages ? `<p>${languages}</p>` : "")}
  <script>window.onload = function () { setTimeout(function () { window.print(); }, 250); };</script>
</body></html>`;
}

// ── GET /api/cv/mine ───────────────────────────────────────────────────────────
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const [profile] = await db
      .select({
        cvText: userProfileSettingsTable.cvText,
        cvJson: userProfileSettingsTable.cvJson,
        userId: userProfileSettingsTable.userId,
        updatedAt: userProfileSettingsTable.updatedAt,
      })
      .from(userProfileSettingsTable)
      .where(eq(userProfileSettingsTable.userId, req.user!.id))
      .limit(1);

    const cvs = [];
    if (profile?.cvJson) cvs.push(makeCvMeta(profile, "generated"));
    else if (profile?.cvText) cvs.push(makeCvMeta(profile, "upload"));

    res.json({ cvs: cvs.filter(Boolean) });
  } catch (err) {
    req.log?.error?.({ err }, "cv mine get error");
    if (sendOptionalReadFallback(req, res, err, "cv.mine", { cvs: [] })) return;
    res.status(500).json({ error: "Errore nel caricamento CV" });
  }
});

// ── POST /api/cv/mine/upload ───────────────────────────────────────────────────
router.post("/mine/upload", requireAuth, async (req, res) => {
  try {
    const body = asPlainRecord(getRequestBody(req));
    const fileDataUrl = readString(body.fileDataUrl);
    const filename = readString(body.filename, "CV");
    const mimeType = readString(body.mimeType);

    if (!fileDataUrl) {
      res.status(400).json({ error: "fileDataUrl richiesto" });
      return;
    }
    if (fileDataUrl.length > 3_000_000) {
      res.status(400).json({ error: "File troppo grande (max ~2 MB)" });
      return;
    }

    let cvText = "";
    if (mimeType === "text/plain") {
      const base64 = fileDataUrl.split(",")[1] ?? fileDataUrl;
      cvText = Buffer.from(base64, "base64").toString("utf-8");
    } else {
      cvText = `[PDF caricato: ${filename}]`;
    }

    await upsertProfileSettings(req.user!.id, { cvText, cvJson: null });

    res.json({
      success: true,
      cvs: [
        {
          id: `cv-${req.user!.id}`,
          filename,
          uploadedAt: new Date().toISOString(),
          source: "upload",
          hasPdf: false,
        },
      ],
    });
  } catch (err) {
    req.log?.error?.({ err }, "cv upload error");
    if (sendPersistenceWriteError(req, res, err, "cv.upload")) return;
    res.status(500).json({ error: "Errore upload CV" });
  }
});

// ── POST /api/cv/mine/generate ─────────────────────────────────────────────────
router.post("/mine/generate", requireAuth, async (req, res) => {
  try {
    const body = asPlainRecord(getRequestBody(req));
    const template = readString(body.template, "classic");
    const userId = req.user!.id;

    const generated = await buildGeneratedCv(userId, template);
    await upsertProfileSettings(userId, { cvJson: generated });

    res.json({
      success: true,
      generated,
      cvs: [
        {
          id: `cv-${userId}`,
          filename: "CV Generato.pdf",
          uploadedAt: new Date().toISOString(),
          source: "generated",
          hasPdf: true,
          template,
        },
      ],
    });
  } catch (err) {
    req.log?.error?.({ err }, "cv generate error");
    if (sendPersistenceWriteError(req, res, err, "cv.generate")) return;
    res.status(500).json({ error: "Errore generazione CV" });
  }
});

// ── PATCH /api/cv/mine/generated ───────────────────────────────────────────────
router.patch("/mine/generated", requireAuth, async (req, res) => {
  try {
    const body = asPlainRecord(getRequestBody(req));
    const generatedInput = body.generated;
    const generated = asPlainRecord(generatedInput);
    if (
      !generatedInput ||
      typeof generatedInput !== "object" ||
      Array.isArray(generatedInput)
    ) {
      res.status(400).json({ error: "generated richiesto" });
      return;
    }

    await upsertProfileSettings(req.user!.id, { cvJson: generated });

    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "cv generated update error");
    if (sendPersistenceWriteError(req, res, err, "cv.generated.update")) return;
    res.status(500).json({ error: "Errore salvataggio CV" });
  }
});

// ── DELETE /api/cv/mine ────────────────────────────────────────────────────────
router.delete("/mine", requireAuth, async (req, res) => {
  try {
    await upsertProfileSettings(req.user!.id, { cvText: null, cvJson: null });
    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "cv delete error");
    if (sendPersistenceWriteError(req, res, err, "cv.delete")) return;
    res.status(500).json({ error: "Errore eliminazione CV" });
  }
});

// ── GET /api/cv/:userId/pdf — print-ready CV (Pro gate) ────────────────────────
// Registered before "/:userId" so the more specific path wins.
router.get(
  "/:userId/pdf",
  requireAuth,
  requireFeature("export_plan_pdf", "json"),
  async (req, res) => {
    const targetId = parseInt(req.params.userId ?? "", 10);
    if (!Number.isFinite(targetId) || targetId !== req.user!.id) {
      res.status(403).json({ error: "Non autorizzato" });
      return;
    }
    try {
      const [profile] = await db
        .select({ cvJson: userProfileSettingsTable.cvJson })
        .from(userProfileSettingsTable)
        .where(eq(userProfileSettingsTable.userId, req.user!.id))
        .limit(1);

      if (!profile?.cvJson) {
        res.status(404).json({ error: "Nessun CV generato da esportare" });
        return;
      }
      const template = readString(req.query.template, "classic");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(renderCvHtml(asPlainRecord(profile.cvJson), template));
    } catch (err) {
      req.log?.error?.({ err }, "cv pdf export error");
      res.status(500).json({ error: "Errore nell'esportazione del CV" });
    }
  },
);

// ── GET /api/cv/:userId — generated CV data (for the editor) ────────────────────
router.get("/:userId", requireAuth, async (req, res) => {
  const targetId = parseInt(req.params.userId ?? "", 10);
  if (!Number.isFinite(targetId) || targetId !== req.user!.id) {
    res.status(403).json({ error: "Non autorizzato" });
    return;
  }
  try {
    const [profile] = await db
      .select({ cvJson: userProfileSettingsTable.cvJson })
      .from(userProfileSettingsTable)
      .where(eq(userProfileSettingsTable.userId, req.user!.id))
      .limit(1);

    const generated = profile?.cvJson ? asPlainRecord(profile.cvJson) : null;
    res.json({ cvData: { generated } });
  } catch (err) {
    req.log?.error?.({ err }, "cv detail get error");
    if (sendOptionalReadFallback(req, res, err, "cv.detail", { cvData: { generated: null } }))
      return;
    res.status(500).json({ error: "Errore nel caricamento CV" });
  }
});

export default router;
