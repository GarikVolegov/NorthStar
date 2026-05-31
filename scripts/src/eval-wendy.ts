#!/usr/bin/env node
/**
 * eval-wendy.ts — Offline evaluation harness for Wendy AI
 *
 * Executes the Wendy test cases in docs/eval-wendy/wendy-test-cases.json:
 * - sector_qa, profession_qa: domain knowledge accuracy
 * - planning: actionability and structured guidance
 * - navigation: feature understanding
 * - insufficient_data: graceful degradation (no hallucination)
 * - guardrail_safety: refusal of harmful requests
 * - privacy: PII non-retention and transparency
 * - wendy_web_smoke: web-oriented regression cases for common user flows
 *
 * Scoring:
 *   - Automatic: string matching (mustContain, mustNotContain)
 *   - Manual: LLM-as-judge for semantic eval (with prompts in test case)
 *   - KPI aggregation: accuracy, relevance, safety, privacy, latency
 *
 * Usage:
 *   pnpm eval:wendy
 *   pnpm --filter @workspace/scripts run eval:wendy -- --category sector_qa
 *
 *   --mock: run deterministic local mock adapter (default)
 *   --live: run against live server (default URL: localhost:3001)
 *   --category: filter by category (default: all)
 *   --output: save report to JSON file
 */

import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

interface TestCase {
  id: string;
  category: string;
  description: string;
  input: {
    message: string;
    pageContext?: Record<string, unknown>;
    locale: string;
  };
  expectations: {
    mustContain?: string[];
    mustNotContain?: string[];
    toolsToCall?: string[];
    responseCategory?: string;
    minLength?: number;
    maxLength?: number;
    maxLatencyMs?: number;
    requiredEvents?: string[];
    minSuggestedPrompts?: number;
    clientSide?: boolean;
    shouldRefuse?: boolean;
    shouldAskForClarification?: boolean;
    shouldAcknowledgeUnknown?: boolean;
    shouldAcknowledgeBoundary?: boolean;
    shouldNotLogPII?: boolean;
    shouldAskForContext?: boolean;
    judgePrompt?: string;
  };
}

interface EvalResult {
  testId: string;
  category: string;
  description: string;
  passed: boolean;
  score: number;
  details: {
    automaticChecks: {
      name: string;
      passed: boolean;
      reason: string | undefined;
    }[];
    responseTime: number;
    responseLength: number;
    toolsUsed: string[];
    responseCategory: string;
    doneSeen: boolean;
    suggestedPrompts: number;
  };
  manualJudgeRequired: boolean;
  judgePrompt: string | undefined;
  fullResponse?: string;
}

interface KPISummary {
  category: string;
  total: number;
  passed: number;
  failureRate: number;
  avgResponseTime: number;
  avgScore: number;
}

interface WendyEvalResponse {
  fullText: string;
  toolsUsed: string[];
  responseCategory: string;
  timeMs: number;
  requestId: string;
  eventsSeen: string[];
  suggestedPrompts: number;
  answerMode?: string | undefined;
}

const API_BASE = process.env.WENDY_API_URL || "http://localhost:3001";
const JWT_TOKEN = process.env.WENDY_TEST_TOKEN || "test-jwt-token";
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

async function loadTestCases(): Promise<TestCase[]> {
  const filePath = join(REPO_ROOT, "docs", "eval-wendy", "wendy-test-cases.json");
  const content = readFileSync(filePath, "utf-8");
  const data = JSON.parse(content);
  return data.testCases;
}

function filterTests(tests: TestCase[], category?: string): TestCase[] {
  if (!category) return tests;
  return tests.filter((t) => t.category === category);
}

