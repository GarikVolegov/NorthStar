import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WendyActionCard } from "./WendyActionCard";
import type { WendyAction } from "@/hooks/useWendyActionExecutor";

const useDynamicTranslationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: useDynamicTranslationMock,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: {
      resolvedLanguage: "en-US",
      language: "it",
    },
  }),
}));

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
  beforeEach(() => {
    useDynamicTranslationMock.mockReset();
    useDynamicTranslationMock.mockImplementation(
      ({ key, source }: { key?: string; source: string }) => (key ? `dynamic:${key}` : source),
    );
  });

  it("requires exact strong confirmation text before confirming high-risk admin actions", () => {
    const onConfirm = vi.fn();
    render(
      <WendyActionCard
        action={highRiskAction}
        onConfirm={onConfirm}
        onCancel={() => undefined}
      />,
    );

    const confirmButton = screen.getByRole("button", { name: /dynamic:wendy.action.confirm$/i });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/dynamic:wendy.action.strongConfirmation.label/i), {
      target: { value: "restart database" },
    });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/dynamic:wendy.action.strongConfirmation.label/i), {
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

    expect(screen.getByText("dynamic:wendy.action.status.failed")).toBeInTheDocument();
    expect(screen.queryByText("Conferma prima di modificare questo obiettivo.")).not.toBeInTheDocument();
    expect(screen.getByText(/Non ho modificato nulla/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /dynamic:wendy.action.retry/i }));
    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });

  it("translates only action chrome while preserving action data", () => {
    render(
      <WendyActionCard
        action={highRiskAction}
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );

    expect(screen.getByText("Conferma azione ad alto rischio")).toBeInTheDocument();
    expect(screen.getByText("Riavvia il database Postgres.")).toBeInTheDocument();
    expect(screen.getByText("service")).toBeInTheDocument();
    expect(screen.getByText("postgres")).toBeInTheDocument();

    expect(screen.getByText("dynamic:wendy.action.status.needsConfirmation")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dynamic:wendy.action.cancel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dynamic:wendy.action.confirm/i })).toBeInTheDocument();

    expect(useDynamicTranslationMock).toHaveBeenCalledWith(expect.objectContaining({
      key: "wendy.action.status.needsConfirmation",
      locale: "en",
      source: "Da confermare",
    }));
  });
});
