import { describe, expect, it } from "vitest";
import { normalizeWendyAction } from "./useWendyActionExecutor";

describe("normalizeWendyAction", () => {
  it("normalizes server Wendy actions to the current action contract", () => {
    const action = normalizeWendyAction({
      name: "open_view",
      result: {
        wendyAction: {
          id: "a1",
          type: "navigate",
          status: "done",
          risk: "low",
          label: "Apro la pagina",
          description: "Ti porto al calendario.",
          requiresConfirmation: false,
          payload: { url: "/calendario" },
          targetRoute: "/calendario",
        },
      },
    });

    expect(action).toMatchObject({
      id: "a1",
      type: "navigate",
      status: "executed",
      risk: "low",
      targetRoute: "/calendario",
    });
  });

  it("keeps write actions in needs_confirmation until the user confirms", () => {
    const action = normalizeWendyAction({
      name: "add_calendar_event",
      result: {
        wendyAction: {
          id: "a2",
          type: "create_calendar_event",
          status: "needs_confirmation",
          risk: "medium",
          label: "Aggiungere questo evento?",
          description: "Conferma prima di inserirlo nel calendario.",
          requiresConfirmation: true,
          payload: { title: "Mentor call", date: "2099-06-12" },
        },
      },
    });

    expect(action).toMatchObject({
      id: "a2",
      type: "create_calendar_event",
      status: "needs_confirmation",
      risk: "medium",
      requiresConfirmation: true,
    });
  });

  it("normalizes Wendy memory save actions", () => {
    const action = normalizeWendyAction({
      name: "save_memory_fact",
      result: {
        wendyAction: {
          id: "a3",
          type: "create_memory_fact",
          status: "needs_confirmation",
          risk: "medium",
          label: "Vuoi che Wendy lo ricordi?",
          description: "Salvo questo fatto solo dopo conferma.",
          requiresConfirmation: true,
          payload: { key: "study_preference", value: "Studia la sera", source: "user_manual" },
          targetRoute: "/wendy/memoria",
        },
      },
    });

    expect(action).toMatchObject({
      id: "a3",
      type: "create_memory_fact",
      status: "needs_confirmation",
      requiresConfirmation: true,
      targetRoute: "/wendy/memoria",
    });
  });
});
