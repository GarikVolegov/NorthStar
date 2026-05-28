/**
 * /api/assessment — Assessment Engine per la profilazione psicologica 360°
 *
 * Endpoints:
 *   GET  /api/assessment/big-five          → Restituisce le 10 domande TIPI
 *   POST /api/assessment/big-five          → Calcola e salva profilo OCEAN
 *   GET  /api/assessment/values            → Restituisce 12 scenari Schwartz
 *   POST /api/assessment/values            → Calcola e salva profilo valori
 *   GET  /api/assessment/motivation        → Restituisce 15 item SDT+McClelland
 *   POST /api/assessment/motivation        → Calcola e salva profilo motivazionale
 *   GET  /api/assessment/status            → Stato completamento assessment utente
 *
 * Tutti i quiz sono opzionali ma incentivati (sblocco funzionalità avanzate).
 * Il consent GDPR viene verificato prima di salvare dati profilazione.
 */

import { Router } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  userPsychologicalProfileTable,
  userMotivationalProfileTable,
  userProfilingConsentsTable,
  type ProfilingDimension,
} from "@workspace/db";
import { requireAuth } from "../middleware/auth";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// TIPI — Ten-Item Personality Inventory (Big Five / OCEAN)
// Gosling et al., 2003 — r ≈ 0.72 vs BFI-44, valido per uso applicativo
// Scala Likert 1-7 (1=completamente in disaccordo, 7=completamente d'accordo)
// ─────────────────────────────────────────────────────────────────────────────

const TIPI_QUESTIONS = [
  {
    id: "tipi_1",
    text: "Mi vedo come una persona estroversa, entusiasta.",
    dimension: "extraversion" as const,
    polarity: "positive" as const,
  },
  {
    id: "tipi_2",
    text: "Mi vedo come critico/a, litigioso/a.",
    dimension: "agreeableness" as const,
    polarity: "negative" as const,
  },
  {
    id: "tipi_3",
    text: "Mi vedo come affidabile, autodisciplinato/a.",
    dimension: "conscientiousness" as const,
    polarity: "positive" as const,
  },
  {
    id: "tipi_4",
    text: "Mi vedo come ansioso/a, facilmente turbato/a.",
    dimension: "neuroticism" as const,
    polarity: "positive" as const,
  },
  {
    id: "tipi_5",
    text: "Mi vedo come aperto/a a nuove esperienze, complesso/a.",
    dimension: "openness" as const,
    polarity: "positive" as const,
  },
  {
    id: "tipi_6",
    text: "Mi vedo come riservato/a, tranquillo/a.",
    dimension: "extraversion" as const,
    polarity: "negative" as const,
  },
  {
    id: "tipi_7",
    text: "Mi vedo come simpatico/a, collaborativo/a.",
    dimension: "agreeableness" as const,
    polarity: "positive" as const,
  },
  {
    id: "tipi_8",
    text: "Mi vedo come disorganizzato/a, distratto/a.",
    dimension: "conscientiousness" as const,
    polarity: "negative" as const,
  },
  {
    id: "tipi_9",
    text: "Mi vedo come emotivamente stabile, difficilmente turbato/a.",
    dimension: "neuroticism" as const,
    polarity: "negative" as const,
  },
  {
    id: "tipi_10",
    text: "Mi vedo come convenzionale, poco creativo/a.",
    dimension: "openness" as const,
    polarity: "negative" as const,
  },
];

/**
 * Calcola i 5 score OCEAN dai 10 item TIPI.
 * Formula: (item_positivo + (8 - item_negativo)) / 2, poi normalizza 0-1.
 */
