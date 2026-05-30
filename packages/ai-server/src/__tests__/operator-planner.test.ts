import { describe, expect, it } from "vitest";
import { planOperatorTask } from "../operator/planner";

describe("operator planner", () => {
  it("keeps trivial chat on the immediate reply path", () => {
    const plan = planOperatorTask({
      source: "wendy",
      triggerType: "chat_message",
      message: "ciao!",
    });

    expect(plan.primaryDecision).toBe("reply_now");
    expect(plan.actions).toEqual([
      expect.objectContaining({ decision: "reply_now", targetType: "wendy" }),
    ]);
  });

  it("routes long analytical requests to background agent tasks", () => {
    const plan = planOperatorTask({
      source: "wendy",
      triggerType: "chat_message",
      message: "Analizza per me i settori migliori per passare al lavoro autonomo e prepara un report dettagliato.",
    });

    expect(plan.primaryDecision).toBe("agent_task");
    expect(plan.actions).toEqual([
      expect.objectContaining({ decision: "agent_task", targetType: "agent_task" }),
    ]);
  });

  it("routes recurring monitoring requests to routines", () => {
    const plan = planOperatorTask({
      source: "wendy",
      triggerType: "chat_message",
      message: "Ogni settimana monitorami il settore cybersecurity e mandami un aggiornamento.",
    });

    expect(plan.primaryDecision).toBe("routine");
    expect(plan.actions).toEqual([
      expect.objectContaining({ decision: "routine", targetType: "routine" }),
    ]);
  });

  it("turns relevant task completion events into memory and notification actions", () => {
    const plan = planOperatorTask({
      source: "agent",
      triggerType: "agent_task_completed",
      message: "Report completato con raccomandazioni personali.",
      metadata: { taskId: 77, userId: 42 },
    });

    expect(plan.primaryDecision).toBe("memory_update");
    expect(plan.actions).toEqual([
      expect.objectContaining({ decision: "memory_update", targetType: "memory" }),
      expect.objectContaining({ decision: "notification", targetType: "notification" }),
    ]);
  });
});
