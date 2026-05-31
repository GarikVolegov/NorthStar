import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useOptionalWendy } from "@/contexts/WendyProvider";
import { ROUTINE_TYPE_LABEL, useRoutines, type UserRoutine } from "@/hooks/useRoutines";
import { usePageMeta } from "@/lib/seo";
import { ArrowLeft, Bot, CalendarClock, Clock3, RefreshCcw, Settings2, Zap } from "lucide-react";
import { Link } from "wouter";

const ROUTINES_WENDY_PROMPT =
  "Aiutami a configurare o migliorare le mie routine NorthStar. Parti dai miei obiettivi, proponi una priorita e guidami con pochi passaggi concreti.";

function formatDateTime(value: string | null): string {
  if (!value) return "Non pianificata";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getRoutineName(routine: UserRoutine): string {
  return routine.name ?? ROUTINE_TYPE_LABEL[routine.type] ?? routine.type.replace(/_/g, " ");
}

function getRoutineType(routine: UserRoutine): string {
  return ROUTINE_TYPE_LABEL[routine.type] ?? routine.type.replace(/_/g, " ");
}

export default function RoutinesPage() {
  usePageMeta({
    title: "Routine | Fondazione NorthStar",
    description: "Gestisci le routine personali e gli aggiornamenti automatici del tuo percorso.",
  });

  const { routines, meta, error, isError, isLoading, refetch } = useRoutines();
  const wendy = useOptionalWendy();

  const activeCount = meta?.activeCount ?? routines.filter((routine) => routine.active).length;
  const totalCount = meta?.total ?? routines.length;
  const planLabel = meta?.plan ?? "free";

  function handleWendySetup() {
    wendy?.ask(ROUTINES_WENDY_PROMPT);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 md:py-12">
      <Link href="/dashboard" className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" />
        Torna alla dashboard
      </Link>

      <section className="mb-6 border-b pb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">Automazioni personali</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-foreground">Routine</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Controlla cosa Wendy monitora per te e quando ricevi i prossimi aggiornamenti.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="min-h-10 gap-2" onClick={() => void refetch()}>
              <RefreshCcw className="h-4 w-4" />
              Aggiorna
            </Button>
            <Button type="button" className="min-h-10 gap-2" onClick={handleWendySetup} disabled={!wendy}>
              <Settings2 className="h-4 w-4" />
              Configura con Wendy
            </Button>
          </div>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground">Totali</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{totalCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground">Attive</p>
          <p className="mt-2 text-2xl font-bold text-foreground">{activeCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground">Piano</p>
          <p className="mt-2 text-2xl font-bold capitalize text-foreground">{planLabel}</p>
        </div>
      </section>

      {isLoading ? (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {[0, 1].map((item) => (
            <Card key={item} className="p-4">
              <Skeleton className="mb-3 h-5 w-44" />
              <Skeleton className="mb-2 h-20 w-full rounded-lg" />
              <Skeleton className="h-4 w-32" />
            </Card>
          ))}
        </section>
      ) : isError ? (
        <section className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
          <h2 className="text-lg font-semibold text-foreground">Routine non disponibili</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Non riesco a caricare le routine in questo momento. Riprova tra poco o chiedi a Wendy di aiutarti a ripartire.
          </p>
          {error instanceof Error && (
            <p className="mt-2 text-xs text-muted-foreground">{error.message}</p>
          )}
          <Button type="button" variant="outline" className="mt-4 min-h-10 gap-2" onClick={() => void refetch()}>
            <RefreshCcw className="h-4 w-4" />
            Riprova
          </Button>
        </section>
      ) : routines.length === 0 ? (
        <section className="rounded-lg border border-dashed bg-card p-6">
          <div className="flex max-w-2xl flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border bg-primary/10 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">Nessuna routine configurata</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Puoi partire da una routine leggera: offerte da monitorare, esercizi mindset o un briefing periodico sul tuo percorso.
              </p>
              <Button type="button" className="mt-4 min-h-10 gap-2" onClick={handleWendySetup} disabled={!wendy}>
                <Zap className="h-4 w-4" />
                Scegli la prima routine
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {routines.map((routine) => (
            <Card key={routine.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="line-clamp-2 text-base">{getRoutineName(routine)}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{getRoutineType(routine)}</p>
                  </div>
                  <Badge variant={routine.active ? "default" : "outline"}>
                    {routine.active ? "Attiva" : "Pausa"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <CalendarClock className="h-4 w-4" />
                      Prossima esecuzione
                    </div>
                    <p className="font-medium text-foreground">{formatDateTime(routine.nextRunAt)}</p>
                  </div>
                  <div className="rounded-lg border bg-muted/20 p-3">
                    <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <Clock3 className="h-4 w-4" />
                      Frequenza
                    </div>
                    <p className="font-medium text-foreground">{routine.schedule}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Canale: <span className="font-semibold text-foreground">{routine.outputChannel.replace(/_/g, " ")}</span>
                </p>
              </CardContent>
            </Card>
          ))}
        </section>
      )}
    </main>
  );
}
