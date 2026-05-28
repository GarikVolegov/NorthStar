import { sendMonthlyRitualVigilEmail, type MonthlyRitualVigilEmailData } from "../lib/email";
import {
  createOrGetMonthlyRitualRun,
  getMonthlyRitualPhase,
  MONTHLY_RITUAL_ROUTE,
  type MonthlyRitualNotificationStore,
  type MonthlyRitualPhaseName,
  type MonthlyRitualPushSubscriptionRecord,
} from "../services/monthly-ritual/monthly-ritual.service";
import { rootLogger } from "../middleware/logger";
import { notificationService } from "../services/notifications/notification.service";

interface RunMonthlyRitualVigilEmailJobInput {
  now?: Date;
  store?: MonthlyRitualNotificationStore;
  sendEmail?: (toEmail: string, data: MonthlyRitualVigilEmailData) => Promise<void>;
}

export interface MonthlyRitualVigilEmailJobResult {
  phase: MonthlyRitualPhaseName;
  ritualMonth: string;
  candidates: number;
  sent: number;
  skippedAlreadySent: number;
  failed: number;
}

export interface MonthlyRitualPushLaunchJobResult {
  phase: MonthlyRitualPhaseName;
  ritualMonth: string;
  candidates: number;
  sent: number;
  failed: number;
  skippedAlreadySent: number;
  fallbackInsights: number;
}

export type MonthlyRitualPushSender = (
  subscription: MonthlyRitualPushSubscriptionRecord,
  payload: { title: string; body: string; url: string; tag: string },
) => Promise<{ ok: boolean; skipped?: boolean; error?: string }>;

export type MonthlyRitualLaunchNotifier = (input: {
  userId: number;
  ritualMonth: string;
  routeTitle: string;
  ctaTarget: string;
}) => Promise<void>;

export async function runMonthlyRitualVigilEmailJob({
  now = new Date(),
  store,
  sendEmail = sendMonthlyRitualVigilEmail,
}: RunMonthlyRitualVigilEmailJobInput = {}): Promise<MonthlyRitualVigilEmailJobResult> {
  const phase = getMonthlyRitualPhase(now);
  if (phase.phase !== "vigil") {
    return emptyResult(phase.phase, phase.ritualMonth);
  }

  const activeSince = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const currentStore = store ?? await getDefaultStore();
  const candidates = await currentStore.listEmailReminderCandidates(activeSince);
  let sent = 0;
  let skippedAlreadySent = 0;
  let failed = 0;

  for (const candidate of candidates) {
    const run = await createOrGetMonthlyRitualRun({
      userId: candidate.userId,
      journeyType: candidate.journeyType,
      now,
      store: currentStore,
    });
    if (run.emailSentAt) {
      skippedAlreadySent += 1;
      continue;
    }

    try {
      await sendEmail(candidate.email, {
        userName: candidate.name,
        ritualUrl: MONTHLY_RITUAL_ROUTE,
      });
      await currentStore.updateRun(run.id, {
        emailSentAt: now,
        updatedAt: now,
      });
      sent += 1;
    } catch (err) {
      failed += 1;
      rootLogger.warn({ err, userId: candidate.userId }, "[monthly-ritual] vigil email failed");
    }
  }

  return {
    phase: phase.phase,
    ritualMonth: phase.ritualMonth,
    candidates: candidates.length,
    sent,
    skippedAlreadySent,
    failed,
  };
}

