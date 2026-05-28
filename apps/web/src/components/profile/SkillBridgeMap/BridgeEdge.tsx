import { BaseEdge, getBezierPath, type EdgeProps } from "reactflow";

type BridgeEdgeData = {
  overlapPercent?: number;
  ring?: 1 | 2 | 3;
};

const EDGE_COLORS: Record<1 | 2 | 3, string> = {
  1: "#10b981",
  2: "#f59e0b",
  3: "#f97316",
};

export function BridgeEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<BridgeEdgeData>) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const ring = data?.ring ?? 2;
  const strokeWidth = Math.max(1.4, (data?.overlapPercent ?? 20) / 10);

  return (
    <BaseEdge
      id={id}
      path={path}
      style={{
        stroke: EDGE_COLORS[ring],
        strokeOpacity: 0.5,
        strokeWidth,
      }}
    />
  );
}

