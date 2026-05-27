import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProactiveInsightCard } from "@/components/wendy/ProactiveInsightCard";
import { useProactiveInsights } from "@/hooks/useProactiveInsights";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

const SIZE_HEIGHT: Record<"sm" | "md" | "lg", string> = {
  sm: "min-h-[120px]",
  md: "min-h-[200px]",
  lg: "min-h-[280px]",
};

interface Props {
  size: "sm" | "md" | "lg";
}

export function InsightsWidget({ size }: Props) {
  const { insights, isLoading, markRead, dismiss } = useProactiveInsights();

  if (isLoading) {
    return (
      <Card className={cn(SIZE_HEIGHT[size], "p-4")}>
        <Skeleton className="h-5 w-28 mb-3" />
        <div className="space-y-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded" />)}
        </div>
      </Card>
    );
  }

  const unreadInsights = insights.filter((i) => !i.readAt).slice(0, 3);

  return (
    <Card className={cn(SIZE_HEIGHT[size])}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          Insight da Wendy
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {unreadInsights.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nessun nuovo insight. Wendy ti aggiornerà presto!
          </p>
        ) : (
          <div className="space-y-2">
            {unreadInsights.map((insight) => (
              <ProactiveInsightCard
                key={insight.id}
                insight={insight}
                onRead={markRead}
                onDismiss={dismiss}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
