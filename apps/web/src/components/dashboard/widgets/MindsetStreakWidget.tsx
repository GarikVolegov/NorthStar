import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { ApiClientError, getJson } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Brain, Flame } from "lucide-react";

const SIZE_HEIGHT: Record<"sm" | "md" | "lg", string> = {
  sm: "min-h-[120px]",
  md: "min-h-[200px]",
  lg: "min-h-[280px]",
};

interface FeedItem {
  id: number;
  routineId: number;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

interface FeedResponse {
  feed: FeedItem[];
}

async function fetchMindsetFeed(): Promise<FeedResponse> {
  try {
    return await getJson<FeedResponse>("/api/routines/feed?type=mindset_exercise&limit=5");
  } catch (error) {
    if (error instanceof ApiClientError) return { feed: [] };
    throw error;
  }
}

function computeStreak(feed: FeedItem[]): number {
  if (feed.length === 0) return 0;

  const uniqueDays = Array.from(
    new Set(
      feed.map((item) =>
        new Date(item.createdAt).toISOString().slice(0, 10),
      ),
    ),
  ).sort((a, b) => b.localeCompare(a));

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < uniqueDays.length; i++) {
    const dayDate = new Date((uniqueDays[i] ?? "") + "T00:00:00");
    const expectedDate = new Date(today);
    expectedDate.setDate(today.getDate() - i);

    if (dayDate.toISOString().slice(0, 10) === expectedDate.toISOString().slice(0, 10)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

interface Props {
  size: "sm" | "md" | "lg";
}

export function MindsetStreakWidget({ size }: Props) {
  const { user } = useAuth();
  const hasUser = user !== null && user !== undefined;

  const { data, isLoading } = useQuery<FeedResponse>({
    queryKey: ["routines-feed-mindset"],
    queryFn: fetchMindsetFeed,
    enabled: hasUser,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Card className={cn(SIZE_HEIGHT[size], "p-4")}>
        <Skeleton className="h-5 w-32 mb-3" />
        <Skeleton className="h-12 w-24 rounded mx-auto" />
      </Card>
    );
  }

  const feed = data?.feed ?? [];
  const streak = computeStreak(feed);
  const lastExercise = feed[0] ?? null;

  return (
    <Card className={cn(SIZE_HEIGHT[size])}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Brain className="h-4 w-4 text-primary" />
          Streak mindset
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Flame className={cn("h-6 w-6", streak > 0 ? "text-orange-500" : "text-muted-foreground")} />
            <span className="text-3xl font-bold tabular-nums text-foreground">{streak}</span>
          </div>
          <div>
            <p className="text-xs font-medium text-foreground">
              {streak === 1 ? "giorno consecutivo" : "giorni consecutivi"}
            </p>
            <p className="text-xs text-muted-foreground">
              {streak === 0 ? "Inizia oggi!" : "Continua così!"}
            </p>
          </div>
        </div>
        {lastExercise && (
          <div className="mt-3 rounded-lg border bg-muted/30 p-2">
            <p className="text-xs text-muted-foreground mb-0.5">Ultimo esercizio</p>
            <p className="text-xs font-medium text-foreground line-clamp-2">{lastExercise.title}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
