function hasRedisProtocol(value: string): boolean {
  return value.startsWith("redis://") || value.startsWith("rediss://");
}

function isPrivateRuntimeHost(value: string): boolean {
  try {
    const hostname = new URL(value).hostname;
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.endsWith(".internal")
    );
  } catch {
    return true;
  }
}

export function resolveRedisUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const publicUrl = env.REDIS_PUBLIC_URL || env.UPSTASH_REDIS_URL || "";
  if (publicUrl && hasRedisProtocol(publicUrl)) {
    return publicUrl;
  }

  const redisUrl = env.REDIS_URL || "";
  if (!redisUrl || !hasRedisProtocol(redisUrl)) {
    return null;
  }

  if (env.VERCEL && isPrivateRuntimeHost(redisUrl)) {
    return null;
  }

  return redisUrl;
}
