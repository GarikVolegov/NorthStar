/**
 * profile-inference-job.ts — Job settimanale di aggiornamento del profilo psicologico
 *
 * Scopo: aggiornare automaticamente il profilo psicologico degli utenti attivi
 * analizzando i segnali comportamentali passivi delle ultime N settimane.
 *
 * Pipeline per ogni utente attivo:
 * 1. Verifica consenso attivo per le dimensioni "linguistic", "behavioral_passive", "chronotype"
 * 2. Carica ultime 30 sessioni Wendy (solo messaggi utente)
 * 3. Esegue linguistic-analyzer → segnali linguistici
 * 4. Aggiorna user_behavioral_signals per la settimana corrente
 * 5. Inferisce Big Five dai segnali linguistici (se confidence > 0.3)
 * 6. Se il profilo OCEAN non è "explicit" → aggiorna come "inferred" o "hybrid"
 * 7. Rileva cronotype da ai_request_log (se consenso "chronotype")
 * 8. Aggiorna user_psychological_profile
 *
 * Frequenza: settimanale (domenica notte, configurabile via PROFILE_INFERENCE_INTERVAL_MS)
 * Batch size: PROFILE_INFERENCE_BATCH_SIZE utenti per run (default 100)
 * Privacy: opera solo su utenti con consenso attivo; zero PII nel log
 */

import { and, desc, eq, isNull, inArray } from "drizzle-orm";
import {
  db,
  coachSessionsTable,
  userProfilingConsentsTable,
  userBehavioralSignalsTable,
  userPsychologicalProfileTable,
  userProfileSettingsTable,
} from "@workspace/db";
import { rootLogger } from "../middleware/logger";
import {
  analyzeLinguisticSignals,
  inferOceanFromLinguistics,
} from "../services/profiling/linguistic-analyzer";
import { detectChronotype } from "../services/profiling/chronotype-detector";

const log = rootLogger.child({ module: "profile-inference-job" });

const BATCH_SIZE = parseInt(process.env.PROFILE_INFERENCE_BATCH_SIZE ?? "100");
const MAX_SESSIONS = parseInt(process.env.PROFILE_INFERENCE_MAX_SESSIONS ?? "30");
const MIN_CONFIDENCE = parseFloat(process.env.PROFILE_INFERENCE_MIN_CONFIDENCE ?? "0.3");

export interface ProfileInferenceResult {
  usersProcessed: number;
  profilesUpdated: number;
  chronotypesUpdated: number;
  behavioralSignalsInserted: number;
  usersSkipped: number;
  durationMs: number;
  errors: number;
}

/**
 * Calcola la data di inizio della settimana corrente (lunedì ISO)
 */
function getWeekStart(): string {
  const d = new Date();
  const day = d.getDay(); // 0=dom, 1=lun, ...
  const diff = day === 0 ? -6 : 1 - day; // distanza al lunedì più recente
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0]!; // "YYYY-MM-DD"
}

/**
 * Restituisce gli userId che hanno almeno UN consenso attivo
 * tra linguistic, behavioral_passive, chronotype.
 */
async function getUsersWithConsent(limit: number): Promise<number[]> {
  const RELEVANT_DIMENSIONS = ["linguistic", "behavioral_passive", "chronotype"] as const;

  const rows = await db
    .selectDistinct({ userId: userProfilingConsentsTable.userId })
    .from(userProfilingConsentsTable)
    .where(
      and(
        eq(userProfilingConsentsTable.granted, true),
        isNull(userProfilingConsentsTable.revokedAt),
        inArray(userProfilingConsentsTable.dimension, [...RELEVANT_DIMENSIONS]),
      ),
    )
    .limit(limit);

  return rows.map((r) => r.userId);
}

/**
 * Verifica se l'utente ha consenso attivo per una specifica dimensione.
 */
async function checkConsent(
  userId: number,
  dimension: "linguistic" | "behavioral_passive" | "chronotype",
): Promise<boolean> {
  const [row] = await db
    .select({ granted: userProfilingConsentsTable.granted })
    .from(userProfilingConsentsTable)
    .where(
      and(
        eq(userProfilingConsentsTable.userId, userId),
        eq(userProfilingConsentsTable.dimension, dimension),
        eq(userProfilingConsentsTable.granted, true),
        isNull(userProfilingConsentsTable.revokedAt),
      ),
    )
    .limit(1);
  return !!row;
}

