import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MemoriaWendy from "./memoria-wendy";

const deleteJsonMock = vi.hoisted(() => vi.fn());
const getJsonMock = vi.hoisted(() => vi.fn());
const postJsonMock = vi.hoisted(() => vi.fn());
const useDynamicTranslationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", () => ({
  deleteJson: deleteJsonMock,
  getJson: getJsonMock,
  postJson: postJsonMock,
}));

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

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: 42 }, isLoggedIn: true, authReady: true }),
}));

vi.mock("@/lib/seo", () => ({
  usePageMeta: vi.fn(),
}));

function renderMemoryPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <MemoriaWendy />
    </QueryClientProvider>,
  );
}

describe("Memoria Wendy accessibility", () => {
  beforeEach(() => {
    deleteJsonMock.mockReset();
    getJsonMock.mockReset();
    postJsonMock.mockReset();
    useDynamicTranslationMock.mockReset();
    useDynamicTranslationMock.mockImplementation(({ key, source }: { key?: string; source: string }) =>
      key ? `dynamic:${key}` : source,
    );
  });

  it("keeps each delete action persistently visible and touch-sized", async () => {
    getJsonMock.mockResolvedValue({
      facts: [
        {
          id: 7,
          key: "user_manual",
          value: "Preferisce lavorare su prodotti accessibili",
          source: "user_manual",
          confirmedCount: 1,
          createdAt: "2026-05-31T08:00:00.000Z",
        },
      ],
    });

    renderMemoryPage();

    const deleteButton = await screen.findByRole("button", { name: "dynamic:wendy.memory.deleteFact" });

    expect(deleteButton).not.toHaveClass("opacity-0");
    expect(deleteButton).not.toHaveClass("group-hover:opacity-100");
    expect(deleteButton).toHaveClass("min-h-11", "min-w-11");
  });

  it("keeps the manual memory composer comfortable on narrow mobile screens", async () => {
    getJsonMock.mockResolvedValue({ facts: [] });

    renderMemoryPage();

    const input = await screen.findByPlaceholderText("dynamic:wendy.memory.addPlaceholder");
    const addButton = screen.getByRole("button", { name: "dynamic:wendy.memory.addButton" });

    expect(input.parentElement).toHaveClass("flex-col", "sm:flex-row");
    expect(input).toHaveClass("min-h-11");
    expect(addButton).toHaveClass("min-h-11", "w-full", "sm:w-auto");
  });

  it("uses dynamic translations for the page chrome without translating memory values", async () => {
    getJsonMock.mockResolvedValue({
      facts: [
        {
          id: 11,
          key: "career_goal",
          value: "Vuole diventare product manager fintech",
          source: "user_manual",
          confirmedCount: 3,
          createdAt: "2026-05-31T08:00:00.000Z",
        },
      ],
    });

    renderMemoryPage();

    // attendi che la lista (dato async) sia renderizzata prima delle asserzioni sincrone
    await screen.findByText("Vuole diventare product manager fintech");

    expect(screen.getByText("dynamic:wendy.memory.title")).toBeInTheDocument();
    expect(screen.getByText("dynamic:wendy.memory.subtitle")).toBeInTheDocument();
    expect(screen.getByText("dynamic:wendy.memory.privacyNotePrefix")).toBeInTheDocument();
    expect(screen.getByText("dynamic:wendy.memory.privacyNoteStrong")).toBeInTheDocument();
    expect(screen.getByText("dynamic:wendy.memory.privacyNoteSuffix")).toBeInTheDocument();
    expect(screen.getByText("dynamic:wendy.memory.source.userManual")).toBeInTheDocument();
    expect(screen.getByText("dynamic:wendy.memory.confirmedCount")).toBeInTheDocument();
    expect(screen.getByText("Vuole diventare product manager fintech")).toBeInTheDocument();

    expect(useDynamicTranslationMock).toHaveBeenCalledWith(expect.objectContaining({
      locale: "en-US",
      key: "wendy.memory.title",
      source: "Memoria di Wendy",
    }));
    expect(useDynamicTranslationMock).not.toHaveBeenCalledWith(expect.objectContaining({
      source: "Vuole diventare product manager fintech",
    }));
  });

  it("uses dynamic translations for empty, footer, and mutation error states", async () => {
    const user = userEvent.setup();
    getJsonMock.mockResolvedValue({ facts: [] });
    postJsonMock.mockRejectedValue(new Error("network"));

    renderMemoryPage();

    expect(await screen.findByText("dynamic:wendy.memory.emptyTitle")).toBeInTheDocument();
    expect(screen.getByText("dynamic:wendy.memory.emptyDescription")).toBeInTheDocument();
    expect(screen.getByText("dynamic:wendy.memory.gdprPrefix")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "dynamic:wendy.memory.gdprLink" })).toHaveAttribute("href", "/profilo");
    expect(screen.getByText("dynamic:wendy.memory.gdprSuffix")).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText("dynamic:wendy.memory.addPlaceholder"), "Ama i prodotti inclusivi");
    await user.click(screen.getByRole("button", { name: "dynamic:wendy.memory.addButton" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("dynamic:wendy.memory.addError");
  });
});
