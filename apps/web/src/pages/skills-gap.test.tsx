import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SkillsGap from "./skills-gap";

const apiFetchMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api-fetch", () => ({
  apiFetch: apiFetchMock,
}));

vi.mock("@workspace/api-client-react", () => ({
  useGetSector: () => ({
    data: {
      id: 3,
      name: "Data Analysis",
      skills: ["SQL", "Python"],
    },
    isLoading: false,
  }),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  useLocation: () => ["/skills-gap/3", vi.fn()],
  useParams: () => ({ id: "3" }),
}));

function streamResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  return {
    ok: true,
    body: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    }),
  };
}

describe("SkillsGap stream states", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a recoverable alert when the SSE response is malformed instead of rendering an empty report", async () => {
    const user = userEvent.setup();
    apiFetchMock.mockResolvedValue(streamResponse(["data: {not-json}\n\n"]));

    render(<SkillsGap />);

    await user.click(screen.getByRole("button", { name: /analizza il mio gap/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/risposta ai incompleta/i);
    expect(screen.getByRole("button", { name: /riprova analisi/i })).toBeInTheDocument();
    expect(screen.queryByText(/indice di readiness/i)).not.toBeInTheDocument();
  });

  it("clears the visible stream error when the user starts a retry", async () => {
    apiFetchMock
      .mockResolvedValueOnce(streamResponse(["data: {not-json}\n\n"]))
      .mockResolvedValueOnce(streamResponse([
        `data: ${JSON.stringify({ type: "token", value: "Indice di Readiness: 72/100" })}\n\n`,
        `data: ${JSON.stringify({ type: "done" })}\n\n`,
      ]));

    render(<SkillsGap />);

    fireEvent.click(screen.getByRole("button", { name: /analizza il mio gap/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /riprova analisi/i }));

    expect(await screen.findByText("72/100")).toBeInTheDocument();
    expect(screen.getAllByText(/livello di prontezza/i).length).toBeGreaterThan(0);
    expect(screen.queryByText(/indice di readiness/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
