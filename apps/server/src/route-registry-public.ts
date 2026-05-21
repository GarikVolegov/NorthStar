/**
 * Public route registry.
 *
 * Mounts endpoints that are reachable without a user session: auth,
 * catalog/readiness surfaces, public content, and contact entry points.
 */
import type express from "express";
import { routeConfig } from "./route-config";

export function registerPublicRoutes(app: express.Application): void {
  for (const route of routeConfig.filter((entry) => entry.auth === "public")) {
    app.use(route.path, route.router);
  }
}
