import { describe, expect, it } from "vitest";
import { buildSystemPrompt, buildVoiceSystemPrompt } from "../growth-agent/prompt-builder";
import type { BuildSystemPromptOptions } from "../growth-agent/prompt-builder";
import { buildToneSection } from "../growth-agent/tone-adapter";
import { classifyIntent } from "../wendy-router/intent-classifier";
import { getLocalWendyReply } from "../wendy-router/local-reply";
import { buildLightPrompt } from "../wendy-router/light-prompt";
import {
  buildWendyVoiceContract,
  findForbiddenWendyVoicePhrases,
} from "../wendy-voice";

const basePromptOptions = {
  userContext: { locale: "it", journeyType: "indeciso" },
  personaExamples: [],
  documentChunks: [],
  webResults: [],
  cot: null,
  userMessage: "non so cosa fare",
  evalResult: {
    score: 0.9,
    level: "high" as const,
    dimensions: {
      contextCoverage: 0.9,
      cotConfidence: 0.9,
      questionClarity: 0.9,
      memoryCoverage: 0.9,
    },
    reasons: [],
    needsClarification: false,
  },
} satisfies BuildSystemPromptOptions;

describe("Wendy human voice layer", () => {
  it("adds the shared voice contract to the full growth prompt", () => {
    const prompt = buildSystemPrompt(basePromptOptions);

    expect(prompt).toContain("Voice contract di Wendy");
    expect(prompt).toContain("calda, diretta, concreta");
    expect(prompt).toContain("Per dubbi personali");
    expect(prompt).toContain("Ottima domanda");
  });

  it("adds a compact human voice contract to simple answers", () => {
    const prompt = buildLightPrompt({
      locale: "italiano",
      intent: "simple_qa",
    });

    expect(prompt).toContain("Voce Wendy");
    expect(prompt).toContain("1-3 frasi");
    expect(prompt).toContain("chi sei");
    expect(prompt).toContain("Niente entusiasmo automatico");
  });

  it("keeps navigation operative and tool-only", () => {
    const prompt = buildLightPrompt({
      locale: "italiano",
      intent: "navigation",
    });

    expect(prompt).toContain("solo la tool call JSON");
    expect(prompt).toContain("open_view");
    expect(classifyIntent({ userMessage: "portami al calendario" })).toBe("navigation");
  });

  it("keeps adaptive tones under the shared human voice", () => {
    const tone = buildToneSection("autonomo");

    expect(tone).toContain("non sostituisce la voce base di Wendy");
    expect(tone).toContain("calda, diretta, concreta");
    expect(tone).toContain("autonomo");
  });

  it("uses the same voice rules for spoken answers", () => {
    const prompt = buildVoiceSystemPrompt("Garik");

    expect(prompt).toContain("coach vocale");
    expect(prompt).toContain("Parla come una persona");
    expect(prompt).toContain("Nessuna lista o markdown");
  });

  it("detects forbidden AI-sounding phrases in generated text", () => {
    expect(findForbiddenWendyVoicePhrases("Ottima domanda. In conclusione, spero ti sia utile.")).toEqual([
      "Ottima domanda",
      "Spero ti sia utile",
      "In conclusione",
    ]);
    expect(findForbiddenWendyVoicePhrases("Mi sembra che il nodo sia il tempo. Partirei da una scelta piccola.")).toEqual([]);
  });

  it("exposes a compact checklist for prompt previews", () => {
    const checklist = buildWendyVoiceContract({ compact: true });

    expect(checklist).toContain("caldo e diretto");
    expect(checklist).toContain("Dubbi personali");
  });

  it("routes small talk through the LLM fast path, not an instant canned answer", () => {
    for (const message of ["come stai?", "hru", "grazie", "ok", "come va?"]) {
      expect(classifyIntent({ userMessage: message })).toBe("simple_qa");
      expect(getLocalWendyReply(message)).toBeNull();
    }

    expect(classifyIntent({ userMessage: "portami al calendario" })).toBe("navigation");
    expect(classifyIntent({ userMessage: "creami un obiettivo" })).toBe("planning");
  });

  it("tells the model to vary natural small-talk instead of using fixed replies", () => {
    const prompt = buildLightPrompt({
      locale: "italiano",
      intent: "simple_qa",
    });

    expect(prompt).toContain("saluti, small talk");
    expect(prompt).toContain("varia");
    expect(prompt).toContain("Mai due risposte uguali");
  });
});
