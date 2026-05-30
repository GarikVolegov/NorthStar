import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { SecurityFinding } from "./types";

const SEVERITY_EMOJI: Record<string, string> = {
  HIGH:   "🔴",
  MEDIUM: "🟡",
  LOW:    "🟢",
};

/** Neutralize LLM-generated text before writing it into the tracked
 * SECURITY_RULES.md: strip control chars (incl. newlines), defuse markdown
 * backticks, and cap length so a finding can't inject structure or bloat the
 * file unbounded. */
function sanitizeField(value: string, max = 500): string {
  const cleaned = Array.from(String(value ?? ""))
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code < 0x20 || code === 0x7f) return " "; // strip control chars + newlines
      return ch === "`" ? "'" : ch;               // defuse markdown backticks
    })
    .join("")
    .trim();
  return cleaned.slice(0, max);
}

export function updateSecurityRules(
  repoRoot:  string,
  findings:  SecurityFinding[],
  scannedFiles: number,
): void {
  const mdPath  = join(repoRoot, "SECURITY_RULES.md");
  const date    = new Date().toISOString().slice(0, 10);
  const existing = existsSync(mdPath) ? readFileSync(mdPath, "utf-8") : "";

  // Build scan report section
  const high   = findings.filter((f) => f.severity === "HIGH").length;
  const medium = findings.filter((f) => f.severity === "MEDIUM").length;
  const low    = findings.filter((f) => f.severity === "LOW").length;

  const findingsMd = findings.length === 0
    ? "_Nessuna vulnerabilità trovata._\n"
    : findings.map((f) =>
        `#### ${SEVERITY_EMOJI[f.severity] ?? ""} [${f.severity}] ${sanitizeField(f.title, 200)}\n` +
        `- **File:** \`${sanitizeField(f.file, 200)}:${f.line}\`\n` +
        `- **Categoria:** \`${f.category}\`\n` +
        `- **Descrizione:** ${sanitizeField(f.description)}\n` +
        `- **Exploit:** ${sanitizeField(f.exploit)}\n` +
        `- **Fix:** ${sanitizeField(f.fix)}\n`
      ).join("\n");

  const scanSection =
    `\n---\n\n## Scan ${date}\n\n` +
    `**File analizzati:** ${scannedFiles} | ` +
    `**🔴 High:** ${high} | **🟡 Medium:** ${medium} | **🟢 Low:** ${low}\n\n` +
    findingsMd;

  writeFileSync(mdPath, existing + scanSection, "utf-8");
}
