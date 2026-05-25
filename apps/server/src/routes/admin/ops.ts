import { Router, type Request, type Response } from "express";
import { writeAuditLog } from "../../middleware/audit";
import { rootLogger } from "../../middleware/logger";
import {
  getAdminOpsStatus,
  queueDockerOperation,
  validateOpsAction,
} from "../../lib/admin-ops";
import { setMaintenanceMode } from "../../lib/maintenance-mode";
import { getRequestBody } from "../../lib/request-context";
import { asPlainRecord } from "../../lib/type-guards";

const router = Router();

async function runOpsServiceAction(
  req: Request,
  res: Response,
  service: "northstar-server" | "postgres",
  action: "start" | "stop" | "restart",
) {
  const body = asPlainRecord(getRequestBody(req));
  const confirmation =
    typeof body.confirmation === "string" ? body.confirmation : undefined;
  const validation = validateOpsAction({
    service,
    action,
    ...(confirmation ? { confirmation } : {}),
  });
  if (!validation.ok) {
    res.status(validation.status).json({
      error: validation.error,
      expectedConfirmation: validation.expectedConfirmation ?? null,
    });
    return;
  }

  const operation = queueDockerOperation({
    service,
    action,
    requestedBy: req.user?.id ?? null,
  });

  void writeAuditLog(req, {
    action: `admin_ops_${service}_${action}`,
    category: "admin_action",
    metadata: { service, action, operationId: operation.id },
  });

  res.status(202).json({ ok: true, operation });
}

router.get("/ops/status", async (_req: Request, res: Response) => {
  try {
    const status = await getAdminOpsStatus();
    res.json(status);
  } catch (err) {
    rootLogger.error({ err }, "[admin/ops/status] error");
    res.status(500).json({ error: "Stato operativo non disponibile" });
  }
});

router.post("/ops/server/restart", async (req: Request, res: Response) => {
  await runOpsServiceAction(req, res, "northstar-server", "restart");
});

router.post("/ops/server/stop", async (req: Request, res: Response) => {
  await runOpsServiceAction(req, res, "northstar-server", "stop");
});

router.post("/ops/server/start", async (req: Request, res: Response) => {
  await runOpsServiceAction(req, res, "northstar-server", "start");
});

router.post("/ops/database/restart", async (req: Request, res: Response) => {
  await runOpsServiceAction(req, res, "postgres", "restart");
});

router.post(
  "/ops/database/maintenance",
  async (req: Request, res: Response) => {
    try {
      const body = asPlainRecord(getRequestBody(req));
      const enabled = Boolean(body.enabled);
      const reason = typeof body.reason === "string" ? body.reason : null;
      const maintenance = await setMaintenanceMode({
        enabled,
        reason,
        updatedBy: req.user?.id ?? null,
      });

      void writeAuditLog(req, {
        action: enabled
          ? "admin_ops_database_maintenance_on"
          : "admin_ops_database_maintenance_off",
        category: "admin_action",
        metadata: { reason: maintenance.reason },
      });

      res.json({ ok: true, maintenance });
    } catch (err) {
      rootLogger.error({ err }, "[admin/ops/database/maintenance] error");
      res
        .status(500)
        .json({ error: "Impossibile aggiornare la maintenance mode" });
    }
  },
);

export default router;