/**
 * Carica il profilo psicologico esistente (se presente).
 */
async function loadExistingPsychProfile(userId: number) {
  const [profile] = await db
    .select()
    .from(userPsychologicalProfileTable)
    .where(eq(userPsychologicalProfileTable.userId, userId))
    .limit(1);
  return profile ?? null;
}

/**
 * Processa un singolo utente.
 * Restituisce un oggetto con cosa è stato aggiornato.
 */
async function processUser(userId: number): Promise<{
  profileUpdated: boolean;
  chronotypeUpdated: boolean;
  behavioralSignalsInserted: boolean;
}> {
  let profileUpdated = false;
  let chronotypeUpdated = false;
  let behavioralSignalsInserted = false;

  // ── 1. Analisi linguistica (consenso "linguistic") ────────────────────
  const hasLinguisticConsent = await checkConsent(userId, "linguistic");
  const hasBehavioralConsent = await checkConsent(userId, "behavioral_passive");
  const hasChronotypeConsent = await checkConsent(userId, "chronotype");

  if (hasLinguisticConsent || hasBehavioralConsent) {
    // Carica ultime N sessioni (solo messaggi utente, non assistente)
    const sessions = await db
      .select({ messages: coachSessionsTable.messages })
      .from(coachSessionsTable)
      .where(
        and(
          eq(coachSessionsTable.userId, userId),
          isNull(coachSessionsTable.deletedAt),
        ),
      )
      .orderBy(desc(coachSessionsTable.updatedAt))
      .limit(MAX_SESSIONS);

    // Estrae solo testo dei messaggi utente
    const userMessages: string[] = [];
    for (const session of sessions) {
      for (const msg of (session.messages ?? [])) {
        if (msg.role === "user" && msg.content?.length > 5) {
          userMessages.push(msg.content.slice(0, 500)); // max 500 chars per messaggio
        }
      }
    }

    if (userMessages.length > 0) {
      const signals = analyzeLinguisticSignals(userMessages);

      // ── 2. Salva behavioral signals settimanali ───────────────────────
      if (hasBehavioralConsent && signals.totalWords >= 20) {
        const weekStart = getWeekStart();

        // Calcola goal completion rate dalla tabella objectives se disponibile
        // (semplificato: usiamo solo i segnali linguistici disponibili)
        const now = new Date();
        await db
          .insert(userBehavioralSignalsTable)
          .values({
            userId,
            weekStart,
            questionVsStatement: signals.questionRatio,
            negativeEmotionWords: signals.negativeEmotionWords,
            uncertaintyMarkers: signals.uncertaintyMarkers,
            socialWordUsage: signals.socialWordUsage,
            futureTemporalFocus: signals.futureTemporalFocus,
            avgSessionMinutes: sessions.length > 0 ? sessions.length * 5 : 0, // proxy: N sessioni * 5 min
            createdAt: now,
          })
          .onConflictDoUpdate({
            target: [
              userBehavioralSignalsTable.userId,
              userBehavioralSignalsTable.weekStart,
            ],
            set: {
              questionVsStatement: signals.questionRatio,
              negativeEmotionWords: signals.negativeEmotionWords,
              uncertaintyMarkers: signals.uncertaintyMarkers,
              socialWordUsage: signals.socialWordUsage,
              futureTemporalFocus: signals.futureTemporalFocus,
            },
          });

        behavioralSignalsInserted = true;
      }

      // ── 3. Aggiorna profilo OCEAN per inferenza ───────────────────────
      if (hasLinguisticConsent && signals.totalWords >= 50) {
        const existingProfile = await loadExistingPsychProfile(userId);
        const inference = inferOceanFromLinguistics(
          signals,
          existingProfile
            ? {
                source: existingProfile.oceanSource,
                confidence: existingProfile.oceanConfidence,
              }
            : undefined,
        );

        if (inference.confidence >= MIN_CONFIDENCE) {
          const now = new Date();

          // Se esplicito: aggiorna solo confidence/source → diventa "hybrid"
          // Se già inferred o null: sovrascrive
          const isExplicit = existingProfile?.oceanSource === "explicit";
          const newSource = isExplicit ? "hybrid" : "inferred";
          const newConfidence = isExplicit
            ? Math.max(existingProfile?.oceanConfidence ?? 0, inference.confidence)
            : inference.confidence;

          await db
            .insert(userPsychologicalProfileTable)
            .values({
              userId,
              oceanOpenness: inference.openness,
              oceanConscientiousness: inference.conscientiousness,
              oceanExtraversion: inference.extraversion,
              oceanAgreeableness: inference.agreeableness,
              oceanNeuroticism: inference.neuroticism,
              oceanSource: newSource,
              oceanConfidence: newConfidence,
              updatedAt: now,
              createdAt: now,
            })
            .onConflictDoUpdate({
              target: userPsychologicalProfileTable.userId,
              set: isExplicit
                ? {
                    // In caso di profilo esplicito: aggiorna source e confidence ma non i valori
                    oceanSource: newSource,
                    oceanConfidence: newConfidence,
                    updatedAt: now,
                  }
                : {
                    oceanOpenness: inference.openness,
                    oceanConscientiousness: inference.conscientiousness,
                    oceanExtraversion: inference.extraversion,
                    oceanAgreeableness: inference.agreeableness,
                    oceanNeuroticism: inference.neuroticism,
                    oceanSource: newSource,
                    oceanConfidence: newConfidence,
                    updatedAt: now,
                  },
            });

          profileUpdated = true;
        }
      }
    }
  }

  // ── 4. Rileva cronotype ───────────────────────────────────────────────
  if (hasChronotypeConsent) {
    // Carica timezone dell'utente
    const [profileSettings] = await db
      .select({ timezone: userProfileSettingsTable.timezone })
      .from(userProfileSettingsTable)
      .where(eq(userProfileSettingsTable.userId, userId))
      .limit(1);

    const timezone = profileSettings?.timezone ?? "Europe/Rome";
    const result = await detectChronotype(userId, timezone);

    if (result.confidence >= MIN_CONFIDENCE) {
      const now = new Date();
      await db
        .insert(userPsychologicalProfileTable)
        .values({
          userId,
          chronotype: result.chronotype,
          chronotypeConfidence: result.confidence,
          updatedAt: now,
          createdAt: now,
        })
        .onConflictDoUpdate({
          target: userPsychologicalProfileTable.userId,
          set: {
            chronotype: result.chronotype,
            chronotypeConfidence: result.confidence,
            updatedAt: now,
          },
        });
      chronotypeUpdated = true;
    }
  }

  return { profileUpdated, chronotypeUpdated, behavioralSignalsInserted };
}

