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
