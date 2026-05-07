import { Router } from "express";
import { db, usersTable, testSessionsTable, sectorsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "../lib/auth-jwt.js";

const router = Router();

const MOCK_JOBS = [
  { id: 1, title: "UX Designer", company: "Foobar Studio", location: "Milano (Ibrido)", type: "full-time", sector: "design", tags: ["Figma", "User Research", "Prototyping"], url: "#", salary: "35k–48k €" },
  { id: 2, title: "Data Analyst Junior", company: "DataCo Italia", location: "Roma (Remoto)", type: "full-time", sector: "dati", tags: ["SQL", "Python", "PowerBI"], url: "#", salary: "28k–38k €" },
  { id: 3, title: "Digital Marketing Specialist", company: "GrowthHub", location: "Torino (Ibrido)", type: "full-time", sector: "marketing", tags: ["SEO", "Meta Ads", "Analytics"], url: "#", salary: "30k–42k €" },
  { id: 4, title: "Frontend Developer React", company: "TechStart", location: "Remoto", type: "full-time", sector: "tech", tags: ["React", "TypeScript", "Tailwind"], url: "#", salary: "40k–58k €" },
  { id: 5, title: "Project Manager Jr", company: "ConsultingBlu", location: "Milano", type: "full-time", sector: "management", tags: ["Agile", "Jira", "Stakeholder management"], url: "#", salary: "32k–44k €" },
  { id: 6, title: "Infermiere Specializzato", company: "Ospedale San Raffaele", location: "Milano", type: "full-time", sector: "salute", tags: ["Assistenza", "Reparto", "Cure intensive"], url: "#", salary: "29k–38k €" },
  { id: 7, title: "Grafico / Art Director", company: "Agenzia Creativa Srl", location: "Napoli (Ibrido)", type: "full-time", sector: "design", tags: ["Adobe CC", "Branding", "Layout"], url: "#", salary: "26k–36k €" },
  { id: 8, title: "Educatore Scolastico", company: "Istituto Comprensivo", location: "Bologna", type: "full-time", sector: "istruzione", tags: ["Pedagogia", "Inclusione", "Comunicazione"], url: "#", salary: "24k–30k €" },
  { id: 9, title: "Business Developer", company: "SalesPro Italia", location: "Remoto", type: "full-time", sector: "vendite", tags: ["CRM", "B2B", "Negoziazione"], url: "#", salary: "30k–50k € + bonus" },
  { id: 10, title: "Consulente Finanziario Jr", company: "Banca Generica SpA", location: "Roma", type: "full-time", sector: "finanza", tags: ["Analisi finanziaria", "Excel", "Consulenza"], url: "#", salary: "28k–40k €" },
  { id: 11, title: "Logista / Supply Chain", company: "LogiGroup", location: "Genova", type: "full-time", sector: "logistica", tags: ["WMS", "Pianificazione", "Fornitori"], url: "#", salary: "27k–36k €" },
  { id: 12, title: "Social Media Manager", company: "Brand Agency", location: "Remoto", type: "freelance", sector: "marketing", tags: ["Instagram", "TikTok", "Content Strategy"], url: "#", salary: "1.5k–3k €/mese" },
];

const SECTOR_KEYWORD_MAP: Record<string, string[]> = {
  tech: ["informatica", "digitale", "software", "programmazione", "tecnologia"],
  design: ["design", "comunicazione visiva", "arte", "grafica", "architettura"],
  marketing: ["marketing", "comunicazione", "media", "pubblicità", "social"],
  dati: ["dati", "statistica", "ricerca", "analisi", "matematica"],
  management: ["gestione", "organizzazione", "leadership", "business", "economia"],
  salute: ["salute", "medicina", "benessere", "biologia", "farmacia"],
  istruzione: ["istruzione", "pedagogia", "formazione", "educazione", "psicologia"],
  finanza: ["finanza", "economia", "banca", "contabilità", "investimenti"],
  vendite: ["vendite", "commercio", "imprenditoria", "negoziazione"],
  logistica: ["logistica", "produzione", "ingegneria", "manifattura"],
};

function scoreJobForUser(job: typeof MOCK_JOBS[0], sectorName: string | null): number {
  if (!sectorName) return Math.floor(Math.random() * 40) + 40;
  const lowerSector = sectorName.toLowerCase();
  const keywords = SECTOR_KEYWORD_MAP[job.sector] ?? [];
  const matches = keywords.filter((k) => lowerSector.includes(k)).length;
  if (job.sector === "tech" && (lowerSector.includes("digit") || lowerSector.includes("informat"))) return 88 + Math.floor(Math.random() * 10);
  if (matches > 0) return Math.min(95, 65 + matches * 10 + Math.floor(Math.random() * 10));
  return Math.floor(Math.random() * 35) + 35;
}

router.get("/jobs", authMiddleware, async (req, res): Promise<void> => {
  const userId = res.locals.userId as number;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  const sessions = await db.select().from(testSessionsTable)
    .where(eq(testSessionsTable.userId, userId))
    .orderBy(desc(testSessionsTable.createdAt));

  const confirmedSectorId = sessions.find((s) => s.confirmedSectorId)?.confirmedSectorId;
  let sectorName: string | null = null;

  if (confirmedSectorId) {
    const [sector] = await db.select().from(sectorsTable).where(eq(sectorsTable.id, confirmedSectorId));
    sectorName = sector?.name ?? null;
  } else if (sessions.length > 0 && sessions[0].recommendations) {
    const recs = sessions[0].recommendations as Array<{ sectorId: number; sectorName: string; matchScore: number }>;
    sectorName = recs[0]?.sectorName ?? null;
  }

  const scoredJobs = MOCK_JOBS.map((job) => ({
    ...job,
    matchScore: scoreJobForUser(job, sectorName),
  })).sort((a, b) => b.matchScore - a.matchScore);

  res.json({
    jobs: scoredJobs,
    basedOnSector: sectorName,
    totalCount: scoredJobs.length,
  });
});

export default router;
