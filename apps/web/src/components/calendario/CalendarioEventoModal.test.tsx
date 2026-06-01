import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/lib/apiClient";
import { CalendarioEventoModal } from "./CalendarioEventoModal";

const saveCalendarEventMock = vi.hoisted(() => vi.fn());
const toastMock = vi.hoisted(() => vi.fn());

vi.mock("./CalendarioEventoModal.api", () => ({
  fetchCalendarQuota: vi.fn().mockResolvedValue({ isPremium: false, eventCount: 0, eventLimit: 25 }),
  fetchObjectives: vi.fn().mockResolvedValue([]),
  fetchSectors: vi.fn().mockResolvedValue([]),
  getCalendarErrorCode: (body: unknown) => {
    if (!body || typeof body !== "object") return null;
    const code = (body as Record<string, unknown>).code;
    return code === "FREE_LIMIT_REACHED" || code === "PREMIUM_REQUIRED" ? code : null;
  },
  getCalendarErrorText: (body: unknown, field: "message" | "error") => {
    if (!body || typeof body !== "object") return null;
    const value = (body as Record<string, unknown>)[field];
    return typeof value === "string" ? value : null;
  },
  saveCalendarEvent: saveCalendarEventMock,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const labels: Record<string, string> = {
        "calendar.newEvent": "Nuovo evento",
        "calendar.title": "Titolo",
        "calendar.titlePlaceholder": "Titolo evento",
        "calendar.description": "Descrizione",
        "calendar.descPlaceholder": "Note",
        "calendar.allDay": "Tutto il giorno",
        "calendar.startDate": "Data inizio",
        "calendar.startTime": "Ora inizio",
        "calendar.endDate": "Data fine",
        "calendar.endTime": "Ora fine",
        "calendar.category": "Categoria",
        "calendar.priority": "Priorita",
        "calendar.status": "Stato",
        "calendar.eventOptions": "Opzioni evento",
        "calendar.linkedSector": "Settore collegato",
        "calendar.noSector": "Nessun settore",
        "calendar.linkedGoal": "Obiettivo collegato",
        "calendar.linkedGoalInput": "Obiettivo",
        "calendar.addGoalsHint": "Aggiungi obiettivi",
        "calendar.cancel": "Annulla",
        "calendar.createEvent": "Crea evento",
        "calendar.errorSaving": "Evento non salvato",
      };
      return labels[key] ?? key;
    },
  }),
}));

function renderWithClient(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(<QueryClientProvider client={client}>{children}</QueryClientProvider>);
}

describe("CalendarioEventoModal persistence states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  });

  it("keeps the form open and shows an inline retry message when save fails", async () => {
    saveCalendarEventMock.mockRejectedValue(
      new ApiClientError("Persistenza calendario non disponibile", 503, {
        error: "Persistenza calendario non disponibile",
        code: "CALENDAR_PERSISTENCE_UNAVAILABLE",
      }),
    );
    const onOpenChange = vi.fn();

    renderWithClient(
      <CalendarioEventoModal
        open
        onOpenChange={onOpenChange}
        userId={42}
        defaultDate={new Date("2026-06-05T09:00:00.000Z")}
        editingEvent={null}
        onSaved={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Titolo"), {
      target: { value: "Revisione CV" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Crea evento/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Persistenza calendario non disponibile",
    );
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("stacks category priority and status controls on mobile", () => {
    renderWithClient(
      <CalendarioEventoModal
        open
        onOpenChange={vi.fn()}
        userId={42}
        defaultDate={new Date("2026-06-05T09:00:00.000Z")}
        editingEvent={null}
        onSaved={vi.fn()}
        onDeleted={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Opzioni evento")).toHaveClass("grid-cols-1", "sm:grid-cols-3");
  });
});
