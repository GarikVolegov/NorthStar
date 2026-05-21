export interface GraphNode {
  id: string;
  label: string;
  type: "role" | "skill" | "tool" | "certification";
  description: string;
  userAdded?: boolean;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  label?: string;
  userAdded?: boolean;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
