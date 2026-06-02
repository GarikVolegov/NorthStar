/**
 * useCompass — hook dati per "La Bussola" dell'utente indeciso.
 * Legge GET /api/compass e offre helper per registrare segnali e diagnosticare.
 */
import { getJson, postJson } from "@/lib/apiClient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

const BASE = import.meta.env.BASE_URL || "/";
const COMPASS_QUERY_KEY = ["compass"] as const;

export type CompassStage = "zero_ideas" | "hypotheses" | "experimenting" | "committed";
export type CompassBlockType =
  | "too_many_interests" | "no_interests" | "fear_economic"
  | "external_pressure" | "fear_mediocrity" | "unknown";

export interface CompassHypothesis {
  clusterId: string;
  label: string;
  confidence: number;
  source: string[];
  testedAt?: string | null;
  verdict?: "open" | "confirmed" | "discarded";
}

export interface CompassProfile {
  userId: number;
  blockType: CompassBlockType;
  revealedRiasec: Record<string, number>;
  energyProfile: { energizers?: string[] } & Record<string, unknown>;
  hypotheses: CompassHypothesis[];
  stage: CompassStage;
  signalCount: number;
  directionConfidence: number;
  updatedAt: string;
}

export interface SceneCard {
  id: number;
  prompt: string;
  imageUrl: string | null;
  tags: string[];
}

export function useCompass() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: COMPASS_QUERY_KEY,
    queryFn: () => getJson<CompassProfile>(`${BASE}api/compass`),
  });

  // le mutation ritornano il profilo aggiornato → aggiorna la cache react-query
  const applyProfile = useCallback(
    (next: CompassProfile) => queryClient.setQueryData(COMPASS_QUERY_KEY, next),
    [queryClient],
  );

  const recordSignal = useCallback(async (signal: {
    signalType: "scene_swipe" | "tournament_choice" | "block_answer" | "spike_outcome" | "chat_reaction";
    refType?: string;
    refId?: string | number;
    valence?: number;
    reactionMs?: number;
    dims?: Record<string, number>;
    weight?: number;
  }): Promise<CompassProfile | null> => {
    try {
      const next = await postJson<CompassProfile>(`${BASE}api/compass/signal`, signal);
      applyProfile(next);
      return next;
    } catch {
      return null;
    }
  }, [applyProfile]);

  /** Annulla l'ultimo segnale di un tipo (es. l'ultima reazione dello Specchio). */
  const undoLastSignal = useCallback(async (
    signalType: "scene_swipe" | "tournament_choice" | "block_answer" | "spike_outcome" | "chat_reaction",
  ): Promise<CompassProfile | null> => {
    try {
      const next = await postJson<CompassProfile>(`${BASE}api/compass/signal/undo`, { signalType });
      applyProfile(next);
      return next;
    } catch {
      return null;
    }
  }, [applyProfile]);

  const diagnose = useCallback(async (blockType: CompassBlockType) => {
    try {
      applyProfile(await postJson<CompassProfile>(`${BASE}api/compass/diagnose`, { blockType }));
      return true;
    } catch {
      return false;
    }
  }, [applyProfile]);

  return {
    profile: data ?? null,
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : "Errore") : null,
    reload: refetch,
    recordSignal,
    undoLastSignal,
    diagnose,
  };
}

export async function fetchScenes(limit = 12): Promise<SceneCard[]> {
  try {
    return await getJson<SceneCard[]>(`${BASE}api/compass/scenes?limit=${limit}`);
  } catch {
    return [];
  }
}

/* ── Il Torneo: scelta a coppie a preferenze rivelate ── */
export interface TournamentCluster {
  clusterId: string;
  label: string;
  riasec: string[];
}

export interface TournamentState {
  pool: TournamentCluster[];
  pair: TournamentCluster[] | null;
  comparisons: number;
  target: number;
  done: boolean;
}

export interface TournamentChoiceResult extends Omit<TournamentState, "pool"> {
  profile: CompassProfile;
}

export async function fetchTournament(): Promise<TournamentState | null> {
  try {
    return await getJson<TournamentState>(`${BASE}api/compass/tournament`);
  } catch {
    return null;
  }
}

export async function chooseTournament(
  winnerId: string,
  loserId: string,
  reactionMs?: number,
): Promise<TournamentChoiceResult | null> {
  try {
    return await postJson<TournamentChoiceResult>(`${BASE}api/compass/tournament/choice`, { winnerId, loserId, reactionMs });
  } catch {
    return null;
  }
}

/* ── Career Spike: commit reversibile ── */
export type CareerSpikeStatus = "active" | "completed_continue" | "completed_kill" | "abandoned";

export interface CareerSpike {
  id: number;
  hypothesisLabel: string;
  refType: string | null;
  refId: string | null;
  action: string;
  killCriterion: string;
  startDate: string;
  reviewDate: string;
  status: CareerSpikeStatus;
  outcome: { energy?: number; learned?: string; decision?: string } | null;
  objectiveId: number | null;
  calendarEventId: number | null;
  createdAt: string;
}

export interface SpikeSuggestion {
  action: string;
  killCriterion: string;
}

export async function fetchSpikes(): Promise<CareerSpike[]> {
  try {
    return await getJson<CareerSpike[]>(`${BASE}api/spikes`);
  } catch {
    return [];
  }
}

export async function proposeSpikeFor(hypothesisLabel: string, refId?: string): Promise<SpikeSuggestion[]> {
  try {
    const data = await postJson<{ suggestions: SpikeSuggestion[] }>(`${BASE}api/spikes/propose`, { hypothesisLabel, refId });
    return data.suggestions;
  } catch {
    return [];
  }
}

export async function createSpike(body: {
  hypothesisLabel: string;
  refType?: string | null;
  refId?: string | null;
  action: string;
  killCriterion: string;
  reviewDate?: string;
}): Promise<CareerSpike | null> {
  try {
    return await postJson<CareerSpike>(`${BASE}api/spikes`, body);
  } catch {
    return null;
  }
}

export async function resolveSpike(
  id: number,
  decision: "continue" | "kill",
  energy: number,
  learned?: string,
): Promise<{ spike: CareerSpike; profile: CompassProfile } | null> {
  try {
    return await postJson<{ spike: CareerSpike; profile: CompassProfile }>(`${BASE}api/spikes/${id}/resolve`, { decision, energy, learned });
  } catch {
    return null;
  }
}

/* ── Il ponte verso il lavoro vero: piano d'azione fondato sulla domanda reale ── */
export interface CompassDemand {
  count: number;
  period: string;
  growthRate: number | null;
  avgSalaryMin: number | null;
  avgSalaryMax: number | null;
  topSkills: string[];
}

export interface CompassActionPlan {
  ready: boolean;
  stage: CompassStage;
  direction?: {
    label: string;
    clusterId: string;
    professionId: number | null;
    confidence: number;
    confirmed: boolean;
  };
  demand?: CompassDemand | null;
}

export async function fetchActionPlan(): Promise<CompassActionPlan | null> {
  try {
    return await getJson<CompassActionPlan>(`${BASE}api/compass/action-plan`);
  } catch {
    return null;
  }
}
