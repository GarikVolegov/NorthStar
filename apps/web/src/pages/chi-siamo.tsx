import { AnimateOnScroll, AnimateOnScrollItem } from "@/components/motion";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Compass,
  Heart,
  Lightbulb,
  Newspaper,
  Sparkles,
  Target
} from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";

function useSeo(title: string, description: string) {
  useEffect(() => {
    document.title = title;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      (meta as HTMLMetaElement).name = "description";
      document.head.appendChild(meta);
    }
    (meta as HTMLMetaElement).content = description;

    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (!ogTitle) { ogTitle = document.createElement("meta"); (ogTitle as HTMLMetaElement).setAttribute("property", "og:title"); document.head.appendChild(ogTitle); }
    (ogTitle as HTMLMetaElement).content = title;

    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (!ogDesc) { ogDesc = document.createElement("meta"); (ogDesc as HTMLMetaElement).setAttribute("property", "og:description"); document.head.appendChild(ogDesc); }
    (ogDesc as HTMLMetaElement).content = description;
  }, [title, description]);
}

function useJsonLd(data: object) {
  useEffect(() => {
    const existing = document.getElementById("json-ld-page");
    if (existing) existing.remove();
    const script = document.createElement("script");
    script.id = "json-ld-page";
    script.type = "application/ld+json";
    script.text = JSON.stringify(data);
    document.head.appendChild(script);
    return () => { script.remove(); };
  }, []);
}

const VALUE_ICONS = [Target, Heart, Lightbulb, BarChart3, BookOpen, Sparkles];
const METHOD_STEP_NUMBERS = ["01", "02", "03", "04"];

