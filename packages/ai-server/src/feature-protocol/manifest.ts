import type {
  FeatureApiRoute,
  FeatureManifest,
  FeatureValidationResult,
  FeatureWendyTool,
} from "./types";

function requireText(value: string | undefined, label: string, errors: string[]): void {
  if (!value || value.trim().length === 0) errors.push(`${label} is required`);
}

function validateApiRoute(route: FeatureApiRoute, index: number, errors: string[]): void {
  requireText(route.path, `apiRoutes[${index}].path`, errors);
  if (route.path.startsWith("/api/") && route.method !== "GET") {
    requireText(route.schema, `apiRoutes[${index}].schema`, errors);
  }
  if (route.path.startsWith("/api/") && route.smoke !== true) {
    errors.push(`apiRoutes[${index}].smoke must be true for API routes`);
  }
}

export function validateWendyToolContract(tool: FeatureWendyTool): FeatureValidationResult {
  const errors: string[] = [];
  requireText(tool.name, "wendyTool.name", errors);
  requireText(tool.description, "wendyTool.description", errors);
  requireText(tool.inputSchema, "wendyTool.inputSchema", errors);
  requireText(tool.outputSchema, "wendyTool.outputSchema", errors);
  requireText(tool.telemetry, "wendyTool.telemetry", errors);

  if ((tool.policy === "write" || tool.policy === "delete") && !tool.requiresConfirmation) {
    errors.push(`${tool.policy} tools must require confirmation`);
  }
  if (tool.risk === "high" && !tool.requiresConfirmation) {
    errors.push("high-risk tools must require confirmation");
  }

  return { ok: errors.length === 0, errors };
}

export function validateFeatureManifest(manifest: FeatureManifest): FeatureValidationResult {
  const errors: string[] = [];
  requireText(manifest.id, "id", errors);
  requireText(manifest.name, "name", errors);

  if (manifest.webRoutes.length === 0 && manifest.apiRoutes.length === 0) {
    errors.push("at least one webRoute or apiRoute is required");
  }

  manifest.apiRoutes.forEach((route, index) => validateApiRoute(route, index, errors));

  manifest.wendyTools.forEach((tool, index) => {
    const result = validateWendyToolContract(tool);
    errors.push(...result.errors.map((error) => `wendyTools[${index}].${error}`));
  });

  if (manifest.smoke.length === 0) errors.push("smoke must contain at least one smoke id");
  if (manifest.tests.length === 0) errors.push("tests must contain at least one test reference");

  return { ok: errors.length === 0, errors };
}
