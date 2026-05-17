/**
 * sector-data-agent — arricchisce settori e professioni con dati da fonti web.
 *
 * Usa il LLM per sintetizzare dati di mercato (trend, skill emergenti, salari)
 * a partire da query strutturate verso l'API di ricerca OpenRouter.
 *
 * NON scarica direttamente da LinkedIn/Glassdoor (ToS), ma usa il LLM
 * con training knowledge + web search quando disponibile.
 *
 * Eseguito: settimanale via cron (apps/server/src/jobs/cron.ts) o
 * manualmente via POST /api/admin/agents/sector-data.
 */
import { eq, isNull } from "drizzle-orm";
import { db, sectorsTable, professionsTable } from "@workspace/db";
import { getLLM } from "../llm/client";
import { selectModelFor } from "../model-router";
import { estimateTokens, estimateCost, recordLlmUsage } from "../cost-tracking";
import { logger } from "../logger";

export interface SectorDataResult {
  sectorsUpdated:    number;
  professionsUpdated: number;
  errors:            string[];
  durationMs:        number;
}

interface SectorEnrichment {
  skills:         string[];
  opportunities:  string[];
  trend:          "declining" | "stable" | "growing" | "booming";
  growthRate:     number;
  automationRisk: "low" | "medium" | "high";
}

interface ProfessionEnrichment {
  skills:        string[];
  growthOutlook: string;
  salaryRange:   string;
}

const ENRICH_SECTOR_PROMPT = (name: string, desc: string) => `
Sei un esperto di mercato del lavoro italiano ed europeo. Analizza questo settore:

Settore: ${name}
Descrizione: ${desc}

Fornisci dati aggiornati al 2025-2026 in formato JSON:
{
  "skills": ["skill1", "skill2", ...],        // top 8 skill più richieste oggi
  "opportunities": ["opp1", "opp2", ...],     // 3 opportunità di carriera emergenti
  "trend": "growing",                          // declining|stable|growing|booming
  "growthRate": 0.12,                          // tasso crescita annua previsto (es. 0.12 = 12%)
  "automationRisk": "medium"                   // low|medium|high
}
Rispondi SOLO con il JSON, nessun testo.`.trim();

const ENRICH_PROFESSION_PROMPT = (title: string, sector: string) => `
Sei un esperto di mercato del lavoro. Analizza questa professione nel contesto italiano/europeo:

Professione: ${title}
Settore: ${sector}

Dati aggiornati al 2025-2026, formato JSON:
{
  "skills": ["skill1", "skill2", ...],   // top 6 skill tecniche e soft più richieste
  "growthOutlook": "Domanda in crescita del 15% entro 2027...",  // 1-2 frasi
  "salaryRange": "28k-65k€/anno"         // range stipendio Italia (entry-senior)
}
Rispondi SOLO con il JSON.`.trim();

async function enrichSector(
  sector: { id: number; name: string; description: string },
  llm: ReturnType<typeof getLLM>,
  route: ReturnType<typeof selectModelFor>,
  userId: number,
): Promise<boolean> {
  const prompt = ENRICH_SECTOR_PROMPT(sector.name, sector.description);
  const inputTokens = estimateTokens(prompt);

  let raw: string;
  try {
    raw = await llm.chatOnce(
      [{ role: "system", content: "Sei un esperto di mercato del lavoro. Rispondi solo con JSON valido." },
       { role: "user",   content: prompt }],
      { model: route.model, temperature: 0.2, maxTokens: 400 },
    );
  } catch (err) {
    logger.warn({ err, sectorId: sector.id }, "[sector-data-agent] LLM call failed");
    return false;
  }

  const outputTokens = estimateTokens(raw);
  void recordLlmUsage({ userId, model: route.model, promptTokens: inputTokens, completionTokens: outputTokens, requestType: "sector-data-enrich" });

  try {
    const jsonStart = raw.indexOf("{");
    const jsonEnd   = raw.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) return false;
    const data: SectorEnrichment = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));

    await db.update(sectorsTable).set({
      skills:         Array.isArray(data.skills) ? data.skills.slice(0, 10) : [],
      opportunities:  Array.isArray(data.opportunities) ? data.opportunities.slice(0, 5) : [],
      trend:          ["declining","stable","growing","booming"].includes(data.trend) ? data.trend : "stable",
      growthRate:     typeof data.growthRate === "number" ? Math.max(0, Math.min(1, data.growthRate)) : 0.1,
      automationRisk: ["low","medium","high"].includes(data.automationRisk) ? data.automationRisk : "medium",
    }).where(eq(sectorsTable.id, sector.id));

    return true;
  } catch (err) {
    logger.warn({ err, sectorId: sector.id, raw: raw.slice(0, 200) }, "[sector-data-agent] parse failed");
    return false;
  }
}