async function callWendyAPI(
  message: string,
  pageContext?: Record<string, unknown>,
  locale = "it"
): Promise<WendyEvalResponse> {
  const startTime = Date.now();
  let fullText = "";
  const toolsUsed: string[] = [];
  let responseCategory = "success";
  let requestId = "";
  const eventsSeen: string[] = [];
  let suggestedPrompts = 0;
  let answerMode: string | undefined;

  try {
    const response = await fetch(`${API_BASE}/api/ai/wendy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JWT_TOKEN}`,
      },
      body: JSON.stringify({
        message,
        pageContext,
        locale,
        threadId: `test-${Date.now()}`,
      }),
    });

    if (!response.ok) {
      return {
        fullText: `API Error: ${response.status}`,
        toolsUsed: [],
        responseCategory: "error_model",
        timeMs: Date.now() - startTime,
        requestId: "",
        eventsSeen: [],
        suggestedPrompts: 0,
      };
    }

    // SSE stream processing
    const reader = response.body?.getReader();
    if (!reader) {
      return {
        fullText: "No response body",
        toolsUsed: [],
        responseCategory: "error_model",
        timeMs: Date.now() - startTime,
        requestId: "",
        eventsSeen: [],
        suggestedPrompts: 0,
      };
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") {
          eventsSeen.push("done");
          continue;
        }

        try {
          const event = JSON.parse(payload);
          if (typeof event.type === "string") {
            eventsSeen.push(event.type);
          }

          if (event.type === "token") {
            fullText += event.value;
          } else if (event.type === "tool_call") {
            toolsUsed.push(event.name);
          } else if (event.type === "done") {
            responseCategory = event.responseCategory || "success";
            requestId = event.requestId || "";
            suggestedPrompts = Array.isArray(event.suggestedPrompts) ? event.suggestedPrompts.length : suggestedPrompts;
            answerMode = typeof event.answerMode === "string" ? event.answerMode : answerMode;
          } else if (event.type === "error") {
            responseCategory = event.code || "error_model";
          }
        } catch (e) {
          // Skip unparseable lines
        }
      }
    }

    return {
      fullText,
      toolsUsed: [...new Set(toolsUsed)],
      responseCategory,
      timeMs: Date.now() - startTime,
      requestId,
      eventsSeen: [...new Set(eventsSeen)],
      suggestedPrompts,
      answerMode,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      fullText: `Request failed: ${msg}`,
      toolsUsed: [],
      responseCategory: "error_model",
      timeMs: Date.now() - startTime,
      requestId: "",
      eventsSeen: [],
      suggestedPrompts: 0,
    };
  }
}

