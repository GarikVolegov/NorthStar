import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardKpiStrip } from "./DashboardKpiStrip";
import { DashboardWeekTimeline } from "./DashboardWeekTimeline";

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: ({ key, source }: { key?: string; source: string }) =>
    key ? `dynamic:${key}` : source,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: {
      language: "en-US",
      resolvedLanguage: "en-US",
    },
  }),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href?: string; children: React.ReactNode }) => <a href={href} {...props}>{children}</a>,
}));

describe("DashboardWeekTimeline", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("replaces the old next-event KPI with a weekly arrow timeline", () => {
    render(
      <DashboardKpiStrip
        profilePercent={50}
        objectives={[]}
        objectivesProgress={{ done: 1, total: 3, percent: 33 }}
        upcomingEvents={[{
          id: 1,
          title: "Colloquio simulato",
          category: "interview",
          startAt: new Date(Date.now() + 86_400_000).toISOString(),
          priority: "high",
        }]}
        confirmedSectorName={null}
        sessionId={1}
      />,
    );

    expect(screen.queryByText("Prossimo evento")).not.toBeInTheDocument();
  });

  it("shows weekly days, event chips above the arrow and a next-event description", () => {
    const tomorrow = new Date(Date.now() + 86_400_000);
    render(
      <DashboardWeekTimeline
        events={[{
          id: 10,
          title: "Revisione CV",
          category: "task",
          startAt: tomorrow.toISOString(),
          priority: "medium",
        }]}
      />,
    );

    expect(screen.getByText("dynamic:dashboard.weekTimeline.title")).toBeInTheDocument();
    expect(screen.getAllByText("Revisione CV").length).toBeGreaterThan(0);
    expect(screen.getByText("dynamic:dashboard.weekTimeline.nextLabel")).toBeInTheDocument();
    expect(screen.getByText(/dynamic:dashboard\.weekTimeline\.categories\.task: Revisione CV/i)).toBeInTheDocument();
    expect(screen.queryByText(/Timeline settimanale|Prossimo evento|Attivita/i)).not.toBeInTheDocument();
  });

  it("shows an explicit empty state instead of preset events when there is no scheduled work", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-27T10:00:00.000Z"));

    render(<DashboardWeekTimeline events={[]} objectives={[]} />);

    expect(screen.getByText("dynamic:dashboard.weekTimeline.empty.title")).toBeInTheDocument();
    expect(screen.getByText("dynamic:dashboard.weekTimeline.empty.copy")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /dynamic:dashboard\.weekTimeline\.empty\.cta/i })).toHaveAttribute("href", "/calendario");
    expect(screen.queryByText("Revisione obiettivi")).not.toBeInTheDocument();
    expect(screen.queryByText("Focus crescita")).not.toBeInTheDocument();
    expect(screen.queryByText("Check progressi")).not.toBeInTheDocument();
    expect(screen.queryByText("dynamic:dashboard.weekTimeline.nextLabel")).not.toBeInTheDocument();
  });

  it("starts the timeline from today and shows the next seven days, not the current calendar week", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-27T10:00:00.000Z"));

    render(<DashboardWeekTimeline events={[]} />);

    expect(screen.queryByText("25")).not.toBeInTheDocument();
    expect(screen.queryByText("26")).not.toBeInTheDocument();
    expect(screen.getByText("27")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("labels each rolling timeline date with its real weekday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-27T10:00:00.000Z"));

    render(<DashboardWeekTimeline events={[]} />);

    expect(screen.getByLabelText("Wed 27 May")).toBeInTheDocument();
    expect(screen.getByLabelText("Thu 28 May")).toBeInTheDocument();
    expect(screen.getByLabelText("Tue 2 June")).toBeInTheDocument();
  });

  it("organizes objectives inside the rolling timeline", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-27T10:00:00.000Z"));

    render(
      <DashboardWeekTimeline
        events={[]}
        objectives={[{
          id: 7,
          text: "Preparare portfolio",
          category: "carriera",
          progress: 40,
          completed: false,
          completedAt: null,
          isCertifiableMilestone: false,
          dueDate: "2026-05-29",
          createdAt: "2026-05-27T00:00:00.000Z",
        }]}
      />,
    );

    expect(screen.getAllByText("Preparare portfolio").length).toBeGreaterThan(0);
    expect(screen.getByText(/dynamic:dashboard\.weekTimeline\.categories\.objective: Preparare portfolio/i)).toBeInTheDocument();
  });
});
