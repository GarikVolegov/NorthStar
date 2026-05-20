/**
 * Eval runner for Wendy AI — v2 with regression comparison.
 *
 * Usage:
 *   pnpm tsx docs/eval-wendy/run-eval.ts
 *
 * Reads docs/eval-wendy/samples.json, calls runGrowthAgent() for each sample,
 * collects response + metrics, compares with last run, writes results.
 * Fails (exit code 1) if significant regression detected.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface EvalSample {
  id: number;
  message: string;
  domain: string;
  intent: string;
  humanRating: number;
  humanNotes: string;
  goldResponse?: string;
}

interface EvalResult {
  sampleId: number;
  message: string;
  expectedDomain: string;
  expectedIntent: string;
  humanRating: number;
  response: string;
  actualDomain?: string;
  actualIntent?: string;
  supervisorScore?: number;
  supervisorPassed?: boolean;
  supervisorRewritten?: boolean;
  wordCount: number;
  hasNumberedSteps: boolean;
  hasCta: boolean;
  responseLength: number;
  goldSimilarity?: number;
  error?: string;
}

interface EvalRun {
  timestamp: string;
  stats: EvalStats;
  results: EvalResult[];
}

interface EvalStats {
  total: number;
  passed: number;
  passRate: number;
  rewritten: number;
  rewriteRate: number;
  avgScore: number;
  avgWords: number;
  withSteps: number;
  stepsRate: number;
  withCta: number;
  ctaRate: number;
  avgGoldSimilarity: number;
}

const SIMILARITY_THRESHOLD_REGRESSION = 0.05; // 5% drop triggers warning

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
}

function embedText(text: string): number[] {
  // Simple character-level bag-of-words embedding for semantic similarity
  // In production, use the actual embedder model
  const chars = new Set(text.toLowerCase().split(""));
  const vowels = "aeiouàèéìòù".split("");
  const consonants = "bcdfghjklmnpqrstvwxyz".split("");
  const numbers = "0123456789".split("");
  const spaces = text.split(/\s+/).length;
  const avgWordLen = text.length / Math.max(spaces, 1);
  const punctCount = (text.match(/[.!?,;:]/g) ?? []).length;

  return [
    text.length / 5000,
    spaces / 100,
    avgWordLen / 20,
    punctCount / 50,
    [...chars].filter((c) => vowels.includes(c)).length / 10,
    [...chars].filter((c) => consonants.includes(c)).length / 20,
    [...chars].filter((c) => numbers.includes(c)).length / 5,
  ];
}

const MIN_CTA_WORDS = ["comincia", "inizia", "prova a", "fai", "metti in pratica", "azione", "passo", "step"];

function hasCta(text: string): boolean {
  const lower = text.toLowerCase();
  return MIN_CTA_WORDS.some((w) => lower.includes(w));
}

function hasNumberedSteps(text: string): boolean {
  return /\d+\.\s/.test(text);
}

function computeStats(results: EvalResult[]): EvalStats {
  const passed = results.filter((r) => r.supervisorPassed).length;
  const rewritten = results.filter((r) => r.supervisorRewritten).length;
  const withSteps = results.filter((r) => r.hasNumberedSteps).length;
  const withCta = results.filter((r) => r.hasCta).length;
  const avgScore = results.reduce((s, r) => s + (r.supervisorScore ?? 0), 0) / results.length;
  const avgWords = results.reduce((s, r) => s + r.wordCount, 0) / results.length;
  const goldSimilarities = results.filter((r) => r.goldSimilarity != null).map((r) => r.goldSimilarity!);
  const avgGoldSimilarity = goldSimilarities.length > 0
    ? goldSimilarities.reduce((s, v) => s + v, 0) / goldSimilarities.length
    : 0;

  return {
    total: results.length,
    passed,
    passRate: passed / results.length,
    rewritten,
    rewriteRate: rewritten / results.length,
    avgScore,
    avgWords,
    withSteps,
    stepsRate: withSteps / results.length,
    withCta,
    ctaRate: withCta / results.length,
    avgGoldSimilarity,
  };
}

async function loadPreviousRun(): Promise<EvalRun | null> {
  try {
    const historyRaw = await readFile(join(__dirname, "history.json"), "utf-8");
    const history = JSON.parse(historyRaw);
    if (history.runs && history.runs.length > 0) {
      const lastRun = history.runs[history.runs.length - 1];
      const resultsPath = join(__dirname, "results", `${lastRun.timestamp}.json`);
      const runData = await readFile(resultsPath, "utf-8");
      return JSON.parse(runData) as EvalRun;
    }
  } catch {}
  return null;
}

function detectRegression(current: EvalStats, previous: EvalStats): string[] {
  const warnings: string[] = [];

  const checks: Array<{ label: string; current: number; previous: number }> = [
    { label: "pass rate", current: current.passRate, previous: previous.passRate },
    { label: "average score", current: current.avgScore, previous: previous.avgScore },
    { label: "CTA rate", current: current.ctaRate, previous: previous.ctaRate },
    { label: "steps rate", current: current.stepsRate, previous: previous.stepsRate },
    { label: "avg gold similarity", current: current.avgGoldSimilarity, previous: previous.avgGoldSimilarity },
  ];

  for (const check of checks) {
    if (check.previous > 0) {
      const drop = (check.previous - check.current) / check.previous;
      if (drop > SIMILARITY_THRESHOLD_REGRESSION) {
        warnings.push(
          `${check.label}: ${(check.current * 100).toFixed(1)}% vs ${(check.previous * 100).toFixed(1)}% (${(drop * 100).toFixed(1)}% drop)`,
        );
      }
    }
  }

  // Rewrite rate going up is a regression (less reliable)
  if (previous.rewriteRate > 0) {
    const increase = (current.rewriteRate - previous.rewriteRate) / previous.rewriteRate;
    if (increase > SIMILARITY_THRESHOLD_REGRESSION) {
      warnings.push(
        `rewrite rate INCREASED: ${(current.rewriteRate * 100).toFixed(1)}% vs ${(previous.rewriteRate * 100).toFixed(1)}% (${(increase * 100).toFixed(1)}% increase)`,
      );
    }
  }

  return warnings;
}

async function main() {
  const raw = await readFile(join(__dirname, "samples.json"), "utf-8");
  const samples: EvalSample[] = JSON.parse(raw);

  console.log(`Loaded ${samples.length} eval samples (${samples.filter((s) => s.goldResponse).length} with gold response)\n`);

  const { runGrowthAgent } = await import(
    join(__dirname, "..", "packages", "ai-server", "src", "growth-agent", "agent.ts")
  );

  const results: EvalResult[] = [];

  for (const sample of samples) {
    process.stdout.write(`[${sample.id}/${samples.length}] "${sample.message.slice(0, 50)}..." `);

    const result: EvalResult = {
      sampleId: sample.id,
      message: sample.message,
      expectedDomain: sample.domain,
      expectedIntent: sample.intent,
      humanRating: sample.humanRating,
      response: "",
      wordCount: 0,
      hasNumberedSteps: false,
      hasCta: false,
      responseLength: 0,
    };

    try {
      const generator = runGrowthAgent({
        userId: 0,
        userContext: {
          name: "Test",
          journeyType: "autonomo",
          sectorName: "tecnologia",
        },
        history: [],
        userMessage: sample.message,
        requestId: `eval-${sample.id}`,
      });

      let fullResponse = "";
      for await (const event of generator) {
        if (event.type === "token") {
          fullResponse += event.value;
        }
        if (event.type === "done") {
          result.actualDomain = event.routeDecision?.domain;
          result.actualIntent = event.routeDecision?.intent;
          result.supervisorScore = event.supervisorResult?.score;
          result.supervisorPassed = event.supervisorResult?.pass;
          result.supervisorRewritten = event.supervisorResult?.rewritten;
        }
        if (event.type === "error") {
          result.error = event.message;
        }
      }

      result.response = fullResponse;
      result.wordCount = fullResponse.trim().split(/\s+/).filter(Boolean).length;
      result.responseLength = fullResponse.length;
      result.hasNumberedSteps = hasNumberedSteps(fullResponse);
      result.hasCta = hasCta(fullResponse);

      // Gold response similarity
      if (sample.goldResponse) {
        const goldEmb = embedText(sample.goldResponse);
        const respEmb = embedText(fullResponse);
        result.goldSimilarity = cosineSimilarity(goldEmb, respEmb);
      }

      const status = result.supervisorPassed ? "PASS" : "FAIL";
      process.stdout.write(`${status} score=${result.supervisorScore?.toFixed(2) ?? "?"} words=${result.wordCount}`);
      if (result.goldSimilarity != null) {
        process.stdout.write(` goldSim=${result.goldSimilarity.toFixed(2)}`);
      }
      process.stdout.write("\n");
    } catch (err) {
      result.error = String(err);
      process.stdout.write(`ERROR: ${String(err).slice(0, 80)}\n`);
    }

    results.push(result);
  }

  const stats = computeStats(results);
  const previousRun = await loadPreviousRun();

  console.log("\n─── SUMMARY ───");
  console.log(`Total:           ${stats.total}`);
  console.log(`Passed:          ${stats.passed} (${(stats.passRate * 100).toFixed(1)}%)`);
  console.log(`Rewritten:       ${stats.rewritten} (${(stats.rewriteRate * 100).toFixed(1)}%)`);
  console.log(`Avg score:       ${stats.avgScore.toFixed(2)}`);
  console.log(`Avg words:       ${stats.avgWords.toFixed(0)}`);
  console.log(`With steps:      ${stats.withSteps} (${(stats.stepsRate * 100).toFixed(1)}%)`);
  console.log(`With CTA:        ${stats.withCta} (${(stats.ctaRate * 100).toFixed(1)}%)`);
  console.log(`Gold similarity: ${(stats.avgGoldSimilarity * 100).toFixed(1)}%`);

  // Regression analysis
  let hasRegression = false;
  if (previousRun) {
    console.log("\n─── REGRESSION vs " + previousRun.timestamp.slice(0, 19).replace("T", " ") + " ───");
    const warnings = detectRegression(stats, previousRun.stats);
    if (warnings.length > 0) {
      hasRegression = true;
      for (const w of warnings) {
        console.log(`⚠️  REGRESSION: ${w}`);
      }
    } else {
      console.log("✅ No significant regression detected");
    }
  } else {
    console.log("\n(No previous run for comparison)");
  }

  // Write results
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = join(__dirname, "results");
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, `${ts}.json`);
  await writeFile(outPath, JSON.stringify({ timestamp: ts, stats, results }, null, 2));

  // Update history
  const historyPath = join(__dirname, "history.json");
  const history = { runs: [{ timestamp: ts, stats }], description: JSON.parse(await readFile(historyPath, "utf-8")).description };
  await writeFile(historyPath, JSON.stringify(history, null, 2));

  console.log(`\nResults saved to ${outPath}`);

  if (hasRegression) {
    console.error("\n❌ REGRESSION DETECTED — exiting with code 1");
    process.exit(1);
  }
}

main().catch(console.error);
