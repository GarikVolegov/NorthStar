export const MONTHLY_RITUAL_TIMEZONE = "Europe/Rome";
export const MONTHLY_RITUAL_DAY = 7;
export const MONTHLY_RITUAL_VIGIL_DAY = 6;
export const MONTHLY_RITUAL_SLUG = "notte-fondazione";
export const MONTHLY_RITUAL_ROUTE = "/dashboard?ritual=notte-fondazione";

export type MonthlyRitualStatus = "pending" | "opened" | "challenge_completed" | "expired";
export type MonthlyRitualChannel = "email" | "push" | "in_app";
export type MonthlyRitualChallengeKey =
  | "choose_three_directions"
  | "update_career_goal"
  | "validate_business_micro_hypothesis"
  | "review_customer_need"
  | "save_trend_to_watch";
export type MonthlyRitualJourneyType = "indeciso" | "dipendente" | "autonomo" | "azienda" | "investitore";
export type MonthlyRitualPhaseName = "vigil" | "active" | "inactive";

export interface MonthlyRitualPhase {
  phase: MonthlyRitualPhaseName;
  ritualMonth: string;
  ritualDate: Date;
  nextRitualDate: Date;
  nextRitualLocalDate: string;
}

export interface MonthlyRitualChallenge {
  key: MonthlyRitualChallengeKey;
  label: string;
  body: string;
}

