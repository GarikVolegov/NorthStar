import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type React from "react";
import { describe, expect, it, vi } from "vitest";

const getJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", () => ({
  getJson: getJsonMock,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en-US", resolvedLanguage: "en-US" },
  }),
}));

import { useHomeNews } from "./homeApi";

function wrapper({ children }: React.PropsWithChildren) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("home news API", () => {
  it("requests home news in the selected language", async () => {
    getJsonMock.mockResolvedValue({ news: [] });

    renderHook(() => useHomeNews(), { wrapper });

    await waitFor(() => expect(getJsonMock).toHaveBeenCalled());
    expect(getJsonMock.mock.calls[0]?.[0]).toContain("locale=en");
  });
});
