import { useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Compass, Target, Lightbulb, Users, Heart, Sparkles,
  BookOpen, BarChart3, Newspaper, ArrowRight, CheckCircle2,
} from "lucide-react";
import { AnimateOnScroll, AnimateOnScrollItem } from "@/components/motion";

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

const VALUES = [
  { icon: Target,    title: "Chiarezza",    desc: "Trasformiamo il disorientamento in direzione concreta, senza promesse vuote." },
  { icon: Heart,     title: "Empatia",      desc: "Ogni persona ha un percorso unico: lo rispettiamo e lo accompagniamo." },
  { icon: Lightbulb, title: "Consapevolezza", desc: "Le scelte migliori nascono dalla conoscenza di sé, non dal caso." },
  { icon: BarChart3, title: "Dati reali",   desc: "Usiamo dati aggiornati su settori, salari e crescita per orientarti nel mercato." },
  { icon: BookOpen,  title: "Formazione",   desc: "La crescita è continua: offriamo contenuti per imparare e aggiornarsi nel tempo." },
  { icon: Sparkles,  title: "Innovazione",  desc: "Combiniamo psicologia, AI e dati di mercato per un orientamento del futuro." },
];

const METHOD_STEPS = [
  { n: "01", title: "Test RIASEC + Cinque Spiriti", desc: "Scopri il tuo profilo esterno (competenze e interessi) e quello interiore (energia, visione, istinto) attraverso 17 domande." },
  { n: "02", title: "Matching settori",             desc: "Il sistema incrocia il tuo profilo con 21 settori professionali e calcola un punteggio di compatibilità basato su dati reali." },
  { n: "03", title: "Esplora in profondità",        desc: "Ogni settore include dati su salario, crescita, rischio di automazione, competenze chiave, roadmap e grafo della conoscenza." },
  { n: "04", title: "Costruisci il tuo percorso",  desc: "Salva preferenze, segui le news del tuo settore, imposta obiettivi di carriera e traccia i progressi nel tempo." },
];

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

  return (
    <div className="min-h-screen">

      {/* Hero */}
      <section className="border-b bg-gradient-to-b from-primary/5 to-background py-20 md:py-28">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-6">
            <Compass className="w-4 h-4" />
            La nostra storia
          </div>
          <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground leading-tight mb-6">
            Chi siamo
          </h1>
          <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-8">
            NorthStar è una piattaforma SaaS di orientamento e crescita personale progettata per aiutare persone diverse a trovare direzione nello studio, nel lavoro e nella propria evoluzione personale.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild className="rounded-full px-6">
              <Link href="/test">Inizia il test <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full px-6">
              <Link href="/premium">Esplora il Premium</Link>
            </Button>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 max-w-4xl py-16 space-y-20">

        {/* Cosa facciamo */}
        <AnimateOnScroll>
        <section>
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-6">Cosa facciamo</h2>
          <p className="text-lg text-muted-foreground leading-relaxed mb-6">
            NorthStar combina <strong className="text-foreground">test di personalità</strong>, analisi dei settori professionali, news aggiornate e strumenti di organizzazione personale in un unico spazio chiaro, utile e facile da usare.
          </p>
          <AnimateOnScroll stagger>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: Target,    label: "Test RIASEC + Cinque Spiriti",   desc: "Comprendi la tua personalità in due dimensioni: interessi e identità profonda." },
              { icon: BarChart3, label: "21 settori professionali",        desc: "Ogni settore con dati reali su salario, crescita, automazione e competenze." },
              { icon: Newspaper, label: "News settoriali",                 desc: "Contenuti aggiornati filtrabili per i settori che ti interessano." },
              { icon: BookOpen,  label: "Roadmap e grafo della conoscenza", desc: "Visualizza le competenze, i ruoli e i percorsi di ogni settore in forma interattiva." },
            ].map(({ icon: Icon, label, desc }) => (
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
            ))}
          </div>
          </AnimateOnScroll>
        </section>
        </AnimateOnScroll>

        {/* Perché esistiamo */}
        <AnimateOnScroll>
        <section>
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-6">Perché esistiamo</h2>
          <div className="bg-primary/5 border border-primary/20 rounded-3xl p-8 md:p-10">
            <p className="text-lg text-foreground leading-relaxed mb-4">
              Milioni di persone ogni anno scelgono studi o lavori senza avere gli strumenti per capire se quella direzione è davvero coerente con chi sono.
            </p>
            <p className="text-lg text-muted-foreground leading-relaxed mb-4">
              Il risultato è disorientamento, insoddisfazione e percorsi che cambiano continuamente senza una bussola chiara.
            </p>
            <p className="text-lg text-foreground leading-relaxed font-medium">
              La nostra missione è trasformare quel disorientamento in chiarezza — offrendo strumenti concreti per orientarsi tra opportunità, studi, mestieri e possibilità di carriera.
            </p>
          </div>
        </section>
        </AnimateOnScroll>

        {/* Il nostro metodo */}
        <section>
          <AnimateOnScroll>
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-8">Il nostro metodo</h2>
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
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-6">A chi ci rivolgiamo</h2>
          <p className="text-lg text-muted-foreground leading-relaxed mb-6">
            NorthStar è pensato per chiunque si trovi a un bivio nella propria vita professionale o formativa:
          </p>
          <AnimateOnScroll stagger>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              "Studenti delle superiori che devono scegliere l'università",
              "Universitari che vogliono capire in quale settore entrare",
              "Lavoratori che valutano un cambiamento di carriera",
              "Chi rientra nel mondo del lavoro dopo una pausa",
              "Chi vuole capire meglio le proprie inclinazioni e punti di forza",
              "Professionisti che cercano nuove direzioni di crescita",
            ].map((item) => (
              <AnimateOnScrollItem key={item}>
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
          <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-8">I nostri valori</h2>
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
            Pronto a trovare la tua direzione?
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Fai il test gratuito in meno di 10 minuti e scopri i settori professionali più coerenti con la tua personalità.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild className="rounded-full px-8">
              <Link href="/test">Inizia il test gratuito <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
            </Button>
            <Button asChild variant="outline" className="rounded-full px-6">
              <Link href="/news">Leggi le news</Link>
            </Button>
          </div>
        </section>
        </AnimateOnScroll>

      </div>
    </div>
  );
}
