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

  it("detects complex Italian sentences with no domain keywords (the English-fallback bug)", () => {
    const prompts = [
      "Secondo te conviene puntare sul project management oppure sullo sviluppo prodotto, vista la mia situazione?",
      "Non capisco bene quale strada professionale abbia senso per uno come me adesso.",
      "Mi spieghi la differenza tra un ruolo di management e uno piu tecnico?",
      "Onestamente non so da dove iniziare e mi sento abbastanza bloccato.",
    ];

    for (const message of prompts) {
      // Even if the browser still reports English, an Italian sentence stays Italian.
      expect(detectWendyLanguage({ requestedLocale: "en", message })).toBe("it");
      expect(isLikelyItalianWendyMessage(message)).toBe(true);
    }
  });

  it("keeps non-Italian messages in the requested language", () => {
    expect(detectWendyLanguage({ requestedLocale: "en", message: "how does this app work?" })).toBe("en");
    expect(detectWendyLanguage({ requestedLocale: "en", message: "Honestly I have no idea where to start with my career right now." })).toBe("en");
    expect(detectWendyLanguage({ requestedLocale: "fr", message: "comment ca marche?" })).toBe("fr");
    expect(isLikelyItalianWendyMessage("how does this app work?")).toBe(false);
  });

  it("falls back to the requested locale only when the message carries no signal", () => {
    expect(detectWendyLanguage({ requestedLocale: "en", message: "ok 👍" })).toBe("en");
    expect(detectWendyLanguage({ requestedLocale: "es", message: "..." })).toBe("es");
    expect(detectWendyLanguage({ requestedLocale: undefined, message: "" })).toBe("it");
  });
});
