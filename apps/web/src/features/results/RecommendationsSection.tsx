import type { WorkPreference } from "@/components/WorkModeSelector";
import { WorkModeBadge } from "@/components/WorkModeSelector";
import { AnimateOnScroll } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { SectorIcon } from "@/lib/sector-icon";
import { cn } from "@/lib/utils";
import { getWorkModeAlignment } from "@/lib/work-mode-utils";
import type { TFunction } from "i18next";
import { motion } from "framer-motion";
import { Activity, ArrowRight, Bot, CheckCircle2, DollarSign, Sparkles, Star, TrendingUp } from "lucide-react";
import { Link } from "wouter";
import { QuickCompare, SectorBookmarkButton, type Rec } from "./resultsComponents";

interface RecommendationsSession {
  recommendations?: Rec[] | null;
}

interface RecommendationsSectionProps {
  anonymousWorkMode: WorkPreference | null;
  confirmSector: { isPending: boolean };
  effectiveSession?: RecommendationsSession | null | undefined;
  handleConfirm: (sectorId: number) => void;
  prefersReduced: boolean;
  session?: RecommendationsSession | null | undefined;
  t: TFunction;
  user: unknown;
  workPreference: WorkPreference | null;
}

export function RecommendationsSection({
  anonymousWorkMode,
  confirmSector,
  effectiveSession,
  handleConfirm,
  prefersReduced,
  session,
  t,
  user,
  workPreference,
}: RecommendationsSectionProps) {
        const recs = (effectiveSession?.recommendations ?? session?.recommendations ?? []) as Rec[];
        const hero = recs[0];
        const secondary = recs.slice(1, 3);
        const currentWorkMode = user ? workPreference : anonymousWorkMode;
        if (!hero) return null;
        const heroAlignment = getWorkModeAlignment(currentWorkMode, hero.sector?.workMode ?? null);
        return (
          <>
            <div className="mb-10">
              <AnimateOnScroll>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                  {t("results.yourSectors")} - {recs.length} {t("results.sectorCount", { count: recs.length }).replace(/\d+/, "").trim()}
                </div>
              </AnimateOnScroll>

              {/* Hero card */}
              <motion.div
                initial={prefersReduced ? {} : { opacity: 0, y: 24 }}
                animate={prefersReduced ? {} : { opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-3xl border-2 border-primary bg-card overflow-hidden shadow-lg mb-4"
              >
                <div className="bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider text-center py-2">
                  {t("results.matchScore", { score: hero.matchScore })} - {t("results.topMatch", { defaultValue: "Miglior corrispondenza" })}
                </div>
                <div className="p-6 md:p-8">
                  <div className="flex flex-col md:flex-row md:items-start gap-6">
                    {/* Left: icon + meta */}
                    <div className="flex-1">
                      <div className="flex items-start gap-4 mb-4">
                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                          <SectorIcon name={hero.sector?.icon} size={30} />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground">
                              {hero.sector?.name}
                            </h2>
                            <SectorBookmarkButton sectorId={hero.sectorId} />
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {/* Animated match score badge */}
                            <motion.span
                              initial={prefersReduced ? {} : { scale: 0.7, opacity: 0 }}
                              animate={prefersReduced ? {} : { scale: 1, opacity: 1 }}
                              transition={{ delay: 0.3, type: "spring", stiffness: 300, damping: 22 }}
                              className="inline-flex items-center gap-1 text-sm font-bold bg-primary text-primary-foreground rounded-full px-3 py-1"
                            >
                              <Star className="w-3.5 h-3.5" /> {hero.matchScore}% Match
                            </motion.span>
                            {hero.sector?.workMode && hero.sector.workMode.length > 0 && (
                              <WorkModeBadge modes={hero.sector.workMode} size="xs" />
                            )}
                            {currentWorkMode && currentWorkMode !== "unknown" && heroAlignment.tooltipKey && (
                              <span className={cn(
                                "inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border",
                                heroAlignment.type === "aligned" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                heroAlignment.type === "partial" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                "bg-rose-500/10 text-rose-400 border-rose-500/20"
                              )}>
                                <span className="inline-block w-1.5 h-1.5 rounded-full mr-0.5" style={{
                                  backgroundColor: heroAlignment.type === "aligned" ? "hsl(var(--chart-2))" : heroAlignment.type === "partial" ? "hsl(var(--chart-1))" : "hsl(var(--chart-5))"
                                }} />
                                {heroAlignment.type === "aligned" ? t("results.alignment.aligned") :
                                 heroAlignment.type === "partial" ? t("results.alignment.partial") :
                                 t("results.alignment.misaligned")}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <p className="text-muted-foreground text-sm md:text-base leading-relaxed mb-4">
                        {hero.sector?.description}
                      </p>

                      <div className="bg-muted rounded-xl p-4 flex items-start gap-3 mb-4">
                        <CheckCircle2 className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <p className="text-sm text-foreground">{hero.matchReason}</p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="bg-muted/50 rounded-xl p-3">
                          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <DollarSign className="w-3.5 h-3.5" /> {t("sector.annualSalary")}
                          </div>
                          <div className="font-semibold text-sm">EUR{(hero.sector?.avgSalaryMin ?? 0) / 1000}k-EUR{(hero.sector?.avgSalaryMax ?? 0) / 1000}k</div>
                        </div>
                        <div className="bg-muted/50 rounded-xl p-3">
                          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5" /> {t("common.growth")}
                          </div>
                          <div className="font-semibold text-sm text-emerald-400">+{hero.sector?.growthRate ?? 0}%</div>
                        </div>
                        <div className="bg-muted/50 rounded-xl p-3">
                          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <Activity className="w-3.5 h-3.5" /> {t("common.trend")}
                          </div>
                          <div className="font-semibold text-sm capitalize">
                            {t(`results.trend.${hero.sector?.trend}`, { defaultValue: hero.sector?.trend ?? "" })}
                          </div>
                        </div>
                        <div className="bg-muted/50 rounded-xl p-3">
                          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <Bot className="w-3.5 h-3.5" /> {t("sector.automationRisk")}
                          </div>
                          <div className="font-semibold text-sm capitalize">
                            {t(`results.risk.${hero.sector?.automationRisk}`, { defaultValue: hero.sector?.automationRisk ?? "" })}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right: CTAs */}
                    <div className="flex flex-row md:flex-col gap-3 md:w-52 shrink-0">
                      <Button asChild className="flex-1 md:flex-none rounded-2xl h-11">
                        <Link href={`/settore/${hero.sectorId}`}>
                          <ArrowRight className="w-4 h-4 mr-2" /> {t("home.personalized.fullDetail")}
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1 md:flex-none rounded-2xl h-11"
                        onClick={() => handleConfirm(hero.sectorId)}
                        disabled={confirmSector.isPending}
                      >
                        {user ? t("results.confirmSector") : t("results.confirmSectorDesc")}
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Sezione 3: Altre direzioni */}
              {secondary.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-3 mt-8">
                    {t("results.otherDirections", { defaultValue: "Altre direzioni" })}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {secondary.map((rec, index) => {
                      const alignment = getWorkModeAlignment(currentWorkMode, rec.sector?.workMode ?? null);
                      return (
                        <motion.div
                          key={rec.sectorId}
                          initial={prefersReduced ? {} : { opacity: 0, y: 20 }}
                          animate={prefersReduced ? {} : { opacity: 1, y: 0 }}
                          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1], delay: 0.15 + index * 0.1 }}
                          {...(prefersReduced ? {} : { whileHover: { y: -3 } })}
                        >
                          <Card className="flex flex-col border border-border hover:border-primary/30 transition-colors">
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between gap-3 mb-3">
                                <div className="w-11 h-11 rounded-xl bg-muted flex items-center justify-center text-muted-foreground">
                                  <SectorIcon name={rec.sector?.icon} size={22} />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Badge variant="secondary" className="font-mono text-xs">
                                    {rec.matchScore}% Match
                                  </Badge>
                                  <SectorBookmarkButton sectorId={rec.sectorId} />
                                </div>
                              </div>
                              <CardTitle className="text-lg font-serif">{rec.sector?.name}</CardTitle>
                              <CardDescription className="text-xs line-clamp-2 mt-1">
                                {rec.sector?.description}
                              </CardDescription>
                              {currentWorkMode && currentWorkMode !== "unknown" && alignment.tooltipKey && (
                                <div className={cn(
                                  "mt-2 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border w-fit",
                                  alignment.type === "aligned" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                  alignment.type === "partial" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                  "bg-rose-500/10 text-rose-400 border-rose-500/20"
                                )}>
                                  <span className="inline-block w-1.5 h-1.5 rounded-full" style={{
                                    backgroundColor: alignment.type === "aligned" ? "hsl(var(--chart-2))" : alignment.type === "partial" ? "hsl(var(--chart-1))" : "hsl(var(--chart-5))"
                                  }} />
                                  {alignment.type === "aligned" ? t("results.alignment.aligned") :
                                   alignment.type === "partial" ? t("results.alignment.partial") :
                                   t("results.alignment.misaligned")}
                                </div>
                              )}
                            </CardHeader>
                            <CardContent className="pb-3">
                              <div className="flex gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <DollarSign className="w-3 h-3" />
                                  EUR{(rec.sector?.avgSalaryMin ?? 0) / 1000}k-EUR{(rec.sector?.avgSalaryMax ?? 0) / 1000}k
                                </span>
                                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                                  <TrendingUp className="w-3 h-3" /> +{rec.sector?.growthRate ?? 0}%
                                </span>
                              </div>
                            </CardContent>
                            <CardFooter className="pt-0 flex gap-2">
                              <Button asChild variant="outline" size="sm" className="flex-1 rounded-xl">
                                <Link href={`/settore/${rec.sectorId}`}>{t("home.personalized.fullDetail")}</Link>
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="rounded-xl"
                                onClick={() => handleConfirm(rec.sectorId)}
                                disabled={confirmSector.isPending}
                              >
                                {user ? t("results.confirmSector") : t("results.confirmSectorDesc")}
                              </Button>
                            </CardFooter>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Anonymous CTA - salva risultati */}
              {!user && (
                <div className="mt-8 rounded-3xl border border-dashed border-primary/30 bg-primary/3 p-8 text-center animate-in fade-in duration-700">
                  <Sparkles className="w-10 h-10 text-primary mx-auto mb-3 opacity-70" />
                  <h3 className="font-serif text-xl font-bold mb-2">{t("results.aiSection.loginTitle")}</h3>
                  <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
                    {t("results.aiSection.loginBody")}
                  </p>
                  <Button asChild size="lg" className="rounded-full">
                    <Link href="/registra">
                      <ArrowRight className="w-4 h-4 mr-2" /> {t("results.aiSection.loginBtn")}
                    </Link>
                  </Button>
                </div>
              )}

              <QuickCompare recs={recs} />
            </div>
          </>
        );
}

