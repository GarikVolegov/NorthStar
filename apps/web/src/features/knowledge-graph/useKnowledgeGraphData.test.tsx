import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useKnowledgeGraphData } from "./useKnowledgeGraphData";

const apiMock = vi.hoisted(() => vi.fn());
const authState = vi.hoisted(() => ({
  user: { id: 42 },
  authReady: true,
}));

vi.mock("./knowledgeGraphApi", () => ({
  knowledgeApi: apiMock,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => authState,
}));

function renderDataHook(toast = vi.fn()) {
  return renderHook(() =>
    useKnowledgeGraphData({
      toast,
      svgRef: { current: null },
      viewRef: { current: { x: 0, y: 0, k: 1 } },
      setView: vi.fn(),
      setFitAnimating: vi.fn(),
    }),
  );
}

describe("useKnowledgeGraphData", () => {
  beforeEach(() => {
    apiMock.mockReset();
    authState.user = { id: 42 };
    authState.authReady = true;
  });

  it("exposes a recoverable load error instead of falling through to an empty graph", async () => {
    authState.authReady = false;
    apiMock.mockRejectedValueOnce(new Error("Archivio non raggiungibile"));
    const toast = vi.fn();

    const { result } = renderDataHook(toast);

    await act(async () => {
      await result.current.loadGraph();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.loadError).toBe("Archivio non raggiungibile");
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Archivio non caricato",
        variant: "destructive",
      }),
    );

    apiMock.mockResolvedValueOnce({ nodes: [], edges: [] });

    await act(async () => {
      await result.current.loadGraph();
    });

    expect(result.current.loadError).toBeNull();
  });
});
