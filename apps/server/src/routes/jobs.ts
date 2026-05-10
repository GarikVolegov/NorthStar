/**
 * GET /api/jobs — ricerca offerte di lavoro personalizzate
 *
 * Pipeline:
 *   1. Auth + lettura settore confermato / raccomandato dell'utente
 *   2. Ricerca offerte via Tavily (job boards italiani + LinkedIn)
 *   3. Parsing strutturato dei risultati (titolo, azienda, location, tag, url)
 *   4. Scoring di rilevanza basato su settore utente
 *   5. Cache in-memory per settore (TTL 30 min) — evita chiamate Tavily ridondanti
 *   6. Fallback: lista curata minima se Tavily non è disponibile
 */
import { Router } from "express";
import { db, usersTable, testSessionsTable, sectorsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "../lib/auth-jwt.js";
import { tavilySearch } from "../lib/tavily.js";
import { logger } from "../lib/logger.js";

const router = Router();

// ─── Cache in-memory per settore ─────────────────────────────────────────────
const JOB_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minuti

interface CachedJobs {
  jobs: JobCard[];
  fetchedAt: number;
}

const jobCache = new Map<string, CachedJobs>();

// ─── Tipo risultato ───────────────────────────────────────────────────────────

interface JobCard {
  id: string;
  title: string;
  company: string;
  location: string;
  type: string;
  sector: string;
  tags: string[];
  url: string;
  salary: string | null;
  matchScore: number;
  source: string;
  publishedDate?: string;
}

// ─── Keyword map settore → termini di ricerca ─────────────────────────────────
const SECTOR_SEARCH_TERMS: Record<string, string> = {
  informatica: "sviluppatore programmatore IT software",
  "digitale e tecnologia": "tech developer digitale",
  design: "designer UX UI grafico",
  marketing: "marketing digitale comunicazione",
  "dati e analisi": "data analyst data scientist SQL",
  management: "project manager business analyst",
  salute: "infermiere medico sanitario",
  istruzione: "insegnante educatore formatore",
  finanza: "analista finanziario banca contabile",
  commercio: "venditore sales commerciale",
  logistica: "logistica supply chain magazzino",
  ingegneria: "ingegnere tecnico industria",
  legale: "avvocato giurista legale",
  comunicazione: "giornalista copywriter content",
  "risorse umane": "HR recruiter risorse umane",
  architettura: "architetto progettista edilizia",
  scienze: "ricercatore biologo chimico",
  arti: "artista creativo illustratore",
  turismo: "turismo ospitalità hotel",
  agricoltura: "agronomo agricoltura ambientale",
};

function getSectorKeywords(sectorName: string | null): string {
  if (!sectorName) return "lavoro junior";
  const lower = sectorName.toLowerCase();
  for (const [key, terms] of Object.entries(SECTOR_SEARCH_TERMS)) {
    if (lower.includes(key)) return terms;
  }
  return sectorName;
}

// ─── Parser risultati Tavily ──────────────────────────────────────────────────

function extractCompany(title: string, content: string, url: string): string {
  // Tenta di estrarre il nome azienda dal titolo (pattern "Ruolo - Azienda")
  const dashParts = title.split(/\s[-–|]\s/);
  if (dashParts.length >= 2) {
    const candidate = dashParts[dashParts.length - 1].trim();
    if (candidate.length > 1 && candidate.length < 60) return candidate;
  }
  // Fallback: dominio URL
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const domain = hostname.split(".")[0];
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  } catch {
    return "Azienda";
  }
}

function extractLocation(content: string): string {
  const italianCities = [
    "Milano", "Roma", "Torino", "Napoli", "Bologna", "Firenze",
    "Venezia", "Genova", "Palermo", "Catania", "Bari", "Padova",
    "Verona", "Brescia", "Trieste", "Bergamo", "Modena", "Parma",
  ];
  for (const city of italianCities) {
    if (content.includes(city)) {
      if (/remoto|remote|smart.?working/i.test(content)) return `${city} (Ibrido)`;
      return city;
    }
  }
  if (/remoto|remote|full.?remote/i.test(content)) return "Remoto";
  return "Italia";
}

function extractSalary(content: string): string | null {
  const euroMatch = content.match(/(\d{2,3}[.,]?\d{0,3})\s*[€k].*?(\d{2,3}[.,]?\d{0,3})\s*[€k]/i);
  if (euroMatch) return `€${euroMatch[1]}k–€${euroMatch[2]}k`;
  const rangeMatch = content.match(/(\d{2,3})\s*[kK]\s*[-–]\s*(\d{2,3})\s*[kK]/);
  if (rangeMatch) return `${rangeMatch[1]}k–${rangeMatch[2]}k €`;
  return null;
}

