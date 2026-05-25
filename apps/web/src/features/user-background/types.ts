export interface UserBackgroundEntry {
  id: string;
  dataUrl: string;
  dataUrlMobile: string;
  createdAt: string;
  label?: string;
  luma?: number;
}

export interface UserBackgroundPreset {
  id: `preset:${string}`;
  name: string;
  description: string;
  previewClassName: string;
  overlayClassName: string;
}

export type ActiveUserBackground =
  | { kind: "preset"; id: UserBackgroundPreset["id"]; preset: UserBackgroundPreset }
  | { kind: "user"; id: `user:${string}`; entry: UserBackgroundEntry };

export type BackgroundPosition = "center" | "top" | "bottom";

export interface UserBackgroundAppearance {
  mode: "auto" | "manual";
  glassOpacity: number;
  blur: number;
  overlay: number;
  saturation: number;
  desktopPosition: BackgroundPosition;
  mobilePosition: BackgroundPosition;
}

export interface UserBackgroundState {
  activeBackgroundId: string | null;
  library: UserBackgroundEntry[];
  appearance?: Partial<UserBackgroundAppearance>;
}

export interface UploadBackgroundInput {
  file: File;
  label?: string;
}

export const DEFAULT_BACKGROUND_APPEARANCE: UserBackgroundAppearance = {
  mode: "auto",
  glassOpacity: 0.72,
  blur: 18,
  overlay: 0.32,
  saturation: 1.08,
  desktopPosition: "center",
  mobilePosition: "center",
};

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;
}

function position(value: unknown, fallback: BackgroundPosition): BackgroundPosition {
  return value === "top" || value === "bottom" || value === "center" ? value : fallback;
}

export function normalizeBackgroundAppearance(
  value: Partial<UserBackgroundAppearance> | null | undefined,
): UserBackgroundAppearance {
  return {
    mode: value?.mode === "manual" ? "manual" : "auto",
    glassOpacity: clamp(value?.glassOpacity, 0.42, 0.92, DEFAULT_BACKGROUND_APPEARANCE.glassOpacity),
    blur: clamp(value?.blur, 8, 30, DEFAULT_BACKGROUND_APPEARANCE.blur),
    overlay: clamp(value?.overlay, 0.12, 0.58, DEFAULT_BACKGROUND_APPEARANCE.overlay),
    saturation: clamp(value?.saturation, 0.9, 1.35, DEFAULT_BACKGROUND_APPEARANCE.saturation),
    desktopPosition: position(value?.desktopPosition, DEFAULT_BACKGROUND_APPEARANCE.desktopPosition),
    mobilePosition: position(value?.mobilePosition, DEFAULT_BACKGROUND_APPEARANCE.mobilePosition),
  };
}
