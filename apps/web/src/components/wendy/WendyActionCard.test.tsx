import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WendyActionCard } from "./WendyActionCard";
import type { WendyAction } from "@/hooks/useWendyActionExecutor";

const highRiskAction: WendyAction = {
  id: "action-1",
  type: "admin_restart_database",
  status: "needs_confirmation",
  risk: "high",
  label: "Conferma azione ad alto rischio",
  description: "Riavvia il database Postgres.",
  requiresConfirmation: true,
  requiresStrongConfirmation: true,
  confirmationText: "RESTART DATABASE",
  actionToken: "signed-token",
  payload: { service: "postgres" },
  preview: [{ label: "service", value: "postgres" }],
};

describe("WendyActionCard", () => {
  it("requires exact strong confirmation text before confirming high-risk admin actions", () => {
    const onConfirm = vi.fn();
    render(
      <WendyActionCard
        action={highRiskAction}
        onConfirm={onConfirm}
        onCancel={() => undefined}
      />,
    );

    const confirmButton = screen.getByRole("button", { name: /Conferma/i });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Testo di conferma/i), {
      target: { value: "restart database" },
    });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/Testo di conferma/i), {
      target: { value: "RESTART DATABASE" },
    });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);
    expect(onConfirm).toHaveBeenCalledWith("RESTART DATABASE");
  });
});
