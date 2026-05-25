import type { GraphNode } from "@/pages/grafo-types";
import { GRAPH_CENTER } from "./sectorGraphConfig";

export function layoutSectorGraphNodes(nodes: GraphNode[]): GraphNode[] {
  const byType: Record<GraphNode["type"], GraphNode[]> = {
    role: [],
    skill: [],
    tool: [],
    certification: [],
  };
  nodes.forEach((node) => {
    const type: GraphNode["type"] = node.type in byType ? node.type : "skill";
    byType[type].push(node);
  });

  const positioned: GraphNode[] = [];
  const place = (group: GraphNode[], radius: number, offsetAngle = 0) => {
    group.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / group.length + offsetAngle - Math.PI / 2;
      positioned.push({
        ...node,
        x: GRAPH_CENTER.x + radius * Math.cos(angle),
        y: GRAPH_CENTER.y + radius * Math.sin(angle),
      });
    });
  };

  place(byType.role, 140);
  place(byType.skill, 255, byType.skill.length > 0 ? Math.PI / byType.skill.length : 0);

  const outer = [...byType.tool.map((node) => ({ ...node })), ...byType.certification.map((node) => ({ ...node }))];
  outer.forEach((node, index) => {
    const angle = (2 * Math.PI * index) / outer.length - Math.PI / 2;
    positioned.push({
      ...node,
      x: GRAPH_CENTER.x + 360 * Math.cos(angle),
      y: GRAPH_CENTER.y + 360 * Math.sin(angle),
    });
  });

  return positioned;
}