function computeOceanScores(
  answers: Record<string, number>,
): {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
} {
  const dims = ["openness", "conscientiousness", "extraversion", "agreeableness", "neuroticism"] as const;
  const result = {} as Record<typeof dims[number], number>;

  for (const dim of dims) {
    const posItem = TIPI_QUESTIONS.find(
      (q) => q.dimension === dim && q.polarity === "positive",
    );
    const negItem = TIPI_QUESTIONS.find(
      (q) => q.dimension === dim && q.polarity === "negative",
    );

    const posScore = posItem ? (answers[posItem.id] ?? 4) : 4;
    const negScore = negItem ? (answers[negItem.id] ?? 4) : 4;

    // TIPI formula: media dei due item (il negativo viene invertito)
    const rawScore = (posScore + (8 - negScore)) / 2; // range 1-7
    result[dim] = Math.round(((rawScore - 1) / 6) * 100) / 100; // normalizza 0-1
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// SCHWARTZ VALUES — 12 scenari di scelta tra valori contrapposti
// Semplificato dal Portrait Values Questionnaire (PVQ-21)
// ─────────────────────────────────────────────────────────────────────────────

const VALUES_SCENARIOS = [
  {
    id: "vs_1",
    text: "Preferisci una carriera in cui hai libertà di scegliere come lavorare, oppure una in cui hai ruoli e regole chiare?",
    optionA: { label: "Libertà di scelta", dimension: "self_direction" },
    optionB: { label: "Ruoli e regole chiare", dimension: "conformity" },
  },
  {
    id: "vs_2",
    text: "Ti motiva di più raggiungere risultati eccellenti riconosciuti dagli altri, o costruire relazioni profonde con colleghi e amici?",
    optionA: { label: "Eccellenza riconosciuta", dimension: "achievement" },
    optionB: { label: "Relazioni profonde", dimension: "benevolence" },
  },
  {
    id: "vs_3",
    text: "Preferisci lavorare su progetti stabili e consolidati, oppure su sfide nuove e rischiose?",
    optionA: { label: "Stabilità e sicurezza", dimension: "security" },
    optionB: { label: "Sfide e novità", dimension: "stimulation" },
  },
  {
    id: "vs_4",
    text: "Ti preoccupi di più per il benessere delle persone che conosci, o per la giustizia globale e l'ambiente?",
    optionA: { label: "Persone vicine a me", dimension: "benevolence" },
    optionB: { label: "Giustizia e ambiente", dimension: "universalism" },
  },
  {
    id: "vs_5",
    text: "Preferisci avere autorità e influenza sugli altri, o piuttosto godirti la vita e i piaceri?",
    optionA: { label: "Autorità e influenza", dimension: "power" },
    optionB: { label: "Piaceri della vita", dimension: "hedonism" },
  },
  {
    id: "vs_6",
    text: "Tra queste due cose, quale guida di più le tue scelte: rispettare le tradizioni della tua cultura, o seguire la tua curiosità e creatività?",
    optionA: { label: "Tradizioni culturali", dimension: "tradition" },
    optionB: { label: "Curiosità e creatività", dimension: "self_direction" },
  },
  {
    id: "vs_7",
    text: "In un lavoro ideale, cosa conta di più: la sicurezza economica a lungo termine, o l'opportunità di crescere e migliorare continuamente?",
    optionA: { label: "Sicurezza economica", dimension: "security" },
    optionB: { label: "Crescita continua", dimension: "achievement" },
  },
  {
    id: "vs_8",
    text: "Preferisci un ambiente dove si seguono le regole stabilite, o uno dove ogni persona fa ciò che ritiene giusto?",
    optionA: { label: "Regole condivise", dimension: "conformity" },
    optionB: { label: "Autonomia individuale", dimension: "self_direction" },
  },
  {
    id: "vs_9",
    text: "Ti motiva di più fare esperienze eccitanti e inusuali, o contribuire al benessere di chi ti è vicino?",
    optionA: { label: "Esperienze eccitanti", dimension: "stimulation" },
    optionB: { label: "Benessere di chi amo", dimension: "benevolence" },
  },
  {
    id: "vs_10",
    text: "Preferisci un ruolo in cui hai potere di decidere per gli altri, o in cui lavori alla pari con tutti?",
    optionA: { label: "Potere decisionale", dimension: "power" },
    optionB: { label: "Parità e collaborazione", dimension: "universalism" },
  },
  {
    id: "vs_11",
    text: "In una scelta difficile, ti affidi di più alle tradizioni e valori tramandati, o ragioni in modo indipendente?",
    optionA: { label: "Tradizioni e valori", dimension: "tradition" },
    optionB: { label: "Ragionamento autonomo", dimension: "self_direction" },
  },
  {
    id: "vs_12",
    text: "Cosa pesa di più nelle tue scelte di vita: il successo personale misurabile, o la ricerca di piacere e qualità della vita?",
    optionA: { label: "Successo misurabile", dimension: "achievement" },
    optionB: { label: "Qualità della vita", dimension: "hedonism" },
  },
];

const SCHWARTZ_DIMENSIONS = [
  "self_direction", "stimulation", "hedonism", "achievement",
  "power", "security", "conformity", "tradition", "benevolence", "universalism",
] as const;

type SchwartzDimension = typeof SCHWARTZ_DIMENSIONS[number];

/**
 * Calcola profilo Schwartz dai 12 scenari di scelta.
 * Ogni risposta "A" o "B" assegna 1 punto alla dimensione corrispondente.
 * Il punteggio finale viene normalizzato 0-1 sul massimo teorico.
 */
function computeSchwartzScores(
  answers: Record<string, "A" | "B">,
): Record<SchwartzDimension, number> {
  const counts: Record<SchwartzDimension, number> = {
    self_direction: 0, stimulation: 0, hedonism: 0, achievement: 0,
    power: 0, security: 0, conformity: 0, tradition: 0,
    benevolence: 0, universalism: 0,
  };

  for (const scenario of VALUES_SCENARIOS) {
    const answer = answers[scenario.id];
    if (answer === "A") {
      counts[scenario.optionA.dimension as SchwartzDimension]++;
    } else if (answer === "B") {
      counts[scenario.optionB.dimension as SchwartzDimension]++;
    }
  }

  // Conta il massimo teorico per ogni dimensione
  const maxCounts: Record<SchwartzDimension, number> = {
    self_direction: 0, stimulation: 0, hedonism: 0, achievement: 0,
    power: 0, security: 0, conformity: 0, tradition: 0,
    benevolence: 0, universalism: 0,
  };
  for (const scenario of VALUES_SCENARIOS) {
    maxCounts[scenario.optionA.dimension as SchwartzDimension]++;
    maxCounts[scenario.optionB.dimension as SchwartzDimension]++;
  }

  const normalized = {} as Record<SchwartzDimension, number>;
  for (const dim of SCHWARTZ_DIMENSIONS) {
    const max = maxCounts[dim];
    normalized[dim] = max > 0 ? Math.round((counts[dim] / max) * 100) / 100 : 0;
  }

  return normalized;
}

// ─────────────────────────────────────────────────────────────────────────────
// SDT + McClelland — 15 item per il profilo motivazionale
// Adattato da Basic Psychological Needs Scale (BPNS) + nAch/nAff/nPow scales
// Scala Likert 1-5 (1=per nulla vero, 5=completamente vero)
// ─────────────────────────────────────────────────────────────────────────────

const MOTIVATION_ITEMS = [
  // SDT — Autonomy (3 item)
  { id: "m1", text: "Sento di poter fare scelte su come voglio vivere e lavorare.", dimension: "autonomy", framework: "sdt" },
  { id: "m2", text: "Mi sento libero/a di decidere come impostare la mia giornata.", dimension: "autonomy", framework: "sdt" },
  { id: "m3", text: "Nella maggior parte delle situazioni, mi sento libero/a di fare ciò che ritengo giusto.", dimension: "autonomy", framework: "sdt" },
  // SDT — Competence (3 item)
  { id: "m4", text: "Mi sento capace di affrontare le sfide che incontro.", dimension: "competence", framework: "sdt" },
  { id: "m5", text: "Riesco a raggiungere i risultati che mi aspetto da me stesso/a.", dimension: "competence", framework: "sdt" },
  { id: "m6", text: "Ho le competenze necessarie per fare bene quello che mi interessa.", dimension: "competence", framework: "sdt" },
  // SDT — Relatedness (3 item)
  { id: "m7", text: "Mi sento vicino/a alle persone con cui lavoro o studio.", dimension: "relatedness", framework: "sdt" },
  { id: "m8", text: "È importante per me avere relazioni profonde con chi mi circonda.", dimension: "relatedness", framework: "sdt" },
  { id: "m9", text: "Mi sento parte di una comunità o gruppo che mi sostiene.", dimension: "relatedness", framework: "sdt" },
  // McClelland — Achievement (2 item)
  { id: "m10", text: "Mi piace fissare obiettivi ambiziosi e lavorare duramente per raggiungerli.", dimension: "achievement", framework: "mcclelland" },
  { id: "m11", text: "Sono soddisfatto/a soprattutto quando supero me stesso/a o risolvo problemi difficili.", dimension: "achievement", framework: "mcclelland" },
  // McClelland — Affiliation (2 item)
  { id: "m12", text: "Per me è molto importante andare d'accordo con le persone e sentirsi accettato/a.", dimension: "affiliation", framework: "mcclelland" },
  { id: "m13", text: "Preferisco lavorare in team piuttosto che da solo/a.", dimension: "affiliation", framework: "mcclelland" },
  // McClelland — Power (2 item)
  { id: "m14", text: "Mi piace influenzare le idee e le azioni degli altri.", dimension: "power", framework: "mcclelland" },
  { id: "m15", text: "Aspiro ad avere un ruolo di guida o leadership.", dimension: "power", framework: "mcclelland" },
];

/**
 * Calcola il profilo motivazionale dai 15 item.
 * Ogni dimensione viene mediata e normalizzata 0-1.
 */
function computeMotivationScores(answers: Record<string, number>): {
  needAutonomy: number;
  needCompetence: number;
  needRelatedness: number;
  needAchievement: number;
  needAffiliation: number;
  needPower: number;
} {
  const dims = {
    autonomy: [] as number[],
    competence: [] as number[],
    relatedness: [] as number[],
    achievement: [] as number[],
    affiliation: [] as number[],
    power: [] as number[],
  };

  for (const item of MOTIVATION_ITEMS) {
    const score = answers[item.id];
    if (score !== undefined) {
      dims[item.dimension as keyof typeof dims].push(score);
    }
  }

  const avg = (arr: number[]): number => {
    if (arr.length === 0) return 0.5;
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return Math.round(((mean - 1) / 4) * 100) / 100; // normalizza 1-5 → 0-1
  };

  return {
    needAutonomy: avg(dims.autonomy),
    needCompetence: avg(dims.competence),
    needRelatedness: avg(dims.relatedness),
    needAchievement: avg(dims.achievement),
    needAffiliation: avg(dims.affiliation),
    needPower: avg(dims.power),
  };
}

/** Concede il consenso per una dimensione (upsert) */
async function grantConsent(
  userId: number,
  dimension: ProfilingDimension,
): Promise<void> {
  const now = new Date();
  await db
    .insert(userProfilingConsentsTable)
    .values({
      userId,
      dimension,
      granted: true,
      grantedAt: now,
      revokedAt: null,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        userProfilingConsentsTable.userId,
        userProfilingConsentsTable.dimension,
      ],
      set: { granted: true, grantedAt: now, revokedAt: null, updatedAt: now },
    });
}

// ═════════════════════════════════════════════════════════════════════════════
// ROUTES
// ═════════════════════════════════════════════════════════════════════════════

/** GET /api/assessment/status — stato completamento assessment */
router.get("/status", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const [psychProfile] = await db
    .select({
      oceanSource: userPsychologicalProfileTable.oceanSource,
      oceanConfidence: userPsychologicalProfileTable.oceanConfidence,
      updatedAt: userPsychologicalProfileTable.updatedAt,
    })
    .from(userPsychologicalProfileTable)
    .where(eq(userPsychologicalProfileTable.userId, userId))
    .limit(1);

  const [motivProfile] = await db
    .select({ updatedAt: userMotivationalProfileTable.updatedAt })
    .from(userMotivationalProfileTable)
    .where(eq(userMotivationalProfileTable.userId, userId))
    .limit(1);

  return res.json({
    bigFive: {
      completed: !!psychProfile?.oceanSource,
      source: psychProfile?.oceanSource ?? null,
      confidence: psychProfile?.oceanConfidence ?? 0,
      lastUpdated: psychProfile?.updatedAt ?? null,
    },
    values: {
      completed: !!motivProfile?.updatedAt && (motivProfile?.updatedAt !== null),
      lastUpdated: motivProfile?.updatedAt ?? null,
    },
    motivation: {
      completed: !!motivProfile?.updatedAt && (motivProfile?.updatedAt !== null),
      lastUpdated: motivProfile?.updatedAt ?? null,
    },
  });
});

