export type NodeType =
  | "note"
  | "skill"
  | "document"
  | "sector"
  | "role"
  | "tool"
  | "certification"
  | "concept"
  | "link";

export interface KNode {
  id: number;
  userId: number;
  type: NodeType;
  title: string;
  content: string;
  color: string | null;
  url: string | null;
  sectorId: number | null;
  metadata?: Record<string, unknown>;
  sourceType?: string;
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
  visibility?: string;
  status?: "candidate" | "active" | "rejected" | "archived";
  confidence?: number;
  importance?: number;
  provenance?: Record<string, unknown>;
  extractedBy?: string;
  lastReinforcedAt?: string | null;
  x: number;
  y: number;
  createdAt: string;
  updatedAt: string;
}

export interface KEdge {
  id: number;
  userId: number;
  sourceId: number;
  targetId: number;
  label: string | null;
  relationType?: string;
  confidence?: number;
  status?: "candidate" | "active" | "rejected" | "archived";
  reason?: string | null;
  metadata?: Record<string, unknown>;
  extractedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface GraphData {
  nodes: KNode[];
  edges: KEdge[];
}

export interface AutoLinkSuggestion {
  id: number;
  title: string;
  type: NodeType;
  score: number;
}

export interface AutoLinkAllResponse {
  created: number;
  skipped: number;
  edges: KEdge[];
}

export interface ContextMenu {
  nodeId: number;
  x: number;
  y: number;
}

export interface EdgeLabelEdit {
  edgeId: number;
  draft: string;
  screenX: number;
  screenY: number;
}
