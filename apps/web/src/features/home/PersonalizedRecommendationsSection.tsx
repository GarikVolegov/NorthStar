import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ArrowRight, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { WORK_MODE_COLOR, WORK_MODE_ICON } from "./homeConstants";
import { useLatestRecommendations } from "./homeApi";

export function PersonalizedRecommendationsSection({ userId }: { userId: number }) {
  const { t } = useTranslation();
  const { data, isLoading } = useLatestRecommendations(!!userId);
  if (isLoading)
    return (
      <section className="py-10 border-b border-border">
        <div className="container mx-auto px-4 md:px-6 max-w-6xl">
          <Skeleton className="h-6 w-64 mb-4 rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        </div>
      </section>
    );
  if (!data?.recommendations?.length) return null;

  const wm = data.workPreference;
  const wmLabel = t(`workMode.${wm}`, { defaultValue: wm });
  const wmIcon = WORK_MODE_ICON[wm];
  const wmColor = WORK_MODE_COLOR[wm];

  return (
    <section className="py-10 border-b border-border">
      <div className="container mx-auto px-4 md:px-6 max-w-6xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide mb-2">
              <Sparkles className="w-3.5 h-3.5" />{" "}
              {t("home.personalized.badge")}
            </div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground">
              {t("home.personalized.title")}
            </h2>
            {wmLabel && (
              <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                {t("home.personalized.sortedBy")}
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2 py-0.5",
                    wmColor,
                  )}
                >
                  {wmIcon} {wmLabel}
                </span>
              </p>
            )}
          </div>
          <Link href={`/risultati/${data.sessionId}`}>
            <div className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-white/20 transition-all">
              {t("home.personalized.fullDetail")}{" "}
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.recommendations.map((rec, i) => (
            <Link key={rec.sectorId} href={`/settore/${rec.sectorId}`}>
              <div
                className={cn(
                  "group flex items-start gap-3 p-4 rounded-2xl border bg-card hover:border-primary/30 transition-all duration-200 cursor-pointer h-full",
                  rec.sectorId === data.confirmedSectorId
                    ? "border-primary/40 bg-primary/5"
                    : "border-border",
                )}
              >
                <div className="shrink-0 w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-sm font-bold border border-primary/20">
                  {i + 1}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground leading-tight mb-1 group-hover:text-primary transition-colors">
                    {rec.sectorName}
                    {rec.sectorId === data.confirmedSectorId && (
                      <span className="ml-2 text-xs font-semibold text-primary bg-primary/10 rounded-full px-2 py-0.5">
                        {t("home.personalized.chosen")}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {rec.matchReason}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

