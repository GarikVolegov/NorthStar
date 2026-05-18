import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { checkDatabaseHealth, pool } from "@workspace/db";
import { getMaintenanceMode } from "./maintenance-mode";

const execFileAsync = promisify(execFile);

type OpsAction = "start" | "stop" | "restart";
type OpsService = "northstar-server" | "postgres" | "redis";
type DockerServiceStatus = "running" | "stopped" | "unknown" | "error";

type LastOperation = {
  id: string;
  action: OpsAction | "maintenance";
  service: OpsService | "database";
  status: "accepted" | "running" | "done" | "failed";
  message: string;
  requestedAt: string;
  finishedAt: string | null;
  requestedBy: number | null;
};

const DEFAULT_ALLOWED_SERVICES: OpsService[] = ["northstar-server", "postgres", "redis"];
const CONFIRMATION_LABELS: Record<string, string> = {
  "northstar-server:restart": "RIAVVIA SERVER",
  "northstar-server:stop": "SPEGNI SERVER",
  "northstar-server:start": "ACCENDI SERVER",
  "postgres:restart": "RIAVVIA DATABASE",
};

let lastOperation: LastOperation | null = null;

function boolEnv(name: string, fallback = false): boolean {
  const value = process.env[name];
  if (value == null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function splitServices(value: string | undefined): OpsService[] {
  const allowed = new Set(DEFAULT_ALLOWED_SERVICES);
  return (value ?? DEFAULT_ALLOWED_SERVICES.join(","))
    .split(",")
    .map((part) => part.trim())
    .filter((part): part is OpsService => allowed.has(part as OpsService));
}

function resolveComposeFile(): { file: string; cwd: string; exists: boolean } {
  const configured = process.env.ADMIN_OPS_COMPOSE_FILE || "docker-compose.yml";
  const candidates = [
    path.resolve(process.cwd(), configured),
    path.resolve(process.cwd(), "..", "..", configured),
    path.resolve(process.cwd(), "..", configured),
  ];
  const file = candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
  return { file, cwd: path.dirname(file), exists: fs.existsSync(file) };
}

function opsEnabled() {
  return boolEnv("ADMIN_OPS_ENABLED", false);
}

function dbRestartEnabled() {
  return boolEnv("ADMIN_OPS_ALLOW_DB_RESTART", false);
}

function requiresConfirmation() {
  return boolEnv("ADMIN_OPS_REQUIRE_CONFIRMATION", true);
}

async function runDockerCompose(args: string[]) {
  const compose = resolveComposeFile();
  if (!compose.exists) {
    throw new Error(`Compose file non trovato: ${compose.file}`);
  }
  return execFileAsync("docker", ["compose", "-f", compose.file, ...args], {
    cwd: compose.cwd,
    timeout: 20_000,
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });
}

function parseComposePs(stdout: string): Record<string, DockerServiceStatus> {
  const services: Record<string, DockerServiceStatus> = {};
  const trimmed = stdout.trim();
  if (!trimmed) return services;

  const parseRow = (row: unknown) => {
    if (!row || typeof row !== "object") return;
    const record = row as Record<string, unknown>;
    const service = String(record.Service ?? record.Name ?? "");
    const state = String(record.State ?? record.Status ?? "").toLowerCase();
    if (!service) return;
    services[service] = state.includes("running") ? "running" : state ? "stopped" : "unknown";
  };

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) parsed.forEach(parseRow);
    else parseRow(parsed);
    return services;
  } catch {
    for (const line of trimmed.split(/\r?\n/)) {
      try {
        parseRow(JSON.parse(line));
      } catch {
        // Ignore non-JSON compose output.
      }
    }
    return services;
  }
}

