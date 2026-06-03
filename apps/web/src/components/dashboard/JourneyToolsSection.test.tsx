import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { JourneyToolsSection } from "./JourneyToolsSection";

const useDynamicTranslationMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/dynamic-translation", () => ({
  useDynamicTranslation: useDynamicTranslationMock,
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    i18n: {
      language: "it",
      resolvedLanguage: "en-US",
    },
  }),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

describe("JourneyToolsSection", () => {
  beforeEach(() => {
    useDynamicTranslationMock.mockReset();
    useDynamicTranslationMock.mockImplementation(({ key, source }: { key?: string; source: string }) =>
      key ? `dynamic:${key}` : source,
    );
  });

  it("condenses tools when the adaptive presentation is compact", () => {
    render(
      <JourneyToolsSection
        journeyType="indeciso"
        adaptivePhase="explore_sectors"
        presentation={{ priority: "compact", gated: false }}
      />,
    );

    expect(screen.getAllByRole("link")).toHaveLength(3);
    expect(screen.getByRole("link", { name: /dynamic:dashboard\.journeyTools\.tools\.exploreSectors\.title/i })).toHaveAttribute(
      "href",
      "/settori",
    );
    expect(screen.queryByText("dynamic:dashboard.journeyTools.tools.newsWork.title")).not.toBeInTheDocument();
  });

  it("keeps practical descriptions in compact card accessible names", () => {
    render(
      <JourneyToolsSection
        journeyType="indeciso"
        adaptivePhase="explore_sectors"
        presentation={{ priority: "compact", gated: false }}
      />,
    );

    expect(screen.getByRole("link", {
      name: /dynamic:dashboard\.journeyTools\.tools\.exploreSectors\.title.*dynamic:dashboard\.journeyTools\.tools\.exploreSectors\.description/i,
    })).toHaveAttribute("href", "/settori");
    expect(screen.queryByText("dynamic:dashboard.journeyTools.tools.exploreSectors.description")).not.toBeInTheDocument();
  });

  it("uses practical fallback copy instead of app-centric feature labels", () => {
    const { rerender } = render(<JourneyToolsSection journeyType="indeciso" readinessBand="mid" />);
    rerender(<JourneyToolsSection journeyType="autonomo" />);
    rerender(<JourneyToolsSection journeyType="investitore" />);

    const sources = useDynamicTranslationMock.mock.calls
      .map(([input]) => (input as { source?: string }).source ?? "")
      .join("\n");

    expect(sources).not.toMatch(/La Bussola|Il tuo hub|Sessione Socratica|Score AI|Mappa delle conoscenze/i);
  });

  it("marks the phase tool as the emphasized card when presentation is primary", () => {
    render(
      <JourneyToolsSection
        journeyType="indeciso"
        adaptivePhase="choose_path"
        presentation={{ priority: "primary", gated: false }}
      />,
    );

    const choosePathLink = screen.getByRole("link", { name: /dynamic:dashboard\.journeyTools\.tools\.choosePath\.title/i });
    expect(choosePathLink.firstElementChild).toHaveClass("sm:col-span-2");
  });

  it("translates rendered tool titles, descriptions, and badges with the selected locale", () => {
    render(<JourneyToolsSection journeyType="dipendente" sectorId={7} />);

    expect(screen.getByRole("link", { name: /dynamic:dashboard\.journeyTools\.tools\.skillsGap\.title/i })).toHaveAttribute(
      "href",
      "/skills-gap/7",
    );
    expect(screen.getByText("dynamic:dashboard.journeyTools.tools.skillsGap.description")).toBeInTheDocument();
    expect(screen.getAllByText("dynamic:dashboard.journeyTools.badges.ai")).not.toHaveLength(0);
    expect(screen.queryByText("Competenze da sviluppare")).not.toBeInTheDocument();

    expect(useDynamicTranslationMock).toHaveBeenCalledWith(expect.objectContaining({
      locale: "en-US",
      key: "dashboard.journeyTools.tools.skillsGap.title",
      source: "Competenze da sviluppare",
      context: "Dashboard journey tool title",
    }));
    expect(useDynamicTranslationMock).toHaveBeenCalledWith(expect.objectContaining({
      locale: "en-US",
      key: "dashboard.journeyTools.tools.skillsGap.description",
      source: "Identifica cosa ti manca per salire di livello",
      context: "Dashboard journey tool description",
    }));
    expect(useDynamicTranslationMock).toHaveBeenCalledWith(expect.objectContaining({
      locale: "en-US",
      key: "dashboard.journeyTools.badges.ai",
      source: "AI",
      context: "Dashboard journey tool badge",
    }));
  });
});
