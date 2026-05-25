/**
 * seed-rag.ts — popola rag_sources e job_posting_snapshots con dati di test.
 *
 * IDEMPOTENTE: usa INSERT ON CONFLICT DO NOTHING dove possibile.
 *
 * Eseguire con:
 *   pnpm --filter @workspace/scripts run seed:rag
 *
 * Cosa crea:
 *   - 5 rag_sources di riferimento (WEF, LinkedIn, ONET, news IT, news tech)
 *   - 30+ job_posting_snapshots con role title italiani/internazionali
 *     per gli ultimi 3 mesi → base dati per weak_signal_detector
 *   - 3 skill_cooccurrences di esempio
 */

import "dotenv/config";
import { eq, and } from "drizzle-orm";
import {
  db,
  ragSourcesTable,
  jobPostingSnapshotsTable,
  skillCooccurrencesTable,
} from "@workspace/db";

// ── 1. RAG Sources ────────────────────────────────────────────────────────────

const RAG_SOURCES = [
  {
    name:        "WEF Future of Jobs Report 2025",
    url:         "https://www.weforum.org/publications/the-future-of-jobs-report-2025/",
    sourceType:  "report" as const,
    format:      "pdf" as const,
    trustScore:  0.95,
    geography:   ["Global"],
    publishedAt: new Date("2025-01-15"),
  },
  {
    name:        "LinkedIn Skills on the Rise 2025",
    url:         "https://www.linkedin.com/business/learning/blog/learning-and-development/skills-on-the-rise",
    sourceType:  "report" as const,
    format:      "html" as const,
    trustScore:  0.90,
    geography:   ["IT", "EU", "Global"],
    publishedAt: new Date("2025-03-01"),
  },
  {
    name:        "ONET Online Occupational Data",
    url:         "https://services.onetcenter.org/ws/mnm/search",
    sourceType:  "report" as const,
    format:      "json" as const,
    trustScore:  0.88,
    geography:   ["US"],
    publishedAt: new Date("2025-01-01"),
  },
  {
    name:        "Il Sole 24 Ore — Lavoro & Carriere",
    url:         "https://www.ilsole24ore.com/rss/lavoro-e-carriere.xml",
    sourceType:  "news" as const,
    format:      "rss" as const,
    trustScore:  0.70,
    geography:   ["IT"],
    publishedAt: null,
  },
  {
    name:        "TechCrunch Jobs & HR",
    url:         "https://techcrunch.com/category/jobs-and-hr/feed/",
    sourceType:  "news" as const,
    format:      "rss" as const,
    trustScore:  0.65,
    geography:   ["US", "EU"],
    publishedAt: null,
  },
] as const;

// ── 2. Job Posting Snapshots ──────────────────────────────────────────────────

