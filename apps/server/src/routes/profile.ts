import { Router } from "express";
import { eq, and, ne } from "drizzle-orm";
import {
  db,
  PROFILING_DIMENSIONS,
  usersTable,
  userBehavioralSignalsTable,
  userMotivationalProfileTable,
  userProfileSettingsTable,
  userProfilingConsentsTable,
  userPsychologicalProfileTable,
  type ProfilingDimension,
} from "@workspace/db";
import { requireAuth } from "../middleware/auth";
import {
  isPersistenceSchemaError,
  sendPersistenceWriteError,
} from "../lib/persistence";
import { getRequestBody } from "../lib/request-context";
import { asPlainRecord } from "../lib/type-guards";

const router = Router();

const DIMENSIONS = new Set<ProfilingDimension>(PROFILING_DIMENSIONS);
const DECISION_STYLES = new Set(["analytical", "directive", "intuitive", "collaborative"]);
const RISK_TOLERANCES = new Set(["conservative", "moderate", "bold"]);
const COMMUNICATION_STYLES = new Set(["concise", "detailed", "visual", "narrative"]);
const CHRONOTYPES = new Set(["morning", "intermediate", "evening"]);

type Plain = Record<string, unknown>;

function isDimension(value: string): value is ProfilingDimension {
  return DIMENSIONS.has(value as ProfilingDimension);
}

function isActiveConsent(row: {
  dimension: ProfilingDimension;
  granted: boolean;
  revokedAt: Date | string | null;
}) {
  return row.granted === true && row.revokedAt === null;
}

