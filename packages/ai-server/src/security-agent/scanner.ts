import { readFileSync } from "fs";
import { getLLM } from "../llm/client";
import { selectModelFor } from "../model-router";
import { estimateTokens, estimateCost, recordLlmUsage } from "../cost-tracking";
import { logger } from "../logger";
import type { SecurityFinding } from "./types";

const MAX_FILE_CHARS  = 10_000;
const MAX_BATCH_CHARS = 50_000;

const SCAN_SYSTEM_PROMPT = `You are a senior security engineer performing a focused vulnerability scan.

INSTRUCTIONS:
- Report ONLY vulnerabilities with >80% exploitability confidence
- Exclude: XSS in React/TSX (unless dangerouslySetInnerHTML), client-side auth checks, env vars as trusted input, DoS, rate limiting, log spoofing, prompt injection into LLMs
- Focus on: SQL injection, command injection, auth bypass, hardcoded secrets, weak crypto, RCE, path traversal, data exposure

Respond with valid JSON only:
{
  "findings": [
    {
      "severity": "HIGH|MEDIUM|LOW",
      "category": "sql_injection|xss|auth_bypass|hardcoded_secret|weak_crypto|rce|data_exposure|path_traversal|insecure_deserialization|privilege_escalation|other",
      "file": "relative/path/to/file.ts",
      "line": 42,
      "title": "Short title",
      "description": "What is wrong",
      "exploit": "How it can be exploited concretely",
      "fix": "How to fix it",
      "confidence": 0.85
    }
  ]
}

If no real vulnerabilities found, respond: {"findings":[]}`;

function readFileSafe(path: string): string {
  try {
    const content = readFileSync(path, "utf-8");
    return content.length > MAX_FILE_CHARS
      ? content.slice(0, MAX_FILE_CHARS) + "\n// [truncated for analysis]"
      : content;
  } catch {
    return "";
  }
}

function groupIntoBatches(files: { path: string; content: string }[]): { path: string; content: string }[][] {
  const batches: { path: string; content: string }[][] = [];
  let current: { path: string; content: string }[] = [];
  let size = 0;

  for (const f of files) {
    if (size + f.content.length > MAX_BATCH_CHARS && current.length > 0) {
      batches.push(current);
      current = [];
      size = 0;
    }
    current.push(f);
    size += f.content.length;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

export async function scanFiles(
  filePaths: string[],
  userId: number,
): Promise<{ findings: SecurityFinding[]; costUsd: number }> {
  const llm = getLLM();
  const route = selectModelFor("security-scan");

  const readable = filePaths
    .map((p) => ({ path: p, content: readFileSafe(p) }))
    .filter((f) => f.content.length > 0);

  if (readable.length === 0) {
    return { findings: [], costUsd: 0 };
  }

  const batches = groupIntoBatches(readable);
  const allFindings: SecurityFinding[] = [];
  let totalCost = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const fileBlock = batch.map((f) => `=== ${f.path} ===\n${f.content}`).join("\n\n");
    const userMsg = `Scan these files for security vulnerabilities:\n\n${fileBlock}`;

    const promptTokens   = estimateTokens(SCAN_SYSTEM_PROMPT + userMsg);
    let   responseText   = "";

    try {
      const stream = await llm.chat(
        [
          { role: "system", content: SCAN_SYSTEM_PROMPT },
          { role: "user",   content: userMsg },
        ],
        { model: route.model, temperature: route.temperature, maxTokens: route.maxTokens },
      );

      for await (const chunk of stream) {
        responseText += chunk;
      }
    } catch (err) {
      logger.warn({ err, batch: i }, "security-agent: scan batch failed");
      continue;
    }

    const completionTokens = estimateTokens(responseText);
    const batchCost        = estimateCost(route.model, promptTokens, completionTokens);
    totalCost             += batchCost;

    void recordLlmUsage({
      userId,
      model:            route.model,
      promptTokens,
      completionTokens,
      requestType:      "security-scan",
      metadata:         `batch=${i + 1}/${batches.length} files=${batch.length}`,
    });

    try {
      const jsonStart = responseText.indexOf("{");
      const jsonEnd   = responseText.lastIndexOf("}");
      const parsed    = JSON.parse(responseText.slice(jsonStart, jsonEnd + 1)) as { findings?: SecurityFinding[] };
      const findings  = (parsed.findings ?? []).filter((f) => (f.confidence ?? 1) >= 0.8);
      allFindings.push(...findings);
    } catch (err) {
      logger.warn({ err, raw: responseText.slice(0, 200) }, "security-agent: failed to parse scan response");
    }
  }

  return { findings: allFindings, costUsd: totalCost };
}
