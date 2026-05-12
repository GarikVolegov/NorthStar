import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";

const BASE = import.meta.env.BASE_URL || "/";

export interface DashboardObjective {
  id: number;
  text: string;
  category: string;
  progress: number;
  completed: boolean;
  completedAt: string | null;
  dueDate: string | null;
  createdAt: string;
}

export interface DashboardEvent {
  id: number;
  title: string;
  category: string | null;
  startAt: string;
  priority: string | null;
}

export interface DashboardSession {
  id: number;
  riasecScores: Record<string, number>;
  primaryTypes: string[];
  spiritScores: Record<string, number>;
  recommendations: Array<{ sectorId: number; sectorName: string; matchScore: number }>;
  createdAt: string;
}

export interface DashboardData {
  user: {
    journeyType: string | null;
    name: string;
    email: string;
    isPremium: boolean;
    onboardingCompleted: boolean;
  };
  session: DashboardSession | null;
  objectives: DashboardObjective[];
  objectivesProgress: {
    done: number;
    total: number;
    percent: number;
  };
  upcomingEvents: DashboardEvent[];
}

export function useDashboardData() {
  return useQuery<DashboardData>({
    queryKey: ["dashboard-data"],
    queryFn: async () => {
      const res = await apiFetch(`${BASE}api/dashboard`);
      if (!res.ok) throw new Error("Errore caricamento dashboard");
      return res.json() as Promise<DashboardData>;
    },
    staleTime: 60_000,
    retry: false,
  });
}
