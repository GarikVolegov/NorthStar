import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePageMeta } from "@/lib/seo";
import { BookOpen, CheckCircle2, ArrowRight, Brain, Compass, BarChart3, TrendingUp, Award } from "lucide-react";

export default function AffiliazioneFormazione() {
  const { t } = useTranslation();

  usePageMeta({
    title: "NorthStar per centri di formazione professionale — Orientamento ai mestieri",
    description: "Integra NorthStar nei tuoi percorsi ITS, CFP e di formazione professionale. Aiuta gli utenti a scegliere il percorso tecnico più adatto al loro profilo.",
    path: "/affiliazione/centri-formazione",
  });

  const contexts = [
    { label: "ITS Academy", desc: "Orienta gli iscritti verso gli indirizzi tecnologici più coerenti con il loro profilo RIASEC e il mercato del lavoro locale.", bg: "bg-rose-50 border-rose-200" },
    { label: "CFP – Centri di Formazione Professionale", desc: "Valorizza i mestieri tecnici e artigianali con dati reali. I corsisti scelgono con più consapevolezza quale percorso pratico intraprendere.", bg: "bg-orange-50 border-orange-200" },
    { label: "Enti di formazione continua", desc: "Supporta la riqualificazione di lavoratori adulti che cambiano settore o ruolo, con un'analisi delle attitudini e del mercato attuale.", bg: "bg-amber-50 border-amber-200" },
  ];

  const features = [
    { icon: Brain, title: "Profilo attitudinale", desc: "Il test RIASEC identifica predisposizioni per lavori pratici, tecnici, analitici o relazionali." },
    { icon: Compass, title: "Orientamento ai settori", desc: "21 settori con focus su quelli tecnici e manifatturieri: meccanica, ICT, salute, energia e altri." },
    { icon: BarChart3, title: "Dati sui mestieri", desc: "Stipendi e crescita per ogni settore: argomenti concreti per motivare la scelta formativa." },
    { icon: TrendingUp, title: "Rischio AI per mestiere", desc: "Mostra quali professioni sono più o meno esposte all'automazione: una guida preziosa per il futuro." },
    { icon: Award, title: "Valorizza i mestieri tecnici", desc: "NorthStar mostra con dati reali che i percorsi tecnici offrono spesso stipendi e crescita superiori." },
    { icon: CheckCircle2, title: "Senza competenze tech", desc: "Il corsista fa il test dal proprio smartphone in pochi minuti. Nessuna installazione, nessun manuale." },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 md:py-20">

      <div className="mb-6">
        <Link href="/affiliazione">
          <Badge variant="outline" className="cursor-pointer hover:bg-muted transition-colors text-xs">
            ← {t("affiliazione.backTo")}
          </Badge>
        </Link>
      </div>

      {/* Hero */}
      <div className="text-center mb-16">
        <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center mx-auto mb-6">
          <BookOpen className="w-7 h-7" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          {t("affiliazione.formazione.title")}
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          {t("affiliazione.formazione.desc")}
        </p>
        <Button size="lg" className="rounded-full px-8" asChild>
          <Link href="/affiliazione#contatto">{t("affiliazione.requestDemo")} <ArrowRight className="ml-2 w-4 h-4" /></Link>
        </Button>
      </div>

      {/* Contesti */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold mb-8 text-center">{t("affiliazione.formazione.contextsTitle")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {contexts.map(c => (
            <div key={c.label} className={`p-6 rounded-2xl border ${c.bg}`}>
              <h3 className="font-semibold mb-2">{c.label}</h3>
              <p className="text-sm text-muted-foreground">{c.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Funzionalità */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold mb-8 text-center">{t("affiliazione.formazione.featuresTitle")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {features.map(f => (
            <div key={f.title} className="p-5 rounded-xl border bg-card">
              <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center mb-3">
                <f.icon className="w-4 h-4" />
              </div>
              <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-3xl bg-primary text-primary-foreground p-10 text-center">
        <h2 className="text-2xl font-bold mb-3">{t("affiliazione.formazione.ctaTitle")}</h2>
        <p className="text-primary-foreground/75 mb-6 max-w-md mx-auto">
          {t("affiliazione.formazione.ctaDesc")}
        </p>
        <Button size="lg" variant="secondary" className="rounded-full px-8" asChild>
          <Link href="/affiliazione#contatto">{t("affiliazione.requestDemoShort")} <ArrowRight className="ml-2 w-4 h-4" /></Link>
        </Button>
      </div>
    </div>
  );
}
