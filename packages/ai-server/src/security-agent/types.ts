import { z } from "zod/v4";

export type Severity = "HIGH" | "MEDIUM" | "LOW";

export type VulnCategory =
  | "sql_injection"
  | "xss"
  | "auth_bypass"
  | "hardcoded_secret"
  | "weak_crypto"
  | "rce"
  | "data_exposure"
  | "path_traversal"
  | "insecure_deserialization"
  | "privilege_escalation"
  | "other";

export interface SecurityFinding {
  severity:    Severity;
  category:    VulnCategory;
  file:        string;
  line:        number;
  title:       string;
  description: string;
  exploit:     string;
  fix:         string;
  confidence:  number; // 0-1
}

/**
 * Runtime validation for findings parsed from untrusted LLM scan output. The
 * security-critical fields (severity, category, file, title) are strict; the
 * rest are lenient with defaults. A finding that fails this schema must never
 * reach the auto-fixer (see applier.ts), so invalid findings are dropped.
 */
export const securityFindingSchema = z.object({
  severity:    z.enum(["HIGH", "MEDIUM", "LOW"]),
  category:    z.enum([
    "sql_injection", "xss", "auth_bypass", "hardcoded_secret", "weak_crypto",
    "rce", "data_exposure", "path_traversal", "insecure_deserialization",
    "privilege_escalation", "other",
  ]),
  file:        z.string().min(1),
  line:        z.number().int().nonnegative().catch(0),
  title:       z.string().min(1),
  description: z.string().catch(""),
  exploit:     z.string().catch(""),
  fix:         z.string().catch(""),
  confidence:  z.number().min(0).max(1).catch(0),
}) satisfies z.ZodType<SecurityFinding>;

export interface SecurityScanOptions {
  /** File paths to scan (absolute or relative to repo root). */
  files:       string[];
  /** If true, the agent will try to apply code fixes automatically. */
  applyFixes?: boolean;
  /** User id initiating the scan (for cost tracking). */
  userId:      number;
  /** Repo root — used to resolve relative paths and update SECURITY_RULES.md. */
  repoRoot:    string;
}

export type SecurityAgentEvent =
  | { type: "status";      value: string }
  | { type: "finding";     finding: SecurityFinding }
  | { type: "fix_applied"; file: string; title: string }
  | { type: "rules_updated" }
  | { type: "done";        findings: SecurityFinding[]; totalFiles: number; costUsd: number }
  | { type: "error";       message: string };
