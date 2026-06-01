import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/apiClient";
import Calendario from "./calendar";

const getJsonMock = vi.hoisted(() => vi.fn());
const deleteJsonMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/apiClient")>("@/lib/apiClient");
  return {
    ...actual,
    getJson: getJsonMock,
    deleteJson: deleteJsonMock,
  };
});

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 42 }, isLoggedIn: true }),
}));

vi.mock("@/hooks/useWendyPageContext", () => ({
  useWendyPageContext: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        "calendar.editEvent": "Modifica evento",
        "calendar.newEvent": "Nuovo evento",
        "calendar.title": "Titolo",
        "calendar.description": "Descrizione",
        "calendar.allDay": "Tutto il giorno",
        "calendar.startDate": "Data inizio",
        "calendar.startTime": "Ora inizio",
        "calendar.endDate": "Data fine",
        "calendar.endTime": "Ora fine",
        "calendar.category": "Categoria",
        "calendar.priority": "Priorita",
        "calendar.status": "Stato",
        "calendar.linkedSector": "Settore collegato",
        "calendar.noSector": "Nessun settore",
        "calendar.linkedGoal": "Obiettivo collegato",
        "calendar.linkedGoalInput": "Obiettivo",
        "calendar.addGoalsHint": "Aggiungi obiettivi",
        "calendar.delete": "Elimina",
        "calendar.cancel": "Annulla",
        "calendar.saveChanges": "Salva modifiche",
        "calendar.createEvent": "Crea evento",
      };
      return labels[key] ?? key;
    },
  }),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/calendario", vi.fn()],
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

function renderCalendar() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <Calendario />
    </QueryClientProvider>,
  );
}

const event = {
  id: 7,
  userId: 42,
  title: "Revisione CV",
  description: null,
  startAt: "2026-06-05T09:00:00.000Z",
  endAt: "2026-06-05T10:00:00.000Z",
  allDay: false,
  category: "task",
  priority: "medium",
  status: "todo",
  color: null,
  tags: [],
  linkedSectorId: null,
  linkedGoal: null,
  linkedContentIds: [],
  isRecurring: false,
  recurrenceRule: null,
  reminders: [],
};

describe("calendar persistence states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  it("shows a retryable load error instead of an empty calendar grid", async () => {
    getJsonMock.mockRejectedValue(new Error("calendar unavailable"));

    renderCalendar();

    expect(await screen.findByRole("alert")).toHaveTextContent("Calendario non disponibile");
    expect(screen.getByRole("button", { name: "Riprova caricamento calendario" })).toBeInTheDocument();
  });

  it("keeps the event dialog open when delete persistence fails", async () => {
    getJsonMock.mockImplementation((url: string) => {
      if (url.includes("api/calendar/events?")) return Promise.resolve({ events: [event] });
      if (url.includes("api/calendar/quota")) return Promise.resolve({ isPremium: false, eventCount: 1, eventLimit: 25 });
      if (url.includes("api/sectors")) return Promise.resolve([]);
      if (url.includes("api/objectives/me")) return Promise.resolve([]);
      return Promise.resolve({});
    });
    deleteJsonMock.mockRejectedValue(
      new ApiClientError("Evento non eliminato dal calendario", 503, {
        code: "CALENDAR_PERSISTENCE_UNAVAILABLE",
      }),
    );

    renderCalendar();

    fireEvent.click(await screen.findByText("Revisione CV"));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Elimina/i }));

    await waitFor(() => expect(deleteJsonMock).toHaveBeenCalledWith("/api/calendar/events/7"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Evento non eliminato dal calendario");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Revisione CV")).toBeInTheDocument();
  });
});
