export function resolveWebPort(env: Record<string, string | undefined>): number {
  const rawPort = env.VITE_PORT || "5173";
  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid VITE_PORT value: "${rawPort}"`);
  }

  return port;
}

export function resolveWebHttps(env: Record<string, string | undefined>): boolean {
  return env.VITE_HTTPS?.trim().toLowerCase() === "true";
}
