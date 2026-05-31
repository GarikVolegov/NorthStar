import { Router, type Router as ExpressRouter } from "express";
import { getHealthPayload } from "../lib/health";

export function createHealthRouter(): ExpressRouter {
  const healthRouter = Router();

  healthRouter.get("/live", (_req, res) => {
    res.json({ status: "alive" });
  });

  healthRouter.get("/ready", async (_req, res) => {
    const payload = await getHealthPayload();
    res.status(payload.status === "fail" ? 503 : 200).json(payload);
  });

  healthRouter.get("/", async (_req, res) => {
    const payload = await getHealthPayload();
    res.status(payload.status === "fail" ? 503 : 200).json(payload);
  });

  healthRouter.get("/db", async (_req, res) => {
    try {
      const { pool } = await import("@workspace/db");
      res.json({
        status: "ok",
        pool: {
          totalCount: pool.totalCount,
          idleCount: pool.idleCount,
          waitingCount: pool.waitingCount,
        },
      });
    } catch (err) {
      res.status(503).json({ status: "error", message: String(err) });
    }
  });

  healthRouter.get("/alerts", async (_req, res) => {
    const { getAlertHistory } = await import("../lib/alerts");
    res.json({ alerts: getAlertHistory() });
  });

  return healthRouter;
}
