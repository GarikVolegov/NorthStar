import { TYPE_META } from "@/components/knowledge-graph/types";
import { memo } from "react";
import type { KNode } from "./knowledgeGraphTypes";
import { nodeRadius, splitTitle } from "./knowledgeGraphUtils";

export interface KnowledgeGraphNodeProps {
  node: KNode;
  isSelected: boolean;
  isLinkSrc: boolean;
  isLinkMode: boolean;
  onPointerDown: (e: React.PointerEvent, n: KNode) => void;
  onPointerUp: (e: React.PointerEvent, n: KNode) => void;
  onContextMenu: (e: React.MouseEvent, n: KNode) => void;
}

export const KnowledgeGraphNode = memo(
  function KnowledgeGraphNode({
    node,
    isSelected,
    isLinkSrc,
    isLinkMode,
    onPointerDown,
    onPointerUp,
    onContextMenu,
  }: KnowledgeGraphNodeProps) {
    const meta = TYPE_META[node.type] ?? TYPE_META.note;
    const r = nodeRadius(node.title);
    const [line1, line2] = splitTitle(node.title);
    const labelW = Math.min(80, 16 + meta.label.length * 5.5);
    const textY = line2 ? -3 : 4;
    return (
      <g
        transform={`translate(${node.x},${node.y})`}
        style={{ cursor: isLinkMode ? "crosshair" : "grab" }}
        onPointerDown={(e) => onPointerDown(e, node)}
        onPointerUp={(e) => onPointerUp(e, node)}
        onContextMenu={(e) => onContextMenu(e, node)}
        data-node-id={node.id}
        data-x={node.x}
        data-y={node.y}
      >
        <circle
          r={r}
          fill={node.color || meta.bg}
          stroke={isSelected || isLinkSrc ? meta.color : meta.border}
          strokeWidth={isSelected || isLinkSrc ? 2.5 : 1.5}
          filter="url(#node-shadow)"
        />
        <text
          textAnchor="middle"
          y={textY}
          fontSize={10}
          fontWeight={600}
          fill={meta.color}
          style={{ pointerEvents: "none" }}
        >
          <tspan x="0" dy="0">
            {line1}
          </tspan>
          {line2 && (
            <tspan x="0" dy="12">
              {line2}
            </tspan>
          )}
        </text>
        <rect
          x={-labelW / 2}
          y={r + 5}
          width={labelW}
          height={14}
          rx={7}
          fill={meta.bg}
          stroke={meta.border}
          strokeWidth={1}
        />
        <text
          textAnchor="middle"
          y={r + 15}
          fontSize={8}
          fontWeight={500}
          fill={meta.color}
          style={{ pointerEvents: "none" }}
        >
          {meta.label}
        </text>
      </g>
    );
  },
  (prev, next) =>
    prev.node.x === next.node.x &&
    prev.node.y === next.node.y &&
    prev.node.title === next.node.title &&
    prev.node.type === next.node.type &&
    prev.node.color === next.node.color &&
    prev.isSelected === next.isSelected &&
    prev.isLinkSrc === next.isLinkSrc &&
    prev.isLinkMode === next.isLinkMode,
);
