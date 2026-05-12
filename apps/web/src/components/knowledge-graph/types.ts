import {
  StickyNote,
  Lightbulb,
  FileText,
  Target,
  Briefcase,
  Wrench,
  Award,
  Network,
  Globe,
} from "lucide-react";

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
  createdAt: string;
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

export interface ViewState {
  x: number;
  y: number;
  k: number;
}

export const TYPE_META: Record<
  NodeType,
  {
    label: string;
    color: string;
    bg: string;
    border: string;
    Icon: React.ComponentType<{
      className?: string;
      style?: React.CSSProperties;
    }>;
  }
> = {
  note: {
    label: "Nota",
    color: "#0891b2",
    bg: "#ecfeff",
    border: "#67e8f9",
    Icon: StickyNote,
  },
  skill: {
    label: "Competenza",
    color: "#10b981",
    bg: "#ecfdf5",
    border: "#6ee7b7",
    Icon: Lightbulb,
  },
  document: {
    label: "Documento",
    color: "#f59e0b",
    bg: "#fffbeb",
    border: "#fcd34d",
    Icon: FileText,
  },
  sector: {
    label: "Settore",
    color: "#1a3a2a",
    bg: "#f0fdf4",
    border: "#86efac",
    Icon: Target,
  },
  role: {
    label: "Ruolo",
    color: "#6366f1",
    bg: "#eef2ff",
    border: "#a5b4fc",
    Icon: Briefcase,
  },
  tool: {
    label: "Strumento",
    color: "#ea580c",
    bg: "#fff7ed",
    border: "#fdba74",
    Icon: Wrench,
  },
  certification: {
    label: "Certificazione",
    color: "#8b5cf6",
    bg: "#f5f3ff",
    border: "#c4b5fd",
    Icon: Award,
  },
  concept: {
    label: "Idea",
    color: "#db2777",
    bg: "#fdf2f8",
    border: "#f9a8d4",
    Icon: Network,
  },
  link: {
    label: "Link",
    color: "#0284c7",
    bg: "#f0f9ff",
    border: "#7dd3fc",
    Icon: Globe,
  },
};

export const ALL_TYPES: NodeType[] = [
  "note",
  "skill",
  "document",
  "role",
  "tool",
  "certification",
  "concept",
  "link",
];
