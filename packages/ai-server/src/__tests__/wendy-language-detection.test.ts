import { describe, expect, it } from "vitest";
import { detectWendyLanguage, isLikelyItalianWendyMessage } from "../wendy-router/language-detection";

describe("Wendy language detection", () => {
  it("detects Italian prompts even when the browser requested English", () => {
    const prompts = [
      "come funziona l'app?",
      "cosa dovrei fare oggi?",
      "analizza il mio profilo e dimmi la prossima mossa",
      "quali settori sono piu adatti a me?",
      "perche Wendy mi risponde cosi?",
      "ce l'ho gia",
    ];

    for (const message of prompts) {
      expect(detectWendyLanguage({ requestedLocale: "en", message })).toBe("it");
      expect(isLikelyItalianWendyMessage(message)).toBe(true);
    }
  });

  it("keeps non-Italian messages in the requested language", () => {
    expect(detectWendyLanguage({ requestedLocale: "en", message: "how does this app work?" })).toBe("en");
    expect(detectWendyLanguage({ requestedLocale: "fr", message: "comment ca marche?" })).toBe("fr");
    expect(isLikelyItalianWendyMessage("how does this app work?")).toBe(false);
  });
});
