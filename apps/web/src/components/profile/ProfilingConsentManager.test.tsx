import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProfilingConsentManager } from "./ProfilingConsentManager";
import type { PsychologicalProfileResponse } from "./PsychologicalProfileCard";

const patchJsonMock = vi.hoisted(() => vi.fn());
const deleteJsonMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/apiClient", () => ({
  patchJson: patchJsonMock,
  deleteJson: deleteJsonMock,
}));

const data: PsychologicalProfileResponse = {
  profile: {
    ocean: { openness: 0.8, conscientiousness: 0.7, extraversion: 0.4, agreeableness: 0.6, neuroticism: 0.2 },
    oceanSource: "explicit",
    oceanConfidence: 0.85,
    sourceLabel: "Da quiz",
  },
  consents: [
    { dimension: "big_five", granted: true, grantedAt: "2026-05-20T00:00:00.000Z", revokedAt: null },
    { dimension: "values", granted: false, grantedAt: null, revokedAt: null },
    { dimension: "motivation", granted: false, grantedAt: null, revokedAt: null },
    { dimension: "linguistic", granted: false, grantedAt: null, revokedAt: null },
    { dimension: "behavioral_passive", granted: false, grantedAt: null, revokedAt: null },
    { dimension: "chronotype", granted: false, grantedAt: null, revokedAt: null },
  ],
};

describe("ProfilingConsentManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    patchJsonMock.mockResolvedValue({ success: true });
    deleteJsonMock.mockResolvedValue({ success: true });
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("grants consent with a switch and refreshes data", async () => {
    const onRefresh = vi.fn();
    render(<ProfilingConsentManager data={data} onRefresh={onRefresh} />);

    fireEvent.click(screen.getByRole("switch", { name: /valori/i }));

    await waitFor(() => {
      expect(patchJsonMock).toHaveBeenCalledWith("/api/profile/psychological-profile", {
        consents: { values: true },
      });
      expect(onRefresh).toHaveBeenCalled();
    });
  });

  it("revokes and erases a dimension after confirmation", async () => {
    const onRefresh = vi.fn();
    render(<ProfilingConsentManager data={data} onRefresh={onRefresh} />);

    fireEvent.click(screen.getByRole("button", { name: /cancella big five/i }));

    await waitFor(() => {
      expect(deleteJsonMock).toHaveBeenCalledWith("/api/profile/psychological-profile/big_five");
      expect(onRefresh).toHaveBeenCalled();
    });
  });

  it("downloads the visible profile JSON client-side", () => {
    const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:profile");
    const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const click = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName === "a") {
        element.click = click;
      }
      return element;
    });

    render(<ProfilingConsentManager data={data} onRefresh={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /scarica il mio profilo/i }));

    expect(createObjectUrl).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:profile");
  });

  it("surfaces API errors without hiding the controls", async () => {
    patchJsonMock.mockRejectedValueOnce(new Error("Errore consenso"));
    render(<ProfilingConsentManager data={data} onRefresh={vi.fn()} />);

    fireEvent.click(screen.getByRole("switch", { name: /valori/i }));

    expect(await screen.findByText("Errore consenso")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /valori/i })).toBeInTheDocument();
  });
});
