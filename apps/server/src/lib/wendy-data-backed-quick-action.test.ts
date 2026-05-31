import { describe, expect, it } from "vitest";
import {
  buildWendyDataBackedGuidedAction,
  classifyWendyDataBackedQuickAction,
  formatWendyDataBackedQuickActionReply,
} from "./wendy-data-backed-quick-action";

describe("wendy data-backed quick actions", () => {
  it("classifies common operational prompts", () => {
    expect(classifyWendyDataBackedQuickAction("Cosa dovrei fare oggi?")).toBe("today");
    expect(classifyWendyDataBackedQuickAction("Che faccio oggi?")).toBe("today");
    expect(classifyWendyDataBackedQuickAction("Cosa dovrei fare domani?")).toBe("today");
    expect(classifyWendyDataBackedQuickAction("Che faccio questa settimana?")).toBe("today");
    expect(classifyWendyDataBackedQuickAction("Qual e la prossima azione?")).toBe("today");
    expect(classifyWendyDataBackedQuickAction("Qual e il prossimo passo?")).toBe("today");
    expect(classifyWendyDataBackedQuickAction("Analizza i miei progressi")).toBe("progress");
    expect(classifyWendyDataBackedQuickAction("Analizza il mio profilo e dimmi la prossima mossa")).toBe("profile");
    expect(classifyWendyDataBackedQuickAction("Quali settori sono piu adatti a me?")).toBe("sectors");
    expect(classifyWendyDataBackedQuickAction("Ho gia fatto il test, che settore scelgo?")).toBe("sectors");
    expect(classifyWendyDataBackedQuickAction("L'ho gia fatto, che settore scelgo?")).toBe("sectors");
    expect(classifyWendyDataBackedQuickAction("What should I do today?")).toBe("today");
    expect(classifyWendyDataBackedQuickAction("What is my next step?")).toBe("today");
    expect(classifyWendyDataBackedQuickAction("Analyze my profile and tell me the next move")).toBe("profile");
    expect(classifyWendyDataBackedQuickAction("Which sectors fit me best?")).toBe("sectors");
    expect(classifyWendyDataBackedQuickAction("I already did the test, which sector should I choose?")).toBe("sectors");
  });

  it("builds a specific today reply from active objectives", () => {
    const reply = formatWendyDataBackedQuickActionReply({
      kind: "today",
      objectives: { objectives: [{ text: "Finire il portfolio", progress: 40 }] },
    });

    expect(reply).toContain("Finire il portfolio");
    expect(reply).toContain("25 minuti");
    expect(reply).not.toContain("risposta rapida e sicura");
  });

  it("builds a sector reply from preferred sectors", () => {
    const reply = formatWendyDataBackedQuickActionReply({
      kind: "sectors",
      userContext: { preferredSectors: [{ name: "Cybersecurity" }, { name: "Data" }] },
    });

    expect(reply).toContain("Cybersecurity");
    expect(reply).toContain("Data");
    expect(reply).toContain("fit personale");
  });

  it("uses profile and objectives when no preferred sectors are available", () => {
    const reply = formatWendyDataBackedQuickActionReply({
      kind: "sectors",
      objectives: { objectives: [{ text: "Costruire un portfolio UX", progress: 20 }] },
      userContext: { journeyType: "autonomo", preferredSectors: [] },
    });

    expect(reply).toContain("autonomo");
    expect(reply).toContain("Costruire un portfolio UX");
    expect(reply).not.toContain("se hai un test recente");
  });

  it("keeps English quick-action replies in English when requested", () => {
    const reply = formatWendyDataBackedQuickActionReply({
      kind: "today",
      locale: "en",
      objectives: { objectives: [{ text: "Finish the portfolio", progress: 40 }] },
    });

    expect(reply).toContain("Finish the portfolio");
    expect(reply).toContain("25 minutes");
    expect(reply).not.toContain("Oggi");
  });

  it("builds a confirmable progress action for today's next step", () => {
    const action = buildWendyDataBackedGuidedAction({
      kind: "today",
      objectives: {
        objectives: [{ id: 42, text: "Finire il portfolio", progress: 40 }],
      },
    });

    expect(action).toEqual({
      toolName: "update_objective_progress",
      args: { objectiveId: 42, progress: 55 },
    });
  });

  it("builds a starter objective action when no objectives exist", () => {
    const action = buildWendyDataBackedGuidedAction({
      kind: "progress",
      objectives: { objectives: [] },
    });

    expect(action).toEqual({
      toolName: "save_objective",
      args: {
        text: "Definire il prossimo passo professionale e completarlo in 25 minuti",
        category: "career",
        deadlineWeeks: 1,
      },
    });
  });

  it("builds a sector exploration action from preferred sectors", () => {
    const action = buildWendyDataBackedGuidedAction({
      kind: "sectors",
      userContext: { preferredSectors: [{ name: "Cybersecurity" }, { name: "Data" }] },
    });

    expect(action).toEqual({
      toolName: "set_filters",
      confirmBeforeExecution: true,
      args: {
        listType: "sectors",
        filters: {
          q: "Cybersecurity",
          source: "wendy_personal_fit",
        },
      },
    });
  });

  it("opens the sector explorer when sector fit needs a visual decision surface", () => {
    const action = buildWendyDataBackedGuidedAction({
      kind: "sectors",
      objectives: { objectives: [{ text: "Costruire un portfolio UX", progress: 20 }] },
      userContext: { journeyType: "autonomo", preferredSectors: [] },
    });

    expect(action).toEqual({
      toolName: "open_view",
      confirmBeforeExecution: true,
      args: { viewId: "settori" },
    });
  });
});