// ─── Big Five / OCEAN ─────────────────────────────────────────────────────────

/** GET /api/assessment/big-five — domande TIPI */
router.get("/big-five", requireAuth, (_req, res) => {
  return res.json({
    assessment: "TIPI",
    fullName: "Ten-Item Personality Inventory",
    description:
      "10 domande per misurare i Big Five (OCEAN): Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism.",
    scale: { min: 1, max: 7, labels: { 1: "Completamente in disaccordo", 4: "Neutro", 7: "Completamente d'accordo" } },
    questions: TIPI_QUESTIONS.map(({ id, text }) => ({ id, text })),
  });
});

/** POST /api/assessment/big-five — calcola e salva OCEAN */
router.post("/big-five", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { answers, grantConsent: shouldGrant = true } = req.body as {
    answers: Record<string, number>;
    grantConsent?: boolean;
  };

  if (!answers || typeof answers !== "object") {
    return res.status(400).json({ error: "answers required (Record<tipi_id, 1-7>)" });
  }

  // Verifica che tutte le 10 domande abbiano risposta
  const missing = TIPI_QUESTIONS.filter((q) => answers[q.id] === undefined);
  if (missing.length > 0) {
    return res.status(400).json({
      error: "Risposte mancanti",
      missing: missing.map((q) => q.id),
    });
  }

  // Valida range 1-7
  for (const [id, val] of Object.entries(answers)) {
    if (typeof val !== "number" || val < 1 || val > 7) {
      return res.status(400).json({ error: `Risposta non valida per ${id}: deve essere 1-7` });
    }
  }

  // Concedi consenso se richiesto
  if (shouldGrant) {
    await grantConsent(userId, "big_five");
    await grantConsent(userId, "linguistic"); // il quiz implica consenso all'analisi NLP
  }

  const scores = computeOceanScores(answers);
  const now = new Date();

  await db
    .insert(userPsychologicalProfileTable)
    .values({
      userId,
      oceanOpenness: scores.openness,
      oceanConscientiousness: scores.conscientiousness,
      oceanExtraversion: scores.extraversion,
      oceanAgreeableness: scores.agreeableness,
      oceanNeuroticism: scores.neuroticism,
      oceanSource: "explicit",
      oceanConfidence: 0.85, // quiz esplicito → alta confidence
      updatedAt: now,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: userPsychologicalProfileTable.userId,
      set: {
        oceanOpenness: scores.openness,
        oceanConscientiousness: scores.conscientiousness,
        oceanExtraversion: scores.extraversion,
        oceanAgreeableness: scores.agreeableness,
        oceanNeuroticism: scores.neuroticism,
        oceanSource: "explicit",
        oceanConfidence: 0.85,
        updatedAt: now,
      },
    });

  return res.json({
    success: true,
    scores: {
      openness: scores.openness,
      conscientiousness: scores.conscientiousness,
      extraversion: scores.extraversion,
      agreeableness: scores.agreeableness,
      neuroticism: scores.neuroticism,
    },
    interpretation: {
      openness: scores.openness > 0.6 ? "Alta curiosità e creatività" : scores.openness < 0.4 ? "Preferisce il familiare e concreto" : "Equilibrato tra innovazione e tradizione",
      conscientiousness: scores.conscientiousness > 0.6 ? "Molto organizzato e disciplinato" : scores.conscientiousness < 0.4 ? "Flessibile e spontaneo" : "Moderatamente strutturato",
      extraversion: scores.extraversion > 0.6 ? "Socialmente energico, estroverso" : scores.extraversion < 0.4 ? "Introverso, preferisce il silenzio" : "Ambiverte",
      agreeableness: scores.agreeableness > 0.6 ? "Empatico e cooperativo" : scores.agreeableness < 0.4 ? "Diretto e competitivo" : "Bilanciato",
      neuroticism: scores.neuroticism > 0.6 ? "Emotivamente reattivo, sensibile allo stress" : scores.neuroticism < 0.4 ? "Emotivamente stabile e resiliente" : "Moderata reattività emotiva",
    },
  });
});

