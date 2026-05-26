import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardKpiStrip } from "./DashboardKpiStrip";
import { DashboardWeekTimeline } from "./DashboardWeekTimeline";

vi.mock("wouter", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
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

    expect(screen.getByText("Timeline settimanale")).toBeInTheDocument();
    expect(screen.getAllByText("Revisione CV").length).toBeGreaterThan(0);
    expect(screen.getByText(/Prossimo evento/i)).toBeInTheDocument();
    expect(screen.getByText(/Attivita: Revisione CV/i)).toBeInTheDocument();
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

    expect(screen.getByLabelText("Mer 27 maggio")).toBeInTheDocument();
    expect(screen.getByLabelText("Gio 28 maggio")).toBeInTheDocument();
    expect(screen.getByLabelText("Mar 2 giugno")).toBeInTheDocument();
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
          dueDate: "2026-05-29",
          createdAt: "2026-05-27T00:00:00.000Z",
        }]}
      />,
    );

    expect(screen.getAllByText("Preparare portfolio").length).toBeGreaterThan(0);
    expect(screen.getByText(/Obiettivo: Preparare portfolio/i)).toBeInTheDocument();
  });
});
