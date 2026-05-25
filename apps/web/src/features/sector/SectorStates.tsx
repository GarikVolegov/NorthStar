import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { TFunction } from "i18next";
import { Link } from "wouter";

export function SectorLoadingState() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <Skeleton className="h-8 w-24 mb-8" />
      <div className="flex gap-6 mb-12">
        <Skeleton className="h-24 w-24 rounded-2xl" />
        <div className="flex-1 space-y-4">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-5/6" />
        </div>
      </div>
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

export function SectorErrorState({ t }: { t: TFunction }) {
  return (
    <div className="container mx-auto px-4 py-24 text-center">
      <h2 className="text-2xl font-bold mb-4">{t("sector.notFound")}</h2>
      <Button asChild variant="outline">
        <Link href="/">{t("sector.goHome")}</Link>
      </Button>
    </div>
  );
}
