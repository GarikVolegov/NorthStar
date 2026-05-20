import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/lib/seo";
import { ArrowRight, BarChart3, Brain, Building2, CheckCircle2, Compass, Shield, TrendingUp, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";

export default function AffiliazioneUniversita() {
  const { t } = useTranslation();

  usePageMeta({
    title: "NorthStar per le università — Career guidance e orientamento in ingresso",
    description: "Integra NorthStar nel servizio di orientamento universitario. Test RIASEC, career planning e supporto agli studenti indecisi.",
    path: "/affiliazione/universita",
  });

  const useCases = [
    { icon: Compass, title: "Orientamento in ingresso", desc: "Aiuta i futuri studenti a scegliere il corso di laurea più coerente con il loro profilo RIASEC.", bg: "bg-violet-50 border-violet-200" },
    { icon: Brain, title: "Supporto agli studenti indecisi", desc: "Per chi cambia facoltà o non sa come proseguire: un punto fermo basato su dati e autoanalisi.", bg: "bg-blue-50 border-blue-200" },
    { icon: TrendingUp, title: "Career planning e placement", desc: "Integra NorthStar nell'ufficio placement: i laureandi comprendono meglio dove indirizzarsi.", bg: "bg-emerald-50 border-emerald-200" },
    { icon: Users, title: "Retention e successo formativo", desc: "Studenti più consapevoli della propria scelta tendono ad abbandonare meno e a completare il percorso.", bg: "bg-orange-50 border-orange-200" },
  ];

  const benefits = [
    { icon: BarChart3, title: "Dati di mercato aggiornati", desc: "21 settori con stipendi, crescita, rischio AI: contenuto sempre attuale per i tuoi studenti." },
    { icon: Shield, title: "GDPR compliant", desc: "Privacy by design e DPA incluso in ogni accordo istituzionale." },
    { icon: CheckCircle2, title: "Integrazione semplice", desc: "Nessuna infrastruttura aggiuntiva. Accesso tramite link dedicato o dominio personalizzato." },
    { icon: Users, title: "Multi-utente", desc: "Gestione di centinaia o migliaia di studenti da un'unica licenza istituzionale." },
    { icon: Brain, title: "Test validato", desc: "RIASEC è usato nelle migliori università del mondo da oltre 60 anni." },
    { icon: TrendingUp, title: "Strumenti premium inclusi", desc: "Nella licenza istituzionale: Wiki, Roadmap e Mappa della Conoscenza per ogni studente." },
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
        <div className="w-14 h-14 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center mx-auto mb-6">
          <Building2 className="w-7 h-7" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          {t("affiliazione.universita.title")}
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          {t("affiliazione.universita.desc")}
        </p>
        <Button size="lg" className="rounded-full px-8" asChild>
          <Link href="/affiliazione#contatto">{t("affiliazione.requestDemo")} <ArrowRight className="ml-2 w-4 h-4" /></Link>
        </Button>
      </div>

      {/* Casi d'uso */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold mb-8 text-center">{t("affiliazione.universita.usesTitle")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {useCases.map(f => (
            <div key={f.title} className={`p-6 rounded-2xl border ${f.bg}`}>
              <div className="w-10 h-10 rounded-xl bg-white/70 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-foreground" />
              </div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Benefici */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold mb-8 text-center">{t("affiliazione.universita.benefitsTitle")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {benefits.map(f => (
            <div key={f.title} className="p-5 rounded-xl border bg-card">
              <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center mb-3">
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
        <h2 className="text-2xl font-bold mb-3">{t("affiliazione.universita.ctaTitle")}</h2>
        <p className="text-primary-foreground/75 mb-6 max-w-md mx-auto">
          {t("affiliazione.universita.ctaDesc")}
        </p>
        <Button size="lg" variant="secondary" className="rounded-full px-8" asChild>
          <Link href="/affiliazione#contatto">{t("affiliazione.requestDemoShort")} <ArrowRight className="ml-2 w-4 h-4" /></Link>
        </Button>
      </div>
    </div>
  );
}
