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
    color: "hsl(var(--chart-3))",
    bg: "hsl(var(--chart-3) / 0.1)",
    border: "hsl(var(--chart-3) / 0.4)",
    Icon: StickyNote,
  },
  skill: {
    label: "Competenza",
    color: "hsl(var(--chart-2))",
    bg: "hsl(var(--chart-2) / 0.1)",
    border: "hsl(var(--chart-2) / 0.4)",
    Icon: Lightbulb,
  },
  document: {
    label: "Documento",
    color: "hsl(var(--chart-1))",
    bg: "hsl(var(--chart-1) / 0.1)",
    border: "hsl(var(--chart-1) / 0.4)",
    Icon: FileText,
  },
  sector: {
    label: "Settore",
    color: "hsl(var(--chart-2) / 0.8)",
    bg: "hsl(var(--chart-2) / 0.08)",
    border: "hsl(var(--chart-2) / 0.4)",
    Icon: Target,
  },
  role: {
    label: "Ruolo",
    color: "hsl(var(--chart-4))",
    bg: "hsl(var(--chart-4) / 0.1)",
    border: "hsl(var(--chart-4) / 0.4)",
    Icon: Briefcase,
  },
  tool: {
    label: "Strumento",
    color: "hsl(var(--chart-5))",
    bg: "hsl(var(--chart-5) / 0.08)",
    border: "hsl(var(--chart-5) / 0.4)",
    Icon: Wrench,
  },
  certification: {
    label: "Certificazione",
    color: "hsl(var(--chart-4))",
    bg: "hsl(var(--chart-4) / 0.1)",
    border: "hsl(var(--chart-4) / 0.4)",
    Icon: Award,
  },
  concept: {
    label: "Idea",
    color: "hsl(var(--chart-5))",
    bg: "hsl(var(--chart-5) / 0.08)",
    border: "hsl(var(--chart-5) / 0.4)",
    Icon: Network,
  },
  link: {
    label: "Link",
    color: "hsl(var(--chart-3))",
    bg: "hsl(var(--chart-3) / 0.08)",
    border: "hsl(var(--chart-3) / 0.4)",
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
