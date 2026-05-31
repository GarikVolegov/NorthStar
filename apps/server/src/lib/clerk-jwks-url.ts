function withJwksPath(frontendApiUrl: string): string {
  const normalized = frontendApiUrl.trim().replace(/\/+$/, "");
  if (!normalized) return "";
  const withProtocol = /^https?:\/\//i.test(normalized)
    ? normalized
    : `https://${normalized}`;
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

export function resolveClerkJwksUrl(env: NodeJS.ProcessEnv = process.env): string {
  if (env.CLERK_JWKS_URL?.trim()) return env.CLERK_JWKS_URL.trim();

  const frontendApi =
    env.CLERK_FRONTEND_API_URL?.trim() ??
    env.CLERK_FRONTEND_API?.trim() ??
    frontendApiFromPublishableKey(
      env.CLERK_PUBLISHABLE_KEY ??
        env.VITE_CLERK_PUBLISHABLE_KEY ??
        env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    );

  return withJwksPath(frontendApi);
}
