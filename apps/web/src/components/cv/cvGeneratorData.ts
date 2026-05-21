import { getJson } from "@/lib/apiClient";
import { useQuery } from "@tanstack/react-query";
import type { GraphNode } from "./cvTypes";
import { errorMessage } from "./cvUtils";

const BASE = import.meta.env.BASE_URL || "/";

type CvProfileSector = {
  confirmed?: boolean;
  name?: string;
  skills?: string[];
};

type CvProfile = {
  name?: string;
  email?: string;
  testSessions?: Array<{ primaryTypes?: string[] }>;
  exploredSectors?: CvProfileSector[];
};

export function readErrorMessage(error: unknown, fallback: string) {
  return errorMessage(error, fallback);
}

export function readGraphNodesFromStorage(
  confirmedSectorId: number | undefined,
  userId: number,
): GraphNode[] {
  try {
    const key = `grafo_user_${confirmedSectorId}_${userId}`;
    const parsed = JSON.parse(localStorage.getItem(key) ?? "null") as unknown;
    if (!parsed || typeof parsed !== "object") return [];
    const nodes = (parsed as { nodes?: unknown }).nodes;
    return Array.isArray(nodes) ? (nodes as GraphNode[]) : [];
  } catch {
    return [];
  }
}

export function useProfileForCv(userId: number) {
  return useQuery<CvProfile>({
    queryKey: ["profile", userId],
    queryFn: () => getJson<CvProfile>(`${BASE}api/profile/${userId}`),
    enabled: !!userId,
    staleTime: 60_000,
  });
}
