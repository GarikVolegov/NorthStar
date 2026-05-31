import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ChatMessage } from "@/hooks/useWendyChat";
import { WendySources } from "./WendySources";

function message(overrides: Partial<ChatMessage>): ChatMessage {
  return {
    id: "msg-1",
    role: "assistant",
    content: "Risposta Wendy",
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("WendySources", () => {
  it("surfaces adaptive reasoning when Wendy used profile and market data", () => {
    render(
      <WendySources
        message={message({
          adaptiveReasoning: {
            mode: "tool_action",
            reasoningDepth: "grounded",
            dataStrategy: "profile_market",
            executionMode: "tool_augmented_chat",
            selfCheck: ["grounded_sources", "specific_next_step"],
          },
        })}
      />,
    );

    expect(screen.getByText("Profilo + mercato")).toBeInTheDocument();
    expect(screen.getByText("Ragionamento guidato")).toBeInTheDocument();
  });
});
