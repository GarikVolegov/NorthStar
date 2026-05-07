/**
 * Startup environment validation.
 *
 * Call `assertEnv()` as the very first thing in your API server entrypoint.
 * If any secret is still using a placeholder value the server will refuse
 * to start — preventing accidental production deployments with insecure defaults.
 *
 * Usage:
 *
 *   import { assertEnv } from "@workspace/api-server/startup-env-check";
 *   assertEnv(); // throws if misconfigured
 *   const app = createApp();
 *   app.listen(PORT);
 */

interface EnvRule {
  key: string;
  /** Minimum length for the value to be considered non-default */
  minLength?: number;
  /** List of known placeholder / example values that must be rejected */
  forbiddenValues?: string[];
  /** If true, the check is only enforced when NODE_ENV === 'production' */
  productionOnly?: boolean;
  /** Human-readable description shown in error messages */
  description?: string;
}

const RULES: EnvRule[] = [
  // ─── Required in all environments ───────────────────────────────────────────
  {
    key:            "DATABASE_URL",
    forbiddenValues: [
      "postgresql://northstar:northstar_dev@localhost:5432/northstar",
    ],
    productionOnly: true, // local dev may use the default compose URL
    description:    "PostgreSQL connection string",
  },
  {
    key:             "JWT_SECRET",
    minLength:       32,
    forbiddenValues: [
      "change-me-jwt-secret-min-32-chars",
      "secret",
      "jwt-secret",
      "your-secret",
    ],
    description: "HS256 signing secret for user JWTs (min 32 chars)",
  },
  {
    key:             "ADMIN_KEY",
    minLength:       32,
    forbiddenValues: [
      "change-me-admin-key-min-32-chars",
      "admin",
      "admin-key",
      "your-admin-key",
    ],
    description: "Legacy admin key (kept for backwards compatibility)",
  },

  // ─── Phase 6 — Supervisor self-improvement ─────────────────────────────────
  // Used by adminOnly middleware to protect POST /api/admin/analyze-supervisor.
  // Generate with: openssl rand -hex 32
  {
    key:             "ADMIN_SECRET",
    minLength:       32,
    forbiddenValues: [
      "change-me-admin-secret-min-32-chars",
      "admin-secret",
      "your-admin-secret",
      "secret",
    ],
    description:    "x-admin-secret header value for /api/admin/* routes (min 32 chars)",
    productionOnly: true, // dev without DB still boots; middleware warns instead of blocking
  },
];

export class EnvConfigError extends Error {
  readonly name = "EnvConfigError";
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function assertEnv(): void {
  const isProd = process.env.NODE_ENV === "production";
  const errors: string[] = [];

  for (const rule of RULES) {
    if (rule.productionOnly && !isProd) continue;

    const value = process.env[rule.key];

    if (!value || value.trim() === "") {
      const hint = rule.description ? ` (${rule.description})` : "";
      errors.push(`  ✗ ${rule.key} is not set${hint}`);
      continue;
    }

    if (rule.minLength && value.length < rule.minLength) {
      errors.push(
        `  ✗ ${rule.key} is too short (${value.length} chars, minimum ${rule.minLength})`,
      );
      continue;
    }

    if (rule.forbiddenValues?.includes(value)) {
      errors.push(
        `  ✗ ${rule.key} is using a placeholder/default value — change it before deploying`,
      );
    }
  }

  if (errors.length > 0) {
    throw new EnvConfigError(
      `[startup] Environment configuration errors:\n${errors.join("\n")}\n` +
        `Copy .env.example to .env and fill in real values.`,
    );
  }
}
