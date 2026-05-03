import { Router } from "express";
import {
  getFreeNews,
  getSectorNews,
  getMultiCategoryNews,
  FREE_CATEGORIES,
  type FreeCategory,
} from "../lib/news";
import { orchestratorAgent } from "../agents/orchestrator";
import { logAgentCall } from "../agents/logger";
import { getAuthenticatedUserId, getUserPlan } from "../lib/plan-utils";
import { parseOrchestratorData, getSubAgentOutput, parseNewsAgentData } from "../lib/agent-helpers";
import { logger } from "../lib/logger";

const router = Router();

router.get("/news", async (req, res) => {
  const category = (req.query["category"] as string) || "general";
  const limit = Math.min(Number(req.query["limit"]) || 6, 20);
  const multi = req.query["multi"] === "true";

  if (multi) {
    const cats = ((req.query["categories"] as string) || "general,technology,business,science")
      .split(",")
      .filter((c) => FREE_CATEGORIES.includes(c as FreeCategory)) as FreeCategory[];
    const perCat = Math.min(Number(req.query["perCategory"]) || 2, 5);
    const news = await getMultiCategoryNews(cats, perCat);
    return res.json({ news, source: process.env["GNEWS_API_KEY"] ? "live" : "static" });
  }

  if (!FREE_CATEGORIES.includes(category as FreeCategory)) {
    return res.status(400).json({ error: "Categoria non valida" });
  }

  const userId = getAuthenticatedUserId(req);
  const plan = userId ? await getUserPlan(userId) : "free";
  const start = Date.now();

  try {
    const result = await orchestratorAgent.run({
      taskType: "news_filter",
      payload: { categories: [category] },
      context: { userId, plan, sharedState: {} },
    });

    const durationMs = Date.now() - start;
    await logAgentCall({
      agentName: "OrchestratorAgent",
      userId,
      taskType: "news_filter",
      inputSummary: { source: "/news", category, plan },
      outputSummary: { success: result.success },
      durationMs,
      error: result.error,
      retryCount: 0,
    });

    if (result.success) {
      const orcData = parseOrchestratorData(result);
      const newsData = orcData ? parseNewsAgentData(getSubAgentOutput(orcData, "NewsAgent")) : null;
      if (newsData) {
        return res.json({ news: newsData.news.slice(0, limit), source: newsData.source });
      }
    }
  } catch (err) {
    logger.warn({ err }, "NewsAgent delegation failed in /news, falling back");
  }

  const news = await getFreeNews(category as FreeCategory, limit);
  return res.json({ news, source: process.env["GNEWS_API_KEY"] ? "live" : "static" });
});

router.get("/news/sector/:sector", async (req, res) => {
  const { sector } = req.params;
  const limit = Math.min(Number(req.query["limit"]) || 8, 20);

  const userId = getAuthenticatedUserId(req);
  const plan = userId ? await getUserPlan(userId) : "free";
  const start = Date.now();

  try {
    const result = await orchestratorAgent.run({
      taskType: "news_filter",
      payload: { topSectors: [{ sectorName: sector }] },
      context: { userId, plan, sharedState: {} },
    });

    const durationMs = Date.now() - start;
    await logAgentCall({
      agentName: "OrchestratorAgent",
      userId,
      taskType: "news_filter",
      inputSummary: { source: "/news/sector/:sector", sector, plan },
      outputSummary: { success: result.success },
      durationMs,
      error: result.error,
      retryCount: 0,
    });

    if (result.success) {
      const orcData = parseOrchestratorData(result);
      const newsData = orcData ? parseNewsAgentData(getSubAgentOutput(orcData, "NewsAgent")) : null;
      if (newsData) {
        return res.json({ news: newsData.news.slice(0, limit), source: newsData.source });
      }
    }
  } catch (err) {
    logger.warn({ err }, "NewsAgent delegation failed in /news/sector/:sector, falling back");
  }

  const news = await getSectorNews(sector, limit);
  return res.json({ news, source: process.env["GNEWS_API_KEY"] ? "live" : "static" });
});

router.get("/news/personalizzate", async (req, res) => {
  const userId = getAuthenticatedUserId(req);
  const plan = userId ? await getUserPlan(userId) : "free";

  const sectors = req.query["sectors"]
    ? (req.query["sectors"] as string).split(",").map((s) => ({ sectorName: s.trim() }))
    : [];
  const categories = req.query["categories"]
    ? (req.query["categories"] as string).split(",")
    : ["general", "technology"];

  const start = Date.now();
  try {
    const agentResult = await orchestratorAgent.run({
      taskType: "news_filter",
      payload: { topSectors: sectors, categories },
      context: { userId, plan, sharedState: {} },
    });

    const durationMs = Date.now() - start;
    await logAgentCall({
      agentName: "OrchestratorAgent",
      userId,
      taskType: "news_filter",
      inputSummary: { source: "/news/personalizzate", plan },
      outputSummary: { success: agentResult.success },
      durationMs,
      error: agentResult.error,
      retryCount: 0,
    });

    if (agentResult.success) {
      const orcData = parseOrchestratorData(agentResult);
      if (orcData) {
        const newsOutput = parseNewsAgentData(getSubAgentOutput(orcData, "NewsAgent"));
        if (newsOutput) {
          return res.json({
            news: newsOutput.news,
            personalized: newsOutput.personalized,
            source: newsOutput.source,
            plan,
          });
        }
      }
    }
  } catch (err) {
    logger.warn({ err }, "NewsAgent delegation failed, falling back to direct fetch");
  }

  const news = await getFreeNews("general", 6);
  return res.json({ news, source: "fallback", personalized: false, plan });
});

export default router;
