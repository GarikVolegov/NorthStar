import { Router, type Router as ExpressRouter } from "express";
import objectivesRouter from "./routes/objectives";
import calendarRouter from "./routes/calendar";
import dashboardRouter from "./routes/dashboard";
import dashboardLayoutRouter from "./routes/dashboard-layout";
import coachRouter from "./routes/coach";
import diaryRouter from "./routes/diary";
import usersRouter from "./routes/users";
import adminRouter from "./routes/admin";
import friendsRouter from "./routes/friends";
import socialRouter from "./routes/social";
import profileRouter from "./routes/profile";
import profileBackgroundRouter from "./routes/profile-background";
import profileLogoRouter from "./routes/profile-logo";
import profileNavigationLayoutRouter from "./routes/profile-navigation-layout";
import profileVisionRouter from "./routes/profile-vision";
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
import growthRouter from "./routes/growth";
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
import aiWendyRouter from "./routes/ai-wendy";
import wendyFeedbackRouter from "./routes/wendy-feedback";
import ragAdminRouter from "./routes/rag-admin";
import proactiveInsightsRouter from "./routes/proactive-insights";
import onboardingRouter from "./routes/onboarding";
import mlRouter from "./routes/ml";
import subscriptionRouter from "./routes/subscription";
import workspaceRouter from "./routes/workspace";
import briefingsRouter from "./routes/briefings";
import agentRouter from "./routes/agent";
import agentsRouter from "./routes/agents";
import journeyScoreRouter from "./routes/journey-score";
import cvRouter from "./routes/cv";
import notificationsRouter from "./routes/notifications";
import pushRouter from "./routes/push";
import favoritesRouter from "./routes/favorites";
import nftCertificatesRouter from "./routes/nft-certificates";
import certificationsRouter from "./routes/certifications";
import contactRouter from "./routes/contact";
import affiliazioneRouter from "./routes/affiliation-program";
import affiliateRouter from "./routes/affiliate";
import openhumanRouter from "./routes/openhuman";
import graphifyRouter from "./routes/graphify";
import skillsGapRouter from "./routes/skills-gap";
import aiImageRouter from "./routes/ai-image";
import monthlyRitualRouter from "./routes/monthly-ritual";
import { getHealthPayload } from "./lib/health";

export type RouteAuthLevel = "public" | "authenticated" | "admin";
export type RouteRateLimit = "global" | "strict" | "none";

export interface RouteConfig {
  path: string;
  router: ExpressRouter;
  auth: RouteAuthLevel;
  rateLimit?: RouteRateLimit;
  description: string;
}

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
  const { getAlertHistory } = await import("./lib/alerts");
  res.json({ alerts: getAlertHistory() });
});

