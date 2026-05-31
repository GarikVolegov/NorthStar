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

    expect(prompts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: expect.stringMatching(/obiettiv|progresso/i),
          prompt: expect.stringMatching(/strumenti dell'app|app/i),
        }),
      ]),
    );
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
});