function extractTags(title: string, content: string): string[] {
  const techKeywords = [
    "React", "Python", "TypeScript", "JavaScript", "SQL", "Node.js",
    "AWS", "Docker", "Kubernetes", "Java", "PHP", "Vue", "Angular",
    "Figma", "SEO", "CRM", "Excel", "PowerBI", "Tableau", "Agile",
    "Scrum", "SAP", "Salesforce", "Adobe", "Google Ads", "Meta Ads",
  ];
  const combined = `${title} ${content}`;
  const found = techKeywords.filter((kw) =>
    combined.toLowerCase().includes(kw.toLowerCase()),
  );
  if (found.length === 0) {
    const words = title.split(/\s+/).filter((w) => w.length > 4).slice(0, 3);
    return words;
  }
  return found.slice(0, 5);
}

function extractJobType(content: string): string {
  if (/part.?time/i.test(content)) return "part-time";
  if (/freelance|partita.?iva/i.test(content)) return "freelance";
  if (/stage|tirocinio|internship/i.test(content)) return "stage";
  if (/contratto a termine|tempo determinato/i.test(content)) return "determinato";
  return "full-time";
}

function scoreJob(tavilyScore: number, sectorName: string | null, title: string): number {
  let base = Math.round(tavilyScore * 80) + 20; // Tavily score 0-1 → 20-100
  if (sectorName) {
    const keywords = getSectorKeywords(sectorName).toLowerCase().split(" ");
    const titleLower = title.toLowerCase();
    const matches = keywords.filter((k) => titleLower.includes(k)).length;
    base = Math.min(98, base + matches * 5);
  }
  return Math.min(98, Math.max(35, base));
}

// ─── Fallback minimo se Tavily non disponibile ────────────────────────────────

const FALLBACK_JOBS: Omit<JobCard, "matchScore">[] = [
  { id: "f1", title: "Sviluppatore Junior", company: "TechStart Italia", location: "Remoto", type: "full-time", sector: "tech", tags: ["JavaScript", "React"], url: "https://www.linkedin.com/jobs/", salary: "22k–32k €", source: "fallback" },
  { id: "f2", title: "Analista Dati", company: "DataLab", location: "Milano", type: "full-time", sector: "dati", tags: ["SQL", "Python"], url: "https://www.linkedin.com/jobs/", salary: "28k–40k €", source: "fallback" },
  { id: "f3", title: "Marketing Specialist", company: "GrowthCo", location: "Roma (Ibrido)", type: "full-time", sector: "marketing", tags: ["SEO", "Google Ads"], url: "https://www.linkedin.com/jobs/", salary: "25k–35k €", source: "fallback" },
  { id: "f4", title: "Project Manager Junior", company: "ConsultPro", location: "Milano", type: "full-time", sector: "management", tags: ["Agile", "Scrum"], url: "https://www.linkedin.com/jobs/", salary: "30k–42k €", source: "fallback" },
  { id: "f5", title: "UX/UI Designer", company: "DesignHub", location: "Torino (Ibrido)", type: "full-time", sector: "design", tags: ["Figma", "Prototipazione"], url: "https://www.linkedin.com/jobs/", salary: "26k–38k €", source: "fallback" },
];

// ─── Route principale ─────────────────────────────────────────────────────────

