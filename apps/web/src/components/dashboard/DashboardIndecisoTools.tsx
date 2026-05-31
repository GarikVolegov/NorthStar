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
import {
  CommitmentReadinessWidget,
  fetchReadiness,
  isReadinessData,
} from "./CommitmentReadinessWidget";
import { JourneyToolsSection } from "./JourneyToolsSection";

interface Props {
  toolsProps: { journeyType?: string | null; sectorId?: number };
}

export function DashboardIndecisoTools({ toolsProps }: Props) {
  // Stessa queryKey del widget interno → React Query condivide il dato (no doppia chiamata).
  const { data } = useQuery({
    queryKey: ["discovery-readiness"],
    queryFn: fetchReadiness,
    staleTime: 60 * 1000,
  });
  const readinessBand = isReadinessData(data) ? data.band : undefined;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1">
        <CommitmentReadinessWidget />
      </div>
      <div className="lg:col-span-2">
        <JourneyToolsSection
          journeyType={toolsProps.journeyType}
          {...(toolsProps.sectorId !== undefined ? { sectorId: toolsProps.sectorId } : {})}
          {...(readinessBand ? { readinessBand } : {})}
        />
      </div>
    </div>
  );
}
