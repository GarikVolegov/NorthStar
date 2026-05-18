import { type NextFunction, type Request, type Response } from "express";
import { cacheGet, cacheSet } from "./redis";

const CACHE_KEY = "admin:ops:maintenance-mode";

type MaintenanceState = {
  enabled: boolean;
  reason: string | null;
  updatedAt: string;
  updatedBy: number | null;
};

let fallbackState: MaintenanceState = {
  enabled: process.env.ADMIN_MAINTENANCE_MODE === "true",
  reason: process.env.ADMIN_MAINTENANCE_MODE === "true" ? "Abilitata da env" : null,
  updatedAt: new Date().toISOString(),
  updatedBy: null,
};

export async function getMaintenanceMode(): Promise<MaintenanceState> {
  const cached = await cacheGet<MaintenanceState>(CACHE_KEY);
  return cached ?? fallbackState;
}

export async function setMaintenanceMode(input: {
  enabled: boolean;
  reason?: string | null;
  updatedBy?: number | null;
}): Promise<MaintenanceState> {
  fallbackState = {
    enabled: input.enabled,
    reason: input.reason?.trim() || null,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy ?? null,
  };
  await cacheSet(CACHE_KEY, fallbackState, 0);
  return fallbackState;
}

function isExemptPath(path: string): boolean {
  return (
    path.startsWith("/api/admin") ||
    path.startsWith("/api/auth") ||
    path.startsWith("/api/health") ||
    path.startsWith("/api/metrics") ||
    path.startsWith("/api/subscription/webhook")
  );
}

export async function maintenanceModeMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    next();
    return;
  }
  if (req.method === "OPTIONS" || isExemptPath(req.path)) {
    next();
    return;
  }

  const state = await getMaintenanceMode();
  if (!state.enabled) {
    next();
    return;
  }

  res.status(503).json({
    code: "MAINTENANCE_MODE",
    error: "Sistema in manutenzione: le modifiche sono temporaneamente sospese.",
    maintenance: state,
  });
}
