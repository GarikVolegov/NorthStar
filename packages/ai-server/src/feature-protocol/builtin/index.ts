import { calendarFeatureManifest } from "./calendar.manifest";
import { objectivesFeatureManifest } from "./objectives.manifest";
import { profileFeatureManifest } from "./profile.manifest";
import { sectorsFeatureManifest } from "./sectors.manifest";
import type { FeatureManifest } from "../types";

export { calendarFeatureManifest };
export { objectivesFeatureManifest };
export { profileFeatureManifest };
export { sectorsFeatureManifest };

export const BUILTIN_FEATURE_MANIFESTS: FeatureManifest[] = [
  calendarFeatureManifest,
  objectivesFeatureManifest,
  profileFeatureManifest,
  sectorsFeatureManifest,
];
