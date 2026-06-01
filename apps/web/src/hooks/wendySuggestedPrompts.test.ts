import { describe, expect, it } from "vitest";
import {
  buildWendyFallbackSuggestedPrompts,
  withWendySuggestedPromptFallback,
} from "./wendySuggestedPrompts";

describe("wendySuggestedPrompts", () => {
  it("orients objective and progress fallbacks toward app tools", () => {
    const prompts = buildWendyFallbackSuggestedPrompts(
      "Il tuo obiettivo e al 40%: aggiorna il progresso e scegli il prossimo checkpoint.",
    );

    const progressPrompt = prompts.find((prompt) => /obiettiv|progresso/i.test(prompt.label));
    expect(progressPrompt?.prompt).toMatch(/strumenti dell'app|app/i);
  });

  it("removes empty or duplicate backend prompts and fills the set with fallbacks", () => {
    const prompts = withWendySuggestedPromptFallback(
      [
        { label: "  ", prompt: "  " },
        { label: "Piano", prompt: "Trasforma in piano" },
        { label: "Piano duplicato", prompt: " trasforma in piano " },
      ],
      "Il tuo profilo mostra affinita con prodotto e dati.",
    );

    expect(prompts).toHaveLength(3);
    expect(prompts).toEqual(
      expect.arrayContaining([
        { label: "Piano", prompt: "Trasforma in piano" },
        expect.objectContaining({ label: "Usa il profilo" }),
      ]),
    );
  });

  it("prioritizes the adaptive dashboard next action when page context provides it", () => {
    const prompts = buildWendyFallbackSuggestedPrompts("Wendy non ha prodotto suggerimenti.", {
      page: "dashboard",
      title: "Dashboard",
      data: {
        adaptivePhase: "explore_sectors",
        adaptiveNextAction: {
          label: "Esplora settori",
          href: "/settori",
          sectionId: "discovery_feed",
        },
      },
    });

    expect(prompts[0]?.label).toBe("Esplora settori");
    expect(prompts[0]?.prompt).toMatch(/explore_sectors.*Esplora settori.*\/settori/i);
  });
});
