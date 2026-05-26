import { describe, expect, it } from "vitest";
import {
  createAdminWendyActionToken,
  verifyAdminWendyActionToken,
} from "./admin-wendy-actions";

describe("admin Wendy action tokens", () => {
  it("verifies a signed token for the same admin user", () => {
    const token = createAdminWendyActionToken({
      secret: "test-secret",
      now: 1_000,
      ttlMs: 60_000,
      action: {
        actionId: "act_1",
        toolName: "admin_run_agent",
        risk: "medium",
        section: "agents",
        adminUserId: 7,
        payload: { agentKey: "collector" },
        requestId: "req_1",
      },
    });

    const verified = verifyAdminWendyActionToken({
      token,
      secret: "test-secret",
      now: 2_000,
      adminUserId: 7,
    });

    expect(verified.toolName).toBe("admin_run_agent");
    expect(verified.payload).toEqual({ agentKey: "collector" });
  });

  it("rejects tampered tokens", () => {
    const token = createAdminWendyActionToken({
      secret: "test-secret",
      now: 1_000,
      ttlMs: 60_000,
      action: {
        actionId: "act_1",
        toolName: "admin_run_agent",
        risk: "medium",
        section: "agents",
        adminUserId: 7,
        payload: { agentKey: "collector" },
        requestId: "req_1",
      },
    });

    expect(() =>
      verifyAdminWendyActionToken({
        token: `${token.slice(0, -2)}xx`,
        secret: "test-secret",
        now: 2_000,
        adminUserId: 7,
      }),
    ).toThrow("Invalid admin action token");
  });

  it("rejects expired and user-mismatched tokens", () => {
    const token = createAdminWendyActionToken({
      secret: "test-secret",
      now: 1_000,
      ttlMs: 1_000,
      action: {
        actionId: "act_2",
        toolName: "admin_restart_database",
        risk: "high",
        section: "status",
        adminUserId: 7,
        payload: { service: "postgres" },
        requestId: "req_2",
      },
    });

    expect(() =>
      verifyAdminWendyActionToken({
        token,
        secret: "test-secret",
        now: 3_000,
        adminUserId: 7,
      }),
    ).toThrow("Admin action token expired");

    expect(() =>
      verifyAdminWendyActionToken({
        token,
        secret: "test-secret",
        now: 1_500,
        adminUserId: 8,
      }),
    ).toThrow("Admin action token user mismatch");
  });
});