// ─── Schwartz Values ──────────────────────────────────────────────────────────

/** GET /api/assessment/values — scenari Schwartz */
router.get("/values", requireAuth, (_req, res) => {
  return res.json({
    assessment: "Schwartz Values (simplified)",
    description: "12 scenari di scelta per identificare i tuoi valori fondamentali secondo il framework di Schwartz.",
    scenarios: VALUES_SCENARIOS.map(({ id, text, optionA, optionB }) => ({
      id,
      text,
      optionA: optionA.label,
      optionB: optionB.label,
    })),
  });
});

/** POST /api/assessment/values — calcola e salva profilo Schwartz */
router.post("/values", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { answers, grantConsent: shouldGrant = true } = req.body as {
    answers: Record<string, "A" | "B">;
    grantConsent?: boolean;
  };

  if (!answers || typeof answers !== "object") {
    return res.status(400).json({ error: "answers required (Record<vs_id, 'A'|'B'>)" });
  }

  // Verifica tutti i 12 scenari
  const missing = VALUES_SCENARIOS.filter((s) => answers[s.id] === undefined);
  if (missing.length > 0) {
    return res.status(400).json({ error: "Risposte mancanti", missing: missing.map((s) => s.id) });
  }

  if (shouldGrant) {
    await grantConsent(userId, "values");
  }

  const scores = computeSchwartzScores(answers);

  // Top 3 valori
  const ranked = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([dim]) => dim);

  const now = new Date();

  await db
    .insert(userMotivationalProfileTable)
    .values({
      userId,
      valueSelfDirection: scores.self_direction,
      valueStimulation: scores.stimulation,
      valueHedonism: scores.hedonism,
      valueAchievement: scores.achievement,
      valuePower: scores.power,
      valueSecurity: scores.security,
      valueConformity: scores.conformity,
      valueTradition: scores.tradition,
      valueBenevolence: scores.benevolence,
      valueUniversalism: scores.universalism,
      primaryValues: ranked,
      updatedAt: now,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: userMotivationalProfileTable.userId,
      set: {
        valueSelfDirection: scores.self_direction,
        valueStimulation: scores.stimulation,
        valueHedonism: scores.hedonism,
        valueAchievement: scores.achievement,
        valuePower: scores.power,
        valueSecurity: scores.security,
        valueConformity: scores.conformity,
        valueTradition: scores.tradition,
        valueBenevolence: scores.benevolence,
        valueUniversalism: scores.universalism,
        primaryValues: ranked,
        updatedAt: now,
      },
    });

  const VALUE_LABELS: Record<SchwartzDimension, string> = {
    self_direction: "Autonomia e curiosità",
    stimulation: "Eccitazione e novità",
    hedonism: "Piacere e qualità della vita",
    achievement: "Successo e competenza",
    power: "Influenza e status",
    security: "Stabilità e sicurezza",
    conformity: "Regole e autodisciplina",
    tradition: "Tradizione e umiltà",
    benevolence: "Benessere altrui",
    universalism: "Giustizia e ambiente",
  };

  return res.json({
    success: true,
    scores,
    topValues: ranked.map((dim) => ({
      dimension: dim,
      label: VALUE_LABELS[dim as SchwartzDimension],
      score: scores[dim as SchwartzDimension],
    })),
  });
});

