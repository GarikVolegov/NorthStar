import { fireEvent, render, screen } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CareerChat } from "./CareerChat";

const careerChatState = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  isPending: false,
}));

vi.mock("@/hooks/useAIAgents", () => ({
  useCareerChat: () => careerChatState,
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => true,
  motion: {
    create: (Component: React.ElementType) => Component,
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

describe("CareerChat failure recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    careerChatState.isPending = false;
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("shows provider failures as a retryable alert and clears the alert after a successful retry", async () => {
    careerChatState.mutateAsync
      .mockRejectedValueOnce(new Error("provider_not_configured: OPENROUTER_API_KEY missing"))
      .mockResolvedValueOnce({ success: true, reply: "Ecco un piano concreto." });

    render(<CareerChat />);

    fireEvent.click(screen.getByRole("button", { name: /chatta con northstar ai/i }));
    const input = screen.getByPlaceholderText(/scrivi una domanda/i);
    fireEvent.change(input, { target: { value: "Che percorso scelgo?" } });
    fireEvent.submit(input.closest("form")!);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/ai non configurata/i);
    expect(screen.queryByText(/temporaneamente non disponibile/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /riprova/i }));

    expect(await screen.findByText("Ecco un piano concreto.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(careerChatState.mutateAsync).toHaveBeenCalledTimes(2);
  });
});
