import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-fetch", () => ({
  apiFetch: apiFetchMock,
}));

import {
  clearDynamicTranslationCache,
  DynamicText,
  getDynamicTranslation,
} from "./dynamic-translation";

describe("getDynamicTranslation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    clearDynamicTranslationCache();
    apiFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        locale: "en",
        items: [{ source: "Lingua", text: "Language", status: "translated" }],
      }),
    } as Response);
  });

  it("returns Italian source text without calling the API", async () => {
    await expect(getDynamicTranslation({
      locale: "it",
      source: "Lingua",
      context: "Navbar language label",
    })).resolves.toBe("Lingua");

    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it("caches translated text by locale, source, and context", async () => {
    const first = await getDynamicTranslation({
      locale: "en",
      source: "Lingua",
      context: "Navbar language label",
    });
    const second = await getDynamicTranslation({
      locale: "en",
      source: "Lingua",
      context: "Navbar language label",
    });

    expect(first).toBe("Language");
    expect(second).toBe("Language");
    expect(apiFetchMock).toHaveBeenCalledTimes(1);
  });

  it("batches concurrent uncached translations into one API request", async () => {
    apiFetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        locale: "en",
        items: [
          { source: "Lingua", text: "Language", status: "translated" },
          { source: "Salva", text: "Save", status: "translated" },
        ],
      }),
    } as Response);

    await expect(Promise.all([
      getDynamicTranslation({
        locale: "en",
        source: "Lingua",
        context: "Navbar language label",
      }),
      getDynamicTranslation({
        locale: "en",
        source: "Salva",
        context: "Primary action",
      }),
    ])).resolves.toEqual(["Language", "Save"]);

    expect(apiFetchMock).toHaveBeenCalledTimes(1);
    const init = apiFetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({
      locale: "en",
      items: [
        { source: "Lingua", context: "Navbar language label" },
        { source: "Salva", context: "Primary action" },
      ],
    });
  });

  it("uses a separate cache entry when the language changes", async () => {
    apiFetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          locale: "en",
          items: [{ source: "Lingua", text: "Language", status: "translated" }],
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          locale: "fr",
          items: [{ source: "Lingua", text: "Langue", status: "translated" }],
        }),
      } as Response);

    await expect(getDynamicTranslation({
      locale: "en",
      source: "Lingua",
      context: "Navbar language label",
    })).resolves.toBe("Language");
    await expect(getDynamicTranslation({
      locale: "fr",
      source: "Lingua",
      context: "Navbar language label",
    })).resolves.toBe("Langue");

    expect(apiFetchMock).toHaveBeenCalledTimes(2);
  });

  it("renders source text first and then replaces it with the dynamic translation", async () => {
    render(
      <DynamicText
        locale="en"
        source="Lingua"
        context="Navbar language label"
      />,
    );

    expect(screen.getByText("Lingua")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Language")).toBeInTheDocument());
  });

  it("sends the component translationKey to the dynamic translation API", async () => {
    render(
      <DynamicText
        locale="en"
        source="Lingua"
        context="Navbar language label"
        translationKey="nav.language"
      />,
    );

    await waitFor(() => expect(screen.getByText("Language")).toBeInTheDocument());
    const init = apiFetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toMatchObject({
      items: [expect.objectContaining({ key: "nav.language" })],
    });
  });
});
