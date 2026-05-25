import type { UserBackgroundPreset } from "./types";

export const USER_BACKGROUND_PRESETS: UserBackgroundPreset[] = [
  {
    id: "preset:aurora",
    name: "Aurora",
    description: "Toni freddi e luminosi per una dashboard pulita.",
    previewClassName:
      "bg-[radial-gradient(circle_at_20%_20%,hsl(var(--info)/0.35),transparent_28%),radial-gradient(circle_at_80%_10%,hsl(var(--success)/0.25),transparent_32%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--muted)))]",
    overlayClassName:
      "bg-[radial-gradient(circle_at_18%_16%,hsl(var(--info)/0.24),transparent_30%),radial-gradient(circle_at_86%_8%,hsl(var(--success)/0.18),transparent_32%),linear-gradient(135deg,hsl(var(--background)),hsl(var(--muted)/0.55))]",
  },
  {
    id: "preset:focus",
    name: "Focus",
    description: "Neutro e leggero, pensato per sessioni lunghe.",
    previewClassName:
      "bg-[linear-gradient(135deg,hsl(var(--card)),hsl(var(--muted))),radial-gradient(circle_at_70%_30%,hsl(var(--primary)/0.18),transparent_34%)]",
    overlayClassName:
      "bg-[radial-gradient(circle_at_72%_22%,hsl(var(--primary)/0.16),transparent_34%),linear-gradient(135deg,hsl(var(--card)),hsl(var(--background)))]",
  },
  {
    id: "preset:momentum",
    name: "Momentum",
    description: "Accento caldo per obiettivi e crescita.",
    previewClassName:
      "bg-[radial-gradient(circle_at_15%_75%,hsl(var(--warning)/0.24),transparent_30%),radial-gradient(circle_at_88%_22%,hsl(var(--danger)/0.16),transparent_28%),linear-gradient(145deg,hsl(var(--background)),hsl(var(--card)))]",
    overlayClassName:
      "bg-[radial-gradient(circle_at_14%_78%,hsl(var(--warning)/0.18),transparent_32%),radial-gradient(circle_at_90%_18%,hsl(var(--danger)/0.12),transparent_30%),linear-gradient(145deg,hsl(var(--background)),hsl(var(--card)))]",
  },
];

export function findUserBackgroundPreset(id: string | null | undefined) {
  return USER_BACKGROUND_PRESETS.find((preset) => preset.id === id) ?? null;
}
