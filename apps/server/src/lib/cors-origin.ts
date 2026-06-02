type CorsEnv = Partial<
  Pick<
    NodeJS.ProcessEnv,
    | "ALLOWED_ORIGINS"
    | "APP_URL"
    | "CLIENT_URL"
    | "FRONTEND_URL"
    | "NODE_ENV"
    | "PUBLIC_APP_URL"
    | "VERCEL"
    | "VERCEL_BRANCH_URL"
    | "VERCEL_PROJECT_PRODUCTION_URL"
    | "VERCEL_URL"
  >
>;

const defaultLocalOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function normalizeOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    return new URL(trimmed).origin;
  } catch {
    return null;
  }
}

function normalizeHttpsHost(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return normalizeOrigin(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
}

function splitAllowedOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((origin) => normalizeOrigin(origin))
    .filter((origin): origin is string => Boolean(origin));
}

export function buildCorsAllowlist(env: CorsEnv = process.env): Set<string> {
  const configuredOrigins = [
    ...splitAllowedOrigins(env.ALLOWED_ORIGINS),
    normalizeOrigin(env.PUBLIC_APP_URL),
    normalizeOrigin(env.CLIENT_URL),
    normalizeOrigin(env.FRONTEND_URL),
    normalizeOrigin(env.APP_URL),
    normalizeHttpsHost(env.VERCEL_URL),
    normalizeHttpsHost(env.VERCEL_BRANCH_URL),
    normalizeHttpsHost(env.VERCEL_PROJECT_PRODUCTION_URL),
    ...defaultLocalOrigins,
  ].filter((origin): origin is string => Boolean(origin));

  return new Set(configuredOrigins);
}

export function isCorsOriginAllowed(
  origin: string | undefined,
  env: CorsEnv = process.env,
  allowlist = buildCorsAllowlist(env),
  requestOrigin?: string,
): boolean {
  if (!origin) return true;
  if (env.NODE_ENV !== "production") return true;

  const normalizedOrigin = normalizeOrigin(origin);
  if (!normalizedOrigin) return false;

  if (requestOrigin && normalizedOrigin === normalizeOrigin(requestOrigin)) return true;

  return allowlist.has(normalizedOrigin);
}
