import { readFileSync, writeFileSync, realpathSync } from "fs";
import { resolve, sep, extname } from "path";
import { getLLM } from "../llm/client";
import { selectModelFor } from "../model-router";
import { estimateTokens, recordLlmUsage } from "../cost-tracking";
import { logger } from "../logger";
import type { SecurityFinding } from "./types";

/** Only ever rewrite source code, never config/docs/secrets. */
const FIX_ALLOWED_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

/**
 * Resolve `finding.file` (LLM-supplied, untrusted) to an absolute path that is
 * provably inside `repoRoot`, points at an allowed code extension, and exists
 * (symlinks resolved). Returns null — refuse the fix — otherwise. Without this,
 * a hallucinated/poisoned `finding.file` like "../../middleware/auth.ts" or an
 * absolute path would let the auto-fixer overwrite arbitrary files (RCE-class).
 */
function resolveConfinedFixPath(repoRoot: string, file: string): string | null {
  const root = resolve(repoRoot);
  const candidate = resolve(root, file);
  if (candidate !== root && !candidate.startsWith(root + sep)) return null;
  if (!FIX_ALLOWED_EXT.has(extname(candidate).toLowerCase())) return null;
  try {
    // Resolve symlinks and re-check containment; also enforces the file exists
    // (applyFix only ever rewrites an existing file it just read).
    const real = realpathSync(candidate);
    if (real !== root && !real.startsWith(root + sep)) return null;
    return real;
  } catch {
    return null;
  }
}

const FIX_SYSTEM_PROMPT = `You are a senior security engineer applying a targeted code fix.

Given the ORIGINAL FILE and a SECURITY FINDING, produce ONLY the corrected version of the file.
- Fix the specific vulnerability described
- Keep all other code exactly as is
- Do NOT add explanatory comments about the fix
- Respond with ONLY the corrected file content, no markdown fences, no explanations`;

export async function applyFix(
  finding: SecurityFinding,
  userId:  number,
  repoRoot: string,
): Promise<boolean> {
  const safePath = resolveConfinedFixPath(repoRoot, finding.file);
  if (!safePath) {
    logger.warn(
      { file: finding.file, repoRoot },
      "security-agent: refusing fix — path outside repo, non-code, or missing",
    );
    return false;
  }

  const llm   = getLLM();
  const route = selectModelFor("security-fix");

  let originalContent: string;
  try {
    originalContent = readFileSync(safePath, "utf-8");
  } catch (err) {
    logger.warn({ err, file: finding.file }, "security-agent: cannot read file for fix");
    return false;
  }

  const userMsg =
    `ORIGINAL FILE (${finding.file}):\n\`\`\`\n${originalContent.slice(0, 12_000)}\n\`\`\`\n\n` +
    `SECURITY FINDING:\n` +
    `Title: ${finding.title}\n` +
    `Line: ${finding.line}\n` +
    `Category: ${finding.category}\n` +
    `Description: ${finding.description}\n` +
    `Fix: ${finding.fix}\n\n` +
    `Apply the fix. Respond with the complete corrected file content only.`;

  const promptTokens = estimateTokens(FIX_SYSTEM_PROMPT + userMsg);
  let fixedContent   = "";

  try {
    const stream = await llm.chat(
      [
        { role: "system", content: FIX_SYSTEM_PROMPT },
        { role: "user",   content: userMsg },
      ],
      { model: route.model, temperature: route.temperature, maxTokens: route.maxTokens },
    );

    for await (const chunk of stream) {
      fixedContent += chunk;
    }
  } catch (err) {
    logger.warn({ err, file: finding.file }, "security-agent: fix generation failed");
    return false;
  }

  const completionTokens = estimateTokens(fixedContent);
  void recordLlmUsage({
    userId,
    model:            route.model,
    promptTokens,
    completionTokens,
    requestType:      "security-fix",
    metadata:         `file=${finding.file} category=${finding.category}`,
  });

  // Strip markdown fences if LLM added them
  const stripped = fixedContent
    .replace(/^```[\w]*\n?/, "")
    .replace(/\n?```$/, "")
    .trim();

  if (!stripped || stripped.length < 10) {
    logger.warn({ file: finding.file }, "security-agent: fix content too short, skipping");
    return false;
  }

  try {
    writeFileSync(safePath, stripped, "utf-8");
    logger.info({ file: finding.file, finding: finding.title }, "security-agent: fix applied");
    return true;
  } catch (err) {
    logger.warn({ err, file: finding.file }, "security-agent: cannot write fix");
    return false;
  }
}
