import { describe, expect, it } from "vitest";
import {
  confirmAdminWendyAction,
  executeAdminWendyTool,
  getAdminWendyToolDefinition,
} from "./admin-wendy-tools";

describe("admin Wendy tools", () => {
  it("creates a medium-risk action card for admin_run_agent without executing it", async () => {
    const result = await executeAdminWendyTool({
      name: "admin_run_agent",
      args: { agentKey: "collector" },
      adminUserId: 7,
      requestId: "req_1",
      secret: "test-secret",
      now: 1_000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const data = result.data as { wendyAction: Record<string, unknown> };
    expect(result.data).toMatchObject({
      clientSide: true,
      action: "admin_run_agent",
    });
    expect(data.wendyAction).toMatchObject({
      type: "admin_run_agent",
      risk: "medium",
      requiresConfirmation: true,
      requiresStrongConfirmation: false,
      payload: { agentKey: "collector" },
    });
    expect(data.wendyAction.actionToken).toEqual(expect.any(String));
  });

  it("requires strong confirmation for database restart", async () => {
    const result = await executeAdminWendyTool({
      name: "admin_restart_database",
      args: {},
      adminUserId: 7,
      requestId: "req_2",
      secret: "test-secret",
      now: 1_000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const data = result.data as { wendyAction: { actionToken: string } & Record<string, unknown> };
    expect(data.wendyAction).toMatchObject({
      type: "admin_restart_database",
      risk: "high",
      requiresStrongConfirmation: true,
      confirmationText: "RESTART DATABASE",
    });

    await expect(
      confirmAdminWendyAction({
        actionToken: data.wendyAction.actionToken,
        confirmationText: "restart database",
        adminUserId: 7,
        secret: "test-secret",
        now: 2_000,
        audit: async () => undefined,
      }),
    ).rejects.toThrow('Strong confirmation required: type "RESTART DATABASE"');
  });

  it("reports Printing Press as unavailable when disabled", async () => {
    const result = await executeAdminWendyTool({
      name: "admin_printing_press_generate",
      args: { operation: "generate_cli_from_spec" },
      adminUserId: 7,
      requestId: "req_3",
      secret: "test-secret",
      now: 1_000,
      env: {},
    });

    expect(result).toEqual({
      ok: false,
      code: "PRINTING_PRESS_DISABLED",
      message: "Printing Press bridge non configurato per Wendy Admin.",
    });
  });

  it("creates a medium-risk action card for the Research -> Review -> Publish pipeline", async () => {
    const result = await executeAdminWendyTool({
      name: "admin_pipeline_start",
      args: { templateId: "research-review-publish", topics: ["focus lavoro"] },
      adminUserId: 7,
      requestId: "req_pipeline",
      secret: "test-secret",
      now: 1_000,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const data = result.data as { wendyAction: Record<string, unknown> };
    expect(result.data).toMatchObject({
      clientSide: true,
      action: "admin_pipeline_start",
    });
    expect(data.wendyAction).toMatchObject({
      type: "admin_pipeline_start",
      risk: "medium",
      requiresConfirmation: true,
      payload: {
        templateId: "research-review-publish",
        topics: ["focus lavoro"],
      },
    });
  });

  it("keeps public and admin registries named separately", () => {
    expect(getAdminWendyToolDefinition("admin_ops_status")?.name).toBe("admin_ops_status");
    expect(getAdminWendyToolDefinition("search_rag")).toBeNull();
  });
});
