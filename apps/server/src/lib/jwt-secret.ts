const MIN_SECRET_LENGTH = 32;
const FORBIDDEN_PATTERNS = [
  /test/i,
  /secret/i,
  /changeme/i,
  /default/i,
  /northstar-admin/i,
];

function characterClassCount(value: string): number {
  return [
    /[a-z]/.test(value),
    /[A-Z]/.test(value),
    /\d/.test(value),
    /[^a-zA-Z0-9]/.test(value),
  ].filter(Boolean).length;
}

export function validateJwtSecret(
  value: string | undefined,
  env = process.env.NODE_ENV,
): string {
  if (!value) {
    throw new Error("[auth] JWT_SECRET not configured");
  }

  if (env === "test") return value;

  if (value.length < MIN_SECRET_LENGTH) {
    throw new Error("[auth] JWT_SECRET must be at least 32 characters long");
  }

  if (FORBIDDEN_PATTERNS.some((pattern) => pattern.test(value))) {
    throw new Error(
      "[auth] JWT_SECRET must not use test/default placeholder values",
    );
  }

  if (characterClassCount(value) < 2) {
    throw new Error("[auth] JWT_SECRET must contain enough character variety");
  }

  return value;
}

export const JWT_SECRET = validateJwtSecret(process.env.JWT_SECRET);
