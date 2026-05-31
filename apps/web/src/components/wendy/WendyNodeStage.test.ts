import type { ChatMessage } from "@/hooks/useWendyChat";
import { describe, expect, it } from "vitest";
import { deriveWendyNodesFromMessages } from "./WendyNodeStage";

describe("deriveWendyNodesFromMessages", () => {
  it("extracts source, tool, and visualization nodes from Wendy messages", () => {
    const messages: ChatMessage[] = [
      {
        id: "assistant-1",
        role: "assistant",
        content: "Uso fonti e strumenti.",
        timestamp: 1,
        citations: [
          {
            nodeId: 42,
            title: "Trend mercato AI",
            type: "news",
            score: 0.91,
            url: "/news/ai",
          },
        ],
        actions: [
          {
            id: "tool-1",
            type: "navigate",
            label: "Apri settore",
            description: "Naviga verso il settore",
            status: "preview",
            risk: "low",
            requiresConfirmation: false,
            payload: { url: "/settore/ai" },
          },
        ],
        uiTool: {
          name: "sector_compare",
          args: { sectorId: "ai" },
        },
      },
    ];

    const nodes = deriveWendyNodesFromMessages(messages);

    expect(nodes.map((node) => node.kind)).toEqual(["source", "tool", "visual"]);
    expect(nodes[0]).toMatchObject({
      id: "source-42",
      title: "Trend mercato AI",
      status: "active",
    });
    expect(nodes[1]).toMatchObject({
      id: "tool-tool-1",
      title: "Apri settore",
    });
    expect(nodes[2]).toMatchObject({
      id: "visual-assistant-1-sector_compare",
      title: "sector_compare",
    });
  });
});
