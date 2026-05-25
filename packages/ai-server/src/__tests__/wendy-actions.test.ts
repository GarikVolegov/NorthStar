import { describe, expect, it } from "vitest";
import { executeToolCall } from "../wendy-router/tool-handlers";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

describe("Wendy action contract", () => {
  it("prepares calendar writes as confirmation-gated actions", async () => {
    const result = await executeToolCall(
      "add_calendar_event",
      {
        title: "Colloquio con mentor",
        date: "2099-06-12",
        type: "interview",
        notes: "Preparare portfolio",
      },
      7,
    );

    expect(result.ok).toBe(true);
    const data = result.ok ? asRecord(result.data) : {};
    const action = asRecord(data.wendyAction);

    expect(data).toMatchObject({
      clientSide: true,
      action: "create_calendar_event",
    });
    expect(action).toMatchObject({
      type: "create_calendar_event",
      status: "needs_confirmation",
      risk: "medium",
      requiresConfirmation: true,
      targetRoute: "/calendario",
    });
    expect(action.payload).toMatchObject({
      title: "Colloquio con mentor",
      date: "2099-06-12",
      category: "interview",
      notes: "Preparare portfolio",
    });
  });

  it("keeps navigation actions immediate and low risk", async () => {
    const result = await executeToolCall(
      "open_view",
      { viewId: "settore", entityId: 12, entityName: "Cybersecurity" },
      7,
    );

    expect(result.ok).toBe(true);
    const data = result.ok ? asRecord(result.data) : {};
    const action = asRecord(data.wendyAction);

    expect(action).toMatchObject({
      type: "navigate",
      status: "executed",
      risk: "low",
      requiresConfirmation: false,
      targetRoute: "/settore/12",
    });
  });

  it("prepares memory writes as confirmation-gated actions", async () => {
    const result = await executeToolCall(
      "save_memory_fact",
      {
        key: "study_preference",
        value: "Preferisce studiare la sera",
      },
      7,
    );

    expect(result.ok).toBe(true);
    const data = result.ok ? asRecord(result.data) : {};
    const action = asRecord(data.wendyAction);

    expect(action).toMatchObject({
      type: "create_memory_fact",
      status: "needs_confirmation",
      risk: "medium",
      requiresConfirmation: true,
      targetRoute: "/wendy/memoria",
    });
    expect(action.payload).toMatchObject({
      key: "study_preference",
      value: "Preferisce studiare la sera",
      source: "user_manual",
    });
  });
});
