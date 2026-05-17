import { useQuery } from "@tanstack/react-query";

export interface ProfessionPreview {
  id:             number;
  title:          string;
  sector:         string;
  salaryRange:    string;
  growthOutlook:  string;
  autonomyScore:  number;
  stabilityScore: number;
  riasecFit:      string[];
  skills:         string[];
}

export interface ProfessionWithPaths extends ProfessionPreview {
  description:  string;
  professions?: ProfessionPreview[];  // when fetching sector detail that includes professions
}

async function fetchProfessionsBySector(sectorId: number): Promise<ProfessionPreview[]> {
  const res = await fetch(`/api/sectors/${sectorId}`, { credentials: "include" });
  if (!res.ok) throw new Error("Errore caricamento professioni");
  const data = await res.json();
  return data.professions ?? [];
}

async function fetchProfessionDetail(professionId: number): Promise<ProfessionWithPaths> {
  const res = await fetch(`/api/roles/${professionId}`, { credentials: "include" });
  if (!res.ok) throw new Error("Professione non trovata");
  return res.json();
}

export function useProfessionsBySector(sectorId: number | null) {
  return useQuery<ProfessionPreview[]>({
    queryKey: ["professions", "by-sector", sectorId],
    enabled:  !!sectorId,
    queryFn:  () => fetchProfessionsBySector(sectorId!),
    staleTime: 10 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
  });
}

export function useProfessionDetail(professionId: number | null) {
  return useQuery<ProfessionWithPaths>({
    queryKey: ["profession", professionId],
    enabled:  !!professionId,
    queryFn:  () => fetchProfessionDetail(professionId!),
    staleTime: 10 * 60 * 1000,
    gcTime:    30 * 60 * 1000,
  });
}