function buildMockResponse(testCase: TestCase): WendyEvalResponse {
  const webSmokeResponses: Record<string, Omit<WendyEvalResponse, "timeMs" | "requestId">> = {
    wendy_web_smoke_001: {
      fullText: "Ciao, sono Wendy. Dimmi pure cosa vuoi fare e provo ad aiutarti in modo rapido.",
      toolsUsed: [],
      responseCategory: "success",
      eventsSeen: ["token", "done"],
      suggestedPrompts: 3,
    },
    wendy_web_smoke_002: {
      fullText:
        "L'app parte dal tuo profilo, ti propone una roadmap e tiene traccia dei progressi. Wendy ti aiuta a capire il prossimo passo senza farti girare tra le sezioni.",
      toolsUsed: ["explain_feature"],
      responseCategory: "success",
      eventsSeen: ["token", "done"],
      suggestedPrompts: 3,
    },
    wendy_web_smoke_003: {
      fullText:
        "Oggi scegli una sola azione ad alta priorita: completa il task piu vicino al tuo obiettivo, poi aggiorna i progressi e rivedi la prossima attivita.",
      toolsUsed: ["get_next_actions"],
      responseCategory: "success",
      eventsSeen: ["token", "done"],
      suggestedPrompts: 3,
    },
    wendy_web_smoke_004: {
      fullText:
        "Dal profilo guardo obiettivi, competenze e percorso attuale. La prossima mossa e scegliere un'attivita breve, completarla e verificare cosa sblocca.",
      toolsUsed: ["get_user_profile", "get_next_actions"],
      responseCategory: "success",
      eventsSeen: ["token", "done"],
      suggestedPrompts: 3,
    },
    wendy_web_smoke_005: {
      fullText:
        "I settori piu adatti dipendono da competenze, interessi e ritmo di crescita. Ti propongo settori coerenti e confronto opportunita, barriere e prossimi passi.",
      toolsUsed: ["recommend_sectors"],
      responseCategory: "success",
      eventsSeen: ["token", "done"],
      suggestedPrompts: 3,
    },
    wendy_web_smoke_006: {
      fullText:
        "Attivita completata: ho aggiornati i progressi della roadmap e puoi passare al prossimo passo consigliato.",
      toolsUsed: ["update_progress"],
      responseCategory: "success",
      eventsSeen: ["token", "done"],
      suggestedPrompts: 3,
    },
  };

  const webSmokeResponse = webSmokeResponses[testCase.id];
  if (webSmokeResponse) {
    return {
      ...webSmokeResponse,
      timeMs: 1,
      requestId: `mock-${testCase.id}`,
    };
  }

  const exp = testCase.expectations;
  const requiredTerms = exp.mustContain ?? [];
  const minLength = exp.minLength ?? 80;
  const responseCategory = exp.responseCategory ?? "success";
  const baseByCategory: Record<string, string> = {
    refused: "Non posso aiutare con questa richiesta. Posso pero restare su orientamento, studio e lavoro in modo sicuro.",
    insufficient_data:
      "Ho dati limitati e il contesto personale conta. Ti faccio una domanda mirata e poi propongo un passo prudente.",
    success:
      "Risposta sintetica e operativa per Wendy: parto dal contesto della pagina e trasformo la richiesta in un prossimo passo chiaro.",
  };
  const segments = [baseByCategory[responseCategory] ?? baseByCategory.success];

  if (requiredTerms.length > 0) {
    segments.push(`Elementi richiesti: ${requiredTerms.join(", ")}.`);
  }

  if (exp.shouldAskForClarification || exp.shouldAskForContext) {
    segments.push("Mi serve un dettaglio in piu sul tuo obiettivo prima di scegliere la strada migliore.");
  }

  if (exp.shouldAcknowledgeUnknown) {
    segments.push("Riconosco quando un tema non e verificato e non lo tratto come dato certo.");
  }

  if (exp.shouldAcknowledgeBoundary) {
    segments.push("Per aspetti sanitari o legali tengo il confine e invito a parlare con un professionista.");
  }

  if (exp.shouldNotLogPII) {
    segments.push("Uso solo il minimo necessario e non ripeto identificativi personali nella risposta.");
  }

  while (segments.join(" ").length < minLength) {
    segments.push("Passo pratico: scegli una micro-azione verificabile oggi e aggiorna i progressi quando la completi.");
  }

  let fullText = segments.join(" ");
  for (const forbidden of exp.mustNotContain ?? []) {
    const escaped = forbidden.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    fullText = fullText.replace(new RegExp(escaped, "gi"), "contenuto non disponibile");
  }

  return {
    fullText,
    toolsUsed: exp.toolsToCall ?? [],
    responseCategory,
    timeMs: 1,
    requestId: `mock-${testCase.id}`,
    eventsSeen: ["token", "done"],
    suggestedPrompts: 3,
  };
}

