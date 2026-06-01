export type AdminOpsStatus = {
  generatedAt: string;
  enabled: boolean;
  confirmationRequired: boolean;
  compose: {
    file: string;
    exists: boolean;
    dockerError: string | null;
    allowedServices: string[];
  };
  capabilities: {
    serverStart: boolean;
    serverStop: boolean;
    serverRestart: boolean;
    databaseMaintenance: boolean;
    databaseRestart: boolean;
  };
  server: {
    status: string;
    uptimeSeconds: number;
    pid: number;
    nodeVersion: string;
    platform: string;
    env: string;
    memory: { rss: number; heapUsed: number; heapTotal: number };
    docker: { status: string; label: string };
  };
  database: {
    status: string;
    ready: boolean;
    maintenance: {
      enabled: boolean;
      reason: string | null;
      updatedAt: string;
      updatedBy: number | null;
    };
    pool: { totalCount: number; idleCount: number; waitingCount: number };
    docker: { status: string; label: string };
  };
  redis: {
    docker: { status: string; label: string };
  };
  lastOperation: {
    id: string;
    action: string;
    service: string;
    status: "accepted" | "running" | "done" | "failed";
    message: string;
    requestedAt: string;
    finishedAt: string | null;
    requestedBy: number | null;
  } | null;
};

export type AdminOpsAction =
  | "server-start"
  | "server-stop"
  | "server-restart"
  | "database-restart";
