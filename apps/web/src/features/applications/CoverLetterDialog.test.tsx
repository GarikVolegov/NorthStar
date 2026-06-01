import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CoverLetterDialog } from "./CoverLetterDialog";
import type { Application } from "./applicationTypes";

const postJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", () => ({
  postJson: postJsonMock,
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
  });

  it("shows a recoverable AI helper error instead of an empty generated letter", async () => {
    postJsonMock.mockResolvedValue({ text: "" });

    render(<CoverLetterDialog app={app} onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Genera lettera AI/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("La lettera AI non e disponibile");
    expect(screen.queryByText("Lettera generata")).not.toBeInTheDocument();
  });
});
