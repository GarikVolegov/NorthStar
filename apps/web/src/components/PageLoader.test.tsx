import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PageLoader } from "./PageLoader";

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

describe("PageLoader", () => {
  beforeEach(() => {
    useDynamicTranslationMock.mockReset();
    useDynamicTranslationMock.mockImplementation(
      ({ key, source }: { key?: string; source: string }) => (key ? `dynamic:${key}` : source),
    );
  });

  it("uses dynamic translations for accessible loading copy", () => {
    render(<PageLoader />);

    expect(screen.getByRole("status", { name: "dynamic:pageLoader.status" })).toBeInTheDocument();
    expect(screen.getByText("dynamic:pageLoader.srOnly")).toBeInTheDocument();
    expect(useDynamicTranslationMock).toHaveBeenCalledWith(expect.objectContaining({
      key: "pageLoader.status",
      locale: "en",
      source: "Caricamento pagina",
    }));
  });
});
