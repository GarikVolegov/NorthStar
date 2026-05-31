import { describe, expect, it } from "vitest";
import {
  buildWendyTrainingPromptSection,
  buildWendyIntelligenceDirectives,
  buildWendyRepairHint,
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
});
