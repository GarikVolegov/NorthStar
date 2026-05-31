/**
 * DashboardIndecisoTools — wrapper adattivo per il percorso "indeciso".
 *
 * Combina:
 *   - CommitmentReadinessWidget (Discovery Engine — score, componenti, nudge)
 *   - JourneyToolsSection bandizzata (set tool diverso in base alla banda)
 *
 * Usato in dashboard.tsx solo quando journeyType === "indeciso".
 */
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-fetch";
import { CommitmentReadinessWidget } from "./CommitmentReadinessWidget";
import { JourneyToolsSection } from "./JourneyToolsSection";

interface ReadinessLite {
  band: "low" | "mid" | "high";
}

async function fetchBand(): Promise<ReadinessLite> {
  const res = await apiFetch("/api/discovery/readiness");
  if (!res.ok) throw new Error("Errore caricamento readiness");
  const j = (await res.json()) as ReadinessLite;
  return { band: j.band };
}

interface Props {
  toolsProps: { journeyType?: string | null; sectorId?: number };
}

export function DashboardIndecisoTools({ toolsProps }: Props) {
  // Stessa queryKey del widget interno → React Query condivide il dato (no doppia chiamata).
  const { data } = useQuery({
    queryKey: ["discovery-readiness"],
    queryFn: fetchBand,
    staleTime: 60 * 1000,
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1">
        <CommitmentReadinessWidget />
      </div>
      <div className="lg:col-span-2">
        <JourneyToolsSection
          journeyType={toolsProps.journeyType}
          {...(toolsProps.sectorId !== undefined ? { sectorId: toolsProps.sectorId } : {})}
          {...(data?.band ? { readinessBand: data.band } : {})}
        />
      </div>
    </div>
  );
}
