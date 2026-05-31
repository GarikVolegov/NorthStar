import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_SCORES } from "./ideaValidatorConfig";
import { IdeaHeaderPanel } from "./IdeaTopPanels";
import { IdeaDecisionSection } from "./IdeaDecisionSections";
import { RadarAndTestSetupSection, ExperimentsSection } from "./IdeaExperimentSections";

describe("Idea Validator error states", () => {
  it("announces persistence errors as alerts", () => {
    render(
      <IdeaHeaderPanel
        error="Errore salvataggio"
        saveState="error"
        saveLabel="Errore salvataggio"
        activeIdeaId={1}
        archiveConfirm={false}
        ideaName="Idea"
        oneLiner="Pitch"
        status="draft"
        persistIdea={vi.fn()}
        archiveIdea={vi.fn()}
        setIdeaName={vi.fn()}
        setOneLiner={vi.fn()}
        setStatus={vi.fn()}
        addTimelineEvent={vi.fn()}
        markDirty={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Errore salvataggio");
  });

  it("announces Wendy radar errors as alerts", () => {
    render(
      <RadarAndTestSetupSection
        scores={DEFAULT_SCORES}
        proposedScores={{}}
        scoreReasons={{}}
        scoreSuggestions={{}}
        scoreGeneratedAt=""
        scoreModel=""
        radarState="error"
        radarError="Valutazione Wendy non disponibile"
        saveState="idle"
        assumption=""
        lastWendyAdvice=""
        requestRadarSuggestion={vi.fn()}
        applyProposedScore={vi.fn()}
        updateScore={vi.fn()}
        updateAssumption={vi.fn()}
        updateLastWendyAdvice={vi.fn()}
        askWendy={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Valutazione Wendy non disponibile");
  });

  it("announces decision and experiment action errors as alerts", () => {
    const experiment = {
      id: "exp-1",
      template: "landing",
      title: "Landing test",
      objective: "",
      hypothesis: "",
      metric: "",
      expectedResult: "",
      deadline: "",
      outcome: "",
      status: "planned" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const { rerender } = render(
      <IdeaDecisionSection
        decisionState=""
        decisionReason=""
        decisionUpdatedAt=""
        decisionSuggested={null}
        decisionLoading={false}
        decisionError="Suggerimento decisione non disponibile"
        saveState="idle"
        requestDecisionSuggestion={vi.fn()}
        applyDecision={vi.fn()}
        setDecisionState={vi.fn()}
        setDecisionReason={vi.fn()}
        setDecisionUpdatedAt={vi.fn()}
        markDirty={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Suggerimento decisione non disponibile",
    );

    rerender(
      <ExperimentsSection
        experiments={[experiment]}
        activeExperiment={experiment}
        selectedTemplate="landing"
        experimentActionLoading={null}
        experimentActionError="Errore nella creazione dell'evento"
        setSelectedTemplate={vi.fn()}
        setActiveExperimentId={vi.fn()}
        createExperiment={vi.fn()}
        duplicateActiveExperiment={vi.fn()}
        discardActiveExperiment={vi.fn()}
        createExperimentObjective={vi.fn()}
        createExperimentCalendarEvent={vi.fn()}
        completeActiveExperiment={vi.fn()}
        updateActiveExperiment={vi.fn()}
        askWendy={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Errore nella creazione dell'evento",
    );
  });
});
