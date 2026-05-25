import {
  BUILTIN_FEATURE_MANIFESTS,
  featureManifests,
  registerFeatureManifest,
  resetFeatureManifests,
  validateFeatureManifest,
} from "../packages/ai-server/src/feature-protocol";

resetFeatureManifests();

const failures: string[] = [];

for (const manifest of BUILTIN_FEATURE_MANIFESTS) {
  const result = validateFeatureManifest(manifest);
  if (!result.ok) {
    failures.push(`${manifest.id}: ${result.errors.join("; ")}`);
    continue;
  }
  registerFeatureManifest(manifest);
}

const manifests = featureManifests.list();
const coverage = featureManifests.coverage();
const calendar = featureManifests.get("calendar");
const objectives = featureManifests.get("objectives");
const profile = featureManifests.get("profile");
const sectors = featureManifests.get("sectors");

if (manifests.length === 0) {
  failures.push("no feature manifests registered");
}

if (!calendar || calendar.status !== "protocol") {
  failures.push("calendar pilot must be registered as protocol");
}

if (!objectives || objectives.status !== "protocol") {
  failures.push("objectives pilot must be registered as protocol");
}

if (!profile || profile.status !== "protocol") {
  failures.push("profile pilot must be registered as protocol");
}

if (!sectors || sectors.status !== "protocol") {
  failures.push("sectors pilot must be registered as protocol");
}

if (coverage.wendyToolCount === 0) {
  failures.push("no Wendy tools exposed by feature manifests");
}

console.log(
  JSON.stringify(
    {
      status: failures.length === 0 ? "ok" : "fail",
      manifests: manifests.map((manifest) => ({
        id: manifest.id,
        status: manifest.status,
        apiRoutes: manifest.apiRoutes.length,
        webRoutes: manifest.webRoutes.length,
        wendyTools: manifest.wendyTools.length,
      })),
      coverage,
      failures,
    },
    null,
    2,
  ),
);

if (failures.length > 0) {
  process.exitCode = 1;
}
