import { useEffect } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowRight, Compass, Users, MapPin, Brain, Shield,
  Sparkles, BarChart3, Flame, Star, BookOpen, HelpCircle,
  CheckCircle2, Zap, Heart,
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
  }, [title, description]);
}

const STEPS = [
  {
    number: "01",
    icon: Users,
    title: "Rispondi al test",
    subtitle: "12 domande, meno di 3 minuti",
    description:
      "Il test NorthStar combina il modello RIASEC — validato scientificamente da oltre 60 anni di ricerca — con la Bussola Interiore dei Cinque Spiriti. Non ci sono risposte giuste o sbagliate: il sistema misura le tue inclinazioni naturali, non le tue conoscenze.",
    detail: "Le domande coprono 6 dimensioni di personalità professionale (Realistico, Investigativo, Artistico, Sociale, Imprenditivo, Convenzionale) e 5 qualità interiori (Presenza, Visione, Istinto, Focus, Tenacia).",
    color: "bg-primary/10 text-primary",
  },
  {
    number: "02",
    icon: Compass,
    title: "Scopri il tuo profilo",
    subtitle: "Il tuo DNA professionale",
    description:
      "Il sistema elabora le tue risposte e genera un profilo RIASEC unico — una combinazione di lettere che descrive le tue attitudini dominanti — e una mappa della Bussola Interiore con i tuoi cinque spiriti bilanciati.",
    detail: "Il profilo RIASEC è usato da università, aziende Fortune 500 e centri per l'impiego in tutto il mondo. La Bussola Interiore è un modello originale NorthStar che integra dimensioni di motivazione interiore.",
    color: "bg-violet-500/10 text-violet-700",
  },
  {
    number: "03",
    icon: MapPin,
    title: "Esplora i tuoi settori",
    subtitle: "3 raccomandazioni personalizzate con dati reali",
    description:
      "L'algoritmo incrocia il tuo profilo con i dati di 21 settori professionali italiani: stipendi, crescita di mercato, rischio di automazione AI e tendenze. Ricevi 3 settori dove il tuo talento naturale incontra una reale opportunità.",
    detail: "Puoi approfondire ogni settore, confrontarli tra loro, confermare la tua scelta e accedere alle funzionalità premium (Wiki, Roadmap, Grafo della Conoscenza) per tracciare il percorso concreto.",
    color: "bg-emerald-500/10 text-emerald-700",
  },
];

