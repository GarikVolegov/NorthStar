import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const limitMock = vi.hoisted(() => vi.fn());
const whereRowsMock = vi.hoisted(() => vi.fn());

function whereResult() {
  return {
    limit: limitMock,
    then: (onFulfilled: unknown, onRejected: unknown) =>
      whereRowsMock().then(onFulfilled, onRejected),
    catch: (onRejected: unknown) => whereRowsMock().catch(onRejected),
    finally: (onFinally: unknown) => whereRowsMock().finally(onFinally),
  };
}

vi.mock("../lib/jwt-secret", () => ({
  JWT_SECRET: "test-secret",
}));

vi.mock("../middleware/audit", () => ({
  writeAuditLog: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  usersTable: {
    id: "users.id",
    clerkId: "users.clerk_id",
    name: "users.name",
    email: "users.email",
    role: "users.role",
    deletedAt: "users.deleted_at",
    purgedAt: "users.purged_at",
    stripeSubscriptionId: "users.stripe_subscription_id",
    journeyType: "users.journey_type",
    journeyDecidedAt: "users.journey_decided_at",
    journeyDecisionSource: "users.journey_decision_source",
    testSessionId: "users.test_session_id",
    onboardingCompleted: "users.onboarding_completed",
  },
  userProfileSettingsTable: { userId: "profile.user_id" },
  nftCertificatesTable: { userId: "nft.user_id" },
  userObjectivesTable: { userId: "objectives.user_id" },
  coachSessionsTable: { userId: "coach_sessions.user_id" },
  voiceSessionsTable: { userId: "voice_sessions.user_id" },
  messages: { conversationId: "messages.conversation_id" },
  conversations: { id: "conversations.id", userId: "conversations.user_id" },
  businessIdeasTable: { userId: "business_ideas.user_id" },
  coachMemoryFactsTable: { userId: "coach_memory_facts.user_id" },
  coachMemoryPatternsTable: { userId: "coach_memory_patterns.user_id" },
  sessionSummariesTable: { userId: "session_summaries.user_id" },
  affiliateAccountsTable: { userId: "affiliate_accounts.user_id" },
  affiliateCommissionsTable: { affiliateId: "affiliate_commissions.affiliate_id" },
  affiliateWithdrawalsTable: { affiliateId: "affiliate_withdrawals.affiliate_id" },
  affiliateReferralsTable: { affiliateId: "affiliate_referrals.affiliate_id" },
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => whereResult()),
      })),
    })),
  },
}));

import accountRouter from "./account";

function token() {
  return jwt.sign(
    {
      userId: 42,
      name: "Ada",
      email: "ada@example.com",
      role: "user",
      onboardingCompleted: true,
      journeyType: "indeciso",
      stripeSubscriptionId: null,
      testSessionId: null,
    },
    "test-secret",
  );
}

function authUserRow() {
  return {
    id: 42,
    name: "Ada",
    email: "ada@example.com",
    role: "user",
    deletedAt: null,
    purgedAt: null,
    stripeSubscriptionId: null,
    journeyType: "indeciso",
    journeyDecidedAt: null,
    journeyDecisionSource: null,
    testSessionId: null,
    onboardingCompleted: true,
  };
}

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use("/api/account", accountRouter);
  return instance;
}

describe("account persistence-sensitive routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    limitMock.mockResolvedValue([]);
    whereRowsMock.mockResolvedValue([]);
  });

  it("returns an actionable export error when account data cannot be read", async () => {
    limitMock
      .mockResolvedValueOnce([authUserRow()])
      .mockRejectedValueOnce(
        Object.assign(new Error("relation does not exist"), { code: "42P01" }),
      );

    const response = await request(app())
      .get("/api/account/export")
      .set("Authorization", `Bearer ${token()}`)
      .expect(503);

    expect(response.body).toMatchObject({
      status: "error",
      code: "ACCOUNT_EXPORT_UNAVAILABLE",
      action: "retry_after_persistence_restored",
      persistenceUnavailable: true,
    });
  });

  it("exports account data with an explicit safe profile allowlist", async () => {
    limitMock
      .mockResolvedValueOnce([authUserRow()])
      .mockResolvedValueOnce([
        {
          id: 42,
          name: "Ada",
          email: "ada@example.com",
          passwordHash: "hash-should-not-export",
          stripeCustomerId: "cus_secret",
          stripeSubscriptionId: "sub_secret",
          resetToken: "reset-token",
          verificationCode: "123456",
          deletedAt: null,
          purgedAt: null,
          createdAt: new Date("2026-05-01T10:00:00.000Z"),
          updatedAt: new Date("2026-05-02T10:00:00.000Z"),
        },
      ])
      .mockResolvedValueOnce([
        {
          userId: 42,
          username: "ada",
          bio: "Costruisco prodotti utili",
          city: "Milano",
          cvText: "CV raw text",
          cvJson: { title: "CV" },
          backgroundLibrary: [{ id: "user:1", dataUrl: "data:image/png;base64,secret" }],
          referralConvertedAt: new Date("2026-05-03T10:00:00.000Z"),
          isPublic: true,
        },
      ])
      .mockResolvedValue([]);

    const response = await request(app())
      .get("/api/account/export")
      .set("Authorization", `Bearer ${token()}`)
      .expect(200);

    expect(response.body.data.profile).toMatchObject({
      user: {
        id: 42,
        name: "Ada",
        email: "ada@example.com",
      },
      settings: {
        username: "ada",
        bio: "Costruisco prodotti utili",
        city: "Milano",
        isPublic: true,
      },
    });
    expect(JSON.stringify(response.body.data.profile)).not.toContain("passwordHash");
    expect(JSON.stringify(response.body.data.profile)).not.toContain("stripeCustomerId");
    expect(JSON.stringify(response.body.data.profile)).not.toContain("resetToken");
    expect(JSON.stringify(response.body.data.profile)).not.toContain("backgroundLibrary");
  });

  it("returns a conflict with recovery action when deletion was already requested", async () => {
    limitMock
      .mockResolvedValueOnce([authUserRow()])
      .mockResolvedValueOnce([{ id: 42, deletedAt: new Date("2026-05-20T10:00:00.000Z") }]);

    const response = await request(app())
      .delete("/api/account")
      .set("Authorization", `Bearer ${token()}`)
      .expect(409);

    expect(response.body).toMatchObject({
      code: "ACCOUNT_DELETE_ALREADY_REQUESTED",
      action: "check_account_status",
    });
  });
});
