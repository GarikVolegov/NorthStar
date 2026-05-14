import dotenv from "dotenv";
dotenv.config();

import "express-async-errors";
process.on("unhandledRejection", (reason) => {
  console.error("[fatal] Unhandled Promise rejection:", reason);
});
import "./tracing";
import http from "node:http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { register, getMetricsContentType, getMetrics } from "@workspace/ai-server/metrics";
import { requestLoggerMiddleware, rootLogger } from "./middleware/logger";
import { globalLimiter, wendyLimiter, wendyIpLimiter, adminLimiter } from "./middleware/rate-limit";

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestLoggerMiddleware);
app.use(globalLimiter);

// Routes
import objectivesRouter from "./routes/objectives";
import calendarRouter from "./routes/calendar";
import dashboardRouter from "./routes/dashboard";
import coachRouter from "./routes/coach";
import wendyRouter from "./routes/wendy";
import usersRouter from "./routes/users";
import adminRouter from "./routes/admin";
import friendsRouter from "./routes/friends";
import profileRouter from "./routes/profile";
import knowledgeRouter from "./routes/knowledge";
import wikiRouter from "./routes/wiki";
import interviewRouter from "./routes/interview";
import authRouter from "./routes/auth";
import statsRouter from "./routes/stats";
import newsRouter from "./routes/news";
import trendingRouter from "./routes/trending";
import voiceRouter from "./routes/voice";
import leaderboardRouter from "./routes/leaderboard";
import xpRouter from "./routes/xp";
import badgesRouter from "./routes/badges";

app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/users", usersRouter);
app.use("/api/friends", friendsRouter);
app.use("/api/objectives", objectivesRouter);
app.use("/api/calendar", calendarRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/coach", coachRouter);
app.use("/api/wendy", wendyRouter);
app.use("/api/admin", adminRouter);
app.use("/api/knowledge", knowledgeRouter);
app.use("/api/wiki", wikiRouter);
app.use("/api/interview", interviewRouter);
app.use("/api/stats", statsRouter);
app.use("/api/news", newsRouter);
app.use("/api/trending-sectors", trendingRouter);
app.use("/api/voice", voiceRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/xp", xpRouter);
app.use("/api/badges", badgesRouter);

// Kubernetes liveness probe — always 200 if process is alive
app.get("/api/health/live", (req, res) => {
  res.json({ status: "alive" });
});

// Kubernetes readiness probe — checks DB connectivity
app.get("/api/health/ready", async (req, res) => {
  try {
    const { pool } = await import("@workspace/db");
    const result = await pool.query("SELECT 1");
    if (result) {
      res.json({ status: "ready" });
    } else {
      res.status(503).json({ status: "not ready" });
    }
  } catch (err) {
    res.status(503).json({ status: "not ready", message: String(err) });
  }
});

// Legacy health check endpoint
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
    rootLogger.error({ err }, "failed to serve metrics");
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
    (req.log ?? rootLogger).error({ err }, "unhandled error");
    res.status(500).json({
      error: "Internal Server Error",
      message: "Something went wrong",
    });
  },
);

const httpServer = http.createServer(app);
const { createWsServer } = await import("@workspace/ws-server");
const wss = createWsServer(httpServer);

// Rende il WebSocket server accessibile ai route handler
import("./ws").then(({ setWss }) => setWss(wss));

httpServer.listen(PORT, () => {
  rootLogger.info({ port: PORT, wsPath: "/ws" }, "NorthStar API Server started");
});
