import { spawn, spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const pnpm = isWindows ? "pnpm.cmd" : "pnpm";
const docker = isWindows ? "docker.cmd" : "docker";
const apiBase = process.env.API_URL ?? "http://localhost:3001";
const webBase = process.env.BASE_URL ?? "http://localhost:5173";

function commandInvocation(command, args) {
  if (!isWindows) return { command, args };

  return {
    command: process.env.ComSpec ?? "cmd.exe",
    args: ["/d", "/c", [command, ...args].join(" ")],
  };
}

function runSetup(command, args, label, options = {}) {
  const invocation = commandInvocation(command, args);
  const result = spawnSync(invocation.command, invocation.args, {
    stdio: options.optional ? "pipe" : "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    const detail = result.error ? ` (${result.error.message})` : "";
    if (options.optional) {
      console.warn(
        `[e2e-stack] ${label} unavailable${detail}; continuing with configured services`,
      );
      return;
    }
    throw new Error(
      `${label} failed with exit code ${result.status ?? "unknown"}${detail}`,
    );
  }
}

function spawnService(command, args, label) {
  const invocation = commandInvocation(command, args);
  const child = spawn(invocation.command, invocation.args, {
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) return;
    console.error(`[e2e-stack] ${label} exited`, { code, signal });
    shutdown(code ?? 1);
  });

  return child;
}

let shuttingDown = false;
const children = [];

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
  setTimeout(() => process.exit(code), 500).unref();
}

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));

async function isUrlReady(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

try {
  runSetup(
    docker,
    ["compose", "up", "-d", "postgres", "redis"],
    "docker compose",
    { optional: true },
  );
  runSetup(pnpm, ["run", "db:migrate"], "db:migrate");

  if (await isUrlReady(`${apiBase}/api/health/live`)) {
    console.log(`[e2e-stack] reusing API server at ${apiBase}`);
  } else {
    children.push(spawnService(pnpm, ["run", "dev:server"], "server"));
  }

  if (await isUrlReady(webBase)) {
    console.log(`[e2e-stack] reusing web server at ${webBase}`);
  } else {
    children.push(spawnService(pnpm, ["run", "dev:web"], "web"));
  }

  if (children.length === 0) {
    setInterval(() => undefined, 60_000);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  shutdown(1);
}