export async function runMonthlyRitualPushLaunchJob({
  now = new Date(),
  store,
  sendPush = createWebPushSender(),
  notifyLaunch = notifyMonthlyRitualLaunch,
}: {
  now?: Date;
  store?: MonthlyRitualNotificationStore;
  sendPush?: MonthlyRitualPushSender;
  notifyLaunch?: MonthlyRitualLaunchNotifier;
} = {}): Promise<MonthlyRitualPushLaunchJobResult> {
  const phase = getMonthlyRitualPhase(now);
  if (phase.phase !== "active") {
    return emptyPushResult(phase.phase, phase.ritualMonth);
  }

  const currentStore = store ?? await getDefaultStore();
  const activeSince = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const candidates = await currentStore.listPushReminderCandidates(activeSince);
  const byUser = new Map<number, typeof candidates>();
  for (const candidate of candidates) {
    byUser.set(candidate.userId, [...(byUser.get(candidate.userId) ?? []), candidate]);
  }

  let sent = 0;
  let failed = 0;
  let skippedAlreadySent = 0;
  let fallbackInsights = 0;

  for (const [userId, userCandidates] of byUser.entries()) {
    const first = userCandidates[0];
    if (!first) continue;
    const run = await createOrGetMonthlyRitualRun({
      userId,
      journeyType: first.journeyType,
      now,
      store: currentStore,
    });

    if (run.pushSentAt) {
      skippedAlreadySent += userCandidates.length;
      continue;
    }

    try {
      await notifyLaunch({
        userId,
        ritualMonth: run.ritualMonth,
        routeTitle: run.routeTitle,
        ctaTarget: run.ctaTarget,
      });
    } catch (err) {
      rootLogger.warn({ err, userId, ritualMonth: run.ritualMonth }, "[monthly-ritual] app notification failed");
    }

    let userHadSuccess = false;
    for (const candidate of userCandidates) {
      const result = await sendPush(candidate.subscription, {
        title: "E' la Notte della Fondazione",
        body: "Apri la tua Rotta del Mese e accendi la Scintilla 24h.",
        url: MONTHLY_RITUAL_ROUTE,
        tag: "monthly-ritual-notte-fondazione",
      });
      if (result.ok) {
        userHadSuccess = true;
        sent += 1;
      } else {
        failed += 1;
      }
    }

    if (userHadSuccess) {
      await currentStore.updateRun(run.id, { pushSentAt: now, updatedAt: now });
      continue;
    }

    if (!run.proactiveInsightCreatedAt) {
      await currentStore.createRitualFallbackInsight(userId, run);
      await currentStore.updateRun(run.id, { proactiveInsightCreatedAt: now, updatedAt: now });
      fallbackInsights += 1;
    }
  }

  return {
    phase: phase.phase,
    ritualMonth: phase.ritualMonth,
    candidates: candidates.length,
    sent,
    failed,
    skippedAlreadySent,
    fallbackInsights,
  };
}

async function notifyMonthlyRitualLaunch(input: {
  userId: number;
  ritualMonth: string;
  routeTitle: string;
  ctaTarget: string;
}) {
  await notificationService.notify({
    userId: input.userId,
    source: "monthly_ritual",
    type: "launch",
    severity: "info",
    title: "E' la Notte della Fondazione",
    body: `${input.routeTitle}: apri la tua Rotta del Mese e accendi la Scintilla 24h.`,
    ctaLabel: "Apri il rito",
    ctaUrl: input.ctaTarget,
    iconKey: "moon-star",
    dedupeKey: `monthly-ritual:${input.userId}:${input.ritualMonth}`,
    channels: ["in_app", "push"],
    metadata: { ritualMonth: input.ritualMonth },
  });
}

function emptyResult(phase: MonthlyRitualPhaseName, ritualMonth: string): MonthlyRitualVigilEmailJobResult {
  return {
    phase,
    ritualMonth,
    candidates: 0,
    sent: 0,
    skippedAlreadySent: 0,
    failed: 0,
  };
}

function emptyPushResult(phase: MonthlyRitualPhaseName, ritualMonth: string): MonthlyRitualPushLaunchJobResult {
  return {
    phase,
    ritualMonth,
    candidates: 0,
    sent: 0,
    failed: 0,
    skippedAlreadySent: 0,
    fallbackInsights: 0,
  };
}

export function createWebPushSender(): MonthlyRitualPushSender {
  return async (subscription, payload) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT ?? "mailto:info@northstar.app";
    if (!publicKey || !privateKey) {
      rootLogger.info({ endpoint: subscription.endpoint }, "[monthly-ritual] push skipped, VAPID keys missing");
      return { ok: false, skipped: true, error: "vapid_missing" };
    }

    try {
      const webPushModule = await import("web-push");
      const webPush = webPushModule.default ?? webPushModule;
      webPush.setVapidDetails(subject, publicKey, privateKey);
      await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        JSON.stringify(payload),
      );
      return { ok: true };
    } catch (err) {
      rootLogger.warn({ err, endpoint: subscription.endpoint }, "[monthly-ritual] push failed");
      return { ok: false, error: String(err) };
    }
  };
}

async function getDefaultStore(): Promise<MonthlyRitualNotificationStore> {
  const { dbMonthlyRitualStore } = await import("../services/monthly-ritual/monthly-ritual.repository");
  return dbMonthlyRitualStore;
}
