import { and, count, desc, eq, gt, isNull, lt, or } from "drizzle-orm";
import {
  appNotificationsTable,
  db,
  notificationDeliveriesTable,
  notificationPreferencesTable,
  userProfileSettingsTable,
  userPushSubscriptionsTable,
  usersTable,
} from "@workspace/db";
import type { SQL } from "drizzle-orm";
import { resolveLogoPreset, type LogoPreset } from "@workspace/api-zod/logo-presets";
import { getWss } from "../../ws";
import { rootLogger } from "../../middleware/logger";
import { sendAppNotificationEmail } from "../../lib/email";
import { isPersistenceSchemaError } from "../../lib/persistence";

export type NotificationSource =
  | "system"
  | "wendy"
  | "monthly_ritual"
  | "calendar"
  | "agent"
  | "pipeline"
  | "social"
  | "proactive_insight";
export type NotificationSeverity = "info" | "success" | "warning" | "urgent";
export type NotificationChannel = "in_app" | "push" | "email";
export type NotificationDeliveryStatus = "pending" | "sent" | "failed" | "skipped";

export interface AppNotificationRecord {
  id: number;
  userId: number;
  source: NotificationSource;
  type: string;
  severity: NotificationSeverity;
  title: string;
  body: string | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  iconKey: string;
  dedupeKey: string | null;
  metadata: Record<string, unknown>;
  readAt: Date | null;
  openedAt: Date | null;
  dismissedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface NotificationPreferencesRecord {
  inAppEnabled: boolean;
  pushEnabled: boolean;
  emailEnabled: boolean;
}

export interface PushSubscriptionRecord {
  id: number;
  userId: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type NotificationLogoPreset = Pick<LogoPreset, "id" | "notificationIconUrl" | "badgeUrl">;

export interface CreateNotificationInput {
  userId: number;
  source: NotificationSource;
  type: string;
  severity: NotificationSeverity;
  title: string;
  body?: string | null;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  iconKey?: string;
  dedupeKey?: string | null;
  metadata?: Record<string, unknown>;
  expiresAt?: Date | null;
}

export interface NotificationStore {
  createNotification(input: CreateNotificationInput): Promise<{ notification: AppNotificationRecord; created: boolean }>;
  createDelivery(input: { notificationId: number; channel: NotificationChannel; status: NotificationDeliveryStatus; error?: string | null }): Promise<void>;
  updateDeliveryStatus(notificationId: number, channel: NotificationChannel, status: NotificationDeliveryStatus, error?: string | null): Promise<void>;
  getPreferences(userId: number): Promise<NotificationPreferencesRecord>;
  getUserLogoPreset?(userId: number): Promise<NotificationLogoPreset>;
  listPushSubscriptions(userId: number): Promise<PushSubscriptionRecord[]>;
  getUserEmail(userId: number): Promise<{ email: string; name: string | null } | null>;
  listNotifications(userId: number, options: { unread?: boolean; limit: number; cursor?: number | null }): Promise<{
    notifications: AppNotificationRecord[];
    unreadCount: number;
    nextCursor: number | null;
  }>;
  markRead(id: number, userId: number, now: Date): Promise<AppNotificationRecord | null>;
  markAllRead(userId: number, now: Date): Promise<number>;
  markOpened(id: number, userId: number, now: Date): Promise<AppNotificationRecord | null>;
  dismiss(id: number, userId: number, now: Date): Promise<AppNotificationRecord | null>;
  updatePreferences(userId: number, patch: Partial<NotificationPreferencesRecord>): Promise<NotificationPreferencesRecord>;
}

export interface NotifyInput extends CreateNotificationInput {
  channels?: NotificationChannel[];
}

export interface NotificationService {
  notify(input: NotifyInput): Promise<{ notification: AppNotificationRecord; created: boolean }>;
  list(userId: number, options?: { unread?: boolean; limit?: number; cursor?: number | null }): Promise<{
    notifications: AppNotificationRecord[];
    unreadCount: number;
    nextCursor: number | null;
  }>;
  markRead(id: number, userId: number): Promise<AppNotificationRecord | null>;
  markAllRead(userId: number): Promise<number>;
  markOpened(id: number, userId: number): Promise<AppNotificationRecord | null>;
  dismiss(id: number, userId: number): Promise<AppNotificationRecord | null>;
  getPreferences(userId: number): Promise<NotificationPreferencesRecord>;
  updatePreferences(userId: number, patch: Partial<NotificationPreferencesRecord>): Promise<NotificationPreferencesRecord>;
}

type PushSender = (
  subscription: PushSubscriptionRecord,
  payload: {
    notificationId: number;
    title: string;
    body: string;
    url: string;
    tag: string;
    iconKey: string;
    source: NotificationSource;
    iconUrl: string;
    badgeUrl: string;
  },
) => Promise<{ ok: boolean; skipped?: boolean; error?: string }>;

export function createNotificationService({
  store = dbNotificationStore,
  emitRealtime = emitNotificationRealtime,
  sendPush = createWebPushNotificationSender(),
  sendEmail = defaultEmailSender,
}: {
  store?: NotificationStore;
  emitRealtime?: (userId: number, notification: AppNotificationRecord) => void;
  sendPush?: PushSender;
  sendEmail?: (toEmail: string, notification: AppNotificationRecord, userName?: string | null) => Promise<void>;
} = {}): NotificationService {
  return {
    async notify(input) {
      const channels = input.channels?.length ? input.channels : ["in_app"];
      const { notification, created } = await store.createNotification({
        ...input,
        body: input.body ?? null,
        ctaLabel: input.ctaLabel ?? null,
        ctaUrl: input.ctaUrl ?? null,
        iconKey: input.iconKey ?? "bell",
        dedupeKey: input.dedupeKey ?? null,
        metadata: input.metadata ?? {},
        expiresAt: input.expiresAt ?? null,
      });

      if (!created) return { notification, created };

      await store.createDelivery({ notificationId: notification.id, channel: "in_app", status: "sent" });
      emitRealtime(notification.userId, notification);

      const preferences = await store.getPreferences(notification.userId);
      if (channels.includes("push")) {
        await deliverPush(notification, preferences, store, sendPush);
      }
      if (channels.includes("email")) {
        await deliverEmail(notification, preferences, store, sendEmail);
      }

      return { notification, created };
    },

    list(userId, options = {}) {
      return store.listNotifications(userId, {
        ...(options.unread !== undefined ? { unread: options.unread } : {}),
        limit: clampLimit(options.limit),
        cursor: options.cursor ?? null,
      });
    },

    markRead(id, userId) {
      return store.markRead(id, userId, new Date());
    },

    markAllRead(userId) {
      return store.markAllRead(userId, new Date());
    },

    markOpened(id, userId) {
      return store.markOpened(id, userId, new Date());
    },

    dismiss(id, userId) {
      return store.dismiss(id, userId, new Date());
    },

    getPreferences(userId) {
      return store.getPreferences(userId);
    },

    updatePreferences(userId, patch) {
      return store.updatePreferences(userId, patch);
    },
  };
}

async function deliverPush(
  notification: AppNotificationRecord,
  preferences: NotificationPreferencesRecord,
  store: NotificationStore,
  sendPush: PushSender,
) {
  if (!preferences.pushEnabled) {
    await store.createDelivery({ notificationId: notification.id, channel: "push", status: "skipped", error: "preference_disabled" });
    return;
  }

  const subscriptions = await store.listPushSubscriptions(notification.userId);
  if (subscriptions.length === 0) {
    await store.createDelivery({ notificationId: notification.id, channel: "push", status: "skipped", error: "no_subscription" });
    return;
  }

  let success = false;
  let lastError: string | null = null;
  const logoPreset = store.getUserLogoPreset
    ? await store.getUserLogoPreset(notification.userId)
    : resolveLogoPreset(null);
  const payload = {
    notificationId: notification.id,
    title: notification.title,
    body: notification.body ?? "",
    url: notification.ctaUrl ?? "/dashboard",
    tag: notification.dedupeKey ?? `northstar-notification-${notification.id}`,
    iconKey: notification.iconKey,
    source: notification.source,
    iconUrl: logoPreset.notificationIconUrl,
    badgeUrl: logoPreset.badgeUrl,
  };

  for (const subscription of subscriptions) {
    const result = await sendPush(subscription, payload);
    success = success || result.ok;
    lastError = result.error ?? lastError;
  }

  await store.createDelivery({
    notificationId: notification.id,
    channel: "push",
    status: success ? "sent" : "failed",
    error: success ? null : lastError ?? "push_failed",
  });
}

async function deliverEmail(
  notification: AppNotificationRecord,
  preferences: NotificationPreferencesRecord,
  store: NotificationStore,
  sendEmail: (toEmail: string, notification: AppNotificationRecord, userName?: string | null) => Promise<void>,
) {
  if (!preferences.emailEnabled) {
    await store.createDelivery({ notificationId: notification.id, channel: "email", status: "skipped", error: "preference_disabled" });
    return;
  }

  const user = await store.getUserEmail(notification.userId);
  if (!user?.email) {
    await store.createDelivery({ notificationId: notification.id, channel: "email", status: "skipped", error: "missing_email" });
    return;
  }

  try {
    await sendEmail(user.email, notification, user.name);
    await store.createDelivery({ notificationId: notification.id, channel: "email", status: "sent" });
  } catch (err) {
    await store.createDelivery({
      notificationId: notification.id,
      channel: "email",
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function clampLimit(limit?: number) {
  if (!limit || Number.isNaN(limit)) return 20;
  return Math.max(1, Math.min(100, Math.floor(limit)));
}

function mapNotification(row: typeof appNotificationsTable.$inferSelect): AppNotificationRecord {
  return {
    id: row.id,
    userId: row.userId,
    source: row.source as NotificationSource,
    type: row.type,
    severity: row.severity as NotificationSeverity,
    title: row.title,
    body: row.body,
    ctaLabel: row.ctaLabel,
    ctaUrl: row.ctaUrl,
    iconKey: row.iconKey,
    dedupeKey: row.dedupeKey,
    metadata: row.metadata ?? {},
    readAt: row.readAt,
    openedAt: row.openedAt,
    dismissedAt: row.dismissedAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const dbNotificationStore: NotificationStore = {
  async createNotification(input) {
    const [row] = await db
      .insert(appNotificationsTable)
      .values({
        userId: input.userId,
        source: input.source,
        type: input.type,
        severity: input.severity,
        title: input.title,
        body: input.body ?? null,
        ctaLabel: input.ctaLabel ?? null,
        ctaUrl: input.ctaUrl ?? null,
        iconKey: input.iconKey ?? "bell",
        dedupeKey: input.dedupeKey ?? null,
        metadata: input.metadata ?? {},
        expiresAt: input.expiresAt ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoNothing({
        target: [appNotificationsTable.userId, appNotificationsTable.dedupeKey],
      })
      .returning();

    if (row) return { notification: mapNotification(row), created: true };
    if (!input.dedupeKey) throw new Error("Notification was not created");

    const [existing] = await db
      .select()
      .from(appNotificationsTable)
      .where(and(eq(appNotificationsTable.userId, input.userId), eq(appNotificationsTable.dedupeKey, input.dedupeKey)))
      .limit(1);
    if (!existing) throw new Error("Notification conflict row was not found");
    return { notification: mapNotification(existing), created: false };
  },

  async createDelivery(input) {
    await db.insert(notificationDeliveriesTable).values({
      notificationId: input.notificationId,
      channel: input.channel,
      status: input.status,
      error: input.error ?? null,
      updatedAt: new Date(),
    });
  },

  async updateDeliveryStatus(notificationId, channel, status, error) {
    await this.createDelivery({
      notificationId,
      channel,
      status,
      ...(error !== undefined ? { error } : {}),
    });
  },

  async getPreferences(userId) {
    const [row] = await db
      .select({
        inAppEnabled: notificationPreferencesTable.inAppEnabled,
        pushEnabled: notificationPreferencesTable.pushEnabled,
        emailEnabled: notificationPreferencesTable.emailEnabled,
      })
      .from(notificationPreferencesTable)
      .where(eq(notificationPreferencesTable.userId, userId))
      .limit(1);
    return row ?? { inAppEnabled: true, pushEnabled: true, emailEnabled: false };
  },

  async getUserLogoPreset(userId) {
    let preset = resolveLogoPreset(null);
    try {
      const [row] = await db
        .select({ activeLogoPreset: userProfileSettingsTable.activeLogoPreset })
        .from(userProfileSettingsTable)
        .where(eq(userProfileSettingsTable.userId, userId))
        .limit(1);
      preset = resolveLogoPreset(row?.activeLogoPreset);
    } catch (err) {
      if (!isPersistenceSchemaError(err)) throw err;
    }
    return {
      id: preset.id,
      notificationIconUrl: preset.notificationIconUrl,
      badgeUrl: preset.badgeUrl,
    };
  },

  async listPushSubscriptions(userId) {
    const rows = await db
      .select({
        id: userPushSubscriptionsTable.id,
        userId: userPushSubscriptionsTable.userId,
        endpoint: userPushSubscriptionsTable.endpoint,
        p256dh: userPushSubscriptionsTable.p256dh,
        auth: userPushSubscriptionsTable.auth,
      })
      .from(userPushSubscriptionsTable)
      .where(and(eq(userPushSubscriptionsTable.userId, userId), isNull(userPushSubscriptionsTable.revokedAt)));
    return rows;
  },

  async getUserEmail(userId) {
    const [row] = await db
      .select({ email: usersTable.email, name: usersTable.name })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    return row ?? null;
  },

  async listNotifications(userId, options) {
    const now = new Date();
    const conditions: SQL[] = [
      eq(appNotificationsTable.userId, userId),
      isNull(appNotificationsTable.dismissedAt),
      or(isNull(appNotificationsTable.expiresAt), gt(appNotificationsTable.expiresAt, now))!,
    ];
    if (options.unread) conditions.push(isNull(appNotificationsTable.readAt));
    if (options.cursor) conditions.push(lt(appNotificationsTable.id, options.cursor));

    const rows = await db
      .select()
      .from(appNotificationsTable)
      .where(and(...conditions))
      .orderBy(desc(appNotificationsTable.createdAt), desc(appNotificationsTable.id))
      .limit(options.limit + 1);
    const visibleRows = rows.slice(0, options.limit);
    const nextCursor = rows.length > options.limit ? rows[options.limit]?.id ?? null : null;

    const [unread] = await db
      .select({ value: count() })
      .from(appNotificationsTable)
      .where(and(eq(appNotificationsTable.userId, userId), isNull(appNotificationsTable.readAt), isNull(appNotificationsTable.dismissedAt)));

    return {
      notifications: visibleRows.map(mapNotification),
      unreadCount: unread?.value ?? 0,
      nextCursor,
    };
  },

  async markRead(id, userId, now) {
    const [row] = await db
      .update(appNotificationsTable)
      .set({ readAt: now, updatedAt: now })
      .where(and(eq(appNotificationsTable.id, id), eq(appNotificationsTable.userId, userId)))
      .returning();
    return row ? mapNotification(row) : null;
  },

  async markAllRead(userId, now) {
    const rows = await db
      .update(appNotificationsTable)
      .set({ readAt: now, updatedAt: now })
      .where(and(eq(appNotificationsTable.userId, userId), isNull(appNotificationsTable.readAt)))
      .returning({ id: appNotificationsTable.id });
    return rows.length;
  },

  async markOpened(id, userId, now) {
    const [row] = await db
      .update(appNotificationsTable)
      .set({ openedAt: now, readAt: now, updatedAt: now })
      .where(and(eq(appNotificationsTable.id, id), eq(appNotificationsTable.userId, userId)))
      .returning();
    return row ? mapNotification(row) : null;
  },

  async dismiss(id, userId, now) {
    const [row] = await db
      .update(appNotificationsTable)
      .set({ dismissedAt: now, updatedAt: now })
      .where(and(eq(appNotificationsTable.id, id), eq(appNotificationsTable.userId, userId)))
      .returning();
    return row ? mapNotification(row) : null;
  },

  async updatePreferences(userId, patch) {
    const current = await this.getPreferences(userId);
    const next = {
      inAppEnabled: patch.inAppEnabled ?? current.inAppEnabled,
      pushEnabled: patch.pushEnabled ?? current.pushEnabled,
      emailEnabled: patch.emailEnabled ?? current.emailEnabled,
    };
    const [row] = await db
      .insert(notificationPreferencesTable)
      .values({ userId, ...next, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: notificationPreferencesTable.userId,
        set: { ...next, updatedAt: new Date() },
      })
      .returning({
        inAppEnabled: notificationPreferencesTable.inAppEnabled,
        pushEnabled: notificationPreferencesTable.pushEnabled,
        emailEnabled: notificationPreferencesTable.emailEnabled,
      });
    return row ?? next;
  },
};

function emitNotificationRealtime(userId: number, notification: AppNotificationRecord) {
  const wss = getWss();
  if (!wss) return;
  wss.emit(userId, { type: "notification:new", payload: notification });
}

function defaultEmailSender(toEmail: string, notification: AppNotificationRecord, userName?: string | null) {
  return sendAppNotificationEmail(toEmail, {
    userName: userName ?? "utente",
    title: notification.title,
    body: notification.body ?? "",
    ...(notification.ctaLabel ? { ctaLabel: notification.ctaLabel } : {}),
    ...(notification.ctaUrl ? { ctaUrl: notification.ctaUrl } : {}),
  });
}

export function createWebPushNotificationSender(): PushSender {
  return async (subscription, payload) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT ?? "mailto:info@northstar.app";
    if (!publicKey || !privateKey) {
      rootLogger.info({ endpoint: subscription.endpoint }, "[notifications] push skipped, VAPID keys missing");
      return { ok: false, skipped: true, error: "vapid_missing" };
    }

    try {
      const webPushModule = await import("web-push");
      const webPush = webPushModule.default ?? webPushModule;
      webPush.setVapidDetails(subject, publicKey, privateKey);
      await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload),
      );
      return { ok: true };
    } catch (err) {
      rootLogger.warn({ err, endpoint: subscription.endpoint }, "[notifications] push failed");
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  };
}

export const notificationService = createNotificationService();
