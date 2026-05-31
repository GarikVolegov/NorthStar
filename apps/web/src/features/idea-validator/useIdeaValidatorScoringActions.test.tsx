import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "@/lib/api-fetch";

import { DEFAULT_CANVAS } from "./ideaValidatorConfig";
import { useIdeaValidatorScoringActions } from "./useIdeaValidatorScoringActions";

vi.mock("@/lib/api-fetch", () => ({
  apiFetch: vi.fn(),
}));

type ScoringActionOptions = Parameters<typeof useIdeaValidatorScoringActions>[0];

const createWendyMock = () =>
  ({
    setPageContext: vi.fn(),
    ask: vi.fn(),
  }) as unknown as ScoringActionOptions["wendy"];

const createOptions = (overrides: Partial<ScoringActionOptions> = {}): ScoringActionOptions => ({
  wendy: createWendyMock(),
  ideaContext: {},
  activeIdeaId: 12,
  ideaName: "Idea",
  oneLiner: "Pitch",
  canvas: DEFAULT_CANVAS,
  assumption: "",
  activeExperimentSummary: "",
  proposedScores: {},
  setCanvas: vi.fn(),
  setProposedScores: vi.fn(),
  setScores: vi.fn(),
  setScoreReasons: vi.fn(),
  setScoreSuggestions: vi.fn(),
  setScoreGeneratedAt: vi.fn(),
  setScoreModel: vi.fn(),
  setRadarState: vi.fn(),
  setRadarError: vi.fn(),
  setAssumption: vi.fn(),
  setLastWendyAdvice: vi.fn(),
  setDecisionState: vi.fn(),
  setDecisionReason: vi.fn(),
  setDecisionUpdatedAt: vi.fn(),
  setDecisionSuggested: vi.fn(),
  setDecisionLoading: vi.fn(),
  setDecisionError: vi.fn(),
  persistIdea: vi.fn().mockResolvedValue({ id: 12 }),
  markDirty: vi.fn(),
  addTimelineEvent: vi.fn(),
  addDebouncedTimelineEvent: vi.fn(),
  canvasTimelineTimerRef: { current: null },
  scoreTimelineTimerRef: { current: null },
  wendyAdviceTimelineTimerRef: { current: null },
  ...overrides,
});

describe("useIdeaValidatorScoringActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears stale radar suggestions and shows an explicit error when Wendy radar response is malformed", async () => {
    const options = createOptions();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ scores: null }),
    } as Response);

    const { result } = renderHook(() => useIdeaValidatorScoringActions(options));

    await act(async () => {
      await result.current.requestRadarSuggestion();
    });

    expect(options.setProposedScores).toHaveBeenCalledWith({});
    expect(options.setScoreReasons).toHaveBeenCalledWith({});
    expect(options.setScoreSuggestions).toHaveBeenCalledWith({});
    expect(options.setScoreGeneratedAt).toHaveBeenCalledWith("");
    expect(options.setScoreModel).toHaveBeenCalledWith("");
    expect(options.setRadarState).toHaveBeenLastCalledWith("error");
    expect(options.setRadarError).toHaveBeenCalledWith(
      "Wendy non ha restituito una valutazione utilizzabile. Riprova tra poco.",
    );
    expect(options.markDirty).not.toHaveBeenCalled();
  });

  it("clears stale decision advice and shows an explicit error when Wendy decision response is malformed", async () => {
    const options = createOptions();
    vi.mocked(apiFetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ state: "invalid" }),
    } as Response);

    const { result } = renderHook(() => useIdeaValidatorScoringActions(options));

    await act(async () => {
      await result.current.requestDecisionSuggestion();
    });

    expect(options.setDecisionSuggested).toHaveBeenCalledWith(null);
    expect(options.setDecisionError).toHaveBeenCalledWith(
      "Wendy non ha restituito una decisione utilizzabile. Riprova tra poco.",
    );
    await waitFor(() => expect(options.setDecisionLoading).toHaveBeenLastCalledWith(false));
    expect(options.markDirty).not.toHaveBeenCalled();
  });
});
