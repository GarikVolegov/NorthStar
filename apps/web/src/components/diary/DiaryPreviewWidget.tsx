import type { DiaryRecapPayload } from "@/components/diary/diaryTypes";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getJson } from "@/lib/apiClient";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, ArrowRight } from "lucide-react";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

export function DiaryPreviewWidget({ userId: _userId }: { userId: number }) {
  const { data, isLoading } = useQuery<DiaryRecapPayload>({
    queryKey: ["diary", "recap", "profile-preview"],
    queryFn: () => getJson(`${BASE}api/diary/recap?period=week`),
  });

  if (isLoading) return <Skeleton className="h-32 rounded-lg" />;

  return (
    <section className="rounded-lg border bg-card p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-primary/10 text-primary">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase text-muted-foreground">Diario personale</p>
            <h3 className="mt-1 text-base font-semibold text-foreground">
              {data ? `${data.entriesCount} riflessioni questa settimana` : "Spazio di crescita personale"}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Idee, mood e recap Wendy restano raccolti in un unico posto.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" className="min-h-10 rounded-md">
          <Link href="/diario">
            Apri diario
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
