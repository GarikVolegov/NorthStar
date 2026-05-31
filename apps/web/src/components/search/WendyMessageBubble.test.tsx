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

  it("renders fallback next steps when an assistant message has no backend suggestions", () => {
    const onFollowUpPrompt = vi.fn();

    render(
      <WendyMessageBubble
        message={assistantMessage({
          suggestedPrompts: undefined,
          content: "Il tuo profilo mostra buone affinita con dati, sicurezza e prodotto.",
        })}
        onConfirmAction={vi.fn()}
        onCancelAction={vi.fn()}
        onFollowUpPrompt={onFollowUpPrompt}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /piano/i }));

    expect(screen.getByText("Continua con Wendy")).toBeInTheDocument();
    expect(onFollowUpPrompt).toHaveBeenCalledWith(
      expect.stringContaining("piano"),
      expect.stringContaining("Il tuo profilo mostra"),
    );
  });

  it("renders recovery next steps after Wendy error messages", () => {
    const onFollowUpPrompt = vi.fn();

    render(
      <WendyMessageBubble
        message={assistantMessage({
          role: "error",
          content: "Wendy non ha risposto correttamente.",
          suggestedPrompts: undefined,
        })}
        onConfirmAction={vi.fn()}
        onCancelAction={vi.fn()}
        onFollowUpPrompt={onFollowUpPrompt}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /prossima mossa/i }));

    expect(screen.getByText("Continua con Wendy")).toBeInTheDocument();
    expect(onFollowUpPrompt).toHaveBeenCalledWith(
      expect.stringContaining("prossima azione"),
      expect.stringContaining("Wendy non ha risposto correttamente."),
    );
  });
});
