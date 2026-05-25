import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import type { SecurityFinding } from "./types";

const SEVERITY_EMOJI: Record<string, string> = {
  HIGH:   "🔴",
  MEDIUM: "🟡",
  LOW:    "🟢",
};

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
        `#### ${SEVERITY_EMOJI[f.severity] ?? ""} [${f.severity}] ${f.title}\n` +
        `- **File:** \`${f.file}:${f.line}\`\n` +
        `- **Categoria:** \`${f.category}\`\n` +
        `- **Descrizione:** ${f.description}\n` +
        `- **Exploit:** ${f.exploit}\n` +
        `- **Fix:** ${f.fix}\n`
      ).join("\n");

  const scanSection =
    `\n---\n\n## Scan ${date}\n\n` +
    `**File analizzati:** ${scannedFiles} | ` +
    `**🔴 High:** ${high} | **🟡 Medium:** ${medium} | **🟢 Low:** ${low}\n\n` +
    findingsMd;

  writeFileSync(mdPath, existing + scanSection, "utf-8");
}