function period(monthsAgo: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const SNAPSHOTS: Array<{
  roleTitle:   string;
  count:       number;
  period:      string;
  geography:   string;
  topSkills:   string[];
  growthRate?: number;
  source:      string;
}> = [
  // Ruoli in forte crescita (candidati weak signal "new_job_title")
  { roleTitle: "AI Product Manager",         count: 45,  period: period(2), geography: "IT", topSkills: ["product management","LLM","Python","UX","agile"], source: "seed" },
  { roleTitle: "AI Product Manager",         count: 89,  period: period(1), geography: "IT", topSkills: ["product management","LLM","Python","UX","agile"], growthRate: 0.98, source: "seed" },
  { roleTitle: "AI Product Manager",         count: 162, period: period(0), geography: "IT", topSkills: ["product management","LLM","RAG","UX","agile"], growthRate: 0.82, source: "seed" },

  { roleTitle: "Prompt Engineer",            count: 28,  period: period(2), geography: "IT", topSkills: ["LLM","Python","NLP","fine-tuning"], source: "seed" },
  { roleTitle: "Prompt Engineer",            count: 67,  period: period(1), geography: "IT", topSkills: ["LLM","Python","NLP","ChatGPT","Claude"], growthRate: 1.39, source: "seed" },
  { roleTitle: "Prompt Engineer",            count: 134, period: period(0), geography: "IT", topSkills: ["LLM","RAG","Python","agentic AI"], growthRate: 1.00, source: "seed" },

  { roleTitle: "AI Safety Engineer",         count: 8,   period: period(2), geography: "EU", topSkills: ["ML","safety testing","red teaming"], source: "seed" },
  { roleTitle: "AI Safety Engineer",         count: 19,  period: period(1), geography: "EU", topSkills: ["ML","alignment","safety testing"], growthRate: 1.37, source: "seed" },
  { roleTitle: "AI Safety Engineer",         count: 48,  period: period(0), geography: "EU", topSkills: ["ML","alignment","red teaming","RLHF"], growthRate: 1.53, source: "seed" },

  { roleTitle: "MLOps Engineer",             count: 67,  period: period(2), geography: "IT", topSkills: ["Python","Kubernetes","MLflow","AWS","Docker"], source: "seed" },
  { roleTitle: "MLOps Engineer",             count: 98,  period: period(1), geography: "IT", topSkills: ["Python","Kubernetes","MLflow","Azure ML"], growthRate: 0.46, source: "seed" },
  { roleTitle: "MLOps Engineer",             count: 142, period: period(0), geography: "IT", topSkills: ["Python","Kubernetes","MLflow","AWS","CI/CD"], growthRate: 0.45, source: "seed" },

  { roleTitle: "Data Engineer",              count: 220, period: period(2), geography: "IT", topSkills: ["Python","SQL","Spark","dbt","Airflow"], source: "seed" },
  { roleTitle: "Data Engineer",              count: 267, period: period(1), geography: "IT", topSkills: ["Python","SQL","Spark","dbt","Kafka"], growthRate: 0.21, source: "seed" },
  { roleTitle: "Data Engineer",              count: 301, period: period(0), geography: "IT", topSkills: ["Python","SQL","dbt","Iceberg","Airflow"], growthRate: 0.13, source: "seed" },

  // Ruoli emergenti internazionali
  { roleTitle: "LLMOps Engineer",            count: 5,   period: period(2), geography: "EU", topSkills: ["LLM","Python","vector DB","RAG"], source: "seed" },
  { roleTitle: "LLMOps Engineer",            count: 22,  period: period(1), geography: "EU", topSkills: ["LLM","Python","pgvector","LangChain"], growthRate: 3.40, source: "seed" },
  { roleTitle: "LLMOps Engineer",            count: 61,  period: period(0), geography: "EU", topSkills: ["LLM","RAG","pgvector","agentic AI"], growthRate: 1.77, source: "seed" },

  { roleTitle: "Sustainability Tech Lead",   count: 12,  period: period(2), geography: "EU", topSkills: ["ESG","carbon accounting","Python","reporting"], source: "seed" },
  { roleTitle: "Sustainability Tech Lead",   count: 29,  period: period(1), geography: "EU", topSkills: ["ESG","CSRD","carbon footprint","data engineering"], growthRate: 1.42, source: "seed" },
  { roleTitle: "Sustainability Tech Lead",   count: 58,  period: period(0), geography: "EU", topSkills: ["ESG","CSRD","AI sustainability","reporting"], growthRate: 1.00, source: "seed" },

  // Ruoli stabili (non candidati a weak signal)
  { roleTitle: "Software Developer",         count: 1850, period: period(2), geography: "IT", topSkills: ["JavaScript","React","TypeScript","Node.js","SQL"], source: "seed" },
  { roleTitle: "Software Developer",         count: 1920, period: period(1), geography: "IT", topSkills: ["TypeScript","React","Node.js","Docker"], growthRate: 0.04, source: "seed" },
  { roleTitle: "Software Developer",         count: 1978, period: period(0), geography: "IT", topSkills: ["TypeScript","React","Node.js","PostgreSQL"], growthRate: 0.03, source: "seed" },

  { roleTitle: "UX Designer",               count: 340,  period: period(2), geography: "IT", topSkills: ["Figma","ricerca utenti","prototyping","design thinking"], source: "seed" },
  { roleTitle: "UX Designer",               count: 356,  period: period(1), geography: "IT", topSkills: ["Figma","AI-assisted design","ricerca utenti"], growthRate: 0.05, source: "seed" },
  { roleTitle: "UX Designer",               count: 371,  period: period(0), geography: "IT", topSkills: ["Figma","AI-assisted design","accessibilità"], growthRate: 0.04, source: "seed" },
];

// ── 3. Skill cooccurrences di esempio ────────────────────────────────────────

const COOCCURRENCES = [
  { skillName: "Python",    coSkillName: "SQL",          frequency: 1240, frequencyRate: 0.82, period: period(0), source: "seed" },
  { skillName: "Python",    coSkillName: "Docker",       frequency: 890,  frequencyRate: 0.59, period: period(0), source: "seed" },
  { skillName: "Python",    coSkillName: "MLflow",       frequency: 340,  frequencyRate: 0.23, period: period(0), source: "seed" },
  { skillName: "React",     coSkillName: "TypeScript",   frequency: 1560, frequencyRate: 0.91, period: period(0), source: "seed" },
  { skillName: "React",     coSkillName: "Node.js",      frequency: 1120, frequencyRate: 0.65, period: period(0), source: "seed" },
  { skillName: "LLM",       coSkillName: "RAG",          frequency: 280,  frequencyRate: 0.78, period: period(0), source: "seed" },
  { skillName: "LLM",       coSkillName: "Python",       frequency: 310,  frequencyRate: 0.86, period: period(0), source: "seed" },
  { skillName: "dbt",       coSkillName: "Airflow",      frequency: 190,  frequencyRate: 0.71, period: period(0), source: "seed" },
  { skillName: "dbt",       coSkillName: "SQL",          frequency: 220,  frequencyRate: 0.82, period: period(0), source: "seed" },
  { skillName: "Kubernetes",coSkillName: "Docker",       frequency: 680,  frequencyRate: 0.94, period: period(0), source: "seed" },
  { skillName: "ESG",       coSkillName: "CSRD",         frequency: 85,   frequencyRate: 0.67, period: period(0), source: "seed" },
];

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 seed-rag — avvio");

  // 1. RAG sources
  console.log("\n📚 Inserimento rag_sources...");
  let sourcesInserted = 0;
  for (const src of RAG_SOURCES) {
    const existing = await db
      .select({ id: ragSourcesTable.id })
      .from(ragSourcesTable)
      .where(eq(ragSourcesTable.name, src.name))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(ragSourcesTable).values({
        name:        src.name,
        url:         src.url,
        sourceType:  src.sourceType,
        format:      src.format,
        trustScore:  src.trustScore,
        geography:   [...src.geography],
        publishedAt: src.publishedAt ?? undefined,
      });
      sourcesInserted++;
      console.log(`  ✓ ${src.name}`);
    } else {
      console.log(`  ○ skip (esiste già): ${src.name}`);
    }
  }
  console.log(`  Inseriti: ${sourcesInserted}/${RAG_SOURCES.length}`);

  // 2. Job posting snapshots
  console.log("\n📊 Inserimento job_posting_snapshots...");
  let snapshotsInserted = 0;
  let snapshotsSkipped  = 0;

  for (const snap of SNAPSHOTS) {
    try {
      const existing = await db
        .select({ id: jobPostingSnapshotsTable.id })
        .from(jobPostingSnapshotsTable)
        .where(
          and(
            eq(jobPostingSnapshotsTable.roleTitle, snap.roleTitle),
            eq(jobPostingSnapshotsTable.period,    snap.period),
            eq(jobPostingSnapshotsTable.geography, snap.geography),
            eq(jobPostingSnapshotsTable.source,    snap.source),
          ),
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(jobPostingSnapshotsTable).values({
          roleTitle:  snap.roleTitle,
          count:      snap.count,
          period:     snap.period,
          geography:  snap.geography,
          topSkills:  snap.topSkills,
          growthRate: snap.growthRate,
          source:     snap.source,
        });
        snapshotsInserted++;
      } else {
        snapshotsSkipped++;
      }
    } catch {
      // UNIQUE constraint → già esistente
      snapshotsSkipped++;
    }
  }
  console.log(`  Inseriti: ${snapshotsInserted}, saltati: ${snapshotsSkipped}`);

  // 3. Skill cooccurrences
  console.log("\n🔗 Inserimento skill_cooccurrences...");
  let coInserted = 0;
  for (const co of COOCCURRENCES) {
    try {
      await db.insert(skillCooccurrencesTable).values({
        skillName:     co.skillName,
        coSkillName:   co.coSkillName,
        frequency:     co.frequency,
        frequencyRate: co.frequencyRate,
        period:        co.period,
        source:        co.source,
      });
      coInserted++;
    } catch {
      // UNIQUE constraint → già esistente
    }
  }
  console.log(`  Inseriti: ${coInserted}/${COOCCURRENCES.length}`);

  console.log("\n✅ seed-rag completato");
  console.log("   Prossimo passo: pnpm --filter @workspace/scripts run weak-signal-detect");
  process.exit(0);
}

main().catch((e) => {
  console.error("❌ seed-rag fallito:", e);
  process.exit(1);
});
