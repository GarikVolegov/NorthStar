import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { getJson, postJson } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Brain, CheckCircle2, Loader2, Network, Sparkles, Zap } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";

type BillingInterval = "month" | "year";

// Specchio del catalogo restituito da GET /api/subscription/plans.
interface PlanOption {
  plan: "pro" | "team";
  interval: "monthly" | "yearly";
  priceId: string | null;
  amountEur: number;
}

interface PlansResponse {
  plans: PlanOption[];
}

const TOGGLE_TO_API: Record<BillingInterval, PlanOption["interval"]> = {
  month: "monthly",
  year: "yearly",
};

export default function Premium() {
  const { t } = useTranslation();
  const { isLoggedIn } = useAuth();
  const { isPro, isTeam } = useSubscription();
  const [, navigate] = useLocation();
  const [billing, setBilling] = useState<BillingInterval>("month");
  const [error, setError] = useState<string | null>(null);
  const [pendingPlan, setPendingPlan] = useState<"pro" | "team" | null>(null);

  const features = [
    { icon: <Brain className="w-5 h-5 text-primary" />, title: t("premium.features.wiki.title"), description: t("premium.features.wiki.desc") },
    { icon: <Network className="w-5 h-5 text-primary" />, title: t("premium.features.graph.title"), description: t("premium.features.graph.desc") },
    { icon: <Zap className="w-5 h-5 text-primary" />, title: t("premium.features.roadmap.title"), description: t("premium.features.roadmap.desc") },
    { icon: <Sparkles className="w-5 h-5 text-primary" />, title: t("premium.features.updates.title"), description: t("premium.features.updates.desc") },
  ];

  const includesList = [
    t("premium.includes.wiki"),
    t("premium.includes.graph"),
    t("premium.includes.roadmap"),
    t("premium.includes.liveData"),
    t("premium.includes.support"),
    t("premium.includes.goals"),
  ];

  const teamExtras = [
    "Tutto del piano Pro, per ogni membro",
    "Workspace condivisi e collaborazione",
    "Mentor mode e dashboard del team",
    "Export dei dati in CSV",
    "Onboarding prioritario",
  ];

  const { data: plansData, isLoading: plansLoading } = useQuery<PlansResponse>({
    queryKey: ["subscription-plans"],
    queryFn: () => getJson<PlansResponse>(API_ENDPOINTS.subscription.plans),
    staleTime: 30 * 60 * 1000,
  });

  const apiInterval = TOGGLE_TO_API[billing];
  const proPlan = plansData?.plans.find(
    (p) => p.plan === "pro" && p.interval === apiInterval,
  );
  const teamPlan = plansData?.plans.find(
    (p) => p.plan === "team" && p.interval === apiInterval,
  );
  const proPrice = proPlan?.amountEur ?? (billing === "month" ? 9 : 90);
  const teamPrice = teamPlan?.amountEur ?? (billing === "month" ? 29 : 290);
  const proPerMonth = billing === "year" ? (proPrice / 12).toFixed(2) : null;
  const teamPerMonth = billing === "year" ? (teamPrice / 12).toFixed(2) : null;

  const upgrade = useMutation({
    mutationFn: async (plan: "pro" | "team") => {
      const res = await postJson<{ url: string }>(API_ENDPOINTS.subscription.upgrade, {
        plan,
        interval: apiInterval,
      });
      return res.url;
    },
    onSuccess: (url) => {
      window.location.href = url;
    },
    onError: (e) => {
      setError(e instanceof Error ? e.message : "Errore nell'avvio del pagamento");
    },
    onSettled: () => setPendingPlan(null),
  });

  function handleUpgrade(plan: "pro" | "team") {
    setError(null);
    if (!isLoggedIn) {
      navigate("/login?redirect=/premium");
      return;
    }
    setPendingPlan(plan);
    upgrade.mutate(plan);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16 md:py-24 max-w-5xl">

        {/* Header */}
        <div className="text-center mb-16 max-w-2xl mx-auto animate-in slide-in-from-bottom-4 fade-in duration-700">
          <Badge variant="outline" className="mb-6 border-primary/20 text-primary bg-primary/5 px-4 py-1 text-sm rounded-full">
            {t("premium.badge")}
          </Badge>
          <h1 className="text-4xl md:text-5xl font-serif font-bold mb-6 text-foreground">
            {t("premium.title")}
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            {t("premium.subtitle")}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 gap-6 mb-16">
          {features.map((f, i) => (
            <div key={i} className="flex gap-4 p-6 bg-card border rounded-2xl hover:shadow-md transition-shadow duration-200">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                {f.icon}
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            </div>
          ))}
        </div>

        <Separator className="mb-12" />

        {/* Billing Toggle */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center bg-muted rounded-full p-1 gap-1">
            <button
              onClick={() => setBilling("month")}
              className={cn(
                "px-6 py-2 rounded-full text-sm font-medium transition-all duration-200",
                billing === "month" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("premium.monthly")}
            </button>
            <button
              onClick={() => setBilling("year")}
              className={cn(
                "px-6 py-2 rounded-full text-sm font-medium transition-all duration-200 flex items-center gap-2",
                billing === "year" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t("premium.yearly")}
              <Badge variant="secondary" className="text-xs py-0 px-2 bg-emerald-100 text-emerald-700 border-0">
                -17%
              </Badge>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto items-start">

          {/* Pro */}
          <Card className="border-2 border-primary rounded-3xl shadow-xl overflow-hidden">
            <div className="bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider text-center py-2">
              {t("premium.mostPopular")}
            </div>

            <CardHeader className="text-center pb-4 pt-8">
              <CardTitle className="text-2xl font-serif">{t("premium.planName")}</CardTitle>
              <CardDescription>{t("premium.planAccess")}</CardDescription>
            </CardHeader>

            <CardContent className="text-center pb-6">
              <div className="mb-6">
                <div className="text-5xl font-bold text-foreground mb-1">
                  €{proPrice}
                  <span className="text-lg font-normal text-muted-foreground">
                    {billing === "month" ? t("premium.perMonth") : t("premium.perYear")}
                  </span>
                </div>
                {proPerMonth && (
                  <p className="text-sm text-emerald-600 font-medium mt-1">
                    {t("premium.savingsMsg", { price: proPerMonth })}
                  </p>
                )}
              </div>

              <ul className="space-y-3 text-left mb-8">
                {includesList.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {isPro ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-emerald-800">{t("premium.joinedTitle")}</p>
                  <p className="text-xs text-emerald-700 mt-1">{t("premium.planAccess")}</p>
                </div>
              ) : (
                <Button
                  type="button"
                  onClick={() => handleUpgrade("pro")}
                  disabled={upgrade.isPending || plansLoading}
                  className="w-full rounded-xl h-11"
                >
                  {pendingPlan === "pro" ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {t("premium.exploreNow")}</>
                  ) : (
                    <><Zap className="w-4 h-4 mr-2" /> {t("premium.planName")} · €{proPrice}</>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Team */}
          <Card className="border rounded-3xl shadow-sm overflow-hidden">
            <div className="bg-muted text-muted-foreground text-xs font-bold uppercase tracking-wider text-center py-2">
              Per team e mentori
            </div>

            <CardHeader className="text-center pb-4 pt-8">
              <CardTitle className="text-2xl font-serif">Team</CardTitle>
              <CardDescription>Collaborazione, mentoring e dashboard condivisa</CardDescription>
            </CardHeader>

            <CardContent className="text-center pb-6">
              <div className="mb-6">
                <div className="text-5xl font-bold text-foreground mb-1">
                  €{teamPrice}
                  <span className="text-lg font-normal text-muted-foreground">
                    {billing === "month" ? t("premium.perMonth") : t("premium.perYear")}
                  </span>
                </div>
                {teamPerMonth && (
                  <p className="text-sm text-emerald-600 font-medium mt-1">
                    {t("premium.savingsMsg", { price: teamPerMonth })}
                  </p>
                )}
              </div>

              <ul className="space-y-3 text-left mb-8">
                {teamExtras.map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {isTeam ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 text-center">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-emerald-800">{t("premium.joinedTitle")}</p>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleUpgrade("team")}
                  disabled={upgrade.isPending || plansLoading}
                  className="w-full rounded-xl h-11"
                >
                  {pendingPlan === "team" ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Avvio…</>
                  ) : (
                    <><Network className="w-4 h-4 mr-2" /> Team · €{teamPrice}</>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>

        </div>

        {error && <p className="text-xs text-destructive mt-4 text-center">{error}</p>}
        <p className="text-xs text-muted-foreground text-center mt-6">
          {t("premium.guarantee")} · {t("premium.cancelAnytime")}
        </p>

        {/* Trust signals */}
        <div className="mt-16 grid md:grid-cols-3 gap-6 text-center">
          {[
            { title: "Sicuro al 100%", body: "Pagamento gestito tramite Stripe, lo standard di settore per i pagamenti online." },
            { title: t("premium.cancelAnytime"), body: "Nessun vincolo. Puoi disdire l'abbonamento in qualsiasi momento dal tuo profilo." },
            { title: "Supporto dedicato", body: "I membri Premium hanno accesso prioritario al nostro team di supporto." },
          ].map((item) => (
            <div key={item.title} className="p-6 bg-card border rounded-2xl">
              <h4 className="font-semibold text-foreground mb-2 text-sm">{item.title}</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
