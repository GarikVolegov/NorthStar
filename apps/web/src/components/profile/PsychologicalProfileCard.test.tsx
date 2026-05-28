import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { PsychologicalProfileCard, type PsychologicalProfileResponse } from "./PsychologicalProfileCard";

beforeAll(() => {
  global.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const profileData: PsychologicalProfileResponse = {
  profile: {
    ocean: {
      openness: 0.8,
      conscientiousness: 0.7,
      extraversion: 0.4,
      agreeableness: 0.6,
      neuroticism: 0.2,
    },
    oceanSource: "explicit",
    oceanConfidence: 0.85,
    chronotype: "morning",
    chronotypeConfidence: 0.72,
    decisionStyle: "analytical",
    riskTolerance: "moderate",
    communicationStyle: "detailed",
    sdt: { autonomy: 0.9, competence: 0.5, relatedness: 0.4 },
    mcclelland: { achievement: 0.6, affiliation: 0.3, power: 0.2 },
    primarySdtNeed: "autonomy",
    schwartz: { self_direction: 0.9, achievement: 0.8 },
    primaryValues: ["self_direction", "achievement"],
    sourceLabel: "Da quiz",
    updatedAt: "2026-05-22T00:00:00.000Z",
    createdAt: "2026-05-19T00:00:00.000Z",
  },
  consents: [],
};

describe("PsychologicalProfileCard", () => {
  it("renders Big Five, values, motivation, chronotype, source and decision style", () => {
    render(<PsychologicalProfileCard data={profileData} onOverride={vi.fn()} />);

    expect(screen.getByText("Profilo Psicologico")).toBeInTheDocument();
    expect(screen.getByText("Mattutino")).toBeInTheDocument();
    expect(screen.getByText("Analitico")).toBeInTheDocument();
    expect(screen.getByText("Da quiz")).toBeInTheDocument();
    expect(screen.getByText("Autonomia")).toBeInTheDocument();
    expect(screen.getByText("Autonomia e curiosità")).toBeInTheDocument();
    expect(screen.getAllByRole("meter")).toHaveLength(3);
  });

  it("renders an empty state when no profile data is available", () => {
    render(<PsychologicalProfileCard data={{ profile: {}, consents: [] }} onOverride={vi.fn()} />);

    expect(screen.getByText(/profilo psicologico non ancora disponibile/i)).toBeInTheDocument();
  });

  it("submits inline manual corrections", async () => {
    const onOverride = vi.fn().mockResolvedValue(undefined);
    render(<PsychologicalProfileCard data={profileData} onOverride={onOverride} />);

    fireEvent.click(screen.getByRole("button", { name: /correggi questo/i }));
    fireEvent.change(screen.getByLabelText(/stile decisionale/i), {
      target: { value: "collaborative" },
    });
    fireEvent.click(screen.getByRole("button", { name: /salva correzione/i }));

    await waitFor(() => {
      expect(onOverride).toHaveBeenCalledWith({
        profile: { decisionStyle: "collaborative" },
        consents: { behavioral_passive: true },
      });
    });
  });
});
