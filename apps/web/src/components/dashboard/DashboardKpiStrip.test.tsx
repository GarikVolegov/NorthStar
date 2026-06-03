import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardKpiStrip } from "./DashboardKpiStrip";

const useDynamicTranslationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: useDynamicTranslationMock,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: { language: "en-US", resolvedLanguage: "en-US" },
  }),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe("DashboardKpiStrip", () => {
  beforeEach(() => {
    useDynamicTranslationMock.mockReset();
    useDynamicTranslationMock.mockImplementation(({ key, source }: { key?: string; source: string }) =>
      key ? `dynamic:${key}` : source,
    );
  });

  it("uses dynamic translations for KPI labels and fallback copy", () => {
    render(
      <DashboardKpiStrip
        profilePercent={45}
        objectives={[]}
        objectivesProgress={{ done: 0, total: 0, percent: 0 }}
        confirmedSectorName={null}
        sessionId={9}
      />,
    );

    expect(screen.getByText("dynamic:dashboard.kpi.profile.label")).toBeInTheDocument();
    expect(screen.getByText("55% dynamic:dashboard.kpi.profile.missing")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.kpi.sector.label")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.kpi.sector.choose")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.kpi.sector.completeTest")).toBeInTheDocument();
  });

  it("keeps the missing profile translation source stable and composes the percentage outside it", () => {
    render(
      <DashboardKpiStrip
        profilePercent={45}
        objectives={[]}
        objectivesProgress={{ done: 0, total: 0, percent: 0 }}
        confirmedSectorName={null}
      />,
    );

    expect(screen.getByText("55% dynamic:dashboard.kpi.profile.missing")).toBeInTheDocument();
    expect(useDynamicTranslationMock).toHaveBeenCalledWith(expect.objectContaining({
      key: "dashboard.kpi.profile.missing",
      source: "mancante",
    }));
    expect(useDynamicTranslationMock).not.toHaveBeenCalledWith(expect.objectContaining({
      source: "55% mancante",
    }));
  });

  it("sanitizes invalid profile percentages before rendering values and ring data", () => {
    render(
      <DashboardKpiStrip
        profilePercent={Number.NaN}
        objectives={[]}
        objectivesProgress={{ done: 0, total: 0, percent: 0 }}
        confirmedSectorName={null}
      />,
    );

    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText("100% dynamic:dashboard.kpi.profile.missing")).toBeInTheDocument();
    expect(screen.queryByText("NaN%")).not.toBeInTheDocument();
    expect(document.querySelector("circle[stroke-dasharray^='NaN']")).not.toBeInTheDocument();
  });

  it("treats blank sector names as not selected", () => {
    render(
      <DashboardKpiStrip
        profilePercent={50}
        objectives={[]}
        objectivesProgress={{ done: 0, total: 0, percent: 0 }}
        confirmedSectorName="   "
        sessionId={9}
      />,
    );

    expect(screen.getByText("dynamic:dashboard.kpi.sector.choose")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.kpi.sector.completeTest")).toBeInTheDocument();
    expect(screen.queryByText("dynamic:dashboard.kpi.sector.confirmed")).not.toBeInTheDocument();
  });

  it("trims confirmed sector names before showing the selected state", () => {
    render(
      <DashboardKpiStrip
        profilePercent={50}
        objectives={[]}
        objectivesProgress={{ done: 0, total: 0, percent: 0 }}
        confirmedSectorName="  Design & UX  "
        sessionId={9}
      />,
    );

    expect(screen.getByText("Design & UX")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.kpi.sector.confirmed")).toBeInTheDocument();
  });

  it("keeps KPI links keyboard-visible", () => {
    render(
      <DashboardKpiStrip
        profilePercent={50}
        objectives={[]}
        objectivesProgress={{ done: 0, total: 0, percent: 0 }}
        confirmedSectorName={null}
      />,
    );

    expect(screen.getByRole("link", { name: /dynamic:dashboard\.kpi\.profile\.label/i })).toHaveClass("focus-visible:ring-2");
  });
});
