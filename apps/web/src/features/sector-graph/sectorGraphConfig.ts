import type { GraphNode } from "@/pages/grafo-types";

export const NODE_CONFIG = {
  role: {
    color: "hsl(var(--chart-4))",
    bg: "hsl(var(--chart-4) / 0.1)",
    border: "hsl(var(--chart-4) / 0.4)",
    label: "Ruolo",
    emoji: "👤",
  },
  skill: {
    color: "hsl(var(--chart-2))",
    bg: "hsl(var(--chart-2) / 0.1)",
    border: "hsl(var(--chart-2) / 0.4)",
    label: "Competenza",
    emoji: "⚡",
  },
  tool: {
    color: "hsl(var(--chart-1))",
    bg: "hsl(var(--chart-1) / 0.1)",
    border: "hsl(var(--chart-1) / 0.4)",
    label: "Strumento",
    emoji: "🔧",
  },
  certification: {
    color: "hsl(var(--chart-4))",
    bg: "hsl(var(--chart-4) / 0.1)",
    border: "hsl(var(--chart-4) / 0.4)",
    label: "Certificazione",
    emoji: "🏅",
  },
} satisfies Record<GraphNode["type"], {
  color: string;
  bg: string;
  border: string;
  label: string;
  emoji: string;
}>;

export const TYPE_OPTIONS = [
  { value: "role", label: "Ruolo", emoji: "👤" },
  { value: "skill", label: "Competenza", emoji: "⚡" },
  { value: "tool", label: "Strumento", emoji: "🔧" },
  { value: "certification", label: "Certificazione", emoji: "🏅" },
] as const;

export const GRAPH_CENTER = { x: 500, y: 400 };
