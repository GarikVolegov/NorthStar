import { cn } from "@/lib/utils";
import { Map } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import type { KNode, ViewState } from "./types";
import { TYPE_META } from "./types";

const MINI_W = 160;
const MINI_H = 100;

interface MinimapProps {
  nodes: KNode[];
  view: ViewState;
  svgRef: React.RefObject<SVGSVGElement | null>;
  onPan: (x: number, y: number) => void;
}

export const Minimap = memo(function Minimap({
  nodes,
  view,
  svgRef,
  onPan,
}: MinimapProps) {
  const [collapsed, setCollapsed] = useState(false);

  const { scale, offsetX, offsetY, vpRect } = useMemo(() => {
    if (nodes.length === 0)
      return { scale: 1, offsetX: 0, offsetY: 0, vpRect: null };
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const pad = 40;
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;
    const bw = maxX - minX;
    const bh = maxY - minY;
    const s = Math.min(MINI_W / bw, MINI_H / bh);
    const ox = (MINI_W - bw * s) / 2 - minX * s;
    const oy = (MINI_H - bh * s) / 2 - minY * s;
    const svg = svgRef.current;
    const svgW = svg?.clientWidth ?? 800;
    const svgH = svg?.clientHeight ?? 500;
    const wx0 = -view.x / view.k;
    const wy0 = -view.y / view.k;
    const wx1 = (svgW - view.x) / view.k;
    const wy1 = (svgH - view.y) / view.k;
    const vx = wx0 * s + ox;
    const vy = wy0 * s + oy;
    const vw = (wx1 - wx0) * s;
    const vh = (wy1 - wy0) * s;
    return {
      scale: s,
      offsetX: ox,
      offsetY: oy,
      vpRect: { x: vx, y: vy, w: vw, h: vh },
    };
  }, [nodes, view, svgRef]);

  const handleMinimapClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const wx = (mx - offsetX) / scale;
      const wy = (my - offsetY) / scale;
      const svgW = svgRef.current.clientWidth;
      const svgH = svgRef.current.clientHeight;
      onPan(svgW / 2 - wx * view.k, svgH / 2 - wy * view.k);
    },
    [svgRef, offsetX, offsetY, scale, view.k, onPan],
  );

  if (nodes.length === 0) return null;

  return (
    <div className="absolute bottom-4 left-4 z-10">
      <div
        className={cn(
          "bg-card/95 backdrop-blur border rounded-xl shadow-sm overflow-hidden transition-all duration-200",
          collapsed ? "w-8 h-8" : "",
        )}
      >
        <button
          onClick={() => setCollapsed((v) => !v)}
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 hover:bg-muted transition-colors w-full",
            collapsed ? "justify-center h-8" : "border-b",
          )}
          title={collapsed ? "Espandi minimap" : "Comprimi minimap"}
        >
          <Map className="w-3 h-3 text-muted-foreground shrink-0" />
          {!collapsed && (
            <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide">
              Mappa
            </span>
          )}
        </button>
        {!collapsed && (
          <svg
            width={MINI_W}
            height={MINI_H}
            className="block cursor-crosshair"
            onClick={handleMinimapClick}
          >
            <rect width={MINI_W} height={MINI_H} fill="transparent" />
            {nodes.map((n) => {
              const meta = TYPE_META[n.type] ?? TYPE_META.note;
              const mx = n.x * scale + offsetX;
              const my = n.y * scale + offsetY;
              return (
                <circle
                  key={n.id}
                  cx={mx}
                  cy={my}
                  r={3.5}
                  fill={meta.color}
                  opacity={0.8}
                />
              );
            })}
            {vpRect && (
              <rect
                x={vpRect.x}
                y={vpRect.y}
                width={Math.max(4, vpRect.w)}
                height={Math.max(4, vpRect.h)}
                fill="none"
                stroke="hsl(var(--chart-4))"
                strokeWidth={1.5}
                strokeDasharray="3 2"
                rx={2}
                opacity={0.7}
              />
            )}
          </svg>
        )}
      </div>
    </div>
  );
});
