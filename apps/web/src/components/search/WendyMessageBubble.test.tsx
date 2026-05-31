import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/hooks/useWendyChat";
import { WendyMessageBubble } from "./WendyMessageBubble";

function assistantMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "msg-1",
    role: "assistant",
    content: "Ho letto il tuo profilo.",
    timestamp: Date.now(),
    suggestedPrompts: [
      { label: "Prossimo passo", prompt: "Dimmi cosa fare oggi" },
      { label: "Confronta settori", prompt: "Confronta i primi tre settori" },
    ],
    ...overrides,
  };
}

describe("WendyMessageBubble", () => {
  it("renders clickable next conversational steps after Wendy answers", () => {
    const onFollowUpPrompt = vi.fn();

    render(
      <WendyMessageBubble
        message={assistantMessage()}
        onConfirmAction={vi.fn()}
        onCancelAction={vi.fn()}
        onFollowUpPrompt={onFollowUpPrompt}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /prossimo passo/i }));

    expect(screen.getByText("Continua con Wendy")).toBeInTheDocument();
    expect(onFollowUpPrompt).toHaveBeenCalledWith(
      "Dimmi cosa fare oggi",
      expect.stringContaining("Ho letto il tuo profilo."),
    );
  });
});
