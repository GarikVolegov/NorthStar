import { colors } from "@workspace/design-tokens/tokens";

export const SCORE_THRESHOLD = {
  excellent: { min: 85, color: colors.chart2, tailwind: "text-emerald-400", hex: "#4ade80" },
  good: { min: 65, color: colors.chart2, tailwind: "text-emerald-400", hex: "#4ade80" },
  average: { min: 45, color: "#fbbf24", tailwind: "text-amber-400" },
  low: { min: 25, color: "#fb923c", tailwind: "text-orange-400" },
  poor: { min: 0, color: colors.chart5, tailwind: "text-rose-400", hex: "#94a3b8" },
} as const;

export function getScoreColor(score: number): string {
  if (score >= 85) return SCORE_THRESHOLD.excellent.hex ?? SCORE_THRESHOLD.excellent.color;
  if (score >= 65) return SCORE_THRESHOLD.good.color;
  if (score >= 45) return SCORE_THRESHOLD.average.color;
  if (score >= 25) return SCORE_THRESHOLD.low.color;
  return SCORE_THRESHOLD.poor.hex ?? SCORE_THRESHOLD.poor.color;
}

export const NODE_CATEGORY_META: Record<string, { color: string; bg: string; border: string }> = {
  note:          { color: "#0891b2", bg: "#ecfeff", border: "#67e8f9" },
  skill:         { color: colors.chart2, bg: "#ecfdf5", border: "#6ee7b7" },
  document:      { color: "#f59e0b", bg: "#fffbeb", border: "#fcd34d" },
  sector:        { color: "#1a3a2a", bg: "#f0fdf4", border: colors.growth },
  role:          { color: "#6366f1", bg: "#eef2ff", border: "#a5b4fc" },
  tool:          { color: "#ea580c", bg: "#fff7ed", border: "#fdba74" },
  certification: { color: "#8b5cf6", bg: "#f5f3ff", border: "#c4b5fd" },
  concept:       { color: "#db2777", bg: "#fdf2f8", border: "#f9a8d4" },
  link:          { color: colors.chart3, bg: "#f0f9ff", border: "#7dd3fc" },
} as const;

export const CERTIFICATE_CATEGORY_COLORS: Record<string, { accent: string; bg: string }> = {
  carriera:   { accent: colors.primary, bg: `hsl(${colors.primary} / 0.08)` },
  formazione: { accent: colors.chart3, bg: `hsl(210 55% 58% / 0.08)` },
  salute:     { accent: colors.chart2, bg: `hsl(152 28% 58% / 0.08)` },
  finanza:    { accent: "#fbbf24", bg: "rgba(251,191,36,0.08)" },
  relazioni:  { accent: colors.chart4, bg: `hsl(268 38% 60% / 0.08)` },
  progetto:   { accent: "#f472b6", bg: "rgba(244,114,182,0.08)" },
  abitudine:  { accent: "#2dd4bf", bg: "rgba(45,212,191,0.08)" },
  altro:      { accent: colors.primary, bg: `hsl(43 44% 57% / 0.08)` },
} as const;

export const SITEMAP_GROUP_COLORS: Record<string, { color: string; bg: string }> = {
  navigation:  { color: "#6366f1", bg: "#eef2ff" },
  sectors:     { color: "#f59e0b", bg: "#fffbeb" },
  brand:       { color: colors.chart2, bg: "#ecfdf5" },
  wiki:        { color: "#8b5cf6", bg: "#f5f3ff" },
  roadmap:     { color: colors.chart3, bg: "#eff6ff" },
  graph:       { color: "#ec4899", bg: "#fdf2f8" },
} as const;

export const AGENT_STATUS_COLORS = [
  colors.chart1,
  "#22d3ee",
  "#f59e0b",
  colors.chart2,
  colors.destructive,
  colors.chart4,
  "#ec4899",
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  carriera: "Carriera", formazione: "Formazione", salute: "Salute",
  finanza: "Finanza", relazioni: "Relazioni", progetto: "Progetto",
  abitudine: "Abitudine", altro: "Traguardo",
};

export const CONFRONTO_ACCENT = [
  `hsl(var(--primary))`,
  "#7c3aed",
  colors.chart3,
] as const;
