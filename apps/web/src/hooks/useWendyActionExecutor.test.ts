import { describe, expect, it } from "vitest";
import { normalizeWendyAction } from "./useWendyActionExecutor";

describe("normalizeWendyAction", () => {
  it("preserves admin action token and strong confirmation metadata", () => {
    const action = normalizeWendyAction({
      name: "admin_restart_database",
      result: {
        clientSide: true,
        action: "admin_restart_database",
        wendyAction: {
          id: "action-1",
          type: "admin_restart_database",
          status: "needs_confirmation",
          risk: "high",
          label: "Conferma azione ad alto rischio",
          description: "Riavvia il database Postgres.",
          requiresConfirmation: true,
          requiresStrongConfirmation: true,
          confirmationText: "RESTART DATABASE",
          actionToken: "signed-token",
          payload: { service: "postgres" },
          preview: [{ label: "service", value: "postgres" }],
        },
      },
    });

    expect(action).toMatchObject({
      id: "action-1",
      type: "admin_restart_database",
      risk: "high",
      requiresStrongConfirmation: true,
      confirmationText: "RESTART DATABASE",
      actionToken: "signed-token",
    });
  });
});