/**
 * Entry point principale del job.
 * Processa utenti in batch per evitare di saturare il DB.
 */
export async function runProfileInferenceJob(): Promise<ProfileInferenceResult> {
  const t0 = Date.now();
  let usersProcessed = 0;
  let profilesUpdated = 0;
  let chronotypesUpdated = 0;
  let behavioralSignalsInserted = 0;
  let usersSkipped = 0;
  let errors = 0;

  log.info({ batchSize: BATCH_SIZE }, "[profile-inference] starting");

  const userIds = await getUsersWithConsent(BATCH_SIZE);

  if (userIds.length === 0) {
    log.info("[profile-inference] no users with active consent — skipping");
    return {
      usersProcessed: 0, profilesUpdated: 0, chronotypesUpdated: 0,
      behavioralSignalsInserted: 0, usersSkipped: 0,
      durationMs: Date.now() - t0, errors: 0,
    };
  }

  log.info({ count: userIds.length }, "[profile-inference] users to process");

  for (const userId of userIds) {
    try {
      const result = await processUser(userId);
      usersProcessed++;
      if (result.profileUpdated) profilesUpdated++;
      if (result.chronotypeUpdated) chronotypesUpdated++;
      if (result.behavioralSignalsInserted) behavioralSignalsInserted++;
    } catch (err) {
      errors++;
      log.warn({ err, userId }, "[profile-inference] error processing user");
    }
  }

  const durationMs = Date.now() - t0;
  log.info(
    { usersProcessed, profilesUpdated, chronotypesUpdated, behavioralSignalsInserted, errors, durationMs },
    "[profile-inference] complete",
  );

  return {
    usersProcessed, profilesUpdated, chronotypesUpdated,
    behavioralSignalsInserted, usersSkipped, durationMs, errors,
  };
}
