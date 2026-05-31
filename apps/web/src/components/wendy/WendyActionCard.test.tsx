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

  it("shows a failed objective update as recoverable without repeating the confirmation instruction", () => {
    const onConfirm = vi.fn();
    const failedAction: WendyAction = {
      id: "progress-1",
      type: "update_objective_progress",
      status: "failed",
      risk: "medium",
      label: "Aggiornare il progresso?",
      description: "Conferma prima di modificare questo obiettivo.",
      requiresConfirmation: true,
      payload: { objectiveId: 42, progress: 55 },
      preview: [{ label: "Nuovo progresso", value: "55%" }],
      error: "L'API obiettivi ha risposto: Obiettivo non trovato. Non ho modificato nulla. Riprova dopo aver scelto un obiettivo ancora presente.",
    };

    render(
      <WendyActionCard
        action={failedAction}
        onConfirm={onConfirm}
        onCancel={() => undefined}
      />,
    );

    expect(screen.getByText("Non riuscita")).toBeInTheDocument();
    expect(screen.queryByText("Conferma prima di modificare questo obiettivo.")).not.toBeInTheDocument();
    expect(screen.getByText(/Non ho modificato nulla/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Riprova/i }));
    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });
});