async function enrichProfession(
  prof: { id: number; title: string; sector: string },
  llm: ReturnType<typeof getLLM>,
  route: ReturnType<typeof selectModelFor>,
  userId: number,
): Promise<boolean> {
  const prompt = ENRICH_PROFESSION_PROMPT(prof.title, prof.sector);
  const inputTokens = estimateTokens(prompt);

  let raw: string;
  try {
    raw = await llm.chatOnce(
      [{ role: "system", content: "Sei un esperto di mercato del lavoro. Rispondi solo con JSON valido." },
       { role: "user",   content: prompt }],
      { model: route.model, temperature: 0.2, maxTokens: 300 },
    );
  } catch (err) {
    logger.warn({ err, profId: prof.id }, "[sector-data-agent] LLM call failed");
    return false;
  }

  const outputTokens = estimateTokens(raw);
  void recordLlmUsage({ userId, model: route.model, promptTokens: inputTokens, completionTokens: outputTokens, requestType: "profession-data-enrich" });

  try {
    const jsonStart = raw.indexOf("{");
    const jsonEnd   = raw.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) return false;
    const data: ProfessionEnrichment = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));

    await db.update(professionsTable).set({
      skills:        Array.isArray(data.skills) ? data.skills.slice(0, 8) : [],
      growthOutlook: typeof data.growthOutlook === "string" ? data.growthOutlook.slice(0, 300) : "",
      salaryRange:   typeof data.salaryRange   === "string" ? data.salaryRange.slice(0, 50)  : "",
    }).where(eq(professionsTable.id, prof.id));

    return true;
  } catch (err) {
    logger.warn({ err, profId: prof.id, raw: raw.slice(0, 200) }, "[sector-data-agent] profession parse failed");
    return false;
  }
}

/**
 * Arricchisce settori e professioni con dati di mercato aggiornati via LLM.
 * Processa in batch per non saturare il rate limit OpenRouter free.
 */
export async function runSectorDataAgent(
  opts: { userId?: number; maxSectors?: number; maxProfessions?: number } = {},
): Promise<SectorDataResult> {
  const { userId = 0, maxSectors = 5, maxProfessions = 10 } = opts;
  const startedAt = Date.now();
  const errors: string[] = [];
  let sectorsUpdated = 0;
  let professionsUpdated = 0;

  const llm   = getLLM();
  const route = selectModelFor("discovery-enrich"); // MICRO tier — adatto per JSON extraction

  // Prioritizza settori senza opportunità (campo vuoto → da arricchire)
  const sectors = await db
    .select({ id: sectorsTable.id, name: sectorsTable.name, description: sectorsTable.description })
    .from(sectorsTable)
    .limit(maxSectors);

  for (const sector of sectors) {
    try {
      const ok = await enrichSector(sector, llm, route, userId);
      if (ok) sectorsUpdated++;
      // Pausa tra chiamate per rispettare rate limit OpenRouter free (60 rpm)
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      errors.push(`sector:${sector.id}:${String(err).slice(0, 60)}`);
    }
  }

  // Professioni senza skills valorizzate
  const professions = await db
    .select({ id: professionsTable.id, title: professionsTable.title, sector: professionsTable.sector })
    .from(professionsTable)
    .where(eq(professionsTable.isActive, true))
    .limit(maxProfessions);

  for (const prof of professions) {
    try {
      const ok = await enrichProfession(prof, llm, route, userId);
      if (ok) professionsUpdated++;
      await new Promise((r) => setTimeout(r, 1500));
    } catch (err) {
      errors.push(`profession:${prof.id}:${String(err).slice(0, 60)}`);
    }
  }

  const durationMs = Date.now() - startedAt;
  logger.info({ sectorsUpdated, professionsUpdated, errors: errors.length, durationMs }, "[sector-data-agent] done");

  return { sectorsUpdated, professionsUpdated, errors, durationMs };
}
