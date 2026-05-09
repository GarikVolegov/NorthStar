/**
 * app.ts — Factory che restituisce l'app Express configurata
 * senza chiamare .listen().
 *
 * supertest crea il proprio server HTTP effimero, quindi non
 * dobbiamo occupare porte reali nei test.
 *
 * USO:
 *   import { buildApp } from "./helpers/app";
 *   const app = buildApp();
 *   const res = await request(app).get("/api/health");
 */
import "dotenv/config";
import express         from "express";
import cors            from "cors";
import helmet          from "helmet";
import cookieParser    from "cookie-parser";

import { requestLogger }               from "../../middleware/request-logger";
import { requireAuth, optionalAuth }   from "../../middleware/jwt";
import { saveRefCookie }               from "../../affiliate/affiliate-tracking";
import { affiliateRouter }             from "../../affiliate/affiliate-router";
import { profileRouter }               from "../../profile/profile-router";
import { progressRouter }              from "../../profile/progress-router";
import { publicProfileRouter }         from "../../profile/public-profile-router";
import { riasecRouter }                from "../../profile/riasec-router";
import { onboardingRouter }            from "../../growth-agent/onboarding-router";
import { stripeWebhookRouter }         from "../../stripe/stripe-webhook-router";
import { logger }                      from "../../lib/logger";
import type { RequestWithLog }         from "../../middleware/request-logger";

export function buildApp(): express.Application {
  const app    = express();
  const isProd = false; // sempre development nei test

  app.use(cors({ origin: true, credentials: true }));
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cookieParser());
  app.use(requestLogger);

  app.use("/api/stripe", stripeWebhookRouter);

  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: false }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth",                    requireAuth, profileRouter);
  app.use("/api/affiliate",               requireAuth, affiliateRouter);
  app.use("/api/users/me",                requireAuth, profileRouter);
  app.use("/api/users/me/progress",       requireAuth, progressRouter);
  app.use("/api/riasec",                  requireAuth, riasecRouter);
  app.use("/api/growth-agent/onboarding", requireAuth, onboardingRouter);
  app.use("/api/u",                       optionalAuth, publicProfileRouter);

  app.use((req: express.Request, res: express.Response) => {
    res.status(404).json({ error: "Route non trovata" });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const log = (req as RequestWithLog).log ?? logger;
    log.error({ err }, "unhandled error in test");
    res.status(500).json({ error: err.message });
  });

  return app;
}
