import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  checkDatabaseHealth: vi.fn(),
  pool: { totalCount: 0, idleCount: 0, waitingCount: 0 },
}));

vi.mock("./maintenance-mode", () => ({
  getMaintenanceMode: vi.fn().mockResolvedValue({ enabled: false }),
}));

import { parseComposePs, splitServices, validateOpsAction } from "./admin-ops";

describe("admin ops helpers", () => {
  beforeEach(() => {
    delete process.env.ADMIN_OPS_ENABLED;
    delete process.env.ADMIN_OPS_ALLOWED_SERVICES;
    delete process.env.ADMIN_OPS_ALLOW_DB_RESTART;
    delete process.env.ADMIN_OPS_REQUIRE_CONFIRMATION;
  });

  it("splits only allowed services", () => {
    expect(splitServices("postgres,unknown, redis ,northstar-server")).toEqual([
      "postgres",
      "redis",
      "northstar-server",
    ]);
  });

  it("parses docker compose JSON arrays", () => {
    expect(
      parseComposePs(
        JSON.stringify([
          { Service: "postgres", State: "running" },
          { Service: "redis", State: "exited" },
        ]),
      ),
    ).toEqual({ postgres: "running", redis: "stopped" });
  });

  it("parses docker compose JSON lines and ignores noise", () => {
    const output = [
      JSON.stringify({ Name: "northstar-server", Status: "running" }),
      "not-json",
      JSON.stringify({ Service: "redis", State: "" }),
    ].join("\n");

    expect(parseComposePs(output)).toEqual({
      "northstar-server": "running",
      redis: "unknown",
    });
  });

  it("validates service allow-list and confirmation", () => {
    process.env.ADMIN_OPS_ENABLED = "true";
    process.env.ADMIN_OPS_ALLOWED_SERVICES = "northstar-server";

    expect(
      validateOpsAction({ service: "postgres", action: "restart" }),
    ).toMatchObject({ ok: false, status: 400 });

    expect(
      validateOpsAction({ service: "northstar-server", action: "restart" }),
    ).toMatchObject({
      ok: false,
      status: 400,
      expectedConfirmation: "RIAVVIA SERVER",
    });

    expect(
      validateOpsAction({
        service: "northstar-server",
        action: "restart",
        confirmation: "RIAVVIA SERVER",
      }),
    ).toEqual({ ok: true });
  });

  it("validates disabled ops, DB restart switch, and unsupported service actions", () => {
    expect(
      validateOpsAction({
        service: "northstar-server",
        action: "restart",
        confirmation: "RIAVVIA SERVER",
      }),
    ).toMatchObject({ ok: false, status: 403 });

    process.env.ADMIN_OPS_ENABLED = "true";
    process.env.ADMIN_OPS_ALLOWED_SERVICES = "postgres,redis";
    process.env.ADMIN_OPS_REQUIRE_CONFIRMATION = "false";

    expect(
      validateOpsAction({ service: "postgres", action: "restart" }),
    ).toMatchObject({ ok: false, status: 403 });

    process.env.ADMIN_OPS_ALLOW_DB_RESTART = "true";
    expect(
      validateOpsAction({ service: "postgres", action: "restart" }),
    ).toEqual({ ok: true });

    expect(
      validateOpsAction({ service: "redis", action: "restart" }),
    ).toMatchObject({ ok: false, status: 400 });
  });
});
