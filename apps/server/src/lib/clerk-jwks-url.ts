import type { VerifyOptions } from "jsonwebtoken";

function normalizeClerkUrl(frontendApiUrl: string): string {
  const normalized = frontendApiUrl.trim().replace(/\/+$/, "");
  if (!normalized) return "";
  return /^https?:\/\//i.test(normalized)
    ? normalized
    : `https://${normalized}`;
}

function withJwksPath(frontendApiUrl: string): string {
  const withProtocol = normalizeClerkUrl(frontendApiUrl);
  if (!withProtocol) return "";
  return `${withProtocol}/.well-known/jwks.json`;
}

function frontendApiFromPublishableKey(key: string | undefined): string {
  if (!key?.startsWith("pk_")) return "";
  const encoded = key.split("_").slice(2).join("_");
  if (!encoded) return "";

  try {
    return Buffer.from(encoded, "base64").toString("utf-8").replace(/\$$/, "");
  } catch {
    return "";
  }
}

function resolveClerkFrontendApiUrl(env: NodeJS.ProcessEnv): string {
  const explicit = env.CLERK_FRONTEND_API_URL?.trim() ?? env.CLERK_FRONTEND_API?.trim();
  if (explicit) return normalizeClerkUrl(explicit);

  return normalizeClerkUrl(frontendApiFromPublishableKey(
    env.CLERK_PUBLISHABLE_KEY ??
      env.VITE_CLERK_PUBLISHABLE_KEY ??
      env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  ));
}

export function resolveClerkJwksUrl(env: NodeJS.ProcessEnv = process.env): string {
  if (env.CLERK_JWKS_URL?.trim()) return env.CLERK_JWKS_URL.trim();

  return withJwksPath(resolveClerkFrontendApiUrl(env));
}

export function resolveClerkJwtVerifyOptions(env: NodeJS.ProcessEnv = process.env): VerifyOptions {
  const issuer = env.CLERK_JWT_ISSUER?.trim() ?? env.CLERK_ISSUER?.trim() ?? resolveClerkFrontendApiUrl(env);
  const audienceValue = env.CLERK_JWT_AUDIENCE?.trim() ?? env.CLERK_AUDIENCE?.trim();
  const audience = audienceValue
    ? audienceValue.split(",").map((value) => value.trim()).filter(Boolean)
    : undefined;
  const verifyAudience =
    audience && audience.length > 1
      ? (audience as [string, ...string[]])
      : audience?.[0];

  return {
    algorithms: ["RS256"],
    ...(issuer ? { issuer } : {}),
    ...(verifyAudience ? { audience: verifyAudience } : {}),
  };
}
