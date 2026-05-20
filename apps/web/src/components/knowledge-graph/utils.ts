import { apiFetch } from "@/lib/api-fetch";
import type { KNode } from "./types";

const BASE = import.meta.env.BASE_URL || "/";

export function api<T>(path: string, init?: RequestInit): Promise<T> {
  return apiFetch(`${BASE}api/knowledge${path}`, init).then(async (r) => {
    if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
    return r.json() as Promise<T>;
  });
}

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
) {
  if (nodes.length === 0) return { x: 0, y: 0, k: 1 };

  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs) - padding;
  const maxX = Math.max(...xs) + padding;
  const minY = Math.min(...ys) - padding;
  const maxY = Math.max(...ys) + padding;
  const width = maxX - minX;
  const height = maxY - minY;

  const scale = Math.min(svgW / width, svgH / height);
  const x = svgW / 2 - (minX + width / 2) * scale;
  const y = svgH / 2 - (minY + height / 2) * scale;

  return { x, y, k: scale };
}
