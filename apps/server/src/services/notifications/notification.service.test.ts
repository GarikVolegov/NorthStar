import { describe, expect, it, vi } from "vitest";
import {
  createNotificationService,
  type AppNotificationRecord,
  type NotificationStore,
} from "./notification.service";

function notification(overrides: Partial<AppNotificationRecord> = {}): AppNotificationRecord {
  const now = new Date("2026-05-27T10:00:00.000Z");
  return {
    id: overrides.id ?? 1,
    userId: overrides.userId ?? 42,
    source: overrides.source ?? "system",
    type: overrides.type ?? "test",
    severity: overrides.severity ?? "info",
    title: overrides.title ?? "Titolo",
    body: overrides.body ?? "Corpo",
    ctaLabel: overrides.ctaLabel ?? null,
    ctaUrl: overrides.ctaUrl ?? null,
    iconKey: overrides.iconKey ?? "bell",
    dedupeKey: overrides.dedupeKey ?? null,
    metadata: overrides.metadata ?? {},
    readAt: overrides.readAt ?? null,
    openedAt: overrides.openedAt ?? null,
    dismissedAt: overrides.dismissedAt ?? null,
    expiresAt: overrides.expiresAt ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
  };
}

function createStore(): NotificationStore & {
  deliveries: Array<{ notificationId: number; channel: string; status: string }>;
  notifications: AppNotificationRecord[];
} {
  const notifications: AppNotificationRecord[] = [];
  return {
    notifications,
    deliveries: [],
    async createNotification(input) {
      const existing = input.dedupeKey
        ? notifications.find((item) => item.userId === input.userId && item.dedupeKey === input.dedupeKey)
        : null;
      if (existing) return { notification: existing, created: false };
      const row = notification({ ...input, id: notifications.length + 1 });
      notifications.push(row);
      return { notification: row, created: true };
    },
    async createDelivery(input) {
      this.deliveries.push(input);
    },
    async updateDeliveryStatus(notificationId, channel, status) {
      this.deliveries.push({ notificationId, channel, status });
    },
    async getPreferences() {
      return { inAppEnabled: true, pushEnabled: true, emailEnabled: true };
    },
    async listPushSubscriptions() {
      return [{ id: 1, userId: 42, endpoint: "https://push.example/1", p256dh: "key", auth: "auth" }];
    },
    async getUserEmail() {
      return { email: "ada@example.com", name: "Ada" };
    },
    async listNotifications() {
      return { notifications, unreadCount: notifications.filter((item) => !item.readAt).length, nextCursor: null };
    },
    async markRead(id, userId, now) {
      const row = notifications.find((item) => item.id === id && item.userId === userId);
      if (!row) return null;
      row.readAt = now;
      row.updatedAt = now;
      return row;
    },
    async markAllRead(userId, now) {
      let count = 0;
      for (const row of notifications) {
        if (row.userId === userId && !row.readAt) {
          row.readAt = now;
          row.updatedAt = now;
          count += 1;
        }
      }
      return count;
    },
    async markOpened(id, userId, now) {
      const row = notifications.find((item) => item.id === id && item.userId === userId);
      if (!row) return null;
      row.openedAt = now;
      row.readAt = row.readAt ?? now;
      row.updatedAt = now;
      return row;
    },
    async dismiss(id, userId, now) {
      const row = notifications.find((item) => item.id === id && item.userId === userId);
      if (!row) return null;
      row.dismissedAt = now;
      row.updatedAt = now;
      return row;
    },
    async updatePreferences(_userId, patch) {
      return {
        inAppEnabled: patch.inAppEnabled ?? true,
        pushEnabled: patch.pushEnabled ?? true,
        emailEnabled: patch.emailEnabled ?? false,
      };
    },
  };
}

describe("notification service", () => {
  it("creates one inbox notification per dedupe key and emits realtime once", async () => {
    const store = createStore();
    const emit = vi.fn();
    const service = createNotificationService({ store, emitRealtime: emit, sendPush: vi.fn(), sendEmail: vi.fn() });

    await service.notify({
      userId: 42,
      source: "monthly_ritual",
      type: "launch",
      severity: "info",
      title: "E' la Notte della Fondazione",
      body: "Apri la tua Rotta del Mese.",
      dedupeKey: "ritual:42:2026-05",
      channels: ["in_app"],
    });
    await service.notify({
      userId: 42,
      source: "monthly_ritual",
      type: "launch",
      severity: "info",
      title: "E' la Notte della Fondazione",
      body: "Apri la tua Rotta del Mese.",
      dedupeKey: "ritual:42:2026-05",
      channels: ["in_app"],
    });

    expect(store.notifications).toHaveLength(1);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it("keeps the inbox notification when push fails and records failed delivery", async () => {
    const store = createStore();
    const service = createNotificationService({
      store,
      emitRealtime: vi.fn(),
      sendPush: vi.fn(async () => ({ ok: false, error: "boom" })),
      sendEmail: vi.fn(),
    });

    const result = await service.notify({
      userId: 42,
      source: "calendar",
      type: "reminder",
      severity: "warning",
      title: "Promemoria",
      body: "Tra poco hai un evento.",
      channels: ["in_app", "push"],
    });

    expect(result.notification.id).toBe(1);
    expect(store.deliveries).toContainEqual({
      notificationId: 1,
      channel: "push",
      status: "failed",
      error: "boom",
    });
  });

  it("includes the user's active logo assets in push payloads", async () => {
    const store = createStore();
    store.getUserLogoPreset = vi.fn(async () => ({
      id: "digital-glitch",
      notificationIconUrl: "/brand/logo-digital-glitch.svg",
      badgeUrl: "/brand/logo-digital-glitch.svg",
    }));
    const sendPush = vi.fn(async () => ({ ok: true }));
    const service = createNotificationService({
      store,
      emitRealtime: vi.fn(),
      sendPush,
      sendEmail: vi.fn(),
    });

    await service.notify({
      userId: 42,
      source: "calendar",
      type: "reminder",
      severity: "info",
      title: "Promemoria",
      channels: ["push"],
    });

    expect(sendPush).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 42 }),
      expect.objectContaining({
        iconUrl: "/brand/logo-digital-glitch.svg",
        badgeUrl: "/brand/logo-digital-glitch.svg",
      }),
    );
  });
});
