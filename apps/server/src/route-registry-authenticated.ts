/**
 * Authenticated route registry.
 *
 * Mounts user-session domains. Routers may still perform narrower checks, but
 * every route in this layer is visible from one central route map.
 */
import type express from "express";
import { routeConfig } from "./route-config";
import { requireAuth } from "./middleware/require-auth";

export function registerAuthenticatedRoutes(app: express.Application): void {
  for (const route of routeConfig.filter((entry) => entry.auth === "authenticated")) {
    app.use(route.path, requireAuth(), route.router);
  }
}