export default function ChiSiamo() {
  useSeo(
    "Chi siamo — NorthStar, la piattaforma di orientamento e crescita personale",
    "NorthStar è una bussola digitale per il tuo futuro. Scopri chi siamo, la nostra missione e il metodo che unisce test di personalità, dati reali e strumenti di crescita personale."
  );
  useJsonLd({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "NorthStar",
        url: "https://northstar.app",
        description: "Piattaforma SaaS di orientamento e crescita personale che unisce test di personalità, analisi di settori e strumenti di pianificazione della carriera.",
        foundingDate: "2024",
        knowsAbout: ["orientamento scolastico e professionale", "test di personalità RIASEC", "crescita personale", "carriera e lavoro"],
      },
      {
        "@type": "SoftwareApplication",
        name: "NorthStar",
        applicationCategory: "EducationalApplication",
        operatingSystem: "Web",
        offers: [
          { "@type": "Offer", price: "0", priceCurrency: "EUR", name: "Piano Free" },
          { "@type": "Offer", price: "9.99", priceCurrency: "EUR", name: "Piano Premium" },
        ],
      },
    ],
  });

  const { t } = useTranslation();

  const valuesText = t("chiSiamo.values", { returnObjects: true }) as Array<{ title: string; desc: string }>;
  const VALUES = VALUE_ICONS.map((icon, i) => ({ icon, ...(valuesText[i] || {}) }));

  const methodStepsText = t("chiSiamo.methodSteps", { returnObjects: true }) as Array<{ title: string; desc: string }>;
  const METHOD_STEPS = METHOD_STEP_NUMBERS.map((n, i) => ({ n, ...(methodStepsText[i] || {}) }));

  const whatWeDoFeatures = t("chiSiamo.whatWeDoFeatures", { returnObjects: true }) as Array<{ label: string; desc: string }>;
  const WHAT_WE_DO_ICONS = [Target, BarChart3, Newspaper, BookOpen];

  const whoWeServeItems = t("chiSiamo.whoWeServeItems", { returnObjects: true }) as string[];

  return (
    <div className="min-h-screen">

      {/* Hero */}
      <section className="border-b bg-gradient-to-b from-primary/5 to-background py-20 md:py-28">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <Compass className="w-4 h-4" />
            {t("chiSiamo.badge", { defaultValue: "La nostra storia" })}
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground leading-tight mb-6">
            {t("chiSiamo.title")}
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-8">
            {t("chiSiamo.subtitle")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild className="rounded-full px-6">
              <Link href="/test">{t("home.startTest")} <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full px-6">
              <Link href="/premium">{t("chiSiamo.explorePremium", { defaultValue: "Esplora il Premium" })}</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-4xl py-16 space-y-20">

        {/* Cosa facciamo */}
        <AnimateOnScroll>
        <section>
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-6">{t("chiSiamo.whatWeDo")}</h2>
          <p className="text-lg text-muted-foreground leading-relaxed mb-6">
            {t("chiSiamo.whatWeDoCombines", { defaultValue: "NorthStar combina test di personalità, analisi dei settori professionali, news aggiornate e strumenti di organizzazione personale in un unico spazio chiaro, utile e facile da usare." })}
          </p>
          <AnimateOnScroll stagger>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {whatWeDoFeatures.map(({ label, desc }, i) => {
              const Icon = WHAT_WE_DO_ICONS[i] ?? Target;
              return (
              <AnimateOnScrollItem key={label}>
              <div className="flex gap-4 p-5 rounded-2xl border bg-card h-full">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground mb-1">{label}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
              </AnimateOnScrollItem>
              );
            })}
          </div>
          </AnimateOnScroll>
        </section>
        </AnimateOnScroll>

        {/* Perché esistiamo */}
        <AnimateOnScroll>
        <section>
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-6">{t("chiSiamo.whyWeExist")}</h2>
          <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 md:p-10">
            <p className="text-lg text-foreground leading-relaxed mb-4">
              {t("chiSiamo.whyWeExistP1")}
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed mb-4">
              {t("chiSiamo.whyWeExistP2")}
            </p>
            <p className="text-lg text-foreground leading-relaxed font-medium">
              {t("chiSiamo.whyWeExistP3")}
            </p>
          </div>
        </section>
        </AnimateOnScroll>

        {/* Il nostro metodo */}
        <section>
          <AnimateOnScroll>
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-8">{t("chiSiamo.ourMethod")}</h2>
          </AnimateOnScroll>
          <AnimateOnScroll stagger>
          <div className="space-y-6">
            {METHOD_STEPS.map((step) => (
              <AnimateOnScrollItem key={step.n}>
              <div className="flex gap-5 items-start">
                <div className="w-12 h-12 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm shrink-0">
                  {step.n}
                </div>
                <div className="pt-1">
                  <p className="font-semibold text-foreground mb-1.5">{step.title}</p>
                  <p className="text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </div>
              </AnimateOnScrollItem>
            ))}
          </div>
          </AnimateOnScroll>
        </section>

        {/* A chi ci rivolgiamo */}
        <AnimateOnScroll>
        <section>
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-6">{t("chiSiamo.whoWeServe")}</h2>
          <p className="text-lg text-muted-foreground leading-relaxed mb-6">
            {t("chiSiamo.whoWeServeIntro")}
          </p>
          <AnimateOnScroll stagger>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {whoWeServeItems.map((item, i) => (
              <AnimateOnScrollItem key={i}>
              <div className="flex items-start gap-3 p-4 rounded-xl border bg-card h-full">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-sm text-foreground leading-snug">{item}</p>
              </div>
              </AnimateOnScrollItem>
            ))}
          </div>
          </AnimateOnScroll>
        </section>
        </AnimateOnScroll>

        {/* I nostri valori */}
        <section>
          <AnimateOnScroll>
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-8">{t("chiSiamo.ourValues")}</h2>
          </AnimateOnScroll>
          <AnimateOnScroll stagger>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {VALUES.map(({ icon: Icon, title, desc }) => (
              <AnimateOnScrollItem key={title}>
              <div className="p-5 rounded-2xl border bg-card hover:shadow-md transition-shadow h-full">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </div>
              </AnimateOnScrollItem>
            ))}
          </div>
          </AnimateOnScroll>
        </section>

        {/* CTA */}
        <AnimateOnScroll>
        <section className="bg-primary/5 border border-primary/20 rounded-3xl p-10 text-center">
          <h2 className="text-2xl font-serif font-bold text-foreground mb-3">
            {t("chiSiamo.ctaTitle")}
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            {t("chiSiamo.ctaDesc")}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild className="rounded-full px-8">
              <Link href="/test">{t("home.startTest")} <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full px-6">
              <Link href="/news">{t("chiSiamo.readNews", { defaultValue: "Leggi le news" })}</Link>
            </Button>
          </div>
        </section>
        </AnimateOnScroll>

      </div>
    </div>
  );
}
