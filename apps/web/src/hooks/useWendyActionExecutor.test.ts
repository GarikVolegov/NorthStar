import { describe, expect, it } from "vitest";
import { normalizeWendyAction } from "./useWendyActionExecutor";

describe("normalizeWendyAction", () => {
  it("normalizes Wendy progress updates as confirmation-gated app actions", () => {
    const action = normalizeWendyAction({
      name: "update_objective_progress",
      result: {
        clientSide: true,
        action: "update_objective_progress",
        wendyAction: {
          id: "progress-1",
          type: "update_objective_progress",
          status: "needs_confirmation",
          risk: "medium",
          label: "Aggiornare il progresso?",
          description: "Conferma prima di modificare questo obiettivo.",
          requiresConfirmation: true,
          payload: { objectiveId: 42, progress: 55 },
          preview: [{ label: "Progresso", value: "55%" }],
        },
      },
    });

    expect(action).toMatchObject({
      id: "progress-1",
      type: "update_objective_progress",
      status: "needs_confirmation",
      requiresConfirmation: true,
      payload: { objectiveId: 42, progress: 55 },
      sourceTool: "update_objective_progress",
    });
  });

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
