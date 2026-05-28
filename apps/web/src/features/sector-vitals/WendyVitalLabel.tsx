import { SafeMarkdown } from "@/components/SafeMarkdown";
import { Skeleton } from "@/components/ui/skeleton";
import { useSectorVitalsSummary } from "@workspace/api-client-react";
import React from "react";

interface WendyVitalLabelProps {
  sectorId: number;
  geography?: string;
}

export function WendyVitalLabel({ sectorId, geography = "IT" }: WendyVitalLabelProps) {
  const summary = useSectorVitalsSummary();

  React.useEffect(() => {
    if (sectorId > 0) summary.mutate({ sectorId, geography });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectorId, geography]);

  if (summary.isPending) {
    return <Skeleton className="h-8 w-full max-w-xl rounded-lg" />;
  }

  if (!summary.data?.summary) return null;

  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-2 text-sm text-muted-foreground">
      <SafeMarkdown content={summary.data.summary} className="space-y-0" />
    </div>
  );
}