function score(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${field} deve essere un numero tra 0 e 1`);
  }
  return Math.round(value * 100) / 100;
}

function optionalEnum(value: unknown, allowed: Set<string>, field: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new Error(`${field} non valido`);
  }
  return value;
}

function primarySdtNeed(profile: Plain): "autonomy" | "competence" | "relatedness" | undefined {
  const needs = [
    ["autonomy", Number(profile.needAutonomy ?? 0)],
    ["competence", Number(profile.needCompetence ?? 0)],
    ["relatedness", Number(profile.needRelatedness ?? 0)],
  ] as const;
  const [top] = [...needs].sort((a, b) => b[1] - a[1]);
  return top && top[1] > 0 ? top[0] : undefined;
}

function normalizePrimaryValues(row: Plain): string[] {
  if (Array.isArray(row.primaryValues)) return row.primaryValues.map(String).slice(0, 3);
  const fields = [
    ["self_direction", "valueSelfDirection"],
    ["stimulation", "valueStimulation"],
    ["hedonism", "valueHedonism"],
    ["achievement", "valueAchievement"],
    ["power", "valuePower"],
    ["security", "valueSecurity"],
    ["conformity", "valueConformity"],
    ["tradition", "valueTradition"],
    ["benevolence", "valueBenevolence"],
    ["universalism", "valueUniversalism"],
  ] as const;
  return fields
    .map(([key, field]) => [key, Number(row[field] ?? 0)] as const)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => key);
}

function sourceLabel(source: unknown): string | undefined {
  if (source === "explicit") return "Da quiz";
  if (source === "inferred") return "Appreso da Wendy";
  if (source === "hybrid") return "Da quiz + Wendy";
  return undefined;
}

async function grantProfilingConsent(userId: number, dimension: ProfilingDimension) {
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
      deletedAt: null,
    })
    .onConflictDoUpdate({
      target: [userProfilingConsentsTable.userId, userProfilingConsentsTable.dimension],
      set: { granted: true, grantedAt: now, revokedAt: null, updatedAt: now, deletedAt: null },
    });
}

async function revokeProfilingConsent(userId: number, dimension: ProfilingDimension, now = new Date()) {
  await db
    .insert(userProfilingConsentsTable)
    .values({
      userId,
      dimension,
      granted: false,
      grantedAt: null,
      revokedAt: now,
      updatedAt: now,
      deletedAt: now,
    })
    .onConflictDoUpdate({
      target: [userProfilingConsentsTable.userId, userProfilingConsentsTable.dimension],
      set: { granted: false, revokedAt: now, updatedAt: now, deletedAt: now },
    });
}

function allConsentRows(rows: Array<{
  dimension: ProfilingDimension;
  granted: boolean;
  grantedAt: Date | string | null;
  revokedAt: Date | string | null;
}>) {
  const byDimension = new Map(rows.map((row) => [row.dimension, row]));
  return PROFILING_DIMENSIONS.map((dimension) => {
    const row = byDimension.get(dimension);
    return {
      dimension,
      granted: row ? isActiveConsent(row) : false,
      grantedAt: row?.grantedAt ?? null,
      revokedAt: row?.revokedAt ?? null,
    };
  });
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

/* ─── GET /api/profile/psychological-profile — profilo 360 filtrato per consenso ─── */
router.get("/psychological-profile", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;

    const consentRows = await db
      .select({
        dimension: userProfilingConsentsTable.dimension,
        granted: userProfilingConsentsTable.granted,
        grantedAt: userProfilingConsentsTable.grantedAt,
        revokedAt: userProfilingConsentsTable.revokedAt,
      })
      .from(userProfilingConsentsTable)
      .where(eq(userProfilingConsentsTable.userId, userId))
      .limit(PROFILING_DIMENSIONS.length);

    const consents = allConsentRows(consentRows);
    const active = new Set(
      consentRows
        .filter((row) => isActiveConsent(row))
        .map((row) => row.dimension),
    );

    const [psych] = await db
      .select({
        oceanOpenness: userPsychologicalProfileTable.oceanOpenness,
        oceanConscientiousness: userPsychologicalProfileTable.oceanConscientiousness,
        oceanExtraversion: userPsychologicalProfileTable.oceanExtraversion,
        oceanAgreeableness: userPsychologicalProfileTable.oceanAgreeableness,
        oceanNeuroticism: userPsychologicalProfileTable.oceanNeuroticism,
        oceanSource: userPsychologicalProfileTable.oceanSource,
        oceanConfidence: userPsychologicalProfileTable.oceanConfidence,
        decisionStyle: userPsychologicalProfileTable.decisionStyle,
        riskTolerance: userPsychologicalProfileTable.riskTolerance,
        communicationStyle: userPsychologicalProfileTable.communicationStyle,
        chronotype: userPsychologicalProfileTable.chronotype,
        chronotypeConfidence: userPsychologicalProfileTable.chronotypeConfidence,
        createdAt: userPsychologicalProfileTable.createdAt,
        updatedAt: userPsychologicalProfileTable.updatedAt,
      })
      .from(userPsychologicalProfileTable)
      .where(eq(userPsychologicalProfileTable.userId, userId))
      .limit(1);

    const [motivation] = await db
      .select({
        needAutonomy: userMotivationalProfileTable.needAutonomy,
        needCompetence: userMotivationalProfileTable.needCompetence,
        needRelatedness: userMotivationalProfileTable.needRelatedness,
        needAchievement: userMotivationalProfileTable.needAchievement,
        needAffiliation: userMotivationalProfileTable.needAffiliation,
        needPower: userMotivationalProfileTable.needPower,
        valueSelfDirection: userMotivationalProfileTable.valueSelfDirection,
        valueStimulation: userMotivationalProfileTable.valueStimulation,
        valueHedonism: userMotivationalProfileTable.valueHedonism,
        valueAchievement: userMotivationalProfileTable.valueAchievement,
        valuePower: userMotivationalProfileTable.valuePower,
        valueSecurity: userMotivationalProfileTable.valueSecurity,
        valueConformity: userMotivationalProfileTable.valueConformity,
        valueTradition: userMotivationalProfileTable.valueTradition,
        valueBenevolence: userMotivationalProfileTable.valueBenevolence,
        valueUniversalism: userMotivationalProfileTable.valueUniversalism,
        primaryValues: userMotivationalProfileTable.primaryValues,
        createdAt: userMotivationalProfileTable.createdAt,
        updatedAt: userMotivationalProfileTable.updatedAt,
      })
      .from(userMotivationalProfileTable)
      .where(eq(userMotivationalProfileTable.userId, userId))
      .limit(1);

    const profile: Plain = {};
    const updatedCandidates: Array<Date | string> = [];

    if (psych && active.has("big_five")) {
      profile.ocean = {
        openness: psych.oceanOpenness,
        conscientiousness: psych.oceanConscientiousness,
        extraversion: psych.oceanExtraversion,
        agreeableness: psych.oceanAgreeableness,
        neuroticism: psych.oceanNeuroticism,
      };
      profile.oceanSource = psych.oceanSource;
      profile.oceanConfidence = psych.oceanConfidence ?? 0;
      profile.sourceLabel = sourceLabel(psych.oceanSource);
      if (psych.updatedAt) updatedCandidates.push(psych.updatedAt);
      if (psych.createdAt) profile.createdAt = psych.createdAt;
    }

    if (psych && active.has("chronotype")) {
      profile.chronotype = psych.chronotype;
      profile.chronotypeConfidence = psych.chronotypeConfidence ?? 0;
      if (psych.updatedAt) updatedCandidates.push(psych.updatedAt);
    }

    if (psych && active.has("behavioral_passive")) {
      profile.decisionStyle = psych.decisionStyle;
      profile.riskTolerance = psych.riskTolerance;
      profile.communicationStyle = psych.communicationStyle;
      if (psych.updatedAt) updatedCandidates.push(psych.updatedAt);
    }

    if (motivation && active.has("motivation")) {
      profile.sdt = {
        autonomy: motivation.needAutonomy,
        competence: motivation.needCompetence,
        relatedness: motivation.needRelatedness,
      };
      profile.mcclelland = {
        achievement: motivation.needAchievement,
        affiliation: motivation.needAffiliation,
        power: motivation.needPower,
      };
      profile.primarySdtNeed = primarySdtNeed(motivation as Plain);
      if (motivation.updatedAt) updatedCandidates.push(motivation.updatedAt);
      if (!profile.createdAt && motivation.createdAt) profile.createdAt = motivation.createdAt;
    }

    if (motivation && active.has("values")) {
      profile.schwartz = {
        self_direction: motivation.valueSelfDirection,
        stimulation: motivation.valueStimulation,
        hedonism: motivation.valueHedonism,
        achievement: motivation.valueAchievement,
        power: motivation.valuePower,
        security: motivation.valueSecurity,
        conformity: motivation.valueConformity,
        tradition: motivation.valueTradition,
        benevolence: motivation.valueBenevolence,
        universalism: motivation.valueUniversalism,
      };
      profile.primaryValues = normalizePrimaryValues(motivation as Plain);
      if (motivation.updatedAt) updatedCandidates.push(motivation.updatedAt);
      if (!profile.createdAt && motivation.createdAt) profile.createdAt = motivation.createdAt;
    }

    const latest = updatedCandidates
      .map((value) => new Date(value).getTime())
      .filter(Number.isFinite)
      .sort((a, b) => b - a)[0];
    if (latest) profile.updatedAt = new Date(latest).toISOString();

    res.json({ profile, consents });
  } catch (err) {
    req.log?.error?.({ err }, "psychological profile get error");
    res.status(500).json({ error: "Errore nel caricamento del profilo psicologico" });
  }
});

/* ─── PATCH /api/profile/psychological-profile — consensi + override manuali ─── */
router.patch("/psychological-profile", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const body = asPlainRecord(getRequestBody(req));
    const consentsBody = body.consents && typeof body.consents === "object"
      ? (body.consents as Plain)
      : {};
    const profileBody = body.profile && typeof body.profile === "object"
      ? (body.profile as Plain)
      : {};

    for (const [dimension, granted] of Object.entries(consentsBody)) {
      if (!isDimension(dimension)) {
        res.status(400).json({ error: `Dimensione non valida: ${dimension}` });
        return;
      }
      if (granted !== true) {
        res.status(400).json({ error: "Usa DELETE per revocare un consenso" });
        return;
      }
    }

    const now = new Date();
    const psychPatch: Partial<typeof userPsychologicalProfileTable.$inferInsert> = {};
    const motivationPatch: Partial<typeof userMotivationalProfileTable.$inferInsert> = {};

    if (profileBody.ocean !== undefined) {
      const ocean = asPlainRecord(profileBody.ocean);
      psychPatch.oceanOpenness = score(ocean.openness, "openness");
      psychPatch.oceanConscientiousness = score(ocean.conscientiousness, "conscientiousness");
      psychPatch.oceanExtraversion = score(ocean.extraversion, "extraversion");
      psychPatch.oceanAgreeableness = score(ocean.agreeableness, "agreeableness");
      psychPatch.oceanNeuroticism = score(ocean.neuroticism, "neuroticism");
      psychPatch.oceanSource = "explicit";
      psychPatch.oceanConfidence = 0.75;
      await grantProfilingConsent(userId, "big_five");
    }

    const decisionStyle = optionalEnum(profileBody.decisionStyle, DECISION_STYLES, "decisionStyle");
    const riskTolerance = optionalEnum(profileBody.riskTolerance, RISK_TOLERANCES, "riskTolerance");
    const communicationStyle = optionalEnum(profileBody.communicationStyle, COMMUNICATION_STYLES, "communicationStyle");
    if (decisionStyle !== undefined) psychPatch.decisionStyle = decisionStyle as typeof psychPatch.decisionStyle;
    if (riskTolerance !== undefined) psychPatch.riskTolerance = riskTolerance as typeof psychPatch.riskTolerance;
    if (communicationStyle !== undefined) psychPatch.communicationStyle = communicationStyle as typeof psychPatch.communicationStyle;
    if (decisionStyle !== undefined || riskTolerance !== undefined || communicationStyle !== undefined) {
      await grantProfilingConsent(userId, "behavioral_passive");
    }

    const chronotype = optionalEnum(profileBody.chronotype, CHRONOTYPES, "chronotype");
    if (chronotype !== undefined) {
      psychPatch.chronotype = chronotype as typeof psychPatch.chronotype;
      psychPatch.chronotypeConfidence = 0.75;
      await grantProfilingConsent(userId, "chronotype");
    }

    if (profileBody.sdt !== undefined) {
      const sdt = asPlainRecord(profileBody.sdt);
      motivationPatch.needAutonomy = score(sdt.autonomy, "autonomy");
      motivationPatch.needCompetence = score(sdt.competence, "competence");
      motivationPatch.needRelatedness = score(sdt.relatedness, "relatedness");
      await grantProfilingConsent(userId, "motivation");
    }

    if (profileBody.mcclelland !== undefined) {
      const mcclelland = asPlainRecord(profileBody.mcclelland);
      motivationPatch.needAchievement = score(mcclelland.achievement, "achievement");
      motivationPatch.needAffiliation = score(mcclelland.affiliation, "affiliation");
      motivationPatch.needPower = score(mcclelland.power, "power");
      await grantProfilingConsent(userId, "motivation");
    }

    if (profileBody.schwartz !== undefined) {
      const values = asPlainRecord(profileBody.schwartz);
      motivationPatch.valueSelfDirection = score(values.self_direction, "self_direction");
      motivationPatch.valueStimulation = score(values.stimulation, "stimulation");
      motivationPatch.valueHedonism = score(values.hedonism, "hedonism");
      motivationPatch.valueAchievement = score(values.achievement, "achievement");
      motivationPatch.valuePower = score(values.power, "power");
      motivationPatch.valueSecurity = score(values.security, "security");
      motivationPatch.valueConformity = score(values.conformity, "conformity");
      motivationPatch.valueTradition = score(values.tradition, "tradition");
      motivationPatch.valueBenevolence = score(values.benevolence, "benevolence");
      motivationPatch.valueUniversalism = score(values.universalism, "universalism");
      motivationPatch.primaryValues = normalizePrimaryValues(motivationPatch as Plain);
      await grantProfilingConsent(userId, "values");
    }

    for (const dimension of Object.keys(consentsBody)) {
      await grantProfilingConsent(userId, dimension as ProfilingDimension);
    }

    if (Object.keys(psychPatch).length > 0) {
      await db
        .insert(userPsychologicalProfileTable)
        .values({ userId, ...psychPatch, updatedAt: now, createdAt: now, deletedAt: null })
        .onConflictDoUpdate({
          target: userPsychologicalProfileTable.userId,
          set: { ...psychPatch, updatedAt: now, deletedAt: null },
        });
    }

    if (Object.keys(motivationPatch).length > 0) {
      await db
        .insert(userMotivationalProfileTable)
        .values({ userId, ...motivationPatch, updatedAt: now, createdAt: now, deletedAt: null })
        .onConflictDoUpdate({
          target: userMotivationalProfileTable.userId,
          set: { ...motivationPatch, updatedAt: now, deletedAt: null },
        });
    }

    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Dati profilo non validi";
    req.log?.warn?.({ err }, "psychological profile patch rejected");
    res.status(400).json({ error: message });
  }
});

/* ─── DELETE /api/profile/psychological-profile/:dimension — revoca + erasure ─── */
router.delete("/psychological-profile/:dimension", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.id;
    const dimension = req.params.dimension ?? "";
    if (!isDimension(dimension)) {
      res.status(400).json({ error: "Dimensione non valida" });
      return;
    }

    const now = new Date();
    await revokeProfilingConsent(userId, dimension, now);

    if (dimension === "big_five") {
      await db
        .update(userPsychologicalProfileTable)
        .set({
          oceanOpenness: null,
          oceanConscientiousness: null,
          oceanExtraversion: null,
          oceanAgreeableness: null,
          oceanNeuroticism: null,
          oceanSource: null,
          oceanConfidence: 0,
          updatedAt: now,
        })
        .where(eq(userPsychologicalProfileTable.userId, userId));
    } else if (dimension === "values") {
      await db
        .update(userMotivationalProfileTable)
        .set({
          valueSelfDirection: 0,
          valueStimulation: 0,
          valueHedonism: 0,
          valueAchievement: 0,
          valuePower: 0,
          valueSecurity: 0,
          valueConformity: 0,
          valueTradition: 0,
          valueBenevolence: 0,
          valueUniversalism: 0,
          primaryValues: [],
          updatedAt: now,
        })
        .where(eq(userMotivationalProfileTable.userId, userId));
    } else if (dimension === "motivation") {
      await db
        .update(userMotivationalProfileTable)
        .set({
          needAutonomy: 0.33,
          needCompetence: 0.33,
          needRelatedness: 0.33,
          needAchievement: 0.33,
          needAffiliation: 0.33,
          needPower: 0.33,
          updatedAt: now,
        })
        .where(eq(userMotivationalProfileTable.userId, userId));
    } else if (dimension === "chronotype") {
      await db
        .update(userPsychologicalProfileTable)
        .set({ chronotype: null, chronotypeConfidence: 0, updatedAt: now })
        .where(eq(userPsychologicalProfileTable.userId, userId));
    } else if (dimension === "behavioral_passive") {
      await db
        .update(userPsychologicalProfileTable)
        .set({
          decisionStyle: null,
          riskTolerance: null,
          communicationStyle: null,
          updatedAt: now,
        })
        .where(eq(userPsychologicalProfileTable.userId, userId));
      await db
        .update(userBehavioralSignalsTable)
        .set({
          topDomains: [],
          streakConsistency: 0,
          goalCompletionRate: 0,
          exploreVsFocusRatio: 0.5,
          deletedAt: now,
        })
        .where(eq(userBehavioralSignalsTable.userId, userId));
    } else if (dimension === "linguistic") {
      await db
        .update(userBehavioralSignalsTable)
        .set({
          questionVsStatement: 0,
          negativeEmotionWords: 0,
          uncertaintyMarkers: 0,
          socialWordUsage: 0,
          futureTemporalFocus: 0,
          deletedAt: now,
        })
        .where(eq(userBehavioralSignalsTable.userId, userId));
      await db
        .update(userPsychologicalProfileTable)
        .set({
          oceanOpenness: null,
          oceanConscientiousness: null,
          oceanExtraversion: null,
          oceanAgreeableness: null,
          oceanNeuroticism: null,
          oceanSource: null,
          oceanConfidence: 0,
          updatedAt: now,
        })
        .where(
          and(
            eq(userPsychologicalProfileTable.userId, userId),
            ne(userPsychologicalProfileTable.oceanSource, "explicit"),
          ),
        );
    }

    res.json({ success: true, dimension });
  } catch (err) {
    req.log?.error?.({ err }, "psychological profile delete error");
    res.status(500).json({ error: "Errore nella cancellazione della dimensione" });
  }
});

/* ─── GET /api/profile/:userId  —  dati profilo ───────────────────── */
router.get("/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId ?? "", 10);

    let user;
    try {
      [user] = await db
        .select({
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          emailVerified: usersTable.emailVerified,
          avatarUrl: usersTable.avatarUrl,
          bannerUrl: userProfileSettingsTable.bannerUrl,
          activeBackgroundId: userProfileSettingsTable.activeBackgroundId,
          backgroundLibrary: userProfileSettingsTable.backgroundLibrary,
          bio: userProfileSettingsTable.bio,
          city: userProfileSettingsTable.city,
          username: userProfileSettingsTable.username,
          wendyTonePreference: userProfileSettingsTable.wendyTonePreference,
          createdAt: usersTable.createdAt,
        })
        .from(usersTable)
        .leftJoin(
          userProfileSettingsTable,
          eq(usersTable.id, userProfileSettingsTable.userId),
        )
        .where(eq(usersTable.id, userId))
        .limit(1);
    } catch (err) {
      if (!isPersistenceSchemaError(err)) throw err;
      req.log?.warn?.(
        { err, route: "profile.get", userId, setupAction: "run_migrations" },
        "profile settings unavailable",
      );
      const [baseUser] = await db
        .select({
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          emailVerified: usersTable.emailVerified,
          avatarUrl: usersTable.avatarUrl,
          createdAt: usersTable.createdAt,
        })
        .from(usersTable)
        .where(eq(usersTable.id, userId))
        .limit(1);
      user = baseUser
        ? { ...baseUser, bannerUrl: null, activeBackgroundId: null, backgroundLibrary: [] as unknown[], bio: null, city: null, username: null, wendyTonePreference: null }
        : undefined;
    }

    if (!user) {
      res.status(404).json({ error: "Utente non trovato" });
      return;
    }

    res.json(user);
  } catch (err) {
    req.log?.error?.({ err }, "profile get error");
    res.status(500).json({ error: "Errore nel caricamento del profilo" });
  }
});

/* ─── PATCH /api/profile/:userId/avatar  —  upload avatar ──────────── */
router.patch("/:userId/avatar", requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId ?? "", 10);
    if (userId !== req.user!.id) {
      res.status(403).json({ error: "Accesso negato" });
      return;
    }

    const body = asPlainRecord(getRequestBody(req));
    const avatarDataUrl = body.avatarDataUrl;
    if (!avatarDataUrl || typeof avatarDataUrl !== "string") {
      res.status(400).json({ error: "avatarDataUrl richiesto" });
      return;
    }
    if (avatarDataUrl.length > 2_000_000) {
      res.status(400).json({ error: "Immagine troppo grande (max 1.5 MB)" });
      return;
    }

    const [updated] = await db
      .update(usersTable)
      .set({ avatarUrl: avatarDataUrl, updatedAt: new Date() })
      .where(eq(usersTable.id, userId))
      .returning({ avatarUrl: usersTable.avatarUrl });

    if (!updated) {
      res.status(404).json({ error: "Utente non trovato" });
      return;
    }

    res.json({ avatarUrl: updated.avatarUrl });
  } catch (err) {
    req.log?.error?.({ err }, "avatar upload error");
    res.status(500).json({ error: "Errore upload avatar" });
  }
});

/* ─── DELETE /api/profile/:userId/avatar  —  rimuovi avatar ───────── */
router.delete("/:userId/avatar", requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId ?? "", 10);
    if (userId !== req.user!.id) {
      res.status(403).json({ error: "Accesso negato" });
      return;
    }

    await db
      .update(usersTable)
      .set({ avatarUrl: null, updatedAt: new Date() })
      .where(eq(usersTable.id, userId));
    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "avatar delete error");
    res.status(500).json({ error: "Errore rimozione avatar" });
  }
});

/* ─── PATCH /api/profile/:userId/banner  —  upload banner ──────────── */
router.patch("/:userId/banner", requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId ?? "", 10);
    if (userId !== req.user!.id) {
      res.status(403).json({ error: "Accesso negato" });
      return;
    }

    const body = asPlainRecord(getRequestBody(req));
    const bannerDataUrl = body.bannerDataUrl;
    if (!bannerDataUrl || typeof bannerDataUrl !== "string") {
      res.status(400).json({ error: "bannerDataUrl richiesto" });
      return;
    }
    // base64 overhead: 1MB file → ~1.37MB string; cap at 2MB string (~1.5MB file)
    if (bannerDataUrl.length > 2_000_000) {
      res.status(400).json({ error: "Immagine troppo grande (max 1.5 MB)" });
      return;
    }

    await upsertProfileSettings(userId, { bannerUrl: bannerDataUrl });

    res.json({ bannerUrl: bannerDataUrl });
  } catch (err) {
    req.log?.error?.({ err }, "banner upload error");
    if (sendPersistenceWriteError(req, res, err, "profile.banner.update"))
      return;
    res.status(500).json({ error: "Errore upload banner" });
  }
});

/* ─── DELETE /api/profile/:userId/banner  —  rimuovi banner ───────── */
router.delete("/:userId/banner", requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId ?? "", 10);
    if (userId !== req.user!.id) {
      res.status(403).json({ error: "Accesso negato" });
      return;
    }

    await upsertProfileSettings(userId, { bannerUrl: null });

    res.json({ success: true });
  } catch (err) {
    req.log?.error?.({ err }, "banner delete error");
    if (sendPersistenceWriteError(req, res, err, "profile.banner.delete"))
      return;
    res.status(500).json({ error: "Errore rimozione banner" });
  }
});

/* ─── PATCH /api/profile/:userId/mode  —  aggiorna user mode ───────── */
router.patch("/:userId/mode", requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId ?? "", 10);
    if (userId !== req.user!.id) {
      res.status(403).json({ error: "Accesso negato" });
      return;
    }

    const body = asPlainRecord(getRequestBody(req));
    const mode = body.mode;
    if (!mode || typeof mode !== "string") {
      res.status(400).json({ error: "mode richiesto" });
      return;
    }

    await upsertProfileSettings(userId, { userMode: mode });

    res.json({ userMode: mode });
  } catch (err) {
    req.log?.error?.({ err }, "user mode update error");
    if (sendPersistenceWriteError(req, res, err, "profile.mode.update")) return;
    res.status(500).json({ error: "Errore nel salvataggio modalità" });
  }
});

/* ─── PATCH /api/profile/:userId/info  —  aggiorna nome/bio/city/username ── */
router.patch("/:userId/info", requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId ?? "", 10);
    if (userId !== req.user!.id) {
      res.status(403).json({ error: "Accesso negato" });
      return;
    }

    const body = asPlainRecord(getRequestBody(req));

    const name = typeof body.name === "string" ? body.name.trim() : undefined;
    const bio = typeof body.bio === "string" ? (body.bio.trim() || null) : undefined;
    const city = typeof body.city === "string" ? (body.city.trim() || null) : undefined;
    const username = typeof body.username === "string" ? (body.username.trim() || null) : undefined;

    if (name !== undefined) {
      if (name.length === 0) {
        res.status(400).json({ error: "Il nome non può essere vuoto" });
        return;
      }
      if (name.length > 100) {
        res.status(400).json({ error: "Il nome non può superare 100 caratteri" });
        return;
      }
    }
    if (bio !== null && bio !== undefined && bio.length > 300) {
      res.status(400).json({ error: "La bio non può superare 300 caratteri" });
      return;
    }
    if (city !== null && city !== undefined && city.length > 100) {
      res.status(400).json({ error: "La città non può superare 100 caratteri" });
      return;
    }
    if (username !== null && username !== undefined) {
      if (!/^[a-zA-Z0-9_-]{1,30}$/.test(username)) {
        res.status(400).json({ error: "Username: solo lettere, numeri, _ e - (max 30 caratteri)" });
        return;
      }
      // Unicità username
      const [existing] = await db
        .select({ userId: userProfileSettingsTable.userId })
        .from(userProfileSettingsTable)
        .where(
          and(
            eq(userProfileSettingsTable.username, username),
            ne(userProfileSettingsTable.userId, userId),
          ),
        )
        .limit(1);
      if (existing) {
        res.status(409).json({ error: "Username già in uso" });
        return;
      }
    }

    // Aggiorna nome nella tabella users
    let updatedName = name;
    if (name !== undefined) {
      const [updated] = await db
        .update(usersTable)
        .set({ name, updatedAt: new Date() })
        .where(eq(usersTable.id, userId))
        .returning({ name: usersTable.name });
      updatedName = updated?.name ?? name;
    }

    // Aggiorna profilo settings
    const settingsUpdate: Record<string, unknown> = {};
    if (bio !== undefined) settingsUpdate.bio = bio;
    if (city !== undefined) settingsUpdate.city = city;
    if (username !== undefined) settingsUpdate.username = username;

    if (Object.keys(settingsUpdate).length > 0) {
      await upsertProfileSettings(userId, settingsUpdate);
    }

    res.json({ name: updatedName, bio, city, username });
  } catch (err) {
    req.log?.error?.({ err }, "profile info update error");
    if (sendPersistenceWriteError(req, res, err, "profile.info.update")) return;
    res.status(500).json({ error: "Errore nel salvataggio del profilo" });
  }
});

/* ─── PATCH /api/profile/:userId/tone  —  aggiorna tono Wendy ──────── */
router.patch("/:userId/tone", requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId ?? "", 10);
    if (userId !== req.user!.id) {
      res.status(403).json({ error: "Accesso negato" });
      return;
    }

    const body = asPlainRecord(getRequestBody(req));
    const tone = body.tone;
    const VALID_TONES = ["auto", "concise", "detailed", "formal", "casual"] as const;
    if (!tone || typeof tone !== "string" || !VALID_TONES.includes(tone as typeof VALID_TONES[number])) {
      res.status(400).json({ error: "Tono non valido" });
      return;
    }

    await upsertProfileSettings(userId, { wendyTonePreference: tone as typeof VALID_TONES[number] });

    res.json({ wendyTonePreference: tone });
  } catch (err) {
    req.log?.error?.({ err }, "tone update error");
    if (sendPersistenceWriteError(req, res, err, "profile.tone.update")) return;
    res.status(500).json({ error: "Errore nel salvataggio del tono" });
  }
});

export default router;
