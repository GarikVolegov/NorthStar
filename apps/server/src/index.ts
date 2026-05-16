import app from "./app";
import http from "node:http";
import { rootLogger } from "./middleware/logger";
import { pool } from "@workspace/db";

const PORT = process.env.PORT || 3001;

const httpServer = http.createServer(app);
const { createWsServer } = await import("@workspace/ws-server");
const wss = createWsServer(httpServer);

import("./ws").then(({ setWss }) => setWss(wss));

const { startAlertChecker } = await import("./lib/alerts");
startAlertChecker();

httpServer.listen(PORT, () => {
  rootLogger.info({ port: PORT, wsPath: "/ws" }, "NorthStar API Server started");
});

const SHUTDOWN_TIMEOUT = 30_000;

async function gracefulShutdown(signal: string): Promise<void> {
  rootLogger.info({ signal }, "Shutting down gracefully...");

  httpServer.close(() => {
    rootLogger.info("HTTP server closed");
  });

  try {
    wss.raw.close();
    rootLogger.info("WebSocket server closed");
  } catch (err) {
    rootLogger.warn({ err }, "Error closing WebSocket server");
  }

  try {
    const { cacheClose } = await import("./lib/redis");
    await cacheClose();
    rootLogger.info("Redis client closed");
  } catch (err) {
    rootLogger.warn({ err }, "Error closing Redis client");
  }

  try {
    await pool.end();
    rootLogger.info("Database pool closed");
  } catch (err) {
    rootLogger.warn({ err }, "Error closing database pool");
  }

  setTimeout(() => {
    rootLogger.error("Forced exit after timeout");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT).unref();
}

process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => void gracefulShutdown("SIGINT"));
