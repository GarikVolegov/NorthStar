import { Button } from "@/components/ui/button";
import { RoutineFeed } from "@/components/routines/RoutineFeed";
import { RoutinesList } from "@/components/routines/RoutinesList";
import {
  useDeleteRoutine,
  useMarkFeedRead,
  useRoutineFeed,
  useRoutines,
  useUpdateRoutine,
} from "@/hooks/useRoutines";
import { usePageMeta } from "@/lib/seo";
import { Bot } from "lucide-react";
import { Link } from "wouter";

const DEFAULT_META = {
  total:       0,
  activeCount: 0,
  plan:        "free",
  limit:       1,
  canCreate:   true,
} as const;

export default function RoutinesPage() {
  const { routines, meta, isLoading: loadingRoutines } = useRoutines();
  const { feed, isLoading: loadingFeed }               = useRoutineFeed();
  const updateRoutine = useUpdateRoutine();
  const deleteRoutine = useDeleteRoutine();
  const markRead      = useMarkFeedRead();

  usePageMeta({
    title:       "Routine | NorthStar",
    description: "Gestisci le tue automazioni personali con Wendy.",
    path:        "/routines",
    noIndex:     true,
  });

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl space-y-8">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-bold">Routine Autonome</h1>
        <p className="text-muted-foreground mt-1">
          Le tue automazioni personali, gestite da Wendy.
        </p>
      </div>

      {/* Wendy config CTA */}
      <div className="bg-muted/50 rounded-xl p-4 flex items-center gap-3">
        <Bot className="h-6 w-6 text-primary shrink-0" />
        <div className="min-w-0">
          <p className="font-medium">Configura con Wendy</p>
          <p className="text-sm text-muted-foreground">
            Di' a Wendy cosa vuoi automatizzare e lei creerà la routine per te.
          </p>
        </div>
        <Link href="/chat" className="ml-auto shrink-0">
          <Button size="sm">Parla con Wendy</Button>
        </Link>
      </div>

      {/* Two-column layout on md+: routines left, feed right */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RoutinesList
          routines={routines}
          meta={meta ?? DEFAULT_META}
          isLoading={loadingRoutines}
          onToggleActive={(id, active) => updateRoutine.mutate({ id, data: { active } })}
          onDelete={(id) => deleteRoutine.mutate(id)}
        />
        <RoutineFeed
          feed={feed}
          isLoading={loadingFeed}
          onRead={(id) => markRead.mutate(id)}
        />
      </div>
    </div>
  );
}
