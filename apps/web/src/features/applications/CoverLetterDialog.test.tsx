import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CoverLetterDialog } from "./CoverLetterDialog";
import type { Application } from "./applicationTypes";

const postJsonMock = vi.hoisted(() => vi.fn());
const useDynamicTranslationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", () => ({
  postJson: postJsonMock,
}));

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: useDynamicTranslationMock,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "it-IT", resolvedLanguage: "en-US" },
  }),
}));

const app: Application = {
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
};

describe("CoverLetterDialog", () => {
  beforeEach(() => {
    postJsonMock.mockReset();
    useDynamicTranslationMock.mockReset();
    useDynamicTranslationMock.mockImplementation(({ source }: { source: string }) => source);
  });

  it("shows a recoverable AI helper error instead of an empty generated letter", async () => {
    postJsonMock.mockResolvedValue({ text: "" });

    render(<CoverLetterDialog app={app} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Genera lettera AI/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("La lettera AI non e disponibile");
    expect(screen.queryByText("Lettera generata")).not.toBeInTheDocument();
  });

  it("uses dynamic translations for dialog chrome without translating application data", async () => {
    postJsonMock.mockResolvedValue({ text: "Dear hiring team" });
    useDynamicTranslationMock.mockImplementation(
      ({ key, source }: { key?: string; source: string }) => key ? `dynamic:${key}` : source,
    );

    render(<CoverLetterDialog app={app} onClose={vi.fn()} />);

    expect(screen.getByText("NorthStar")).toBeInTheDocument();
    expect(screen.getByText("UX Reliability")).toBeInTheDocument();
    expect(screen.getByText("dynamic:candidature.coverLetter.title")).toBeInTheDocument();
    expect(screen.getByText("dynamic:candidature.coverLetter.jobDescriptionLabel")).toBeInTheDocument();
    expect(screen.getByText("dynamic:candidature.coverLetter.optional")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("dynamic:candidature.coverLetter.jobDescriptionPlaceholder")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /dynamic:candidature\.coverLetter\.generate/i }));

    expect(await screen.findByText("dynamic:candidature.coverLetter.generatedLabel")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Dear hiring team")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dynamic:candidature\.coverLetter\.copy/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /dynamic:candidature\.coverLetter\.close/i })).toBeInTheDocument();
    expect(useDynamicTranslationMock).toHaveBeenCalledWith(expect.objectContaining({
      key: "candidature.coverLetter.title",
      locale: "en",
      source: "Lettera di presentazione AI",
    }));
    expect(useDynamicTranslationMock).not.toHaveBeenCalledWith(expect.objectContaining({ source: "NorthStar" }));
    expect(useDynamicTranslationMock).not.toHaveBeenCalledWith(expect.objectContaining({ source: "UX Reliability" }));
    expect(useDynamicTranslationMock).not.toHaveBeenCalledWith(expect.objectContaining({ source: "Dear hiring team" }));
  });
});
