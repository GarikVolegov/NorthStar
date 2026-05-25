import { Router, type Request, type Response } from "express";
import {
  BUILTIN_FEATURE_MANIFESTS,
  aiPlugins,
  featureManifests,
  getAllCatalogEntries,
  listWendyToolsFromFeatures,
  registerFeatureManifest,
  refreshCatalog,
  resetFeatureManifests,
} from "@workspace/ai-server";
import { rootLogger } from "../../middleware/logger";

const router = Router();

router.get("/plugins", (_req: Request, res: Response) => {
  res.json({
    generatedAt: new Date().toISOString(),
    plugins: aiPlugins.snapshots(),
  });
});

router.get("/wendy-capabilities", (_req: Request, res: Response) => {
  resetFeatureManifests();
  for (const manifest of BUILTIN_FEATURE_MANIFESTS) {
    registerFeatureManifest(manifest);
  }
  res.json({
    generatedAt: new Date().toISOString(),
    coverage: featureManifests.coverage(),
    features: featureManifests.list().map((manifest) => ({
      id: manifest.id,
      name: manifest.name,
      status: manifest.status,
      owner: manifest.owner,
      webRoutes: manifest.webRoutes,
      apiRoutes: manifest.apiRoutes,
      telemetry: manifest.telemetry,
      smoke: manifest.smoke,
    })),
    tools: listWendyToolsFromFeatures(),
  });
});

router.post("/plugins/health", async (_req: Request, res: Response) => {
  try {
    const plugins = await aiPlugins.runHealthAll();
    res.json({ generatedAt: new Date().toISOString(), plugins });
  } catch (err) {
    rootLogger.error({ err }, "[admin/plugins] runHealthAll failed");
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/plugins/catalog", (_req: Request, res: Response) => {
  res.json({
    generatedAt: new Date().toISOString(),
    catalog: getAllCatalogEntries(),
  });
});

router.post("/plugins/discover-models", async (_req: Request, res: Response) => {
  try {
    const report = await refreshCatalog();
    rootLogger.info(
      { candidates: report.candidates.length, source: report.source },
      "[admin/plugins] model discovery completed",
    );
    res.json(report);
  } catch (err) {
    rootLogger.error({ err }, "[admin/plugins] discover-models failed");
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
