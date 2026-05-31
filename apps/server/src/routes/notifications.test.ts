import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { createNotificationsRouter } from "./notifications";
import type {
  AppNotificationRecord,
  NotificationPreferencesRecord,
  NotificationService,
} from "../services/notifications/notification.service";

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("@workspace/db", () => ({
  db: {},
  usersTable: { clerkId: "users.clerk_id" },
}));

function token() {
  return jwt.sign(
    {
      userId: 42,
      name: "Ada",
      email: "ada@example.com",
      role: "user",
      onboardingCompleted: true,
      journeyType: "autonomo",
      stripeSubscriptionId: null,
      testSessionId: null,
    },
    "test-secret",
  );
}

function row(overrides: Partial<AppNotificationRecord> = {}): AppNotificationRecord {
  const now = new Date("2026-05-27T10:00:00.000Z");
  return {
    id: overrides.id ?? 1,
    userId: overrides.userId ?? 42,
    source: overrides.source ?? "system",
    type: overrides.type ?? "test",
    severity: overrides.severity ?? "info",
    title: overrides.title ?? "Titolo",
    body: overrides.body ?? "Corpo",
    ctaLabel: overrides.ctaLabel ?? "Apri",
    ctaUrl: overrides.ctaUrl ?? "/dashboard",
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

function app(service: NotificationService) {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/notifications", createNotificationsRouter({ service }));
  return instance;
}

describe("notifications routes", () => {
  it("requires auth", async () => {
    await request(app(createService())).get("/api/notifications").expect(401);
  });

  it("lists notifications with unread count", async () => {
    const service = createService([row({ id: 7, title: "Nuova rotta" })]);
    const response = await request(app(service))
      .get("/api/notifications?unread=true&limit=10")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body).toMatchObject({
      unreadCount: 1,
      notifications: [{ id: 7, title: "Nuova rotta", source: "system" }],
    });
  });

  it("marks read, opened and dismissed", async () => {
    const service = createService([row({ id: 3 })]);

    await request(app(service))
      .post("/api/notifications/3/read")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);
    await request(app(service))
      .post("/api/notifications/3/open")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);
    await request(app(service))
      .post("/api/notifications/3/dismiss")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(service.markRead).toHaveBeenCalledWith(3, 42);
    expect(service.markOpened).toHaveBeenCalledWith(3, 42);
    expect(service.dismiss).toHaveBeenCalledWith(3, 42);
  });

  it("updates notification preferences", async () => {
    const service = createService();
    const response = await request(app(service))
      .patch("/api/notifications/preferences")
      .set("Authorization", `Bearer ${token()}`)
      .send({ pushEnabled: false, emailEnabled: true })
      .expect(200);

    expect(response.body.preferences).toMatchObject({ pushEnabled: false, emailEnabled: true });
    expect(service.updatePreferences).toHaveBeenCalledWith(42, { pushEnabled: false, emailEnabled: true });
  });
});

function createService(notifications: AppNotificationRecord[] = []): NotificationService {
  const preferences: NotificationPreferencesRecord = {
    inAppEnabled: true,
    pushEnabled: true,
    emailEnabled: false,
  };

  return {
    notify: vi.fn(),
    list: vi.fn(async () => ({
      notifications,
      unreadCount: notifications.filter((item) => !item.readAt).length,
      nextCursor: null,
    })),
    markRead: vi.fn(async (id, userId) => row({ id, userId, readAt: new Date("2026-05-27T10:01:00.000Z") })),
    markAllRead: vi.fn(async () => 1),
    markOpened: vi.fn(async (id, userId) => row({ id, userId, openedAt: new Date("2026-05-27T10:01:00.000Z") })),
    dismiss: vi.fn(async (id, userId) => row({ id, userId, dismissedAt: new Date("2026-05-27T10:01:00.000Z") })),
    getPreferences: vi.fn(async () => preferences),
    updatePreferences: vi.fn(async (_userId, patch) => ({ ...preferences, ...patch })),
  };
}
