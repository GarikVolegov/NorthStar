export function resolveWebPort(env: Record<string, string | undefined>): number {
  const rawPort = env.VITE_PORT || "5273";
  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid VITE_PORT value: "${rawPort}"`);
  }

  return port;
}