export const routeConfig: RouteConfig[] = [
  { path: "/api/auth", router: authRouter, auth: "public", description: "Autenticazione" },
  { path: "/api/health", router: healthRouter, auth: "public", rateLimit: "none", description: "Liveness e readiness" },
  { path: "/api/wiki", router: wikiRouter, auth: "public", description: "Wiki pubblico" },
  { path: "/api/news", router: newsRouter, auth: "public", description: "News pubbliche" },
  { path: "/api/news/subscriptions", router: newsSubsRouter, auth: "public", description: "News subscriptions" },
  { path: "/api/trending-sectors", router: trendingRouter, auth: "public", description: "Settori trending" },
  { path: "/api/sectors", router: sectorsRouter, auth: "public", description: "Catalogo settori" },
  { path: "/api/roles", router: rolesRouter, auth: "public", description: "Catalogo ruoli" },
  { path: "/api/roadmap", router: roadmapRouter, auth: "public", description: "Roadmap pubblica" },
  { path: "/api/contact", router: contactRouter, auth: "public", description: "Messaggi contatto" },

  { path: "/api/profile", router: profileRouter, auth: "authenticated", description: "Profilo utente" },
  { path: "/api/profile", router: profileBackgroundRouter, auth: "authenticated", description: "Sfondo personalizzabile profilo" },
  { path: "/api/profile", router: profileLogoRouter, auth: "authenticated", description: "Logo profilo" },
  { path: "/api/profile", router: profileNavigationLayoutRouter, auth: "authenticated", description: "Layout navigazione profilo" },
  { path: "/api/profile-vision", router: profileVisionRouter, auth: "authenticated", description: "Analisi profilo con vision AI" },
  { path: "/api/users", router: usersRouter, auth: "authenticated", description: "Utenti" },
  { path: "/api/friends", router: friendsRouter, auth: "authenticated", description: "Amici e chat" },
  { path: "/api/social", router: socialRouter, auth: "authenticated", description: "Social feed" },
  { path: "/api/objectives", router: objectivesRouter, auth: "authenticated", description: "Obiettivi" },
  { path: "/api/calendar", router: calendarRouter, auth: "authenticated", description: "Calendario" },
  { path: "/api/dashboard", router: dashboardRouter, auth: "authenticated", description: "Dashboard" },
  { path: "/api/dashboard/layout", router: dashboardLayoutRouter, auth: "authenticated", description: "Layout dashboard" },
  { path: "/api/diary", router: diaryRouter, auth: "authenticated", description: "Diario personale" },
  { path: "/api/coach", router: coachRouter, auth: "authenticated", description: "Coach" },
  { path: "/api/knowledge", router: knowledgeRouter, auth: "authenticated", description: "Knowledge base" },
  { path: "/api/interview", router: interviewRouter, auth: "authenticated", description: "Interview" },
  { path: "/api/stats", router: statsRouter, auth: "authenticated", description: "Statistiche" },
  { path: "/api/voice", router: voiceRouter, auth: "authenticated", description: "Voice sessions" },
  { path: "/api/leaderboard", router: leaderboardRouter, auth: "authenticated", description: "Leaderboard" },
  { path: "/api/xp", router: xpRouter, auth: "authenticated", description: "XP" },
  { path: "/api/badges", router: badgesRouter, auth: "authenticated", description: "Badges" },
  { path: "/api/completion", router: completionRouter, auth: "authenticated", description: "Completion" },
  { path: "/api/applications", router: applicationsRouter, auth: "authenticated", description: "Candidature" },
  { path: "/api/test-sessions", router: testSessionsRouter, auth: "authenticated", description: "Test sessions" },
  { path: "/api/business-ideas", router: businessIdeasRouter, auth: "authenticated", description: "Business ideas" },
  { path: "/api/jobs", router: jobsRouter, auth: "authenticated", description: "Jobs" },
  { path: "/api/crescita", router: growthRouter, auth: "authenticated", description: "Crescita" },
  { path: "/api/journey-type", router: journeyTypeRouter, auth: "authenticated", description: "Tipo percorso" },
  { path: "/api/account", router: accountRouter, auth: "authenticated", description: "Account" },
  { path: "/api/wendy", router: wendyRouter, auth: "authenticated", description: "Wendy" },
  { path: "/api/search", router: searchRouter, auth: "authenticated", description: "Search" },
  { path: "/api/search/route", router: searchRouteRouter, auth: "authenticated", description: "Search route" },
  { path: "/api/search/hybrid", router: searchHybridRouter, auth: "authenticated", description: "Hybrid search" },
  { path: "/api/search/track", router: searchTrackRouter, auth: "authenticated", description: "Search tracking" },
  { path: "/api/security", router: securityRouter, auth: "authenticated", description: "Security settings" },
  { path: "/api/ai/wendy", router: aiWendyRouter, auth: "authenticated", description: "Wendy AI streaming" },
  { path: "/api/ai/wendy/feedback", router: wendyFeedbackRouter, auth: "authenticated", description: "Wendy feedback" },
  { path: "/api/ai/image", router: aiImageRouter, auth: "authenticated", description: "Wendy image generation (Pro)" },
  { path: "/api/users/me/proactive-insights", router: proactiveInsightsRouter, auth: "authenticated", description: "Proactive insights" },
  { path: "/api/onboarding", router: onboardingRouter, auth: "authenticated", description: "Onboarding" },
  { path: "/api/subscription", router: subscriptionRouter, auth: "public", description: "Subscription e Stripe webhook; endpoint utente protetti nel router" },
  { path: "/api/workspaces", router: workspaceRouter, auth: "authenticated", description: "Workspaces" },
  { path: "/api/briefings", router: briefingsRouter, auth: "authenticated", description: "Briefings" },
  { path: "/api/agent", router: agentRouter, auth: "authenticated", description: "Agent" },
  { path: "/api/agents", router: agentsRouter, auth: "authenticated", description: "Agents" },
  { path: "/api/journey-score", router: journeyScoreRouter, auth: "authenticated", description: "Journey score" },
  { path: "/api/cv", router: cvRouter, auth: "authenticated", description: "CV" },
  { path: "/api/notifications", router: notificationsRouter, auth: "authenticated", description: "Notifications" },
  { path: "/api/push", router: pushRouter, auth: "authenticated", description: "Push notifications" },
  { path: "/api/favorites", router: favoritesRouter, auth: "authenticated", description: "Favorites" },
  { path: "/api/nft-certificates", router: nftCertificatesRouter, auth: "authenticated", description: "NFT certificates" },
  { path: "/api/certifications", router: certificationsRouter, auth: "authenticated", description: "Certifications" },
  { path: "/api/affiliazione", router: affiliazioneRouter, auth: "authenticated", description: "Programma affiliazione" },
  { path: "/api/affiliate", router: affiliateRouter, auth: "authenticated", description: "Affiliate" },
  { path: "/api/openhuman", router: openhumanRouter, auth: "authenticated", description: "OpenHuman bridge" },
  { path: "/api/graphify", router: graphifyRouter, auth: "authenticated", description: "Graphify bridge" },
  { path: "/api/skills-gap", router: skillsGapRouter, auth: "authenticated", description: "Skills gap analysis" },
  { path: "/api/monthly-ritual", router: monthlyRitualRouter, auth: "authenticated", description: "Rituale mensile" },

  { path: "/api/admin", router: adminRouter, auth: "admin", description: "Pannello admin" },
  { path: "/api/admin/rag", router: ragAdminRouter, auth: "admin", description: "Admin RAG" },
  { path: "/api/ml", router: mlRouter, auth: "admin", description: "ML service proxy" },
];
