import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "@/hooks/useWendyChat";
import { WendyMessageBubble } from "./WendyMessageBubble";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en-US", resolvedLanguage: "en-US" },
  }),
}));

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: ({ key, source }: { key?: string; source: string }) =>
    key ? `dynamic:${key}` : source,
}));

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

    expect(screen.getByText("dynamic:wendy.message.followUps.heading")).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "dynamic:wendy.suggestedPrompts.transformPlan.label" }));

    expect(screen.getByText("dynamic:wendy.message.followUps.heading")).toBeInTheDocument();
    expect(onFollowUpPrompt).toHaveBeenCalledWith(
      "dynamic:wendy.suggestedPrompts.transformPlan.prompt",
      expect.stringContaining("Il tuo profilo mostra"),
    );
    expect(screen.queryByRole("button", { name: "Trasforma in piano" })).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: "dynamic:wendy.suggestedPrompts.nextConcreteMove.label" }));

    expect(screen.getByText("dynamic:wendy.message.followUps.heading")).toBeInTheDocument();
    expect(onFollowUpPrompt).toHaveBeenCalledWith(
      "dynamic:wendy.suggestedPrompts.nextConcreteMove.prompt",
      expect.stringContaining("Wendy non ha risposto correttamente."),
    );
  });
});
