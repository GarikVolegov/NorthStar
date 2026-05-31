import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { ApiClientError, getJson } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Briefcase } from "lucide-react";
import { Link } from "wouter";

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
  ctaLabel?: string;
  ctaTarget?: string;
  readAt: string | null;
  createdAt: string;
}

interface FeedResponse {
  feed: FeedItem[];
}

async function fetchJobFeed(): Promise<FeedResponse> {
  try {
    return await getJson<FeedResponse>("/api/routines/feed?type=job_monitor&limit=3");
  } catch (error) {
    if (error instanceof ApiClientError) return { feed: [] };
    throw error;
  }
}

interface Props {
  size: "sm" | "md" | "lg";
}

export function JobFeedWidget({ size }: Props) {
  const { user } = useAuth();
  const hasUser = user !== null && user !== undefined;

  const { data, isLoading } = useQuery<FeedResponse>({
    queryKey: ["routines-feed-job"],
    queryFn: fetchJobFeed,
    enabled: hasUser,
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Card className={cn(SIZE_HEIGHT[size], "p-4")}>
        <Skeleton className="h-5 w-32 mb-3" />
        <div className="space-y-2">
          {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded" />)}
        </div>
      </Card>
    );
  }

  const feed = data?.feed ?? [];

  return (
    <Card className={cn(SIZE_HEIGHT[size])}>
      <CardHeader className="pb-2 pt-4 px-4">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Briefcase className="h-4 w-4 text-primary" />
          Monitor offerte lavoro
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {feed.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nessuna notifica recente. Configura una routine job monitor.
          </p>
        ) : (
          <div className="space-y-2">
            {feed.map((item) => (
              <div key={item.id} className="rounded-lg border bg-muted/30 p-2.5">
                <p className="text-xs font-semibold text-foreground line-clamp-1">{item.title}</p>
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.body}</p>
              </div>
            ))}
          </div>
        )}
        <Link
          href="/routines"
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Vedi tutte <ArrowRight className="h-3 w-3" />
        </Link>
      </CardContent>
    </Card>
  );
}
