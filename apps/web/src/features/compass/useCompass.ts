/**
 * useCompass — hook dati per "La Bussola" dell'utente indeciso.
 * Legge GET /api/compass e offre helper per registrare segnali e diagnosticare.
 */
import { apiFetch } from "@/lib/api-fetch";
import { useCallback, useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL || "/";

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
  const [profile, setProfile] = useState<CompassProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`${BASE}api/compass`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setProfile((await res.json()) as CompassProfile);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const recordSignal = useCallback(async (signal: {
    signalType: "scene_swipe" | "tournament_choice" | "block_answer" | "spike_outcome" | "chat_reaction";
    refType?: string;
    refId?: string | number;
    valence?: number;
    reactionMs?: number;
    dims?: Record<string, number>;
    weight?: number;
  }) => {
    const res = await apiFetch(`${BASE}api/compass/signal`, {
      method: "POST",
      body: JSON.stringify(signal),
    });
    if (res.ok) setProfile((await res.json()) as CompassProfile);
    return res.ok;
  }, []);

  const diagnose = useCallback(async (blockType: CompassBlockType) => {
    const res = await apiFetch(`${BASE}api/compass/diagnose`, {
      method: "POST",
      body: JSON.stringify({ blockType }),
    });
    if (res.ok) setProfile((await res.json()) as CompassProfile);
    return res.ok;
  }, []);

  return { profile, loading, error, reload, recordSignal, diagnose };
}

export async function fetchScenes(limit = 12): Promise<SceneCard[]> {
  const res = await apiFetch(`${BASE}api/compass/scenes?limit=${limit}`);
  if (!res.ok) return [];
  return (await res.json()) as SceneCard[];
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
  const res = await apiFetch(`${BASE}api/compass/tournament`);
  if (!res.ok) return null;
  return (await res.json()) as TournamentState;
}

export async function chooseTournament(
  winnerId: string,
  loserId: string,
  reactionMs?: number,
): Promise<TournamentChoiceResult | null> {
  const res = await apiFetch(`${BASE}api/compass/tournament/choice`, {
    method: "POST",
    body: JSON.stringify({ winnerId, loserId, reactionMs }),
  });
  if (!res.ok) return null;
  return (await res.json()) as TournamentChoiceResult;
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
  const res = await apiFetch(`${BASE}api/spikes`);
  if (!res.ok) return [];
  return (await res.json()) as CareerSpike[];
}

export async function proposeSpikeFor(hypothesisLabel: string, refId?: string): Promise<SpikeSuggestion[]> {
  const res = await apiFetch(`${BASE}api/spikes/propose`, {
    method: "POST",
    body: JSON.stringify({ hypothesisLabel, refId }),
  });
  if (!res.ok) return [];
  return ((await res.json()) as { suggestions: SpikeSuggestion[] }).suggestions;
}

export async function createSpike(body: {
  hypothesisLabel: string;
  refType?: string | null;
  refId?: string | null;
  action: string;
  killCriterion: string;
  reviewDate?: string;
}): Promise<CareerSpike | null> {
  const res = await apiFetch(`${BASE}api/spikes`, { method: "POST", body: JSON.stringify(body) });
  if (!res.ok) return null;
  return (await res.json()) as CareerSpike;
}

export async function resolveSpike(
  id: number,
  decision: "continue" | "kill",
  energy: number,
  learned?: string,
): Promise<{ spike: CareerSpike; profile: CompassProfile } | null> {
  const res = await apiFetch(`${BASE}api/spikes/${id}/resolve`, {
    method: "POST",
    body: JSON.stringify({ decision, energy, learned }),
  });
  if (!res.ok) return null;
  return (await res.json()) as { spike: CareerSpike; profile: CompassProfile };
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
  const res = await apiFetch(`${BASE}api/compass/action-plan`);
  if (!res.ok) return null;
  return (await res.json()) as CompassActionPlan;
}
