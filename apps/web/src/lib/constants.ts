import { colors } from "@workspace/design-tokens/tokens";

export const SCORE_THRESHOLD = {
  excellent: { min: 85, color: colors.chart2, tailwind: "text-emerald-400" },
  good: { min: 65, color: colors.chart2, tailwind: "text-emerald-400" },
  average: { min: 45, color: colors.chart1, tailwind: "text-amber-400" },
  low: { min: 25, color: colors.chart1, tailwind: "text-orange-400" },
  poor: { min: 0, color: colors.mutedFg, tailwind: "text-rose-400" },
} as const;

export function getScoreColor(score: number): string {
  if (score >= 85) return SCORE_THRESHOLD.excellent.color;
  if (score >= 65) return SCORE_THRESHOLD.good.color;
  if (score >= 45) return SCORE_THRESHOLD.average.color;
  if (score >= 25) return SCORE_THRESHOLD.low.color;
  return SCORE_THRESHOLD.poor.color;
}

export const NODE_CATEGORY_META: Record<string, { color: string; bg: string; border: string }> = {
  note:          { color: colors.chart3, bg: `hsl(var(--chart-3) / 0.1)`, border: `hsl(var(--chart-3) / 0.4)` },
  skill:         { color: colors.chart2, bg: `hsl(var(--chart-2) / 0.1)`, border: `hsl(var(--chart-2) / 0.4)` },
  document:      { color: colors.chart1, bg: `hsl(var(--chart-1) / 0.1)`, border: `hsl(var(--chart-1) / 0.4)` },
  sector:        { color: colors.growthDark, bg: `hsl(var(--chart-2) / 0.08)`, border: colors.growth },
  role:          { color: colors.chart4, bg: `hsl(var(--chart-4) / 0.1)`, border: `hsl(var(--chart-4) / 0.4)` },
  tool:          { color: colors.chart1, bg: `hsl(var(--chart-1) / 0.08)`, border: `hsl(var(--chart-1) / 0.4)` },
  certification: { color: colors.chart4, bg: `hsl(var(--chart-4) / 0.1)`, border: `hsl(var(--chart-4) / 0.4)` },
  concept:       { color: colors.chart5, bg: `hsl(var(--chart-5) / 0.08)`, border: `hsl(var(--chart-5) / 0.4)` },
  link:          { color: colors.chart3, bg: `hsl(var(--chart-3) / 0.08)`, border: `hsl(var(--chart-3) / 0.4)` },
} as const;

export const CERTIFICATE_CATEGORY_COLORS: Record<string, { accent: string; bg: string }> = {
  carriera:   { accent: colors.primary, bg: `hsl(var(--chart-1) / 0.08)` },
  formazione: { accent: colors.chart3, bg: `hsl(var(--chart-3) / 0.08)` },
  salute:     { accent: colors.chart2, bg: `hsl(var(--chart-2) / 0.08)` },
  finanza:    { accent: colors.chart1, bg: `hsl(var(--chart-1) / 0.08)` },
  relazioni:  { accent: colors.chart4, bg: `hsl(var(--chart-4) / 0.08)` },
  progetto:   { accent: colors.chart5, bg: `hsl(var(--chart-5) / 0.08)` },
  abitudine:  { accent: colors.chart2, bg: `hsl(var(--chart-2) / 0.08)` },
  altro:      { accent: colors.primary, bg: `hsl(var(--chart-1) / 0.08)` },
} as const;

export const SITEMAP_GROUP_COLORS: Record<string, { color: string; bg: string }> = {
  navigation:  { color: colors.chart4, bg: `hsl(var(--chart-4) / 0.1)` },
  sectors:     { color: colors.chart1, bg: `hsl(var(--chart-1) / 0.1)` },
  brand:       { color: colors.chart2, bg: `hsl(var(--chart-2) / 0.1)` },
  wiki:        { color: colors.chart4, bg: `hsl(var(--chart-4) / 0.1)` },
  roadmap:     { color: colors.chart3, bg: `hsl(var(--chart-3) / 0.1)` },
  graph:       { color: colors.chart5, bg: `hsl(var(--chart-5) / 0.1)` },
} as const;

export const AGENT_STATUS_COLORS = [
  colors.chart1,
  colors.chart3,
  colors.chart1,
  colors.chart2,
  colors.destructive,
  colors.chart4,
  colors.chart5,
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  carriera: "Carriera", formazione: "Formazione", salute: "Salute",
  finanza: "Finanza", relazioni: "Relazioni", progetto: "Progetto",
  abitudine: "Abitudine", altro: "Traguardo",
};

export const CONFRONTO_ACCENT = [
  `hsl(var(--primary))`,
  colors.chart4,
  colors.chart3,
] as const;
