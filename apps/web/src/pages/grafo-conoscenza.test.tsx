import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import Archivio from "./grafo-conoscenza";

const graphMock = vi.hoisted(() => ({
  value: null as unknown,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 7 }, authReady: true }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/features/knowledge-graph/useKnowledgeGraphData", () => ({
  useKnowledgeGraphData: () => graphMock.value,
}));

vi.mock("@/features/knowledge-graph/useKnowledgeGraphInteraction", () => ({
  useKnowledgeGraphInteraction: () => ({}),
}));

vi.mock("@/features/knowledge-graph/KnowledgeGraphToolbar", () => ({
  KnowledgeGraphToolbar: () => <div />,
}));

vi.mock("@/features/knowledge-graph/KnowledgeGraphOverlays", () => ({
  KnowledgeGraphOverlays: () => <div />,
}));

vi.mock("@/features/knowledge-graph/KnowledgeGraphEdgeLabelEditor", () => ({
  KnowledgeGraphEdgeLabelEditor: () => null,
}));

vi.mock("@/features/knowledge-graph/KnowledgeChatPanel", () => ({
  KnowledgeChatPanel: () => null,
}));

vi.mock("@/features/knowledge-graph/KnowledgeNodeEditor", () => ({
  KnowledgeNodeEditor: () => null,
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

function createGraphState() {
  return {
    loading: false,
    data: { nodes: [], edges: [] },
    filteredNodes: [],
    visibleEdges: [],
    loadError: "Archivio non raggiungibile",
    loadGraph: vi.fn(),
    selectedId: null,
    setSelectedId: vi.fn(),
    selected: null,
    linkMode: null,
    setLinkMode: vi.fn(),
    chatOpen: false,
    setChatOpen: vi.fn(),
    contextMenu: null,
    setContextMenu: vi.fn(),
    edgeLabelEdit: null,
    setEdgeLabelEdit: vi.fn(),
    setPendingEdge: vi.fn(),
    setEdgeLabelDraft: vi.fn(),
    setData: vi.fn(),
    queuePosition: vi.fn(),
    handleDeleteNode: vi.fn(),
    search: "",
    setSearch: vi.fn(),
    typeFilter: "all",
    setTypeFilter: vi.fn(),
    autoLinkingAll: false,
    importing: false,
    handleAutoLinkAll: vi.fn(),
    handleAddNode: vi.fn(),
    handleFileImport: vi.fn(),
    handleUpdateEdgeLabel: vi.fn(),
    autoLinkSuggestions: [],
    autoLinkSourceId: null,
    setAutoLinkSuggestions: vi.fn(),
    setAutoLinkSourceId: vi.fn(),
    handleCreateEdge: vi.fn(),
    pendingEdge: null,
    edgeLabelDraft: "",
    handleDuplicateNode: vi.fn(),
    handleFit: vi.fn(),
    handleUpdateNode: vi.fn(),
    handleDeleteEdge: vi.fn(),
  };
}

describe("Archivio knowledge graph page", () => {
  it("passes graph load errors to the desktop canvas recovery state", () => {
    graphMock.value = createGraphState();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    window.matchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    render(<Archivio />);

    expect(screen.getByText(/archivio non caricato/i)).toBeInTheDocument();
    expect(screen.getByText(/archivio non raggiungibile/i)).toBeInTheDocument();
  });
});