router.get("/jobs", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;

  const [user] = await db
    .select({ name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ error: "Utente non trovato" });
    return;
  }

  // Determina il settore dell'utente
  const sessions = await db
    .select({
      confirmedSectorId: testSessionsTable.confirmedSectorId,
      recommendations: testSessionsTable.recommendations,
    })
    .from(testSessionsTable)
    .where(eq(testSessionsTable.userId, userId))
    .orderBy(desc(testSessionsTable.createdAt))
    .limit(1);

  const session = sessions[0];
  let sectorName: string | null = null;

  if (session?.confirmedSectorId) {
    const [sector] = await db
      .select({ name: sectorsTable.name })
      .from(sectorsTable)
      .where(eq(sectorsTable.id, session.confirmedSectorId));
    sectorName = sector?.name ?? null;
  } else if (session?.recommendations) {
    const recs = session.recommendations as Array<{ sectorId: number; sectorName: string; matchScore: number }>;
    sectorName = recs[0]?.sectorName ?? null;
  }

  // Controlla cache
  const cacheKey = sectorName ?? "__generic__";
  const cached = jobCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < JOB_CACHE_TTL_MS) {
    res.json({
      jobs: cached.jobs,
      basedOnSector: sectorName,
      totalCount: cached.jobs.length,
      source: "cache",
    });
    return;
  }

  // Cerca offerte via Tavily
  let jobs: JobCard[] = [];

  if (process.env.TAVILY_API_KEY) {
    try {
      const keywords = getSectorKeywords(sectorName);
      const query = `offerte lavoro ${keywords} Italia 2025 assunzione`;

      const response = await tavilySearch({
        query,
        searchDepth: "basic",
        topic: "general",
        maxResults: 10,
        includeAnswer: false,
        includeDomains: [
          "linkedin.com", "indeed.it", "infojobs.it",
          "monster.it", "jobrapido.com", "subito.it",
          "cercalavoro.net", "glassdoor.it",
        ],
      });

      jobs = response.results.map((r, idx) => {
        const title = r.title
          .replace(/\s*[-–|]\s*(LinkedIn|Indeed|InfoJobs|Glassdoor|Monster).*$/i, "")
          .trim();
        const company = extractCompany(r.title, r.content, r.url);
        return {
          id: `t${idx}`,
          title: title || `Posizione aperta ${idx + 1}`,
          company,
          location: extractLocation(r.content),
          type: extractJobType(r.content),
          sector: cacheKey,
          tags: extractTags(title, r.content),
          url: r.url,
          salary: extractSalary(r.content),
          matchScore: scoreJob(r.score, sectorName, title),
          source: (() => {
            try { return new URL(r.url).hostname.replace(/^www\./, ""); } catch { return "web"; }
          })(),
          publishedDate: r.published_date,
        };
      });

      // Ordina per match score
      jobs.sort((a, b) => b.matchScore - a.matchScore);

      logger.info({ userId, sectorName, count: jobs.length }, "[jobs] Tavily results fetched");
    } catch (err) {
      logger.warn({ err, sectorName }, "[jobs] Tavily search failed — using fallback");
    }
  }

  // Fallback se Tavily non disponibile o errore
  if (jobs.length === 0) {
    jobs = FALLBACK_JOBS.map((j, idx) => ({
      ...j,
      matchScore: 85 - idx * 8,
    }));
  }

  // Salva in cache
  jobCache.set(cacheKey, { jobs, fetchedAt: Date.now() });

  res.json({
    jobs,
    basedOnSector: sectorName,
    totalCount: jobs.length,
    source: process.env.TAVILY_API_KEY ? "tavily" : "fallback",
  });
});

// ─── POST /api/jobs/search — ricerca libera per keyword ──────────────────────

router.post("/jobs/search", authMiddleware, async (req, res): Promise<void> => {
  const { query } = req.body as { query?: string };

  if (!query?.trim() || query.length < 2) {
    res.status(400).json({ error: "query obbligatoria (min 2 caratteri)" });
    return;
  }

  if (!process.env.TAVILY_API_KEY) {
    res.json({ jobs: [], source: "unavailable", message: "Ricerca disabilitata — TAVILY_API_KEY non configurata" });
    return;
  }

  try {
    const response = await tavilySearch({
      query: `offerte lavoro ${query.slice(0, 100)} Italia`,
      searchDepth: "basic",
      maxResults: 8,
      includeDomains: ["linkedin.com", "indeed.it", "infojobs.it", "monster.it"],
    });

    const jobs: JobCard[] = response.results.map((r, idx) => {
      const title = r.title
        .replace(/\s*[-–|]\s*(LinkedIn|Indeed|InfoJobs|Glassdoor).*$/i, "")
        .trim();
      return {
        id: `s${idx}`,
        title: title || `Posizione aperta ${idx + 1}`,
        company: extractCompany(r.title, r.content, r.url),
        location: extractLocation(r.content),
        type: extractJobType(r.content),
        sector: "search",
        tags: extractTags(title, r.content),
        url: r.url,
        salary: extractSalary(r.content),
        matchScore: Math.round(r.score * 100),
        source: (() => {
          try { return new URL(r.url).hostname.replace(/^www\./, ""); } catch { return "web"; }
        })(),
        publishedDate: r.published_date,
      };
    });

    res.json({ jobs, totalCount: jobs.length, source: "tavily" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errore ricerca";
    res.status(502).json({ error: msg });
  }
});

export default router;
