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
