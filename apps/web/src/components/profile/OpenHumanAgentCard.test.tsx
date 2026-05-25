import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { OpenHumanAgentCard } from "./OpenHumanAgentCard";

const getJsonMock = vi.hoisted(() => vi.fn());
const postJsonMock = vi.hoisted(() => vi.fn());
const authMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", () => ({
  ApiClientError: class ApiClientError extends Error {
    constructor(
      message: string,
      readonly status: number,
      readonly body: unknown,
    ) {
      super(message);
      this.name = "ApiClientError";
    }
  },
  getJson: getJsonMock,
  postJson: postJsonMock,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: authMock,
}));

function renderCard() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <OpenHumanAgentCard />
    </QueryClientProvider>,
  );
}

describe("OpenHumanAgentCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockReturnValue({ user: { id: 1, role: "user" } });
  });

  it("renders disconnected state without blocking the page", async () => {
    getJsonMock.mockResolvedValue({
      enabled: false,
      state: "disabled",
      configured: false,
      coreUrl: null,
      checkedAt: "2026-05-21T00:00:00.000Z",
      message: "OpenHuman non e` abilitato.",
    });

    renderCard();

    expect(await screen.findByText("Agente personale")).toBeInTheDocument();
    expect(await screen.findByText("Disabilitato")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sincronizza/i })).toBeDisabled();
  });

  it("sends messages when connected", async () => {
    getJsonMock.mockResolvedValue({
      enabled: true,
      state: "connected",
      configured: true,
      coreUrl: "http://localhost:43210/rpc",
      checkedAt: "2026-05-21T00:00:00.000Z",
      message: "OpenHuman raggiungibile.",
    });
    postJsonMock.mockResolvedValue({ message: "Risposta personale", sources: [] });

    renderCard();

    expect(await screen.findByText("Connesso")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/memoria personale/i), {
      target: { value: "Cosa ricordi?" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Invia/i }));

    await waitFor(() => {
      expect(postJsonMock).toHaveBeenCalledWith("/api/openhuman/message", {
        message: "Cosa ricordi?",
      });
    });
    expect(await screen.findByText("Risposta personale")).toBeInTheDocument();
  });

  it("shows graphify search for admin users", async () => {
    authMock.mockReturnValue({ user: { id: 1, role: "admin" } });
    getJsonMock.mockImplementation((url: string) => {
      if (url === "/api/openhuman/status") {
        return Promise.resolve({
          enabled: true,
          state: "connected",
          configured: true,
          coreUrl: "http://localhost:43210/rpc",
          checkedAt: "2026-05-21T00:00:00.000Z",
          message: "OpenHuman raggiungibile.",
        });
      }
      if (url === "/api/graphify/status") {
        return Promise.resolve({
          enabled: true,
          state: "ready",
          checkedAt: "2026-05-21T00:00:00.000Z",
          graphs: [{ name: "apps", status: "ready", nodes: 12, links: 8 }],
        });
      }
      if (url.startsWith("/api/graphify/search")) {
        return Promise.resolve({
          results: [
            {
              id: "auth",
              graph: "apps",
              label: "Auth Route",
              source: "graphify",
              sourceFile: "apps/server/src/routes/auth.ts",
              sourceLocation: null,
              community: "2",
              score: 3,
              neighbors: [],
            },
          ],
        });
      }
      return Promise.resolve({});
    });

    renderCard();

    expect(await screen.findByText("Grafo progetto")).toBeInTheDocument();
    expect(await screen.findByText("Graphify pronto")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/cerca nel knowledge graph/i), {
      target: { value: "auth" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Cerca grafo/i }));

    expect(await screen.findByText("Auth Route")).toBeInTheDocument();
  });
});
