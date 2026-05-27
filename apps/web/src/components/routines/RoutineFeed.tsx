import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { RoutineExecution } from "@/hooks/useRoutines";
import { Zap } from "lucide-react";
import { RoutineFeedItem } from "./RoutineFeedItem";

interface RoutineFeedProps {
  feed:      RoutineExecution[];
  isLoading: boolean;
  onRead:    (id: number) => void;
}

export function RoutineFeed({ feed, isLoading, onRead }: RoutineFeedProps) {
  const unreadCount = feed.filter((e) => e.readAt === null).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Ultime esecuzioni</h2>
        {unreadCount > 0 && (
          <Badge className="text-xs h-5 px-1.5">{unreadCount}</Badge>
        )}
      </div>

      {/* Loading skeletons */}
      {isLoading && (
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && feed.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-10 px-4 text-center">
          <Zap className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Nessuna esecuzione ancora. Le routine inizieranno presto!
          </p>
        </div>
      )}

      {/* Feed list */}
      {!isLoading && feed.length > 0 && (
        <div className="rounded-xl border border-border bg-card px-4">
          {feed.map((execution) => (
            <RoutineFeedItem
              key={execution.id}
              execution={execution}
              onRead={onRead}
            />
          ))}
        </div>
      )}
    </div>
  );
}
