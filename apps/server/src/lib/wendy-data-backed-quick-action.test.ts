import { describe, expect, it } from "vitest";
import {
  buildWendyDataBackedSuggestedPrompts,
  classifyWendyDataBackedQuickAction,
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
    expect(classifyWendyDataBackedQuickAction("Segna questa attivita come completata")).toBe("complete");
    expect(classifyWendyDataBackedQuickAction("What should I do today?")).toBe("today");
    expect(classifyWendyDataBackedQuickAction("What is my next step?")).toBe("today");
    expect(classifyWendyDataBackedQuickAction("Analyze my profile and tell me the next move")).toBe("profile");
    expect(classifyWendyDataBackedQuickAction("Which sectors fit me best?")).toBe("sectors");
    expect(classifyWendyDataBackedQuickAction("Mark this task as completed")).toBe("complete");
    expect(classifyWendyDataBackedQuickAction("I already did the test, which sector should I choose?")).toBe("sectors");
  });

  it("builds coherent Italian suggested prompts for fallback quick actions", () => {
    const prompts = buildWendyDataBackedSuggestedPrompts({
      kind: "today",
      locale: "it",
    });

    expect(prompts).toHaveLength(3);
    expect(prompts.map((prompt) => prompt.prompt).join(" ")).toMatch(/oggi|25 minuti|obiettivo/i);
    expect(prompts.map((prompt) => prompt.prompt).join(" ")).not.toContain("I can still help");
  });

  it("builds coherent sector prompts from the same quick-action intent", () => {
    const prompts = buildWendyDataBackedSuggestedPrompts({
      kind: "sectors",
      locale: "it",
    });

    expect(prompts.length).toBeGreaterThanOrEqual(2);
    expect(prompts.length).toBeLessThanOrEqual(3);
    expect(prompts.map((prompt) => prompt.prompt).join(" ")).toMatch(/settori|profilo|fit/i);
  });

  it("builds completion prompts that keep Wendy moving forward", () => {
    const prompts = buildWendyDataBackedSuggestedPrompts({
      kind: "complete",
      locale: "it",
    });

    expect(prompts).toHaveLength(3);
    expect(prompts.map((prompt) => prompt.prompt).join(" ")).toMatch(/completata|progressi|prossimo/i);
  });
});