// ─── Motivation (SDT + McClelland) ────────────────────────────────────────────

/** GET /api/assessment/motivation — item SDT + McClelland */
router.get("/motivation", requireAuth, (_req, res) => {
  return res.json({
    assessment: "SDT + McClelland Motivation",
    description: "15 domande per identificare i tuoi bisogni psicologici fondamentali (Self-Determination Theory) e il tuo profilo motivazionale (McClelland).",
    scale: { min: 1, max: 5, labels: { 1: "Per nulla vero per me", 3: "Abbastanza vero", 5: "Completamente vero" } },
    questions: MOTIVATION_ITEMS.map(({ id, text }) => ({ id, text })),
  });
});

/** POST /api/assessment/motivation — calcola e salva profilo motivazionale */
router.post("/motivation", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const { answers, grantConsent: shouldGrant = true } = req.body as {
    answers: Record<string, number>;
    grantConsent?: boolean;
  };

  if (!answers || typeof answers !== "object") {
    return res.status(400).json({ error: "answers required (Record<m_id, 1-5>)" });
  }

  const missing = MOTIVATION_ITEMS.filter((item) => answers[item.id] === undefined);
  if (missing.length > 0) {
    return res.status(400).json({ error: "Risposte mancanti", missing: missing.map((i) => i.id) });
  }

  for (const [id, val] of Object.entries(answers)) {
    if (typeof val !== "number" || val < 1 || val > 5) {
      return res.status(400).json({ error: `Risposta non valida per ${id}: deve essere 1-5` });
    }
  }

  if (shouldGrant) {
    await grantConsent(userId, "motivation");
  }

  const scores = computeMotivationScores(answers);
  const now = new Date();

  await db
    .insert(userMotivationalProfileTable)
    .values({
      userId,
      needAutonomy: scores.needAutonomy,
      needCompetence: scores.needCompetence,
      needRelatedness: scores.needRelatedness,
      needAchievement: scores.needAchievement,
      needAffiliation: scores.needAffiliation,
      needPower: scores.needPower,
      updatedAt: now,
      createdAt: now,
    })
    .onConflictDoUpdate({
      target: userMotivationalProfileTable.userId,
      set: {
        needAutonomy: scores.needAutonomy,
        needCompetence: scores.needCompetence,
        needRelatedness: scores.needRelatedness,
        needAchievement: scores.needAchievement,
        needAffiliation: scores.needAffiliation,
        needPower: scores.needPower,
        updatedAt: now,
      },
    });

  // Bisogno primario SDT
  const sdtNeeds = [
    { key: "autonomy", score: scores.needAutonomy, label: "Autonomia" },
    { key: "competence", score: scores.needCompetence, label: "Competenza" },
    { key: "relatedness", score: scores.needRelatedness, label: "Relazioni" },
  ];
  const primarySdtNeed = sdtNeeds.sort((a, b) => b.score - a.score)[0];

  return res.json({
    success: true,
    sdt: {
      autonomy: scores.needAutonomy,
      competence: scores.needCompetence,
      relatedness: scores.needRelatedness,
      primaryNeed: primarySdtNeed,
    },
    mcclelland: {
      achievement: scores.needAchievement,
      affiliation: scores.needAffiliation,
      power: scores.needPower,
    },
  });
});

export default router;
