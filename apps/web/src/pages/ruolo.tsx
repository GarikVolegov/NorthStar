import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TryADaySection } from "@/components/role/TryADaySection";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useWendyPageContext } from "@/hooks/useWendyPageContext";
import { RIASEC_LABELS, SectorIcon } from "@/lib/sector-icon";
import { useGetRoleDetail } from "@workspace/api-client-react";
import {
  ArrowLeft,
  Briefcase,
  ChevronRight,
  Clock,
  Coins,
  DollarSign,
  Gauge,
  GraduationCap,
  ShieldCheck,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "wouter";

export default function Ruolo() {
  const { t } = useTranslation();
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const { user } = useAuth();
  const [currentTryADayScene, setCurrentTryADayScene] = useState<string | null>(null);

  const { data: role, isLoading, error } = useGetRoleDetail(id, {
    query: { enabled: !!id, queryKey: ["roleDetail", id] },
  });

  useWendyPageContext({
    page: "ruolo",
    title: role?.title,
    entityType: "profession",
    entityId: id || undefined,
    entityName: role?.title,
    journeyType: user?.journeyType ?? undefined,
    sector: role?.sector,
    roleTitle: role?.title,
    currentTryADayScene,
    capabilities: ["get_profession_detail", "generate_day_scene", "search_rag"],
    fields: ["skills", "salaryRange", "growthOutlook", "tryADay"],
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <Skeleton className="h-8 w-24 mb-8" />
        <div className="space-y-4 mb-12">
          <Skeleton className="h-12 w-2/3" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-5/6" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-32 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !role) {
    return (
      <div className="container mx-auto px-4 py-24 text-center">
        <h2 className="text-2xl font-bold mb-4">{t("role.notFound")}</h2>
        <Button asChild variant="outline">
          <Link href="/">{t("role.goHome")}</Link>
        </Button>
      </div>
    );
  }

  const autonomyPercent = role.autonomyScore != null ? role.autonomyScore * 10 : null;
  const stabilityPercent = role.stabilityScore != null ? role.stabilityScore * 10 : null;

  return (
    <div className="container mx-auto px-4 py-8 md:py-16 max-w-4xl">
      <Button asChild variant="ghost" size="sm" className="mb-8 rounded-full">
        <button onClick={() => window.history.back()}>
          <ArrowLeft className="w-4 h-4 mr-2" /> {t("role.back")}
        </button>
      </Button>

      {role.sectorInfo && (
        <Link
          href={`/settore/${role.sectorInfo.id}`}
          className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full bg-secondary/60 text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
        >
          <SectorIcon name={role.sectorInfo.icon} size={16} />
          {role.sectorInfo.name}
        </Link>
      )}

      <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4 leading-tight">
        {role.title}
      </h1>

      {role.description && (
        <p className="text-lg text-muted-foreground leading-relaxed mb-8">
          {role.description}
        </p>
      )}

      <div className="flex flex-wrap gap-2 mb-10">
        {role.riasecFit.map((code) => {
          const meta = RIASEC_LABELS[code];
          return (
            <span
              key={code}
              title={meta?.desc}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/60 text-secondary-foreground text-sm font-medium"
            >
              <span className="font-mono font-bold">{code}</span>
              {meta && <span className="text-muted-foreground">— {meta.label}</span>}
            </span>
          );
        })}
        {role.workModes.map((mode) => (
          <Badge key={mode} variant="outline" className="capitalize">
            <Briefcase className="w-3 h-3 mr-1" /> {t(`workMode.${mode}`, { defaultValue: mode })}
          </Badge>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        <div className="bg-card border rounded-2xl p-5 flex flex-col justify-center">
          <div className="flex items-center text-muted-foreground text-sm font-medium mb-2 uppercase tracking-wider">
            <DollarSign className="w-4 h-4 mr-1.5" /> {t("role.salary")}
          </div>
          <div className="text-lg md:text-xl font-semibold">{role.salaryRange}</div>
        </div>
        <div className="bg-card border rounded-2xl p-5 flex flex-col justify-center">
          <div className="flex items-center text-muted-foreground text-sm font-medium mb-2 uppercase tracking-wider">
            <TrendingUp className="w-4 h-4 mr-1.5" /> {t("role.growth")}
          </div>
          <div className="text-lg md:text-xl font-semibold text-emerald-600">
            {role.growthOutlook}
          </div>
        </div>
        {autonomyPercent != null && (
          <div className="bg-card border rounded-2xl p-5 flex flex-col justify-center">
            <div className="flex items-center text-muted-foreground text-sm font-medium mb-2 uppercase tracking-wider">
              <Gauge className="w-4 h-4 mr-1.5" /> {t("role.autonomy")}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full transition-all"
                  style={{ width: `${autonomyPercent}%` }}
                />
              </div>
              <span className="text-sm font-semibold">{role.autonomyScore}/10</span>
            </div>
          </div>
        )}
        {stabilityPercent != null && (
          <div className="bg-card border rounded-2xl p-5 flex flex-col justify-center">
            <div className="flex items-center text-muted-foreground text-sm font-medium mb-2 uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 mr-1.5" /> {t("role.stability")}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: `${stabilityPercent}%` }}
                />
              </div>
              <span className="text-sm font-semibold">{role.stabilityScore}/10</span>
            </div>
          </div>
        )}
      </div>

      <TryADaySection
        role={role}
        journeyType={user?.journeyType}
        onSceneChange={setCurrentTryADayScene}
      />

      <Separator className="mb-12" />

      <div className="mb-12">
        <h2 className="text-2xl font-serif font-bold flex items-center mb-6">
          <Zap className="w-5 h-5 mr-2 text-amber-500" /> {t("role.skills")}
        </h2>
        <div className="flex flex-wrap gap-3">
          {role.skills.map((skill, i) => (
            <div
              key={i}
              className="px-5 py-3 bg-card border rounded-xl shadow-sm text-foreground font-medium flex items-center"
            >
              <Zap className="w-4 h-4 mr-2 text-amber-500 opacity-70" /> {skill}
            </div>
          ))}
        </div>
      </div>

      {role.educationPaths && role.educationPaths.length > 0 && (
        <div className="mb-12">
          <h2 className="text-2xl font-serif font-bold flex items-center mb-6">
            <GraduationCap className="w-5 h-5 mr-2 text-indigo-500" /> {t("role.educationPaths")}
          </h2>
          <div className="grid gap-4">
            {role.educationPaths.map((ep) => (
              <div
                key={ep.id}
                className="bg-card border rounded-2xl p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{ep.path}</h3>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="secondary" className="capitalize">
                        {ep.type}
                      </Badge>
                      <Badge variant="outline" className="text-muted-foreground">
                        <Clock className="w-3 h-3 mr-1" /> {ep.duration}
                      </Badge>
                      <Badge variant="outline" className="text-muted-foreground">
                        <Coins className="w-3 h-3 mr-1" /> {ep.cost}
                      </Badge>
                    </div>
                  </div>
                </div>

                {ep.steps && ep.steps.length > 0 && (
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                      {t("role.steps")}
                    </h4>
                    <div className="space-y-2">
                      {ep.steps.map((step, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0 text-xs font-bold text-indigo-700">
                            {i + 1}
                          </div>
                          <span className="text-sm text-muted-foreground leading-relaxed pt-0.5">
                            {step}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {ep.careerOutcomes && ep.careerOutcomes.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      {t("role.careerOutcomes")}
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {ep.careerOutcomes.map((outcome, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm border border-emerald-100"
                        >
                          <ChevronRight className="w-3 h-3" /> {outcome}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {role.sectorInfo && (
        <div className="bg-primary/5 rounded-3xl p-8 border border-primary/10 text-center">
          <h3 className="text-xl font-serif font-bold mb-2">{t("role.exploreSector")}</h3>
          <p className="text-muted-foreground mb-6 text-sm">
            {t("role.exploreSectorDesc", { sector: role.sectorInfo.name })}
          </p>
          <Button asChild>
            <Link href={`/settore/${role.sectorInfo.id}`}>
              <SectorIcon name={role.sectorInfo.icon} size={16} />
              <span className="ml-2">{role.sectorInfo.name}</span>
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