export interface MonthlyRitualRunRecord {
  id: number;
  userId: number;
  ritualMonth: string;
  ritualDate: Date;
  status: MonthlyRitualStatus;
  journeyType: string;
  routeTitle: string;
  routeBody: string;
  challengeKey: MonthlyRitualChallengeKey;
  challengeLabel: string;
  challengeBody: string;
  ctaLabel: string;
  ctaTarget: string;
  emailSentAt?: Date | null;
  pushSentAt?: Date | null;
  proactiveInsightCreatedAt?: Date | null;
  openedAt?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MonthlyRitualStore {
  getRunByUserAndMonth(userId: number, ritualMonth: string): Promise<MonthlyRitualRunRecord | null>;
  createRun(input: Omit<MonthlyRitualRunRecord, "id">): Promise<MonthlyRitualRunRecord>;
}

export interface MonthlyRitualEligibleUser {
  id: number;
  journeyType: string | null;
  lastActiveAt: Date | null;
}

export interface MonthlyRitualEmailCandidate {
  userId: number;
  email: string;
  name: string;
  journeyType: string | null;
  lastActiveAt: Date | null;
}

export interface MonthlyRitualPushSubscriptionRecord {
  id?: number;
  userId: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface MonthlyRitualPushCandidate {
  userId: number;
  name: string;
  journeyType: string | null;
  lastActiveAt: Date | null;
  subscription: MonthlyRitualPushSubscriptionRecord;
}

export interface MonthlyRitualOrchestratorStore extends MonthlyRitualStore {
  listEligibleUsers(activeSince: Date): Promise<MonthlyRitualEligibleUser[]>;
}

export interface MonthlyRitualPreferencesRecord {
  ritualEnabled: boolean;
  emailReminderEnabled: boolean;
}

export interface MonthlyRitualUserStore extends MonthlyRitualOrchestratorStore {
  getPreferences(userId: number): Promise<MonthlyRitualPreferencesRecord>;
  updatePreferences(
    userId: number,
    patch: Partial<MonthlyRitualPreferencesRecord>,
  ): Promise<MonthlyRitualPreferencesRecord>;
  updateRun(id: number, patch: Partial<MonthlyRitualRunRecord>): Promise<MonthlyRitualRunRecord>;
  getRecentRuns(userId: number, limit: number): Promise<MonthlyRitualRunRecord[]>;
}

export interface MonthlyRitualNotificationStore extends MonthlyRitualUserStore {
  listEmailReminderCandidates(activeSince: Date): Promise<MonthlyRitualEmailCandidate[]>;
  savePushSubscription(input: MonthlyRitualPushSubscriptionRecord & { userAgent?: string | null }): Promise<void>;
  revokePushSubscription(userId: number, endpoint?: string | null): Promise<void>;
  listPushReminderCandidates(activeSince: Date): Promise<MonthlyRitualPushCandidate[]>;
  createRitualFallbackInsight(userId: number, run: MonthlyRitualRunRecord): Promise<void>;
}

export interface CreateMonthlyRitualRunInput {
  userId: number;
  journeyType: string | null | undefined;
  now?: Date;
  store: MonthlyRitualStore;
}

export interface PrepareMonthlyRitualRunsInput {
  now?: Date;
  store: MonthlyRitualOrchestratorStore;
}

export interface PrepareMonthlyRitualRunsResult {
  phase: MonthlyRitualPhaseName;
  ritualMonth: string;
  considered: number;
  created: number;
  existing: number;
  skipped: number;
}

const challengeCatalog: Record<MonthlyRitualJourneyType, MonthlyRitualChallenge> = {
  indeciso: {
    key: "choose_three_directions",
    label: "Scegli 3 direzioni",
    body: "Salva tre direzioni che meritano attenzione nel prossimo mese. Non devono essere definitive: devono essere vive.",
  },
  dipendente: {
    key: "update_career_goal",
    label: "Aggiorna un obiettivo carriera",
    body: "Rivedi un obiettivo professionale e rendilo piu' concreto per i prossimi trenta giorni.",
  },
  autonomo: {
    key: "validate_business_micro_hypothesis",
    label: "Valida una micro-ipotesi business",
    body: "Scegli una micro-ipotesi da validare entro 24 ore con un segnale reale: una domanda, una landing, una call o un test.",
  },
  azienda: {
    key: "review_customer_need",
    label: "Rivedi un bisogno o profilo",
    body: "Riapri un bisogno cliente o un profilo target e aggiorna cio' che e' cambiato nel mercato.",
  },
  investitore: {
    key: "save_trend_to_watch",
    label: "Salva un trend da monitorare",
    body: "Scegli un trend, un settore o un segnale da osservare nel prossimo mese e annota perche' conta.",
  },
};

const routeCopy: Record<MonthlyRitualJourneyType, { title: string; body: string }> = {
  indeciso: {
    title: "Rotta del Mese: ritrovare il centro",
    body: "La Notte della Fondazione ti invita a trasformare possibilita' sparse in tre direzioni osservabili.",
  },
  dipendente: {
    title: "Rotta del Mese: avanzamento consapevole",
    body: "Questa notte mette a fuoco il prossimo passo di carriera, con un obiettivo concreto da aggiornare.",
  },
  autonomo: {
    title: "Rotta del Mese: prova sul campo",
    body: "La tua rotta e' una verifica leggera ma reale: una micro-ipotesi deve incontrare il mondo entro 24 ore.",
  },
  azienda: {
    title: "Rotta del Mese: ascolto del mercato",
    body: "Questa notte riporta la strategia al bisogno reale: rivedi un profilo, una domanda o una tensione cliente.",
  },
  investitore: {
    title: "Rotta del Mese: segnali da custodire",
    body: "La tua fondazione del mese e' un segnale da seguire con disciplina: trend, settore o tecnologia emergente.",
  },
};

export function getMonthlyRitualPhase(now = new Date()): MonthlyRitualPhase {
  const parts = getRomeDateParts(now);
  const ritualMonth = `${parts.year}-${parts.month}`;
  const day = Number(parts.day);
  const ritualDate = new Date(`${ritualMonth}-${pad2(MONTHLY_RITUAL_DAY)}T00:00:00.000+02:00`);

  return {
    phase: day === MONTHLY_RITUAL_VIGIL_DAY ? "vigil" : day === MONTHLY_RITUAL_DAY ? "active" : "inactive",
    ritualMonth,
    ritualDate,
    nextRitualDate: getNextMonthlyRitualDate(now),
    nextRitualLocalDate: getNextMonthlyRitualLocalDate(now),
  };
}

export function selectMonthlyRitualChallenge(journeyType: string | null | undefined): MonthlyRitualChallenge {
  return challengeCatalog[normalizeJourneyType(journeyType)];
}

export async function createOrGetMonthlyRitualRun({
  userId,
  journeyType,
  now = new Date(),
  store,
}: CreateMonthlyRitualRunInput): Promise<MonthlyRitualRunRecord> {
  const phase = getMonthlyRitualPhase(now);
  const existing = await store.getRunByUserAndMonth(userId, phase.ritualMonth);
  if (existing) return existing;

  const normalizedJourney = normalizeJourneyType(journeyType);
  const challenge = selectMonthlyRitualChallenge(normalizedJourney);
  const route = routeCopy[normalizedJourney];
  const timestamp = new Date(now);

  return store.createRun({
    userId,
    ritualMonth: phase.ritualMonth,
    ritualDate: phase.ritualDate,
    status: "pending",
    journeyType: normalizedJourney,
    routeTitle: route.title,
    routeBody: route.body,
    challengeKey: challenge.key,
    challengeLabel: challenge.label,
    challengeBody: challenge.body,
    ctaLabel: "Accendi la Scintilla 24h",
    ctaTarget: MONTHLY_RITUAL_ROUTE,
    emailSentAt: null,
    pushSentAt: null,
    proactiveInsightCreatedAt: null,
    openedAt: null,
    completedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

export async function prepareMonthlyRitualRuns({
  now = new Date(),
  store,
}: PrepareMonthlyRitualRunsInput): Promise<PrepareMonthlyRitualRunsResult> {
  const phase = getMonthlyRitualPhase(now);
  if (phase.phase === "inactive") {
    return {
      phase: phase.phase,
      ritualMonth: phase.ritualMonth,
      considered: 0,
      created: 0,
      existing: 0,
      skipped: 0,
    };
  }

  const activeSince = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const users = await store.listEligibleUsers(activeSince);
  let created = 0;
  let existing = 0;
  let skipped = 0;

  for (const user of users) {
    if (!user.lastActiveAt || user.lastActiveAt < activeSince) {
      skipped += 1;
      continue;
    }
    const before = await store.getRunByUserAndMonth(user.id, phase.ritualMonth);
    if (before) {
      existing += 1;
      continue;
    }
    await createOrGetMonthlyRitualRun({
      userId: user.id,
      journeyType: user.journeyType,
      now,
      store,
    });
    created += 1;
  }

  return {
    phase: phase.phase,
    ritualMonth: phase.ritualMonth,
    considered: users.length,
    created,
    existing,
    skipped,
  };
}

export function normalizeJourneyType(journeyType: string | null | undefined): MonthlyRitualJourneyType {
  if (
    journeyType === "dipendente" ||
    journeyType === "autonomo" ||
    journeyType === "azienda" ||
    journeyType === "investitore"
  ) {
    return journeyType;
  }
  return "indeciso";
}

function getRomeDateParts(date: Date): { year: string; month: string; day: string } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: MONTHLY_RITUAL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  return {
    year: requirePart(parts, "year"),
    month: requirePart(parts, "month"),
    day: requirePart(parts, "day"),
  };
}

function getNextMonthlyRitualDate(now: Date): Date {
  return new Date(`${getNextMonthlyRitualLocalDate(now)}T00:00:00.000+02:00`);
}

function getNextMonthlyRitualLocalDate(now: Date): string {
  const parts = getRomeDateParts(now);
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const nextMonth = day <= MONTHLY_RITUAL_DAY ? month : month + 1;
  const nextYear = nextMonth > 12 ? year + 1 : year;
  const normalizedMonth = nextMonth > 12 ? 1 : nextMonth;
  return `${nextYear}-${pad2(normalizedMonth)}-${pad2(MONTHLY_RITUAL_DAY)}`;
}

function requirePart(parts: Intl.DateTimeFormatPart[], type: string): string {
  const value = parts.find((part) => part.type === type)?.value;
  if (!value) throw new Error(`Missing ${type} in ${MONTHLY_RITUAL_TIMEZONE} date`);
  return value;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
