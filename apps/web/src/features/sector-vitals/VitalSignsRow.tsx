import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWendy } from "@/contexts/WendyProvider";
import { useToast } from "@/hooks/use-toast";
import { useCreateRoutine } from "@/hooks/useRoutines";
import { cn } from "@/lib/utils";
import { useSectorVitals, type VitalKey, type VitalSign } from "@workspace/api-client-react";
import React from "react";
import { VITAL_ORDER, VITAL_SIGN_META } from "./vital-signs-config";
import { VitalSignCard } from "./VitalSignCard";
import { VitalSignDetail } from "./VitalSignDetail";
import { WendyVitalLabel } from "./WendyVitalLabel";
import { usePersonaVitalsConfig } from "./usePersonaVitalsConfig";

interface VitalSignsRowProps {
  sectorId: number;
  sectorName: string;
  geography?: string;
  compact?: boolean;
  showSummary?: boolean;
  enableDetails?: boolean;
  className?: string;
}

export function VitalSignsRow({
  sectorId,
  sectorName,
  geography = "IT",
  compact = false,
  showSummary = true,
  enableDetails = true,
  className,
}: VitalSignsRowProps) {
  const { data, isLoading, isError, refetch } = useSectorVitals(sectorId, geography);
  const persona = usePersonaVitalsConfig();
  const wendy = useWendy();
  const { toast } = useToast();
  const createRoutine = useCreateRoutine();
  const [selected, setSelected] = React.useState<VitalSign | null>(null);
  const [showMonitorPrompt, setShowMonitorPrompt] = React.useState(false);

  React.useEffect(() => {
    if (compact) return;
    const timeout = window.setTimeout(() => setShowMonitorPrompt(true), 30_000);
    return () => window.clearTimeout(timeout);
  }, [compact]);

  const visibleKeys = React.useMemo(
    () => VITAL_ORDER.filter((key) => persona.visible.includes(key)),
    [persona.visible],
  );

  function interpret(sign: VitalSign) {
    const signName = VITAL_SIGN_META[sign.key]!.label;
    wendy.ask(
      `Spiega perché il ${signName} del settore "${sectorName}" è ${sign.status}. Cita le fonti RAG (job_posting_trend, weak_signals, news, growth_articles) usate per arrivare alla conclusione.`,
    );
    wendy.open();
    setShowMonitorPrompt(true);
  }

  async function monitorSector() {
    try {
      await createRoutine.mutateAsync({
        type: "market_report",
        name: `Market report ${sectorName}`,
        schedule: "weekly",
        parameters: { sectorId, includeVitals: true, geography },
        outputChannel: "wendy_context",
        active: true,
      });
      setShowMonitorPrompt(false);
      toast({
        title: "Routine attivata",
        description: "Wendy monitorera questo settore ogni settimana.",
      });
    } catch (error) {
      toast({
        title: "Routine non creata",
        description: error instanceof Error ? error.message : "Riprova tra poco.",
        variant: "destructive",
      });
    }
  }

  if (isLoading) {
    return (
      <div className={cn("space-y-3", className)}>
        <Skeleton className="h-8 w-full max-w-lg rounded-lg" />
        <div className={cn("grid gap-3", compact ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-5")}>
          {visibleKeys.map((key) => <Skeleton key={key} className="h-36 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={cn("rounded-lg border bg-card p-4", className)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Vital signs non disponibili.</p>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Riprova
          </Button>
        </div>
      </div>
    );
  }

  return (
    <section className={cn("space-y-3", className)} aria-label="Sector vital signs">
      {showSummary && <WendyVitalLabel sectorId={sectorId} geography={geography} />}
      <div className={cn("grid gap-3", compact ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-5")}>
        {visibleKeys.map((key: VitalKey) => {
          const sign = data.signs[key]!;
          return (
            <VitalSignCard
              key={key}
              sign={sign}
              plain={persona.tone === "plain"}
              emphasized={persona.emphasized.includes(key)}
              compact={compact}
              {...(enableDetails ? { onSelect: () => setSelected(sign) } : {})}
            />
          );
        })}
      </div>
      {!compact && showMonitorPrompt && (
        <div className="flex flex-col gap-2 rounded-lg border bg-muted/20 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <span className="text-muted-foreground">Vuoi che Wendy monitori questo settore ogni settimana?</span>
          <Button
            size="sm"
            variant="outline"
            disabled={createRoutine.isPending}
            onClick={() => void monitorSector()}
          >
            {createRoutine.isPending ? "Attivo..." : "Monitora questo settore"}
          </Button>
        </div>
      )}
      <VitalSignDetail
        open={selected !== null}
        sign={selected}
        sectorName={sectorName}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        onInterpret={interpret}
      />
    </section>
  );
}
