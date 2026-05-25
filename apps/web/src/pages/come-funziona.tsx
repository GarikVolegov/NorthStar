import { AnimateOnScroll, AnimateOnScrollItem } from "@/components/motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Brain,
  CheckCircle2,
  Compass,
  HelpCircle,
  MapPin,
  Shield,
  Sparkles,
  Users
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
  }, [title, description]);
}

const STEP_META = [
  { number: "01", icon: Users, color: "bg-primary/10 text-primary" },
  { number: "02", icon: Compass, color: "bg-violet-500/10 text-violet-700" },
  { number: "03", icon: MapPin, color: "bg-emerald-500/10 text-emerald-700" },
];

const RIASEC_META = [
  { letter: "R", color: "bg-orange-100 text-orange-800 border-orange-200" },
  { letter: "I", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { letter: "A", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { letter: "S", color: "bg-green-100 text-green-800 border-green-200" },
  { letter: "E", color: "bg-red-100 text-red-800 border-red-200" },
  { letter: "C", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
];

const SPIRIT_EMOJIS = ["✨", "🌙", "⚡", "🔮", "🔥"];

export default function ComeFunziona() {
  const { t } = useTranslation();

  const stepsText = t("comeFunziona.steps", { returnObjects: true }) as Array<{ title: string; subtitle: string; description: string; detail: string }>;
  const STEPS = STEP_META.map((meta, i) => ({ ...meta, ...(stepsText[i] || {}) }));

  const riasecText = t("comeFunziona.riasec", { returnObjects: true }) as Array<{ name: string; desc: string }>;
  const RIASEC_TYPES = RIASEC_META.map((meta, i) => ({ ...meta, ...(riasecText[i] || {}) }));

  const spiritsText = t("comeFunziona.spirits", { returnObjects: true }) as Array<{ key: string; desc: string }>;
  const SPIRITS = SPIRIT_EMOJIS.map((emoji, i) => ({ emoji, ...(spiritsText[i] || {}) }));

  const FAQ = t("comeFunziona.faq", { returnObjects: true }) as Array<{ q: string; a: string }>;

  useSeo(
    t("comeFunziona.pageTitle", { defaultValue: "Come funziona NorthStar | Il metodo di orientamento professionale" }),
    t("comeFunziona.pageDesc", { defaultValue: "Scopri come funziona NorthStar: il modello RIASEC, la Bussola Interiore dei Cinque Spiriti, i dati di mercato e le domande frequenti sul nostro metodo di orientamento professionale." })
  );

  return (
    <div className="flex flex-col w-full">
      {/* Hero */}
      <section className="py-20 md:py-28 bg-background border-b">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-medium mb-6">
            <HelpCircle className="w-3.5 h-3.5" /> {t("comeFunziona.badge", { defaultValue: "Il metodo NorthStar" })}
          </div>
          <h1 className="text-4xl md:text-6xl font-serif font-bold text-foreground mb-6 leading-[1.1]">
            {t("comeFunziona.heroTitle")}<br />
            <span className="text-primary italic">NorthStar</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8">
            {t("comeFunziona.heroSubtitle")}
          </p>
          <Button asChild size="lg" className="rounded-full h-12 px-8">
            <Link href="/test">
              {t("comeFunziona.startTest")} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* 3 Steps */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4 md:px-6 max-w-5xl">
          <AnimateOnScroll>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-3">{t("comeFunziona.stepsTitle")}</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">{t("comeFunziona.stepsSubtitle")}</p>
          </div>
          </AnimateOnScroll>

          <AnimateOnScroll stagger>
          <div className="space-y-10">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <AnimateOnScrollItem key={i}>
                <div className="flex flex-col md:flex-row gap-8 items-start">
                  <div className="shrink-0 flex flex-col items-center md:items-start gap-3">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${step.color}`}>
                      <Icon className="w-7 h-7" />
                    </div>
                    <span className="text-4xl font-serif font-bold text-muted-foreground/25 leading-none">{step.number}</span>
                  </div>
                  <div className="flex-1 bg-card border rounded-2xl p-6 md:p-8">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{step.subtitle}</p>
                    <h3 className="text-2xl font-serif font-bold text-foreground mb-3">{step.title}</h3>
                    <p className="text-muted-foreground leading-relaxed mb-4">{step.description}</p>
                    <div className="bg-muted/40 rounded-xl p-4 border-l-4 border-primary/30">
                      <p className="text-sm text-muted-foreground leading-relaxed">{step.detail}</p>
                    </div>
                  </div>
                </div>
                </AnimateOnScrollItem>
              );
            })}
          </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* RIASEC */}
      <section className="py-24 bg-card border-y">
        <div className="container mx-auto px-4 md:px-6 max-w-5xl">
          <AnimateOnScroll>
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-medium mb-4">
              <Brain className="w-3.5 h-3.5" /> Il modello RIASEC
            </div>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-3">
              Sei tipi di personalità professionale
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Il modello RIASEC, sviluppato dallo psicologo John L. Holland, identifica sei orientamenti professionali fondamentali. Ogni persona è una combinazione unica di questi sei tipi.
            </p>
          </div>
          </AnimateOnScroll>

          <AnimateOnScroll stagger>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {RIASEC_TYPES.map((t) => (
              <AnimateOnScrollItem key={t.letter}>
              <div className={`rounded-2xl border p-5 ${t.color.replace('text-', 'border-').replace(/border-\S+/, '')} bg-card h-full`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-serif font-bold text-xl ${t.color}`}>
                    {t.letter}
                  </span>
                  <span className="font-serif font-bold text-foreground">{t.name}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{t.desc}</p>
              </div>
              </AnimateOnScrollItem>
            ))}
          </div>
          </AnimateOnScroll>

          <AnimateOnScroll delay={0.1}>
          <div className="mt-8 bg-primary/5 border border-primary/15 rounded-2xl p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Il tuo profilo RIASEC sarà una combinazione di due o più lettere, come <span className="font-semibold text-foreground">R + I</span> o <span className="font-semibold text-foreground">S + A + E</span>. Non esiste una combinazione migliore delle altre: ognuna ha settori in cui eccelle naturalmente.
            </p>
          </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* Cinque Spiriti */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4 md:px-6 max-w-5xl">
          <AnimateOnScroll>
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-medium mb-4">
              <Sparkles className="w-3.5 h-3.5" /> La Bussola Interiore
            </div>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-3">
              I Cinque Spiriti
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Un modello originale NorthStar che misura cinque qualità interiori fondamentali. Non sono tratti fissi: sono energie che puoi allenare e sviluppare nel tempo.
            </p>
          </div>
          </AnimateOnScroll>

          <AnimateOnScroll stagger>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {SPIRITS.map((s) => (
              <AnimateOnScrollItem key={s.key}>
              <div className="bg-card border rounded-2xl p-5 flex flex-col items-center text-center hover:border-primary/30 transition-colors h-full">
                <span className="text-3xl mb-3">{s.emoji}</span>
                <h3 className="font-serif font-bold text-foreground mb-2">{s.key}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
              </AnimateOnScrollItem>
            ))}
          </div>
          </AnimateOnScroll>
        </div>
      </section>

      {/* Privacy */}
      <section className="py-20 bg-card border-y">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl">
          <div className="flex flex-col md:flex-row gap-8 items-center">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-700 rounded-full px-3 py-1 text-sm font-medium mb-4">
                <Shield className="w-3.5 h-3.5" /> {t("comeFunziona.privacyBadge")}
              </div>
              <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-4">
                {t("comeFunziona.privacyTitle")}
              </h2>
              <div className="space-y-3">
                {(t("comeFunziona.privacyPoints", { returnObjects: true }) as string[]).map((item: string, i: number) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-muted-foreground">{item}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex gap-3">
                <Link href="/privacy-policy" className="text-sm text-primary underline underline-offset-4">
                  Privacy Policy
                </Link>
                <Link href="/termini-di-servizio" className="text-sm text-primary underline underline-offset-4">
                  {t("footer.links.terms", { defaultValue: "Termini di Servizio" })}
                </Link>
              </div>
            </div>
            <div className="shrink-0 w-40 h-40 rounded-3xl bg-emerald-500/10 flex items-center justify-center">
              <Shield className="w-20 h-20 text-emerald-600/50" />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-medium mb-4">
              <HelpCircle className="w-3.5 h-3.5" /> {t("comeFunziona.faqBadge")}
            </div>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground">
              {t("comeFunziona.faqTitle")}
            </h2>
          </div>

          <Accordion type="single" collapsible className="space-y-3">
            {FAQ.map((item, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="border rounded-2xl px-6 bg-card data-[state=open]:border-primary/30 transition-colors"
              >
                <AccordionTrigger className="text-left font-medium text-foreground hover:no-underline py-5">
                  {item.q}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 md:px-6 max-w-3xl text-center">
          <Compass className="w-12 h-12 mx-auto mb-6 opacity-80" />
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
            {t("comeFunziona.ctaTitle")}
          </h2>
          <p className="text-primary-foreground/80 text-lg mb-8 font-light">
            {t("comeFunziona.ctaDesc")}
          </p>
          <Button
            asChild
            size="lg"
            variant="secondary"
            className="rounded-full h-12 px-10 font-semibold"
          >
            <Link href="/test">
              {t("comeFunziona.startTest")} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
