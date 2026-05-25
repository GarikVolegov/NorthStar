/**
 * Admin route registry.
 *
 * Mounts operational/admin-only domains from the central route map. Individual
 * routers keep their existing admin guards to preserve current behavior.
 */
import type express from "express";
import { routeConfig } from "./route-config";
import { requireAdmin } from "./middleware/require-admin";

export function registerAdminRoutes(app: express.Application): void {
  for (const route of routeConfig.filter((entry) => entry.auth === "admin")) {
    app.use(route.path, requireAdmin, route.router);
  }
}
