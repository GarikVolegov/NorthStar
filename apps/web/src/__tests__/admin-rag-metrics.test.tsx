import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RagCoreSection, TechDebtSection } from "../pages/admin-metriche";

describe("RagCoreSection", () => {
  it("renders RAG health KPIs and backend latency rows", () => {
    render(
      <RagCoreSection
        rag={{
          totalRetrieves: 42,
          fallbackRate: 0.08,
          emptyResultRate: 0.1,
          jsLimitHits: 3,
          avgLatencyMsByBackend: {
            pgvector: 123.4,
            js: 456.7,
            none: 12,
          },
          scoreSamplesByBackend: {
            pgvector: 9,
            js: 4,
          },
          alertThresholds: {
            fallbackRate: 0.05,
            emptyResultRate: 0.2,
            windowMinutes: 10,
          },
        }}
      />,
    );

    expect(screen.getByText("RAG Core")).toBeInTheDocument();
    expect(screen.getByText("Retrieve totali")).toBeInTheDocument();
    expect(screen.getByText("Fallback rate")).toBeInTheDocument();
    expect(screen.getByText("8.0%")).toBeInTheDocument();
    expect(screen.getByText("Warning")).toBeInTheDocument();
    expect(screen.getByText("Empty result rate")).toBeInTheDocument();
    expect(screen.getByText("JS limit hits")).toBeInTheDocument();
    expect(screen.getByText("pgvector")).toBeInTheDocument();
    expect(screen.getByText("457ms")).toBeInTheDocument();
  });
});

describe("TechDebtSection", () => {
  it("renders latest debt snapshot and sprint delta", () => {
    render(
      <TechDebtSection
        techDebt={{
          latest: {
            sprint: "sprint-2",
            date: "2026-05-20",
            tracked: {
              directApiFetch: 10,
              globalNamespacePollution: 2,
              hotConsole: 0,
              adminHardcodedColors: 4,
              productionDbAny: 6,
            },
            gated: {
              directApiFetch: 0,
              globalNamespacePollution: 0,
              hotConsole: 0,
              adminHardcodedColors: 4,
              productionDbAny: 6,
            },
          },
          previous: {
            sprint: "sprint-1",
            date: "2026-05-06",
            tracked: {
              directApiFetch: 12,
              globalNamespacePollution: 2,
              hotConsole: 1,
              adminHardcodedColors: 4,
              productionDbAny: 8,
            },
            gated: {
              directApiFetch: 1,
              globalNamespacePollution: 1,
              hotConsole: 1,
              adminHardcodedColors: 4,
              productionDbAny: 8,
            },
          },
          history: [
            {
              sprint: "sprint-1",
              date: "2026-05-06",
              metrics: {
                directApiFetch: 12,
                globalNamespacePollution: 2,
                hotConsole: 1,
                adminHardcodedColors: 4,
                productionDbAny: 8,
              },
            },
            {
              sprint: "sprint-2",
              date: "2026-05-20",
              metrics: {
                directApiFetch: 10,
                globalNamespacePollution: 2,
                hotConsole: 0,
                adminHardcodedColors: 4,
                productionDbAny: 6,
              },
            },
          ],
          gateStatus: "ok",
          generatedAt: "2026-05-20T00:00:00.000Z",
        }}
      />,
    );

    expect(screen.getByText("Tech Debt")).toBeInTheDocument();
    expect(screen.getByText("Fetch API diretti")).toBeInTheDocument();
    expect(
      screen.getByText("-2 vs sprint precedente · gated 0"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("0 vs sprint precedente · gated 4"),
    ).toBeInTheDocument();
    expect(screen.getByText("Storico versionato")).toBeInTheDocument();
  });
});