export async function getAdminOpsStatus() {
  const compose = resolveComposeFile();
  const allowedServices = splitServices(process.env.ADMIN_OPS_ALLOWED_SERVICES);
  const maintenance = await getMaintenanceMode();
  const dbReady = await checkDatabaseHealth();
  const memory = process.memoryUsage();
  let dockerError: string | null = null;
  let dockerServices: Record<OpsService, { status: DockerServiceStatus; label: string }> = {
    "northstar-server": { status: "unknown", label: "NorthStar Server" },
    postgres: { status: "unknown", label: "Postgres" },
    redis: { status: "unknown", label: "Redis" },
  };

  if (opsEnabled()) {
    try {
      const { stdout } = await runDockerCompose(["ps", "--format", "json"]);
      const parsed = parseComposePs(String(stdout));
      dockerServices = {
        "northstar-server": { status: parsed["northstar-server"] ?? "unknown", label: "NorthStar Server" },
        postgres: { status: parsed.postgres ?? "unknown", label: "Postgres" },
        redis: { status: parsed.redis ?? "unknown", label: "Redis" },
      };
    } catch (err) {
      dockerError = err instanceof Error ? err.message : String(err);
      dockerServices = {
        "northstar-server": { status: "error", label: "NorthStar Server" },
        postgres: { status: "error", label: "Postgres" },
        redis: { status: "error", label: "Redis" },
      };
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    enabled: opsEnabled(),
    confirmationRequired: requiresConfirmation(),
    compose: {
      file: compose.file,
      exists: compose.exists,
      dockerError,
      allowedServices,
    },
    capabilities: {
      serverStart: opsEnabled() && allowedServices.includes("northstar-server"),
      serverStop: opsEnabled() && allowedServices.includes("northstar-server"),
      serverRestart: opsEnabled() && allowedServices.includes("northstar-server"),
      databaseMaintenance: true,
      databaseRestart: opsEnabled() && dbRestartEnabled() && allowedServices.includes("postgres"),
    },
    server: {
      status: dbReady ? "online" : "degraded",
      uptimeSeconds: Math.floor(process.uptime()),
      pid: process.pid,
      nodeVersion: process.version,
      platform: `${os.platform()} ${os.release()}`,
      env: process.env.NODE_ENV ?? "development",
      memory: {
        rss: memory.rss,
        heapUsed: memory.heapUsed,
        heapTotal: memory.heapTotal,
      },
      docker: dockerServices["northstar-server"],
    },
    database: {
      status: maintenance.enabled ? "maintenance" : dbReady ? "online" : "offline",
      ready: dbReady,
      maintenance,
      pool: {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount,
      },
      docker: dockerServices.postgres,
    },
    redis: {
      docker: dockerServices.redis,
    },
    lastOperation,
  };
}

export function expectedConfirmation(service: OpsService, action: OpsAction): string | null {
  return CONFIRMATION_LABELS[`${service}:${action}`] ?? null;
}

export function validateOpsAction(input: {
  service: OpsService;
  action: OpsAction;
  confirmation?: string;
}): { ok: true } | { ok: false; status: number; error: string; expectedConfirmation?: string } {
  if (!opsEnabled()) {
    return { ok: false, status: 403, error: "Admin Ops non abilitato. Imposta ADMIN_OPS_ENABLED=true." };
  }

  const allowedServices = splitServices(process.env.ADMIN_OPS_ALLOWED_SERVICES);
  if (!allowedServices.includes(input.service)) {
    return { ok: false, status: 400, error: "Servizio non consentito per le azioni Admin Ops." };
  }

  if (input.service === "postgres" && input.action === "restart" && !dbRestartEnabled()) {
    return { ok: false, status: 403, error: "Restart database disabilitato. Imposta ADMIN_OPS_ALLOW_DB_RESTART=true." };
  }

  if (input.service !== "northstar-server" && input.service !== "postgres") {
    return { ok: false, status: 400, error: "Azione non supportata per questo servizio." };
  }

  const expected = expectedConfirmation(input.service, input.action);
  if (requiresConfirmation() && expected && input.confirmation !== expected) {
    return {
      ok: false,
      status: 400,
      error: `Conferma richiesta: scrivi esattamente "${expected}".`,
      expectedConfirmation: expected,
    };
  }

  return { ok: true };
}

export function queueDockerOperation(input: {
  service: OpsService;
  action: OpsAction;
  requestedBy?: number | null;
}): LastOperation {
  const operation: LastOperation = {
    id: `${Date.now()}-${input.service}-${input.action}`,
    action: input.action,
    service: input.service,
    status: "accepted",
    message: "Operazione accodata.",
    requestedAt: new Date().toISOString(),
    finishedAt: null,
    requestedBy: input.requestedBy ?? null,
  };
  lastOperation = operation;

  setTimeout(() => {
    operation.status = "running";
    operation.message = "Operazione in corso.";
    lastOperation = operation;
    const args =
      input.action === "start"
        ? ["up", "-d", input.service]
        : [input.action, input.service];
    runDockerCompose(args)
      .then(() => {
        operation.status = "done";
        operation.message = "Operazione completata.";
        operation.finishedAt = new Date().toISOString();
        lastOperation = operation;
      })
      .catch((err) => {
        operation.status = "failed";
        operation.message = err instanceof Error ? err.message : String(err);
        operation.finishedAt = new Date().toISOString();
        lastOperation = operation;
      });
  }, 500);

  return operation;
}