const RIASEC_TYPES = [
  { letter: "R", name: "Realistico", desc: "Ama lavorare con le mani, strumenti, macchine. Concreto, pratico, orientato all'azione.", color: "bg-orange-100 text-orange-800 border-orange-200" },
  { letter: "I", name: "Investigativo", desc: "Curioso, analitico, intellettuale. Ama risolvere problemi complessi e fare ricerca.", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { letter: "A", name: "Artistico", desc: "Creativo, espressivo, originale. Preferisce ambienti non strutturati e libertà di espressione.", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { letter: "S", name: "Sociale", desc: "Empatico, collaborativo, orientato alle persone. Trova significato nell'aiutare gli altri.", color: "bg-green-100 text-green-800 border-green-200" },
  { letter: "E", name: "Imprenditivo", desc: "Leader naturale, persuasivo, ambizioso. Ama guidare, vendere, gestire progetti.", color: "bg-red-100 text-red-800 border-red-200" },
  { letter: "C", name: "Convenzionale", desc: "Organizzato, preciso, affidabile. Eccelle in ambienti strutturati con regole chiare.", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
];

const SPIRITS = [
  { key: "Presenza", emoji: "✨", desc: "Coscienza del momento, capacità di essere pienamente presenti nelle situazioni di lavoro." },
  { key: "Visione", emoji: "🌙", desc: "Capacità di vedere il futuro, pianificare a lungo termine e dare direzione." },
  { key: "Istinto", emoji: "⚡", desc: "Energia intuitiva, velocità decisionale, fiducia nelle proprie sensazioni." },
  { key: "Focus", emoji: "🔮", desc: "Concentrazione profonda, analisi accurata, capacità di entrare nel dettaglio." },
  { key: "Tenacia", emoji: "🔥", desc: "Volontà, resilienza, determinazione nel perseguire gli obiettivi anche sotto pressione." },
];

const FAQ: Array<{ q: string; a: string }> = [
  {
    q: "Il test è gratuito?",
    a: "Sì, il test RIASEC + Bussola Interiore e le 3 raccomandazioni settoriali sono completamente gratuiti. Non è richiesta registrazione per completare il test. Le funzionalità premium (Wiki personalizzata, Roadmap dettagliata, Grafo della Conoscenza) richiedono un abbonamento.",
  },
  {
    q: "Quanto tempo ci vuole per completare il test?",
    a: "Il test completo richiede circa 3-5 minuti. Ci sono 12 domande RIASEC e 15 domande per la Bussola Interiore (3 per ognuno dei 5 spiriti). Puoi rispondere alla tua velocità senza pressione.",
  },
  {
    q: "Il modello RIASEC è scientificamente valido?",
    a: "Sì. Il modello RIASEC (detto anche teoria di Holland) è stato sviluppato dallo psicologo John L. Holland negli anni '50 ed è uno dei modelli di orientamento professionale più studiati e validati al mondo, con oltre 500 ricerche peer-reviewed. È usato da università, aziende Fortune 500, centri per l'impiego e psicologi del lavoro in tutto il mondo.",
  },
  {
    q: "Cosa sono i Cinque Spiriti?",
    a: "La Bussola Interiore dei Cinque Spiriti è un modello originale NorthStar che misura cinque qualità interiori fondamentali nel lavoro: Presenza (consapevolezza del momento), Visione (orientamento al futuro), Istinto (intuizione e velocità), Focus (concentrazione e analisi) e Tenacia (resilienza e determinazione). Integra il profilo RIASEC con una dimensione più profonda di motivazione.",
  },
  {
    q: "I miei dati sono al sicuro?",
    a: "Assolutamente sì. Le tue risposte al test sono anonime di default. Se scegli di registrarti, i tuoi dati sono salvati in modo sicuro e non vengono mai venduti a terzi. Puoi eliminare il tuo account in qualsiasi momento. Consulta la nostra Privacy Policy per tutti i dettagli.",
  },
  {
    q: "Posso fare il test più volte?",
    a: "Sì. Puoi ripetere il test in qualsiasi momento. Le persone cambiano nel tempo e le tue inclinazioni possono evolversi con l'esperienza. Se hai un account, ogni sessione viene salvata e puoi confrontare i risultati nel tempo.",
  },
  {
    q: "I dati di stipendio e crescita sono aggiornati?",
    a: "I dati di mercato (stipendi medi, tasso di crescita, rischio AI) si basano su fonti italiane aggiornate annualmente (ISTAT, EUROSTAT, rapporti settoriali). I range salariali rappresentano la forbice tipica per ruoli entry/mid/senior nel mercato italiano.",
  },
  {
    q: "Cosa sono le funzionalità Premium?",
    a: "Premium include tre strumenti avanzati: la Wiki Personalizzata (risposte AI sulle carriere nel tuo settore), la Roadmap Dettagliata (piano step-by-step per entrare nel settore scelto) e il Grafo della Conoscenza (mappa visiva delle competenze collegate). Questi strumenti usano GPT-4 e si adattano al tuo profilo specifico.",
  },
  {
    q: "Come viene calcolato il punteggio di compatibilità?",
    a: "Il match % si basa su un algoritmo che incrocia i tuoi tipi RIASEC dominanti con i tipi richiesti da ciascun settore, pesato per la dominanza relativa di ogni tipo nel tuo profilo. Un match al 90%+ indica un allineamento ottimale; anche un 50% può essere valido se un settore attrae il tuo spirito dominante.",
  },
  {
    q: "Posso usare NorthStar se ho già un lavoro?",
    a: "Certo. NorthStar è utile sia per chi è all'inizio del percorso sia per chi vuole esplorare una transizione professionale. I dati di mercato e le funzionalità premium sono pensate anche per professionisti esperti che vogliono valutare un cambio di settore o una riqualificazione.",
  },
];

export default function ComeFunziona() {
  useSeo(
    "Come funziona NorthStar | Il metodo di orientamento professionale",
    "Scopri come funziona NorthStar: il modello RIASEC, la Bussola Interiore dei Cinque Spiriti, i dati di mercato e le domande frequenti sul nostro metodo di orientamento professionale."
  );

  return (
    <div className="flex flex-col w-full">
      {/* Hero */}
      <section className="py-20 md:py-28 bg-background border-b">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-3 py-1 text-sm font-medium mb-6">
            <HelpCircle className="w-3.5 h-3.5" /> Il metodo NorthStar
          </div>
          <h1 className="text-4xl md:text-6xl font-serif font-bold text-foreground mb-6 leading-[1.1]">
            Come funziona<br />
            <span className="text-primary italic">NorthStar</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8">
            Un approccio in tre passi che unisce psicologia scientifica, dati reali di mercato e una bussola interiore per aiutarti a scegliere con consapevolezza.
          </p>
          <Button asChild size="lg" className="rounded-full h-12 px-8">
            <Link href="/test">
              Inizia il Test Gratuito <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      {/* 3 Steps */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4 md:px-6 max-w-5xl">
          <AnimateOnScroll>
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-3">Il percorso in tre passi</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">Ogni passo è progettato per darti chiarezza progressiva, non ansia da prestazione.</p>
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
                <Shield className="w-3.5 h-3.5" /> I tuoi dati sono al sicuro
              </div>
              <h2 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-4">
                Privacy e controllo completo
              </h2>
              <div className="space-y-3">
                {[
                  "Il test è anonimo di default — nessuna registrazione richiesta",
                  "I tuoi dati non vengono mai venduti a terzi",
                  "Puoi eliminare il tuo account e tutti i dati in qualsiasi momento",
                  "Le risposte al test non vengono usate per addestrare modelli AI",
                  "Connessione sicura HTTPS su tutti i dispositivi",
                ].map((item, i) => (
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
                  Termini di Servizio
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
              <HelpCircle className="w-3.5 h-3.5" /> Domande frequenti
            </div>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground">
              Hai ancora dubbi?
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
            Pronto a scoprire la tua bussola?
          </h2>
          <p className="text-primary-foreground/80 text-lg mb-8 font-light">
            Meno di 5 minuti. Nessuna registrazione obbligatoria. Zero risposte sbagliate.
          </p>
          <Button
            asChild
            size="lg"
            variant="secondary"
            className="rounded-full h-12 px-10 font-semibold"
          >
            <Link href="/test">
              Inizia il Test Gratuito <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
