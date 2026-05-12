/**
 * Eval runner for Wendy AI.
 *
 * Usage:
 *   pnpm tsx eval/run-eval.ts
 *
 * Reads eval/samples.json, calls runGrowthAgent() for each sample,
 * collects response + metrics, writes results to eval/results/{timestamp}.json.
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
  error?: string;
}

const MIN_CTA_WORDS = ["comincia", "inizia", "prova a", "fai", "metti in pratica", "azione", "passo", "step"];

function hasCta(text: string): boolean {
  const lower = text.toLowerCase();
  return MIN_CTA_WORDS.some((w) => lower.includes(w));
}

function hasNumberedSteps(text: string): boolean {
  return /\d+\.\s/.test(text);
}

async function main() {
  const raw = await readFile(join(__dirname, "samples.json"), "utf-8");
  const samples: EvalSample[] = JSON.parse(raw);

  console.log(`Loaded ${samples.length} eval samples\n`);

  // We'll dynamically import the growth agent
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

      const status = result.supervisorPassed ? "PASS" : "FAIL";
      process.stdout.write(`${status} score=${result.supervisorScore?.toFixed(2) ?? "?"} words=${result.wordCount}\n`);
    } catch (err) {
      result.error = String(err);
      process.stdout.write(`ERROR: ${String(err).slice(0, 80)}\n`);
    }

    results.push(result);
  }

  // Stats
  const passed = results.filter((r) => r.supervisorPassed).length;
  const rewritten = results.filter((r) => r.supervisorRewritten).length;
  const withSteps = results.filter((r) => r.hasNumberedSteps).length;
  const withCta = results.filter((r) => r.hasCta).length;
  const avgScore = results.reduce((s, r) => s + (r.supervisorScore ?? 0), 0) / results.length;
  const avgWords = results.reduce((s, r) => s + r.wordCount, 0) / results.length;

  console.log("\n─── SUMMARY ───");
  console.log(`Total:     ${results.length}`);
  console.log(`Passed:    ${passed} (${(passed / results.length * 100).toFixed(1)}%)`);
  console.log(`Rewritten: ${rewritten} (${(rewritten / results.length * 100).toFixed(1)}%)`);
  console.log(`Avg score: ${avgScore.toFixed(2)}`);
  console.log(`Avg words: ${avgWords.toFixed(0)}`);
  console.log(`With numbered steps: ${withSteps} (${(withSteps / results.length * 100).toFixed(1)}%)`);
  console.log(`With CTA: ${withCta} (${(withCta / results.length * 100).toFixed(1)}%)`);

  // Write results
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const outDir = join(__dirname, "results");
  await mkdir(outDir, { recursive: true });
  const outPath = join(outDir, `${ts}.json`);
  await writeFile(outPath, JSON.stringify({ timestamp: ts, stats: { passed, rewritten, avgScore, avgWords, withSteps, withCta }, results }, null, 2));

  console.log(`\nResults saved to ${outPath}`);
}

main().catch(console.error);
