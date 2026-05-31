import { describe, expect, it } from "vitest";
import {
  buildWendyTrainingPromptSection,
  buildWendyIntelligenceDirectives,
  buildWendyRepairHint,
  buildWendySuggestedPrompts,
  evaluateWendyTrainingResponseShape,
  evaluateWendyTrainingCase,
  evaluateWendyResponse,
  getWendyTrainingCoverage,
  getWendyCapability,
  planWendyDecision,
  runWendyTrainingEvaluation,
  WENDY_TRAINING_CASES,
} from "../wendy-intelligence";

describe("Wendy Jarvis intelligence core", () => {
  it("keeps social fragments immediate and low-latency", () => {
    const decision = planWendyDecision({ message: "ciao!", intent: "simple_qa" });

    expect(decision.mode).toBe("reply_now");
    expect(decision.latencyTargetMs).toBeLessThanOrEqual(1200);
    expect(decision.requiredCapabilities).toContain("social_presence");
  });

  it("routes persistent monitoring to routines", () => {
    const decision = planWendyDecision({
      message: "Ogni settimana monitorami il settore cybersecurity e avvisami se cambia qualcosa.",
      intent: "planning",
    });

    expect(decision.mode).toBe("routine");
    expect(decision.requiresConfirmation).toBe(true);
    expect(decision.requiredCapabilities).toContain("routine_scheduler");
  });

  it("routes long analytical work to background agents", () => {
    const decision = planWendyDecision({
      message: "Analizza i settori migliori per me e prepara un report operativo molto dettagliato.",
      intent: "deep_analysis",
    });

    expect(decision.mode).toBe("agent_task");
    expect(decision.requiredCapabilities).toContain("operator_layer");
  });

  it("detects memory updates from explicit remember requests", () => {
    const decision = planWendyDecision({
      message: "Ricordati che preferisco lavorare da remoto e non voglio ruoli troppo commerciali.",
      intent: "conversation",
    });

    expect(decision.mode).toBe("memory_update");
    expect(decision.requiresConfirmation).toBe(false);
    expect(decision.requiredCapabilities).toContain("long_term_memory");
  });

  it("self-check flags missing sources for market claims", () => {
    const result = evaluateWendyResponse({
      userMessage: "Quali settori stanno crescendo?",
      responseText: "Cybersecurity cresce del 20% e design del 15%.",
      decision: planWendyDecision({ message: "Quali settori stanno crescendo?", intent: "deep_analysis" }),
      contextSources: [],
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "missing_sources_for_market_claim" }),
      ]),
    );
  });

  it("self-check accepts concise sourced answers", () => {
    const result = evaluateWendyResponse({
      userMessage: "Quali settori stanno crescendo?",
      responseText: "Dai dati disponibili emergono cybersecurity e salute digitale. Fonte: search_rag.",
      decision: planWendyDecision({ message: "Quali settori stanno crescendo?", intent: "deep_analysis" }),
      contextSources: ["search_rag"],
    });

    expect(result.ok).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.8);
  });

  it("exposes directives usable inside prompts", () => {
    const directives = buildWendyIntelligenceDirectives(
      planWendyDecision({ message: "creami un obiettivo per studiare data analysis", intent: "planning" }),
    );

    expect(directives).toContain("Modalita decisionale Wendy");
    expect(directives).toContain("chiedi conferma");
    expect(directives).toContain("non inventare");
  });

  it("keeps the training pack focused on Jarvis-style behaviors", () => {
    expect(WENDY_TRAINING_CASES).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "social-fast-path", expectedMode: "reply_now" }),
        expect.objectContaining({ id: "weekly-monitoring", expectedMode: "routine" }),
        expect.objectContaining({ id: "remember-preference", expectedMode: "memory_update" }),
      ]),
    );
    expect(getWendyCapability("tool_discipline").failureMode).toContain("inventare");
  });

  it("evaluates the Wendy curriculum as a regression training pack", () => {
    const result = runWendyTrainingEvaluation(WENDY_TRAINING_CASES);

    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
    expect(result.failures).toEqual([]);
    expect(result.coveredCapabilities).toEqual(
      expect.arrayContaining([
        "social_presence",
        "tool_discipline",
        "long_term_memory",
        "operator_layer",
        "routine_scheduler",
        "northstar_actions",
        "market_intelligence",
        "self_check",
      ]),
    );
  });

  it("spots a training regression when a case expects the wrong mode", () => {
    const result = evaluateWendyTrainingCase({
      id: "bad-expectation",
      message: "Ogni lunedi monitorami i settori in crescita.",
      intent: "planning",
      expectedMode: "reply_now",
      expectedCapabilities: ["routine_scheduler"],
      expectedRequiresConfirmation: true,
      expectedResponseShape: "Deve creare una routine di monitoraggio.",
      badPatterns: ["risposta una tantum"],
      why: "Questo caso e' volutamente sbagliato per testare il trainer.",
    });

    expect(result.passed).toBe(false);
    expect(result.reasons).toEqual(expect.arrayContaining([expect.stringContaining("mode")]));
  });

  it("builds a compact prompt training section for the active decision", () => {
    const decision = planWendyDecision({
      message: "Analizza i settori migliori e prepara un report con fonti.",
      intent: "deep_analysis",
    });
    const section = buildWendyTrainingPromptSection(decision);

    expect(section).toContain("Esempi addestramento Wendy");
    expect(section).toContain("agent_task");
    expect(section).toContain("fonti");
    expect(section.length).toBeLessThan(1400);
  });

  it("expands Wendy training coverage across real product situations", () => {
    expect(WENDY_TRAINING_CASES.length).toBeGreaterThanOrEqual(20);
    expect(WENDY_TRAINING_CASES.map((trainingCase) => trainingCase.id)).toEqual(
      expect.arrayContaining([
        "punctuation-noise",
        "market-salary-sources",
        "delete-objective-confirmation",
        "lost-user-guidance",
        "emotion-support",
        "sector-compare-agent",
        "profile-based-recommendation",
      ]),
    );
    expect(runWendyTrainingEvaluation(WENDY_TRAINING_CASES).passed).toBe(true);
  });

  it("evaluates response shape against training bad patterns", () => {
    const trainingCase = WENDY_TRAINING_CASES.find((item) => item.id === "deep-report");
    expect(trainingCase).toBeTruthy();

    const bad = evaluateWendyTrainingResponseShape(
      trainingCase!,
      "Ecco una classifica senza fonti: cybersecurity, design e salute.",
    );
    const good = evaluateWendyTrainingResponseShape(
      trainingCase!,
      "Avvio un task agente e preparo un report con criteri, fonti RAG e prossimi passi.",
    );

    expect(bad.passed).toBe(false);
    expect(bad.reasons).toEqual(expect.arrayContaining([expect.stringContaining("bad pattern")]));
    expect(good.passed).toBe(true);
  });

  it("scores response quality with a rubric and produces repair hints", () => {
    const decision = planWendyDecision({
      message: "Quali settori hanno stipendi migliori?",
      intent: "deep_analysis",
    });
    const result = evaluateWendyResponse({
      userMessage: "Quali settori hanno stipendi migliori?",
      responseText: "Cybersecurity paga 45k, design 30k. Direi cybersecurity.",
      decision,
      contextSources: [],
    });
    const hint = buildWendyRepairHint(result);

    expect(result.ok).toBe(false);
    expect(result.rubric.sourceDiscipline).toBeLessThan(0.6);
    expect(result.repairHint).toContain("fonti");
    expect(hint).toContain("Correggi");
  });

  it("tracks training coverage by behavioral category", () => {
    const coverage = getWendyTrainingCoverage(WENDY_TRAINING_CASES);

    expect(coverage.passed).toBe(true);
    expect(coverage.missingCategories).toEqual([]);
    expect(coverage.byCategory.market).toBeGreaterThanOrEqual(5);
    expect(coverage.byCategory.action).toBeGreaterThanOrEqual(4);
    expect(coverage.byCategory.social).toBeGreaterThanOrEqual(3);
    expect(coverage.byCategory.emotional).toBeGreaterThanOrEqual(1);
  });

  it("adds stronger guardrails to destructive action prompts", () => {
    const directives = buildWendyIntelligenceDirectives(
      planWendyDecision({
        message: "Elimina il mio obiettivo di studiare inglese.",
        intent: "planning",
      }),
    );

    expect(directives).toContain("Non dire fatto");
    expect(directives).toContain("prima");
    expect(directives).toContain("conferma");
  });

  it("adds explicit adaptive reasoning metadata for profile-market decisions", () => {
    for (const message of [
      "Quali settori sono piu adatti a me?",
      "L'ho gia fatto, che settore scelgo?",
    ]) {
      const decision = planWendyDecision({
        message,
        intent: "conversation",
      });

      expect(decision.reasoningDepth).toBe("grounded");
      expect(decision.dataStrategy).toBe("profile_market");
      expect(decision.executionMode).toBe("tool_augmented_chat");
      expect(decision.selfCheck).toEqual(expect.arrayContaining(["grounded_sources", "specific_next_step"]));
    }
  });

  it("treats next-action prompts as grounded profile actions", () => {
    for (const message of [
      "Che faccio oggi?",
      "Che faccio questa settimana?",
      "Qual e la prossima azione?",
      "Qual e il prossimo passo?",
      "Cosa dovrei fare oggi?",
      "Cosa dovrei fare domani?",
      "What should I do today?",
      "What is my next step?",
    ]) {
      const decision = planWendyDecision({ message, intent: "conversation" });

      expect(decision.mode).toBe("tool_action");
      expect(decision.reasoningDepth).toBe("grounded");
      expect(decision.dataStrategy).toBe("profile");
      expect(decision.executionMode).toBe("tool_augmented_chat");
    }
  });

  it("makes long strategic work deliberate and background-friendly", () => {
    const decision = planWendyDecision({
      message: "Analizza il mio profilo, confronta tre settori e prepara una strategia dettagliata con rischi e prossime azioni.",
      intent: "deep_analysis",
    });

    expect(decision.reasoningDepth).toBe("deliberate");
    expect(decision.executionMode).toBe("background_agent");
    expect(decision.dataStrategy).toBe("profile_market");
  });

  it("injects the adaptive reasoning protocol into Wendy directives", () => {
    const directives = buildWendyIntelligenceDirectives(
      planWendyDecision({
        message: "Quali settori sono piu adatti a me?",
        intent: "conversation",
      }),
    );

    expect(directives).toContain("Protocollo ragionamento adattivo");
    expect(directives).toContain("grounded");
    expect(directives).toContain("profile_market");
    expect(directives).toContain("verifica");
    expect(directives).toContain("Soluzione operativa");
    expect(directives).toContain("input pronto");
  });

  it("always builds clickable next-step prompts for Wendy responses", () => {
    const decision = planWendyDecision({
      message: "Quali settori sono piu adatti a me?",
      intent: "conversation",
    });

    const prompts = buildWendySuggestedPrompts({ decision, locale: "it" });

    expect(prompts.length).toBeGreaterThanOrEqual(2);
    expect(prompts.length).toBeLessThanOrEqual(3);
    expect(prompts[0]).toEqual(expect.objectContaining({
      label: expect.any(String),
      prompt: expect.any(String),
    }));
    expect(prompts.map((prompt) => prompt.prompt).join(" ")).toContain("settori");
  });

  it("turns next-step prompts into implementation inputs, not passive suggestions", () => {
    const prompts = buildWendySuggestedPrompts({
      decision: planWendyDecision({
        message: "Quali settori sono piu adatti a me?",
        intent: "conversation",
      }),
      locale: "it",
    });

    expect(prompts.map((prompt) => prompt.prompt).join(" ")).toMatch(/crea|imposta|scegli|apri|costruisci/i);
    expect(prompts.map((prompt) => prompt.prompt).join(" ")).not.toMatch(/mostrami le fonti|dimmi quale/i);
  });

  it("localizes Wendy next-step prompts in English", () => {
    const prompts = buildWendySuggestedPrompts({
      decision: planWendyDecision({ message: "What should I do today?", intent: "conversation" }),
      locale: "en",
    });

    expect(prompts[0]?.label).toMatch(/next|plan|progress/i);
    expect(prompts.map((prompt) => prompt.prompt).join(" ")).toMatch(/today|profile|progress/i);
  });
});
