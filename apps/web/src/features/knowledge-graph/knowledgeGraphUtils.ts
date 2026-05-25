import type { KNode } from "./knowledgeGraphTypes";

export function nodeRadius(title: string) {
  return Math.max(28, Math.min(52, 10 + title.length * 3.2));
}

export function splitTitle(title: string): [string, string | null] {
  if (title.length <= 12) return [title, null];
  const words = title.split(" ");
  if (words.length === 1) return [title.slice(0, 11) + "\u2026", null];
  let line1 = "";
  let i = 0;
  while (i < words.length && (line1 + words[i]).length <= 12) {
    line1 += (line1 ? " " : "") + words[i];
    i++;
  }
  if (!line1) line1 = (words[0] ?? title).slice(0, 11) + "\u2026";
  const rest = words.slice(i).join(" ");
  const line2 = rest.length > 11 ? rest.slice(0, 10) + "\u2026" : rest;
  return [line1, line2 || null];
}

export function computeFitView(
  nodes: KNode[],
  svgW: number,
  svgH: number,
  padding = 60,
): { x: number; y: number; k: number } {
  if (nodes.length === 0) return { x: 0, y: 0, k: 1 };
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs) - padding;
  const maxX = Math.max(...xs) + padding;
  const minY = Math.min(...ys) - padding;
  const maxY = Math.max(...ys) + padding;
  const bw = maxX - minX;
  const bh = maxY - minY;
  const k = Math.max(0.3, Math.min(2, Math.min(svgW / bw, svgH / bh)));
  const x = svgW / 2 - ((minX + maxX) / 2) * k;
  const y = svgH / 2 - ((minY + maxY) / 2) * k;
  return { x, y, k };
}

export const MINI_W = 160;
export const MINI_H = 100;
