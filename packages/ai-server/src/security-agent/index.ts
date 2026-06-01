import { logger } from "../logger";
import { scanFiles } from "./scanner";
import { applyFix } from "./applier";
import { updateSecurityRules } from "./rules-updater";
import type { SecurityScanOptions, SecurityAgentEvent, SecurityFinding } from "./types";

export type { SecurityScanOptions, SecurityAgentEvent, SecurityFinding };
export type { Severity, VulnCategory } from "./types";

const SKIP_EXTENSIONS = new Set([
  ".md", ".json", ".yaml", ".yml", ".lock", ".svg", ".png",
  ".jpg", ".jpeg", ".ico", ".css", ".html", ".env",
]);
const SKIP_DIRS = ["node_modules", "dist", ".git", "build", ".turbo", "coverage", ".next"];

function isScannableFile(file: string): boolean {
  if (SKIP_DIRS.some((d) => file.includes(`/${d}/`) || file.startsWith(`${d}/`))) return false;
  const ext = file.slice(file.lastIndexOf(".")).toLowerCase();
  return !SKIP_EXTENSIONS.has(ext);
}

/**
 * runSecurityAgent — full security scan pipeline.
 *
 * Yields typed events compatible with the SSE streaming pattern used across
 * the NorthStar agentic system (token | status | done | error).
 *
 * @example
 * for await (const event of runSecurityAgent({ files, userId, repoRoot })) {
 *   res.write(`data: ${JSON.stringify(event)}\n\n`);
 * }
 */
export async function* runSecurityAgent(
  opts: SecurityScanOptions,
): AsyncGenerator<SecurityAgentEvent> {
  const { files, applyFixes = false, userId, repoRoot } = opts;

  const scannable = files.filter(isScannableFile);

  if (scannable.length === 0) {
    yield { type: "status", value: "Nessun file da scansionare." };
    yield { type: "done", findings: [], totalFiles: 0, costUsd: 0 };
    return;
  }

  yield {
    type:  "status",
    value: `🔍 Scansione di ${scannable.length} file in corso...`,
  };

  logger.info({ userId, files: scannable.length }, "security-agent: scan started");

  let findings: SecurityFinding[] = [];
  let totalCost = 0;

  try {
    const result = await scanFiles(scannable, userId);
    findings  = result.findings;
    totalCost = result.costUsd;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, userId }, "security-agent: scan failed");
    yield { type: "error", message: `Scan fallito: ${message}` };
    return;
  }

  const high   = findings.filter((f) => f.severity === "HIGH").length;
  const medium = findings.filter((f) => f.severity === "MEDIUM").length;

  yield {
    type:  "status",
    value: `📊 Trovate ${findings.length} vulnerabilità (${high} HIGH, ${medium} MEDIUM)`,
  };

  // Emit each finding
  for (const finding of findings) {
    yield { type: "finding", finding };
  }

  // Apply fixes for HIGH and MEDIUM if requested
  if (applyFixes && findings.length > 0) {
    const toFix = findings.filter((f) => f.severity === "HIGH" || f.severity === "MEDIUM");
    yield {
      type:  "status",
      value: `🔧 Applicazione di ${toFix.length} fix in corso...`,
    };

    for (const finding of toFix) {
      try {
        const applied = await applyFix(finding, userId, repoRoot);
        if (applied) {
          yield { type: "fix_applied", file: finding.file, title: finding.title };
        }
      } catch (err) {
        logger.warn({ err, file: finding.file }, "security-agent: fix failed");
      }
    }
  }

  // Update .brain/40_Agent_Context/rules/SECURITY_RULES.md
  try {
    updateSecurityRules(repoRoot, findings, scannable.length);
    yield { type: "rules_updated" };
  } catch (err) {
    logger.warn({ err }, "security-agent: rules update failed");
  }

  logger.info(
    { userId, findings: findings.length, costUsd: totalCost },
    "security-agent: scan completed",
  );

  yield {
    type:       "done",
    findings,
    totalFiles: scannable.length,
    costUsd:    totalCost,
  };
}
