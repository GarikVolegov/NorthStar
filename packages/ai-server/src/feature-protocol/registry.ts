import { logger } from "../logger";
import { validateFeatureManifest } from "./manifest";
import type {
  FeatureManifest,
  FeatureProtocolCoverage,
  RegisteredWendyTool,
} from "./types";

class FeatureManifestRegistry {
  private readonly manifests = new Map<string, FeatureManifest>();

  register(manifest: FeatureManifest): void {
    const validation = validateFeatureManifest(manifest);
    if (!validation.ok) {
      throw new Error(`Invalid feature manifest "${manifest.id}": ${validation.errors.join("; ")}`);
    }
    if (this.manifests.has(manifest.id)) {
      logger.warn({ id: manifest.id }, "[feature-protocol] replacing manifest");
    }
    this.manifests.set(manifest.id, manifest);
  }

  get(id: string): FeatureManifest | undefined {
    return this.manifests.get(id);
  }

  list(): FeatureManifest[] {
    return [...this.manifests.values()];
  }

  listWendyTools(): RegisteredWendyTool[] {
    return this.list().flatMap((manifest) =>
      manifest.wendyTools.map((tool) => ({
        ...tool,
        featureId: manifest.id,
        featureName: manifest.name,
      })),
    );
  }

  coverage(): FeatureProtocolCoverage {
    const manifests = this.list();
    const protocol = manifests.filter((manifest) => manifest.status === "protocol").length;
    const pilot = manifests.filter((manifest) => manifest.status === "pilot").length;
    const legacy = manifests.filter((manifest) => manifest.status === "legacy").length;
    return {
      total: manifests.length,
      protocol,
      pilot,
      legacy,
      protocolRatio: manifests.length === 0 ? 0 : protocol / manifests.length,
      wendyToolCount: this.listWendyTools().length,
    };
  }

  reset(): void {
    this.manifests.clear();
  }
}

export const featureManifests = new FeatureManifestRegistry();

export function registerFeatureManifest(manifest: FeatureManifest): void {
  featureManifests.register(manifest);
}

export function getFeatureManifest(id: string): FeatureManifest | undefined {
  return featureManifests.get(id);
}

export function listFeatureManifests(): FeatureManifest[] {
  return featureManifests.list();
}

export function listWendyToolsFromFeatures(): RegisteredWendyTool[] {
  return featureManifests.listWendyTools();
}

export function resetFeatureManifests(): void {
  featureManifests.reset();
}

export type { FeatureManifestRegistry };
