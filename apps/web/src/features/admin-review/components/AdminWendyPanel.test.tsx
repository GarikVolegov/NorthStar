import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminWendyPanel } from "./AdminWendyPanel";
import type { UseWendyChatOptions, UseWendyChatReturn } from "@/hooks/useWendyChat";

const useWendyChatMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useWendyChat", () => ({
  useWendyChat: useWendyChatMock,
}));

function chatReturn(overrides: Partial<UseWendyChatReturn> = {}): UseWendyChatReturn {
  return {
    messages: [],
    thinking: { active: false, label: "Pensando...", startedAt: 0 },
    isStreaming: false,
    streamError: null,
    retryState: { active: false, attempt: 0, max: 0 },
    restoredFromPersistence: false,
    sendMessage: vi.fn(async () => undefined),
    sendContextualMessage: vi.fn(async () => undefined),
    sendFeedback: vi.fn(async () => undefined),
    stopStream: vi.fn(),
    clearHistory: vi.fn(),
    retryLast: vi.fn(async () => undefined),
    confirmAction: vi.fn(async () => undefined),
    cancelAction: vi.fn(),
    tts: {} as UseWendyChatReturn["tts"],
    ttsEnabled: false,
    toggleTts: vi.fn(),
    openaiTts: {} as UseWendyChatReturn["openaiTts"],
    stt: { supported: false } as UseWendyChatReturn["stt"],
    commitSTT: vi.fn(),
    ...overrides,
  };
}

describe("AdminWendyPanel", () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
    useWendyChatMock.mockReset();
  });

  it("uses the admin Wendy endpoint and sends adminContext", () => {
    useWendyChatMock.mockReturnValue(chatReturn());

    render(
      <AdminWendyPanel
        open
        section="agents"
        onClose={() => undefined}
        filters={{ status: "degraded" }}
      />,
    );

    const options = useWendyChatMock.mock.calls[0]?.[0] as UseWendyChatOptions;
    expect(options.apiUrl).toBe("/api/admin/wendy");
    expect(options.restorePersisted).toBe(false);
    expect(options.buildRequestBody?.({ message: "stato" })).toMatchObject({
      message: "stato",
      adminContext: {
        section: "agents",
        filters: { status: "degraded" },
      },
    });
  });

  it("sends a typed message through Wendy Admin", () => {
    const sendMessage = vi.fn(async () => undefined);
    useWendyChatMock.mockReturnValue(chatReturn({ sendMessage }));

    render(<AdminWendyPanel open section="home" onClose={() => undefined} />);
    fireEvent.change(screen.getByPlaceholderText(/Chiedi a Wendy Admin/i), {
      target: { value: "controlla gli agenti" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Invia a Wendy Admin/i }));

    expect(sendMessage).toHaveBeenCalledWith("controlla gli agenti");
  });
});