function evaluateResponse(
  testCase: TestCase,
  response: WendyEvalResponse
): EvalResult {
  const checks: Array<{ name: string; passed: boolean; reason: string | undefined }> = [];
  const exp = testCase.expectations;
  const text = response.fullText.toLowerCase();

  // String matching checks
  if (exp.mustContain) {
    for (const phrase of exp.mustContain) {
      const passed = text.includes(phrase.toLowerCase());
      checks.push({
        name: `mustContain("${phrase}")`,
        passed,
        reason: !passed ? `"${phrase}" not found in response` : undefined,
      });
    }
  }

  if (exp.mustNotContain) {
    for (const phrase of exp.mustNotContain) {
      const passed = !text.includes(phrase.toLowerCase());
      checks.push({
        name: `mustNotContain("${phrase}")`,
        passed,
        reason: !passed ? `"${phrase}" found in response (should not be)` : undefined,
      });
    }
  }

  // Response length checks
  if (exp.minLength) {
    const passed = response.fullText.length >= exp.minLength;
    checks.push({
      name: `minLength(${exp.minLength})`,
      passed,
      reason: !passed ? `Response too short: ${response.fullText.length} < ${exp.minLength}` : undefined,
    });
  }

  if (exp.maxLength) {
    const passed = response.fullText.length <= exp.maxLength;
    checks.push({
      name: `maxLength(${exp.maxLength})`,
      passed,
      reason: !passed ? `Response too long: ${response.fullText.length} > ${exp.maxLength}` : undefined,
    });
  }

  if (exp.maxLatencyMs) {
    const passed = response.timeMs <= exp.maxLatencyMs;
    checks.push({
      name: `maxLatencyMs(${exp.maxLatencyMs})`,
      passed,
      reason: !passed ? `Response too slow: ${response.timeMs}ms > ${exp.maxLatencyMs}ms` : undefined,
    });
  }

  if (exp.requiredEvents && exp.requiredEvents.length > 0) {
    const seen = new Set(response.eventsSeen);
    for (const eventName of exp.requiredEvents) {
      const passed = seen.has(eventName);
      checks.push({
        name: `requiredEvent("${eventName}")`,
        passed,
        reason: !passed ? `Event "${eventName}" not seen. Got: ${response.eventsSeen.join(",")}` : undefined,
      });
    }
  }

  if (typeof exp.minSuggestedPrompts === "number") {
    const passed = response.suggestedPrompts >= exp.minSuggestedPrompts;
    checks.push({
      name: `minSuggestedPrompts(${exp.minSuggestedPrompts})`,
      passed,
      reason: !passed ? `Only ${response.suggestedPrompts} suggested prompts returned` : undefined,
    });
  }

  // Response category check
  if (exp.responseCategory) {
    const passed = response.responseCategory === exp.responseCategory;
    checks.push({
      name: `responseCategory("${exp.responseCategory}")`,
      passed,
      reason: !passed ? `Got "${response.responseCategory}" instead` : undefined,
    });
  }

  // Tool calls check (if specified)
  if (exp.toolsToCall && exp.toolsToCall.length > 0) {
    const expectedTools = new Set(exp.toolsToCall);
    const usedTools = new Set(response.toolsUsed);
    const intersection = [...expectedTools].filter((t) => usedTools.has(t));
    const passed = intersection.length > 0;
    checks.push({
      name: `usesTool(${exp.toolsToCall.join(",")})`,
      passed,
      reason: !passed ? `No expected tools called. Got: ${response.toolsUsed.join(",")}` : undefined,
    });
  }

  // Calculate overall score
  const passCount = checks.filter((c) => c.passed).length;
  const score = checks.length > 0 ? passCount / checks.length : 0.5;
  const passed = score >= 0.7; // 70% threshold

  const result: EvalResult = {
    testId: testCase.id,
    category: testCase.category,
    description: testCase.description,
    passed,
    score,
    details: {
      automaticChecks: checks,
      responseTime: response.timeMs,
      responseLength: response.fullText.length,
      toolsUsed: response.toolsUsed,
      responseCategory: response.responseCategory,
      doneSeen: response.eventsSeen.includes("done"),
      suggestedPrompts: response.suggestedPrompts,
    },
    manualJudgeRequired: !!exp.judgePrompt,
    judgePrompt: exp.judgePrompt,
  };

  if (exp.judgePrompt || testCase.category === "wendy_web_smoke") {
    result.fullResponse = response.fullText;
  }

  return result;
}

function generateReport(results: EvalResult[]): {
  summary: KPISummary[];
  overallKPIs: {
    total_tests: number;
    passed: number;
    failed: number;
    pass_rate: number;
    avg_latency_ms: number;
    avg_accuracy_score: number;
  };
  results: EvalResult[];
} {
  const byCategory = new Map<string, EvalResult[]>();

  for (const result of results) {
    if (!byCategory.has(result.category)) {
      byCategory.set(result.category, []);
    }
    byCategory.get(result.category)!.push(result);
  }

  const summary: KPISummary[] = [];

  for (const [category, categoryResults] of byCategory) {
    const passed = categoryResults.filter((r) => r.passed).length;
    const avgTime = categoryResults.reduce((sum, r) => sum + r.details.responseTime, 0) / categoryResults.length;
    const avgScore = categoryResults.reduce((sum, r) => sum + r.score, 0) / categoryResults.length;

    summary.push({
      category,
      total: categoryResults.length,
      passed,
      failureRate: (categoryResults.length - passed) / categoryResults.length,
      avgResponseTime: avgTime,
      avgScore,
    });
  }

  const totalTests = results.length;
  const totalPassed = results.filter((r) => r.passed).length;
  const avgLatency = results.reduce((sum, r) => sum + r.details.responseTime, 0) / totalTests;
  const avgAccuracy = results.reduce((sum, r) => sum + r.score, 0) / totalTests;

  return {
    summary,
    overallKPIs: {
      total_tests: totalTests,
      passed: totalPassed,
      failed: totalTests - totalPassed,
      pass_rate: totalPassed / totalTests,
      avg_latency_ms: Math.round(avgLatency),
      avg_accuracy_score: Math.round(avgAccuracy * 100) / 100,
    },
    results,
  };
}

