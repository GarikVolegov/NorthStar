import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeWendyAction, useWendyActionExecutor, type WendyAction } from "./useWendyActionExecutor";

const apiFetchMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());
const setLocationMock = vi.hoisted(() => vi.fn());
const eventEmitMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-fetch", () => ({
  apiFetch: apiFetchMock,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/event-bus", () => ({
  eventBus: { emit: eventEmitMock },
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/dashboard", setLocationMock] as const,
}));

function wrapperFactory() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

function progressAction(payload: Record<string, unknown>): WendyAction {
  return {
    id: "progress-1",
    type: "update_objective_progress",
    status: "needs_confirmation",
    risk: "medium",
    label: "Aggiornare il progresso?",
    description: "Conferma prima di modificare questo obiettivo.",
    requiresConfirmation: true,
    payload,
  };
}

describe("useWendyActionExecutor", () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
    toastMock.mockReset();
    setLocationMock.mockReset();
    eventEmitMock.mockReset();
  });

  it("rejects progress updates without a valid objective id before fetching", async () => {
    const { result } = renderHook(() => useWendyActionExecutor(), { wrapper: wrapperFactory() });

    let updated: WendyAction | undefined;
    await act(async () => {
      updated = await result.current.confirm(progressAction({ progress: 55 }));
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(updated).toMatchObject({
      status: "failed",
      error: expect.stringContaining("ID obiettivo"),
    });
    expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({
      variant: "destructive",
      description: expect.stringContaining("ID obiettivo"),
    }));
  });

  it("rejects progress updates with invalid progress before fetching", async () => {
    const { result } = renderHook(() => useWendyActionExecutor(), { wrapper: wrapperFactory() });

    let updated: WendyAction | undefined;
    await act(async () => {
      updated = await result.current.confirm(progressAction({ objectiveId: 42, progress: Number.NaN }));
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(updated).toMatchObject({
      status: "failed",
      error: expect.stringContaining("progresso"),
    });
  });

  it("rejects progress updates with empty progress before fetching", async () => {
    const { result } = renderHook(() => useWendyActionExecutor(), { wrapper: wrapperFactory() });

    let updated: WendyAction | undefined;
    await act(async () => {
      updated = await result.current.confirm(progressAction({ objectiveId: 42, progress: "" }));
    });

    expect(apiFetchMock).not.toHaveBeenCalled();
    expect(updated).toMatchObject({
      status: "failed",
      error: expect.stringContaining("progresso"),
    });
  });

  it("patches valid progress updates with a numeric objective id and completion flag", async () => {
    apiFetchMock.mockResolvedValue({ ok: true } as Response);
    const { result } = renderHook(() => useWendyActionExecutor(), { wrapper: wrapperFactory() });

    let updated: WendyAction | undefined;
    await act(async () => {
      updated = await result.current.confirm(progressAction({ objectiveId: "42", progress: "100" }));
    });

    expect(apiFetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/api\/objectives\/42$/),
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ progress: 100, completed: true }),
      }),
    );
    expect(updated).toMatchObject({ status: "executed" });
  });
});

describe("normalizeWendyAction", () => {
  it("normalizes Wendy progress updates as confirmation-gated app actions", () => {
    const action = normalizeWendyAction({
      name: "update_objective_progress",
      result: {
        clientSide: true,
        action: "update_objective_progress",
        wendyAction: {
          id: "progress-1",
          type: "update_objective_progress",
          status: "needs_confirmation",
          risk: "medium",
          label: "Aggiornare il progresso?",
          description: "Conferma prima di modificare questo obiettivo.",
          requiresConfirmation: true,
          payload: { objectiveId: 42, progress: 55 },
          preview: [{ label: "Progresso", value: "55%" }],
        },
      },
    });

    expect(action).toMatchObject({
      id: "progress-1",
      type: "update_objective_progress",
      status: "needs_confirmation",
      requiresConfirmation: true,
      payload: { objectiveId: 42, progress: 55 },
      sourceTool: "update_objective_progress",
    });
  });

  it("preserves admin action token and strong confirmation metadata", () => {
    const action = normalizeWendyAction({
      name: "admin_restart_database",
      result: {
        clientSide: true,
        action: "admin_restart_database",
        wendyAction: {
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
        },
      },
    });

    expect(action).toMatchObject({
      id: "action-1",
      type: "admin_restart_database",
      risk: "high",
      requiresStrongConfirmation: true,
      confirmationText: "RESTART DATABASE",
      actionToken: "signed-token",
    });
  });
});
