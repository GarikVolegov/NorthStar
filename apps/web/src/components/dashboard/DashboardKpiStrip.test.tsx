import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
  it("uses dynamic translations for KPI labels and fallback copy", () => {
    useDynamicTranslationMock.mockImplementation(({ key, source }: { key?: string; source: string }) =>
      key ? `dynamic:${key}` : source,
    );

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
    expect(screen.getByText("dynamic:dashboard.kpi.profile.missing")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.kpi.sector.label")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.kpi.sector.choose")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.kpi.sector.completeTest")).toBeInTheDocument();
  });
});
