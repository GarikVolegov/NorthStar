import dotenv from "dotenv";
dotenv.config();

import "./tracing";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { register, getMetricsContentType, getMetrics } from "@workspace/ai-server/metrics";
import { requestIdMiddleware } from "./middleware/request-id";
import { logger } from "@workspace/ai-server/logger";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestIdMiddleware);

// Routes
import objectivesRouter from "./routes/objectives";
import calendarRouter from "./routes/calendar";
import dashboardRouter from "./routes/dashboard";
import coachRouter from "./routes/coach";
import wendyRouter from "./routes/wendy";
import usersRouter from "./routes/users";

app.use("/api/objectives", objectivesRouter);
app.use("/api/calendar", calendarRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/coach", coachRouter);
app.use("/api/wendy", wendyRouter);
app.use("/api/users", usersRouter);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Database pool health check
app.get("/api/health/db", async (req, res) => {
  try {
    const { pool } = await import("@workspace/db");
    const poolStats = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    };
    res.json({ status: "ok", pool: poolStats });
  } catch (err) {
    res.status(503).json({ status: "error", message: String(err) });
  }
});

// Prometheus metrics endpoint
app.get("/api/metrics", async (req, res) => {
  try {
    res.setHeader("Content-Type", getMetricsContentType());
    const metrics = await getMetrics();
    res.send(metrics);
  } catch (err) {
    logger.error({ err }, "failed to serve metrics");
    res.status(500).json({ error: "metrics unavailable" });
  }
});

// Root endpoint
app.get("/api", (req, res) => {
  res.json({
    message: "NorthStar API Server",
    version: "0.1.0",
    endpoints: {
      health: "/api/health",
      metrics: "/api/metrics",
    },
  });
});

// 404 handler
app.use("/api/*", (req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: "The requested endpoint does not exist",
  });
});

// Error handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    logger.error({ err, requestId: req.requestId }, "unhandled error");
    res.status(500).json({
      error: "Internal Server Error",
      message: "Something went wrong",
    });
  },
);

app.listen(PORT, () => {
  logger.info({ port: PORT }, "NorthStar API Server started");
});

// Database pool health check
app.get("/api/health/db", async (req, res) => {
  try {
    const { pool } = await import("@workspace/db");
    const poolStats = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    };
    res.json({ status: "ok", pool: poolStats });
  } catch (err) {
    res.status(503).json({ status: "error", message: String(err) });
  }
});

// Root endpoint
app.get("/api", (req, res) => {
  res.json({
    message: "NorthStar API Server",
    version: "0.1.0",
    endpoints: {
      health: "/api/health",
      // TODO: Add other endpoints from OpenAPI spec
    },
  });
});

// 404 handler
app.use("/api/*", (req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: "The requested endpoint does not exist",
  });
});

// Error handler
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Something went wrong",
    });
  },
);

app.listen(PORT, () => {
  console.log(`🚀 NorthStar API Server running on port ${PORT}`);
});