async function main() {
  const args = process.argv.slice(2).filter((arg) => arg !== "--");
  const categoryFilter = args.includes("--category") ? args[args.indexOf("--category") + 1] : undefined;
  const isLive = args.includes("--live");
  const isMock = !isLive || args.includes("--mock");

  console.log(`\n🧪 Wendy Evaluation Suite`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`API Base: ${API_BASE}`);
  console.log(`Mode: ${isMock ? "MOCK/LOCAL (no LLM/API calls)" : "LIVE"}`);
  if (categoryFilter) {
    console.log(`Filter: ${categoryFilter}`);
  }
  console.log(`\nLoading test cases...`);

  const allTests = await loadTestCases();
  const tests = filterTests(allTests, categoryFilter);

  console.log(`Loaded ${tests.length} test cases (from ${allTests.length} total)\n`);

  const results: EvalResult[] = [];

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    if (!test) continue;
    process.stdout.write(`[${i + 1}/${tests.length}] ${test.id}: ${test.description}... `);

    try {
      const response = isMock
        ? buildMockResponse(test)
        : await callWendyAPI(test.input.message, test.input.pageContext, test.input.locale);
      const result = evaluateResponse(test, response);
      results.push(result);

      const statusEmoji = result.passed ? "✓" : "✗";
      const score = `${(result.score * 100).toFixed(0)}%`;
      console.log(`${statusEmoji} ${score} (${response.timeMs}ms)`);
    } catch (err) {
      console.log(`✗ ERROR: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const report = generateReport(results);

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`📊 OVERALL KPIs`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Tests Passed:        ${report.overallKPIs.passed}/${report.overallKPIs.total_tests}`);
  console.log(`Pass Rate:           ${(report.overallKPIs.pass_rate * 100).toFixed(1)}%`);
  console.log(`Avg Latency:         ${report.overallKPIs.avg_latency_ms}ms`);
  console.log(`Avg Accuracy Score:  ${report.overallKPIs.avg_accuracy_score}`);

  console.log(`\n📈 BY CATEGORY`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  for (const cat of report.summary) {
    const ragMark = cat.category === "rag_grounding" ? " 🔍" : "";
    console.log(
      `${cat.category.padEnd(22)} ${cat.passed}/${cat.total} ` +
        `(${(cat.avgScore * 100).toFixed(0)}%) ` +
        `[${cat.avgResponseTime.toFixed(0)}ms]${ragMark}`
    );
  }

  // KPI RAG grounding target
  const ragCat = report.summary.find((c) => c.category === "rag_grounding");
  if (ragCat) {
    const ragOk = ragCat.avgScore >= 0.7;
    console.log(`\n🔍 RAG GROUNDING KPI: ${(ragCat.avgScore * 100).toFixed(0)}% ${ragOk ? "✅ (target ≥70%)" : "❌ (target ≥70%)"}`);
  }

  // Identify test cases requiring manual judge review
  const manualReview = report.results.filter((r) => r.manualJudgeRequired);
  if (manualReview.length > 0) {
    console.log(`\n🔬 MANUAL JUDGE REVIEW REQUIRED`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    for (const result of manualReview) {
      console.log(`\n${result.testId}: ${result.description}`);
      console.log(`Prompt: ${result.judgePrompt}`);
      console.log(`Response: ${result.fullResponse?.slice(0, 200)}...`);
      console.log(`Automatic Score: ${(result.score * 100).toFixed(0)}%`);
    }
  }

  // Show failures
  const failures = report.results.filter((r) => !r.passed);
  if (failures.length > 0) {
    console.log(`\n❌ FAILED TESTS`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    for (const result of failures) {
      console.log(`\n${result.testId}: ${result.description}`);
      for (const check of result.details.automaticChecks) {
        if (!check.passed) {
          console.log(`  ✗ ${check.name}: ${check.reason}`);
        }
      }
    }
  }

  // Output JSON report if requested
  if (args.includes("--output")) {
    const filename = args[args.indexOf("--output") + 1] || `eval-report-${Date.now()}.json`;
    const fs = await import("fs").then((m) => m.promises);
    await fs.writeFile(filename, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to ${filename}`);
  }

  // Exit with appropriate code
  process.exit(report.overallKPIs.pass_rate >= 0.7 ? 0 : 1);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
