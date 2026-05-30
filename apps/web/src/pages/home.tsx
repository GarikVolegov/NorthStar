import { AppLogo } from "@/components/brand/AppLogo";
import { ProssimiEventi } from "@/components/calendario/ProssimiEventi";
import { AnimateOnScroll, AnimateOnScrollItem } from "@/components/motion";
import { OnboardingWizard } from "@/components/OnboardingWizard";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useWendy } from "@/contexts/WendyProvider";
import { AnimatedNumber } from "@/features/home/AnimatedNumber";
import { GuestPersonaHero } from "@/features/home/GuestPersonaHero";
import { HomeNewsCard } from "@/features/home/HomeNewsCard";
import { LoggedInHero } from "@/features/home/LoggedInHero";
import { PersonalizedRecommendationsSection } from "@/features/home/PersonalizedRecommendationsSection";
import { QuickToolsSection } from "@/features/home/QuickToolsSection";
import { TrendingMobileStrip } from "@/features/home/TrendingMobileStrip";
import { ONBOARDING_KEY } from "@/features/home/homeConstants";
import { useHomeNews, useLatestRecommendations, useTrendingSectors } from "@/features/home/homeApi";
import type { Persona } from "@/features/home/homeTypes";
import { usePageMeta } from "@/lib/seo";
import { useGetStatsSummary } from "@workspace/api-client-react";
import { AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  Building2,
  CheckCircle2,
  Compass,
  HelpCircle,
  Heart,
  MapPin,
  Newspaper,
  Rocket,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";

function GuestNarrativeHero() {
  const { t } = useTranslation();

  return (
    <section
      data-testid="guest-narrative-hero"
      className="relative isolate min-h-[calc(100dvh-6rem)] overflow-hidden border-b border-border bg-background"
    >
      <div
        className="absolute inset-0 -z-20 bg-cover bg-center"
        style={{ backgroundImage: "url('/hero.png')" }}
        aria-hidden
      />
      <div className="absolute inset-0 -z-10 bg-background/82" aria-hidden />
      <div className="container mx-auto flex min-h-[calc(100dvh-6rem)] max-w-6xl items-center px-4 py-20 md:px-6 md:py-28">
        <div className="max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-background/70 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wide text-primary backdrop-blur">
            <Compass className="h-3.5 w-3.5" />
            {t("home.narrative.badge", { defaultValue: "Bussola professionale" })}
          </div>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight text-foreground sm:text-5xl md:text-6xl">
            {t("home.narrative.title", {
              defaultValue:
                "NorthStar e la bussola per capire quale direzione professionale ha senso per te.",
            })}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            {t("home.narrative.subtitle", {
              defaultValue:
                "Prima di scegliere tra corsi, lavori, settori o strumenti AI, NorthStar ti aiuta a leggere chi sei, cosa chiede il mercato e quale percorso puo diventare concreto.",
            })}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/test" className="w-full sm:w-auto">
              <div className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90">
                {t("home.startTest")}
                <ArrowRight className="h-4 w-4" />
              </div>
            </Link>
            <a
              href="#cos-e-northstar"
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-border bg-card/70 px-7 py-3 text-sm font-semibold text-foreground backdrop-blur transition-colors hover:bg-card sm:w-auto"
            >
              {t("home.narrative.discover", { defaultValue: "Capisci come funziona" })}
              <MapPin className="h-4 w-4" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function GuestOrientationSections() {
  const { t } = useTranslation();
  const pillars = [
    {
      icon: Zap,
      title: t("home.narrative.what.test.title", { defaultValue: "Parti da chi sei" }),
      desc: t("home.narrative.what.test.desc", {
        defaultValue:
          "Il test combina interessi professionali e Bussola Interiore per darti un primo profilo leggibile.",
      }),
    },
    {
      icon: BarChart3,
      title: t("home.narrative.what.market.title", { defaultValue: "Guarda il mercato reale" }),
      desc: t("home.narrative.what.market.desc", {
        defaultValue:
          "Settori, salari, crescita e rischio automazione aiutano a distinguere desiderio e opportunita.",
      }),
    },
    {
      icon: Bot,
      title: t("home.narrative.what.wendy.title", { defaultValue: "Chiedi a Wendy" }),
      desc: t("home.narrative.what.wendy.desc", {
        defaultValue:
          "L'assistente AI ti aiuta a interpretare risultati, dubbi e prossimi passi senza partire da una schermata vuota.",
      }),
    },
  ];
  const values = [
    {
      icon: Target,
      title: t("chiSiamo.values.0.title", { defaultValue: "Chiarezza" }),
      desc: t("chiSiamo.values.0.desc", {
        defaultValue: "Trasformiamo il disorientamento in direzione concreta.",
      }),
    },
    {
      icon: Heart,
      title: t("chiSiamo.values.1.title", { defaultValue: "Empatia" }),
      desc: t("chiSiamo.values.1.desc", {
        defaultValue: "Ogni persona ha un percorso unico: lo rispettiamo e lo accompagniamo.",
      }),
    },
    {
      icon: BookOpen,
      title: t("chiSiamo.values.3.title", { defaultValue: "Dati reali" }),
      desc: t("chiSiamo.values.3.desc", {
        defaultValue: "Usiamo dati aggiornati per orientare le scelte nel mercato.",
      }),
    },
  ];

  return (
    <>
      <section id="cos-e-northstar" className="border-b border-border py-14 md:py-20">
        <div className="container mx-auto max-w-6xl px-4 md:px-6">
          <div className="mb-8 max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              {t("home.narrative.what.badge", { defaultValue: "Cos'e NorthStar" })}
            </div>
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">
              {t("home.narrative.what.title", {
                defaultValue: "Non iniziare da mille opzioni. Inizia da una lettura chiara.",
              })}
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
              {t("home.narrative.what.subtitle", {
                defaultValue:
                  "NorthStar unisce orientamento personale, dati di mercato e strumenti di crescita in un percorso unico: prima capisci, poi scegli.",
              })}
            </p>
          </div>

          <AnimateOnScroll stagger className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {pillars.map(({ icon: Icon, title, desc }) => (
              <AnimateOnScrollItem key={title}>
                <div className="h-full rounded-lg border border-border bg-card p-5">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-bold text-foreground">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                </div>
              </AnimateOnScrollItem>
            ))}
          </AnimateOnScroll>
        </div>
      </section>

      <section id="chi-siamo" className="scroll-mt-24 border-b border-border py-14 md:py-20">
        <div className="container mx-auto grid max-w-6xl gap-10 px-4 md:grid-cols-[0.9fr_1.1fr] md:px-6">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
              <Compass className="h-3.5 w-3.5" />
              {t("chiSiamo.badge", { defaultValue: "La nostra storia" })}
            </div>
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">
              {t("chiSiamo.whyWeExist", { defaultValue: "Perche esistiamo" })}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {t("chiSiamo.whyWeExistP1")}
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {t("chiSiamo.whyWeExistP3")}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {values.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-lg border border-border bg-card p-5">
                <Icon className="mb-4 h-5 w-5 text-primary" />
                <h3 className="font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function GuestMethodSection() {
  const { t } = useTranslation();
  const steps = [
    {
      step: "01",
      icon: Zap,
      title: t("chiSiamo.methodSteps.0.title", { defaultValue: "Test RIASEC + Bussola Interiore" }),
      desc: t("chiSiamo.methodSteps.0.desc", {
        defaultValue:
          "Scopri interessi, motivazioni e modo di lavorare con un test breve e guidato.",
      }),
    },
    {
      step: "02",
      icon: Target,
      title: t("chiSiamo.methodSteps.1.title", { defaultValue: "Matching con i settori" }),
      desc: t("chiSiamo.methodSteps.1.desc", {
        defaultValue:
          "Il profilo viene collegato a settori, ruoli e opportunita compatibili.",
      }),
    },
    {
      step: "03",
      icon: TrendingUp,
      title: t("chiSiamo.methodSteps.2.title", { defaultValue: "Esplorazione con dati reali" }),
      desc: t("chiSiamo.methodSteps.2.desc", {
        defaultValue:
          "Ogni scelta viene letta con crescita, salari, competenze e segnali di mercato.",
      }),
    },
    {
      step: "04",
      icon: Bot,
      title: t("chiSiamo.methodSteps.3.title", { defaultValue: "Percorso e strumenti AI" }),
      desc: t("chiSiamo.methodSteps.3.desc", {
        defaultValue:
          "Wendy, roadmap, obiettivi e contenuti ti aiutano a trasformare la direzione in azione.",
      }),
    },
  ];

  return (
    <section className="border-b border-border py-14 md:py-20">
      <div className="container mx-auto max-w-6xl px-4 md:px-6">
        <div className="mb-8 max-w-3xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
            <MapPin className="h-3.5 w-3.5" />
            {t("home.howItWorks.badge")}
          </div>
          <h2 className="text-3xl font-bold text-foreground md:text-4xl">
            {t("home.howItWorks.subtitle", {
              defaultValue: "Tre semplici passi per capire dove sei, dove vuoi arrivare e come arrivarci.",
            })}
          </h2>
        </div>

        <AnimateOnScroll stagger className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {steps.map(({ step, icon: Icon, title, desc }) => (
            <AnimateOnScrollItem key={step}>
              <div className="h-full rounded-lg border border-border bg-card p-5">
                <div className="mb-5 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-widest text-primary">{step}</span>
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <h3 className="font-bold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            </AnimateOnScrollItem>
          ))}
        </AnimateOnScroll>
      </div>
    </section>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const wendy = useWendy();
  usePageMeta({
    title: t("seo.home.title", {
      defaultValue: "NorthStar - Scopri la tua direzione professionale",
    }),
    description: t("seo.home.description", {
      defaultValue:
        "Una bussola digitale per capire chi sei, leggere il mercato e scegliere un percorso professionale concreto.",
    }),
    path: "/",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "NorthStar",
      url: "https://northstar.app",
      description:
        "Piattaforma di orientamento e crescita personale che unisce test, dati di mercato e strumenti AI.",
      knowsAbout: [
        "orientamento professionale",
        "test RIASEC",
        "crescita personale",
        "carriera",
      ],
    },
  });
  const personas: Persona[] = [
    {
      id: "indeciso",
      icon: HelpCircle,
      label: t("home.personas.indeciso.label"),
      tagline: t("home.personas.indeciso.tagline"),
      ctaLabel: t("home.personas.indeciso.ctaLabel"),
      ctaHref: "/test",
      tools: [
        t("home.personas.indeciso.tools.0"),
        t("home.personas.indeciso.tools.1"),
        t("home.personas.indeciso.tools.2"),
      ],
      accentClass: "text-primary",
      borderClass: "hover:border-primary/50",
    },
    {
      id: "dipendente",
      icon: TrendingUp,
      label: t("home.personas.dipendente.label"),
      tagline: t("home.personas.dipendente.tagline"),
      ctaLabel: t("home.personas.dipendente.ctaLabel"),
      ctaHref: "/test",
      tools: [
        t("home.personas.dipendente.tools.0"),
        t("home.personas.dipendente.tools.1"),
        t("home.personas.dipendente.tools.2"),
      ],
      accentClass: "text-growth",
      borderClass: "hover:border-growth/50",
    },
    {
      id: "autonomo",
      icon: Rocket,
      label: t("home.personas.autonomo.label"),
      tagline: t("home.personas.autonomo.tagline"),
      ctaLabel: t("home.personas.autonomo.ctaLabel"),
      ctaHref: "#wendy",
      tools: [
        t("home.personas.autonomo.tools.0"),
        t("home.personas.autonomo.tools.1"),
        t("home.personas.autonomo.tools.2"),
      ],
      accentClass: "text-primary",
      borderClass: "hover:border-primary/50",
    },
    {
      id: "azienda",
      icon: Building2,
      label: t("home.personas.azienda.label"),
      tagline: t("home.personas.azienda.tagline"),
      ctaLabel: t("home.personas.azienda.ctaLabel"),
      ctaHref: "/settori",
      tools: [
        t("home.personas.azienda.tools.0"),
        t("home.personas.azienda.tools.1"),
        t("home.personas.azienda.tools.2"),
      ],
      accentClass: "text-growth",
      borderClass: "hover:border-growth/50",
    },
    {
      id: "investitore",
      icon: BarChart3,
      label: t("home.personas.investitore.label"),
      tagline: t("home.personas.investitore.tagline"),
      ctaLabel: t("home.personas.investitore.ctaLabel"),
      ctaHref: "/settori",
      tools: [
        t("home.personas.investitore.tools.0"),
        t("home.personas.investitore.tools.1"),
        t("home.personas.investitore.tools.2"),
      ],
      accentClass: "text-primary",
      borderClass: "hover:border-primary/50",
    },
  ];
  const { data: stats, isLoading: isStatsLoading } = useGetStatsSummary();
  const { data: trendingData } = useTrendingSectors();
  const { data: newsData, isLoading: isNewsLoading } = useHomeNews();
  const { isLoggedIn, user, updateUser, authReady } = useAuth();
  const [, navigateTo] = useLocation();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { data: latestResult, isLoading: isLatestLoading } =
    useLatestRecommendations(authReady && isLoggedIn && !!user);

  // Utenti registrati vanno direttamente alla dashboard: la home è solo per ospiti
  useEffect(() => {
    if (authReady && isLoggedIn) navigateTo("/dashboard");
  }, [authReady, isLoggedIn, navigateTo]);

  // Show onboarding wizard once per browser after login, if not already completed
  useEffect(() => {
    if (!isLoggedIn || !user || isLatestLoading) return;
    const done = localStorage.getItem(ONBOARDING_KEY);
    if (done) return;
    const t = setTimeout(() => setShowOnboarding(true), 600);
    return () => clearTimeout(t);
  }, [isLoggedIn, user, isLatestLoading]);

  if (authReady && isLoggedIn) return null;

  if (isLoggedIn && user && isLatestLoading) {
    return (
      <div className="flex flex-col w-full">
        <div className="hero-navy py-10 px-4">
          <div className="max-w-5xl mx-auto">
            <Skeleton className="h-8 w-48 mb-3 rounded-xl" />
            <Skeleton className="h-5 w-64 mb-6 rounded-xl" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          </div>
        </div>
        <div className="py-10 container mx-auto px-4 max-w-6xl">
          <Skeleton className="h-6 w-48 mb-4 rounded-xl" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-36 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full">
      {isLoggedIn && user ? (
        <LoggedInHero
          userName={user.name}
          journeyType={user.journeyType}
          latestResult={latestResult ?? null}
        />
      ) : (
        <>
          <GuestNarrativeHero />
          <GuestOrientationSections />
          <GuestMethodSection />
          <GuestPersonaHero
            onLoginClick={() => navigateTo("/sign-in")}
            personas={personas}
            wendy={wendy}
          />
        </>
      )}

      <section className="py-8 md:py-10 border-y border-border">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl">
          <div className="grid grid-cols-3 divide-x divide-border">
            {[
              {
                value: stats?.totalTestsTaken || 12450,
                label: t("home.stats.guided"),
                suffix: "",
              },
              {
                value: stats?.totalSectors || 42,
                label: t("home.stats.sectors"),
                suffix: "",
              },
              {
                value: stats?.avgGrowthRate || 15,
                label: t("home.stats.avgGrowth"),
                suffix: "%",
              },
            ].map(({ value, label, suffix }, i) => (
              <div
                key={i}
                className="flex flex-col items-center text-center px-4 py-2"
              >
                <div className="text-3xl md:text-5xl font-bold text-primary mb-1">
                  {isStatsLoading ? (
                    <Skeleton className="h-9 w-16 rounded-md mx-auto" />
                  ) : (
                    <AnimatedNumber value={value} suffix={suffix} />
                  )}
                </div>
                <p className="text-[10px] md:text-xs font-semibold uppercase tracking-widest text-muted-foreground leading-tight">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <TrendingMobileStrip sectors={trendingData} />

      {isLoggedIn && user && (
        <QuickToolsSection
          journeyType={user.journeyType}
          {...(latestResult?.sessionId !== undefined
            ? { sessionId: latestResult.sessionId }
            : {})}
        />
      )}

      {isLoggedIn && user && (
        <PersonalizedRecommendationsSection userId={user.id} />
      )}

      {isLoggedIn && user && (
        <section className="py-8 border-b border-border">
          <div className="container mx-auto px-4 md:px-6 max-w-6xl">
            <ProssimiEventi userId={user.id} limit={4} />
          </div>
        </section>
      )}

      <section className="py-14 md:py-20 border-t border-border">
        <div className="container mx-auto px-4 md:px-6 max-w-6xl">
          <AnimateOnScroll>
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
              <div>
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide mb-3">
                  <Newspaper className="w-3.5 h-3.5" /> {t("home.news.title")}
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                  {t("home.news.title")}
                </h2>
                <p className="text-muted-foreground mt-2 max-w-xl">
                  {t("home.news.subtitle")}
                </p>
              </div>
              <Link href="/news">
                <div className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:border-white/20 transition-all">
                  {t("home.news.readAll")}{" "}
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            </div>
          </AnimateOnScroll>

          {isNewsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-56 rounded-2xl" />
              ))}
            </div>
          ) : newsData?.news?.length ? (
            <AnimateOnScroll
              stagger
              className="grid grid-cols-1 md:grid-cols-3 gap-6"
            >
              {newsData.news.map((item) => (
                <AnimateOnScrollItem key={item.id}>
                  <HomeNewsCard item={item} />
                </AnimateOnScrollItem>
              ))}
            </AnimateOnScroll>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Newspaper className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground text-sm">
                {t("home.news.empty")}
              </p>
              <Link href="/news">
                <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:gap-2 transition-all">
                  {t("home.news.readAll")}{" "}
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            </div>
          )}
        </div>
      </section>

      {!isLoggedIn && (
        <section className="py-16 md:py-24 border-t border-border">
          <div className="max-w-5xl mx-auto px-4">
            <AnimateOnScroll>
              <div className="rounded-3xl overflow-hidden border border-border bg-card">
                <div className="hero-navy px-8 py-10 text-center">
                  <div className="w-16 h-16 rounded-full border-2 border-white/15 bg-white/8 flex items-center justify-center overflow-hidden mx-auto mb-5">
                    <AppLogo alt="NorthStar" className="h-full w-full" />
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
                    Pronto a trovare{" "}
                    <span className="text-italic-serif text-primary">
                      la tua strada?
                    </span>
                  </h2>
                  <p className="text-white/60 mb-8 max-w-xl mx-auto">
                    Il test è gratuito, nessuna carta di credito richiesta.
                    Ottieni la tua analisi in 5 minuti.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Link href="/test" className="w-full sm:w-auto">
                      <div className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold text-sm rounded-full px-8 py-3.5 hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/20">
                        {t("home.startTest")} <ArrowRight className="w-4 h-4" />
                      </div>
                    </Link>
                    <Link href="/percorso" className="w-full sm:w-auto">
                      <div className="w-full flex items-center justify-center gap-2 border border-white/20 text-white font-semibold text-sm rounded-full px-8 py-3.5 hover:border-white/30 hover:bg-white/8 transition-all">
                        <MapPin className="w-4 h-4" />
                        Scegli il tuo percorso
                      </div>
                    </Link>
                  </div>
                </div>
                <div className="px-8 py-4 flex flex-wrap items-center justify-center gap-4 border-t border-border">
                  {[
                    { icon: CheckCircle2, text: "Test gratuito" },
                    {
                      icon: CheckCircle2,
                      text: "Nessuna registrazione obbligatoria",
                    },
                    { icon: CheckCircle2, text: "Risultati immediati" },
                  ].map(({ icon: Icon, text }) => (
                    <div
                      key={text}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground"
                    >
                      <Icon className="w-4 h-4 text-primary" /> {text}
                    </div>
                  ))}
                </div>
              </div>
            </AnimateOnScroll>
          </div>
        </section>
      )}


      <AnimatePresence>
        {showOnboarding && isLoggedIn && user && (
          <OnboardingWizard
            userId={user.id}
            userName={user.name}
            {...(user.journeyType !== undefined
              ? { currentJourneyType: user.journeyType }
              : {})}
            {...(latestResult?.sessionId !== undefined
              ? { sessionId: latestResult.sessionId }
              : {})}
            topSectorName={
              latestResult?.recommendations?.[0]?.sectorName ?? null
            }
            onClose={() => {
              setShowOnboarding(false);
              localStorage.setItem(ONBOARDING_KEY, "1");
            }}
            onComplete={(journeyType) => {
              setShowOnboarding(false);
              localStorage.setItem(ONBOARDING_KEY, "1");
              updateUser({ journeyType });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
