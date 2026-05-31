import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { stream } from "@/lib/apiClient";
import { KnowledgeChatPanel } from "./KnowledgeChatPanel";
import type { KNode } from "./knowledgeGraphTypes";

vi.mock("@/lib/apiClient", () => ({
  stream: vi.fn(),
}));

const streamMock = vi.mocked(stream);

function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    }),
  );
}

const nodes: KNode[] = [
  {
    id: 1,
    userId: 1,
    type: "note",
    title: "Skill plan",
    content: "Build streaming resilience",
    color: null,
    url: null,
    sectorId: null,
    x: 0,
    y: 0,
    createdAt: "2026-05-29T00:00:00.000Z",
    updatedAt: "2026-05-29T00:00:00.000Z",
  },
];

describe("KnowledgeChatPanel", () => {
  beforeEach(() => {
    streamMock.mockReset();
  });

  it("surfaces malformed stream payloads instead of leaving the answer pending", async () => {
    streamMock.mockResolvedValue(sseResponse(["data: {not-json}\n\n"]));

    render(
      <KnowledgeChatPanel
        nodes={nodes}
        onClose={vi.fn()}
        onFocusNode={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Cosa sai?" },
    });
    const sendButton = screen
      .getAllByRole("button")
      .findLast((button) => !button.hasAttribute("disabled"));
    expect(sendButton).toBeDefined();
    fireEvent.click(sendButton!);

    await waitFor(() => {
      expect(screen.getByText(/Risposta interrotta/i)).toBeInTheDocument();
    });
    expect(screen.queryByText("Avvio…")).not.toBeInTheDocument();
  });

  it("finishes cleanly when the stream sends DONE without content", async () => {
    streamMock.mockResolvedValue(sseResponse(["data: [DONE]\n\n"]));

    render(
      <KnowledgeChatPanel
        nodes={nodes}
        onClose={vi.fn()}
        onFocusNode={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Cosa sai?" },
    });
    const sendButton = screen
      .getAllByRole("button")
      .findLast((button) => !button.hasAttribute("disabled"));
    expect(sendButton).toBeDefined();
    fireEvent.click(sendButton!);

    await waitFor(() => {
      expect(screen.getByText("Nessuna risposta ricevuta.")).toBeInTheDocument();
    });
    expect(screen.queryByText("Avvioâ€¦")).not.toBeInTheDocument();
  });

  it("uses the real knowledge ask contract and renders server token events", async () => {
    streamMock.mockResolvedValue(
      sseResponse([
        `data: ${JSON.stringify({ type: "token", value: "Risposta " })}\n\n`,
        `data: ${JSON.stringify({ type: "token", value: "dal grafo." })}\n\n`,
        `data: ${JSON.stringify({ type: "sources", sources: [], indexStatus: "ready" })}\n\n`,
        `data: ${JSON.stringify({ type: "done" })}\n\n`,
      ]),
    );

    render(
      <KnowledgeChatPanel
        nodes={nodes}
        onClose={vi.fn()}
        onFocusNode={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Cosa sai?" },
    });
    const sendButton = screen
      .getAllByRole("button")
      .findLast((button) => !button.hasAttribute("disabled"));
    expect(sendButton).toBeDefined();
    fireEvent.click(sendButton!);

    await waitFor(() => {
      expect(screen.getByText("Risposta dal grafo.")).toBeInTheDocument();
    });
    expect(streamMock).toHaveBeenCalledWith(expect.stringContaining("api/knowledge/ask"), {
      method: "POST",
      body: JSON.stringify({ message: "Cosa sai?" }),
    });
  });
});
