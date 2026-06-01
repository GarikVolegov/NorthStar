import { AnimateOnScroll, AnimateOnScrollItem } from "@/components/motion";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  Compass,
  Heart,
  MapPin,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";

export function GuestNarrativeHero() {
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

export function GuestOrientationSections() {
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

export function GuestMethodSection() {
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
