import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Candidature from "./applications";

const getJsonMock = vi.hoisted(() => vi.fn());
const postJsonMock = vi.hoisted(() => vi.fn());
const patchJsonMock = vi.hoisted(() => vi.fn());
const deleteJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", () => ({
  deleteJson: deleteJsonMock,
  getJson: getJsonMock,
  patchJson: patchJsonMock,
  postJson: postJsonMock,
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 42 }, isLoggedIn: true }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "it-IT" },
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

function renderApplications() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <Candidature />
    </QueryClientProvider>,
  );
}

describe("applications page reliability states", () => {
  beforeEach(() => {
    getJsonMock.mockReset();
    postJsonMock.mockReset();
    patchJsonMock.mockReset();
    deleteJsonMock.mockReset();
  });

  it("shows an API error state instead of the empty-applications state when loading fails", async () => {
    getJsonMock.mockRejectedValue(new Error("applications_unavailable"));

    renderApplications();

    expect(await screen.findByText("Candidature non disponibili")).toBeInTheDocument();
    expect(screen.queryByText("candidature.startTracking")).not.toBeInTheDocument();
  });

  it("shows the real empty state when the API succeeds with no applications", async () => {
    getJsonMock.mockResolvedValue({ applications: [], status: "empty", totalCount: 0 });

    renderApplications();

    expect(await screen.findByText("candidature.startTracking")).toBeInTheDocument();
    expect(screen.queryByText("candidature.loadError")).not.toBeInTheDocument();
  });

  it("shows a setup state instead of the empty-applications CTA when persistence is not connected", async () => {
    getJsonMock.mockResolvedValue({
      applications: [],
      status: "not_configured",
      reason: "applications_persistence_not_connected",
      action: "connect_applications_persistence",
      totalCount: 0,
    });

    renderApplications();

    expect(await screen.findByText("Candidature non ancora collegate")).toBeInTheDocument();
    expect(screen.queryByText("candidature.startTracking")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /candidature.add/i })).not.toBeInTheDocument();
  });

  it("keeps the create dialog open and explains that the application was not saved when persistence fails", async () => {
    getJsonMock.mockResolvedValue({ applications: [], status: "empty", totalCount: 0 });
    postJsonMock.mockRejectedValue(new Error("Persistenza candidature non disponibile"));

    renderApplications();

    fireEvent.click(await screen.findByRole("button", { name: /candidature.addFirst/i }));
    fireEvent.change(screen.getByPlaceholderText("es. Google Italia"), { target: { value: "NorthStar" } });
    fireEvent.change(screen.getByPlaceholderText("es. UX Designer"), { target: { value: "UX Reliability" } });
    fireEvent.click(screen.getByRole("button", { name: /^candidature.add$/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Persistenza candidature non disponibile");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("keeps the edit dialog open and explains that updates were not saved when persistence fails", async () => {
    getJsonMock.mockResolvedValue({
      applications: [{
        id: 7,
        userId: 42,
        company: "NorthStar",
        role: "UX Reliability",
        url: null,
        status: "saved",
        notes: null,
        salary: null,
        location: null,
        appliedAt: "2026-05-20T00:00:00.000Z",
        updatedAt: "2026-05-20T00:00:00.000Z",
        notesLog: null,
      }],
      status: "ok",
      totalCount: 1,
    });
    patchJsonMock.mockRejectedValue(new Error("Aggiornamento non salvato"));

    renderApplications();

    fireEvent.click(await screen.findByText("NorthStar"));
    fireEvent.click(screen.getByRole("button", { name: /candidature.saveChanges/i }));

    await waitFor(() => expect(patchJsonMock).toHaveBeenCalled());
    expect(await screen.findByRole("alert")).toHaveTextContent("Aggiornamento non salvato");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("requires confirmation before calling the delete API", async () => {
    getJsonMock.mockResolvedValue({
      applications: [{
        id: 7,
        userId: 42,
        company: "NorthStar",
        role: "UX Reliability",
        url: null,
        status: "saved",
        notes: null,
        salary: null,
        location: null,
        appliedAt: "2026-05-20T00:00:00.000Z",
        updatedAt: "2026-05-20T00:00:00.000Z",
        notesLog: null,
      }],
      status: "ok",
      totalCount: 1,
    });
    deleteJsonMock.mockResolvedValue(null);

    renderApplications();

    fireEvent.click(await screen.findByRole("button", { name: /elimina candidatura northstar/i }));

    expect(deleteJsonMock).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /conferma eliminazione candidatura northstar/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /conferma eliminazione candidatura northstar/i }));

    await waitFor(() => expect(deleteJsonMock).toHaveBeenCalledWith("/api/applications/7"));
  });
});
