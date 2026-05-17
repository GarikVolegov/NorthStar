import dotenv from "dotenv";
dotenv.config();

import "express-async-errors";
process.on("unhandledRejection", (reason) => {
  rootLogger.fatal({ err: reason }, "[fatal] Unhandled Promise rejection");
});
import "./tracing";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { register, getMetricsContentType, getMetrics } from "@workspace/ai-server/metrics";
import { requestLoggerMiddleware, rootLogger } from "./middleware/logger";
import { globalLimiter } from "./middleware/rate-limit";
import { metricsProtection } from "./middleware/metrics-protection";
import { record } from "./lib/monitor";

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [];

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https:"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:"],
        imgSrc: ["'self'", "data:", "https:"],
        fontSrc: ["'self'", "https:"],
        connectSrc: ["'self'", "https:", "wss:"],
        frameSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
  })
);
const isDev = process.env.NODE_ENV === "development";
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    // Development: allow any origin
    if (isDev) return callback(null, true);
    // Production: check against allowed origins
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(express.json());
app.use(requestLoggerMiddleware);
app.use(globalLimiter);

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    record(res.statusCode, Date.now() - start);
  });
  next();
});

import objectivesRouter from "./routes/objectives";
import calendarRouter from "./routes/calendar";
import dashboardRouter from "./routes/dashboard";
import coachRouter from "./routes/coach";
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
import newsSubsRouter from "./routes/news-subs";
import trendingRouter from "./routes/trending";
import voiceRouter from "./routes/voice";
import leaderboardRouter from "./routes/leaderboard";
import xpRouter from "./routes/xp";
import badgesRouter from "./routes/badges";
import completionRouter from "./routes/completion";
import applicationsRouter from "./routes/applications";
import testSessionsRouter from "./routes/test-sessions";
import businessIdeasRouter from "./routes/business-ideas";
import jobsRouter from "./routes/jobs";
import sectorsRouter from "./routes/sectors";
import roadmapRouter from "./routes/roadmap";
import journeyTypeRouter from "./routes/journey-type";
import accountRouter from "./routes/account";
import wendyRouter from "./routes/wendy";
import rolesRouter from "./routes/roles";
import searchRouter from "./routes/search";
import searchRouteRouter from "./routes/search-route";
import searchHybridRouter from "./routes/search-hybrid";
import searchTrackRouter from "./routes/search-track";
import securityRouter from "./routes/security";
import aiWendyRouter        from "./routes/ai-wendy";
import wendyFeedbackRouter  from "./routes/wendy-feedback";
import ragAdminRouter          from "./routes/rag-admin";
import proactiveInsightsRouter from "./routes/proactive-insights";
import onboardingRouter        from "./routes/onboarding";
import mlRouter                from "./routes/ml";
import subscriptionRouter      from "./routes/subscription";
import workspaceRouter         from "./routes/workspace";
import briefingsRouter         from "./routes/briefings";

app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/users", usersRouter);
app.use("/api/friends", friendsRouter);
app.use("/api/objectives", objectivesRouter);
app.use("/api/calendar", calendarRouter);
app.use("/api/dashboard", dashboardRouter);
app.use("/api/coach", coachRouter);
app.use("/api/admin", adminRouter);
app.use("/api/knowledge", knowledgeRouter);
app.use("/api/wiki", wikiRouter);
app.use("/api/interview", interviewRouter);
app.use("/api/stats", statsRouter);
app.use("/api/news", newsRouter);
app.use("/api/news/subscriptions", newsSubsRouter);
app.use("/api/trending-sectors", trendingRouter);
app.use("/api/voice", voiceRouter);
app.use("/api/leaderboard", leaderboardRouter);
app.use("/api/xp", xpRouter);
app.use("/api/badges", badgesRouter);
app.use("/api/completion", completionRouter);
app.use("/api/applications", applicationsRouter);
app.use("/api/test-sessions", testSessionsRouter);
app.use("/api/business-ideas", businessIdeasRouter);
app.use("/api/jobs", jobsRouter);
app.use("/api/sectors", sectorsRouter);
app.use("/api/roles", rolesRouter);
app.use("/api/roadmap", roadmapRouter);
app.use("/api/profile", journeyTypeRouter);
app.use("/api/account", accountRouter);
app.use("/api/wendy", wendyRouter);
app.use("/api/search", searchRouter);
app.use("/api/search/route", searchRouteRouter);
app.use("/api/search/hybrid", searchHybridRouter);
app.use("/api/search/track", searchTrackRouter);
app.use("/api/security",    securityRouter);
app.use("/api/ai/wendy",            aiWendyRouter);
app.use("/api/ai/wendy/feedback",   wendyFeedbackRouter);
// Step 6: RAG admin + proactive insights
app.use("/api/admin",                       ragAdminRouter);
app.use("/api/users/me/proactive-insights", proactiveInsightsRouter);
// Python ML Service proxy
app.use("/api/ml",                          mlRouter);
// Step 7: onboarding, subscription, workspace, briefing
app.use("/api/onboarding",                  onboardingRouter);
app.use("/api/subscription",                subscriptionRouter);
app.use("/api/workspaces",                  workspaceRouter);
app.use("/api/briefings",                   briefingsRouter);

app.get("/api/health/live", (req, res) => {
  res.json({ status: "alive" });
});

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

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

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

app.get("/api/health/alerts", async (req, res) => {
  const { getAlertHistory } = await import("./lib/alerts");
  res.json({ alerts: getAlertHistory() });
});

app.get("/api/metrics", metricsProtection, async (req, res) => {
  try {
    res.setHeader("Content-Type", getMetricsContentType());
    const metrics = await getMetrics();
    res.send(metrics);
  } catch (err) {
    rootLogger.error({ err }, "failed to serve metrics");
    res.status(500).json({ error: "metrics unavailable" });
  }
});

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

app.use("/api/*", (req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: "The requested endpoint does not exist",
  });
});

app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    (req.log ?? rootLogger).error({ err }, "unhandled error");
    // Step Foundation: cattura strutturata per /api/admin/error-report
    try {
      const { executionMonitor } = require("./lib/execution-monitor") as typeof import("./lib/execution-monitor");
      executionMonitor.capture(err, {
        file:     "app.ts",
        function: `${req.method} ${req.originalUrl ?? req.url ?? "<unknown>"}`,
      });
    } catch { /* fire-and-forget */ }
    res.status(500).json({
      error: "Internal Server Error",
      message: "Something went wrong",
    });
  },
);

export default app;
