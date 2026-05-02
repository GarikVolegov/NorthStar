import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePageMeta } from "@/lib/seo";
import { Briefcase, CheckCircle2, ArrowRight, Brain, Compass, BarChart3, TrendingUp, Users, Zap } from "lucide-react";

export default function AffiliazioneAgenzie() {
  usePageMeta({
    title: "NorthStar per agenzie per il lavoro — Matching e orientamento professionale",
    description: "Potenzia il servizio della tua agenzia per il lavoro con NorthStar: test RIASEC, matching candidati e orientamento professionale basato su dati reali.",
    path: "/affiliazione/agenzie-lavoro",
  });

  return (
    <div className="max-w-5xl mx-auto px-4 py-12 md:py-20">

      <div className="mb-6">
        <Link href="/affiliazione">
          <Badge variant="outline" className="cursor-pointer hover:bg-muted transition-colors text-xs">
            ← Torna alla pagina affiliazione
          </Badge>
        </Link>
      </div>

      {/* Hero */}
      <div className="text-center mb-16">
        <div className="w-14 h-14 rounded-2xl bg-orange-100 text-orange-700 flex items-center justify-center mx-auto mb-6">
          <Briefcase className="w-7 h-7" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          NorthStar per le agenzie per il lavoro
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Migliora il matching tra candidati e opportunità con un profilo di personalità professionale validato e dati aggiornati sul mercato del lavoro italiano.
        </p>
        <Button size="lg" className="rounded-full px-8" asChild>
          <Link href="/affiliazione#contatto">Richiedi una demo gratuita <ArrowRight className="ml-2 w-4 h-4" /></Link>
        </Button>
      </div>

      {/* Casi d'uso */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold mb-8 text-center">Come le agenzie usano NorthStar</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            { icon: Compass, title: "Profiling dei candidati", desc: "Il test RIASEC + Bussola Interiore fornisce un profilo professionale strutturato, utile per migliorare il matching con le posizioni aperte.", bg: "bg-orange-50 border-orange-200" },
            { icon: Brain, title: "Orientamento professionale", desc: "Per candidati incerti o in ricollocazione: NorthStar aiuta a esplorare settori alternativi coerenti con le proprie attitudini.", bg: "bg-blue-50 border-blue-200" },
            { icon: TrendingUp, title: "Analisi del mercato", desc: "21 settori con dati aggiornati su stipendi, crescita e rischio AI: argomenti concreti per guidare il candidato verso scelte realistiche.", bg: "bg-emerald-50 border-emerald-200" },
            { icon: Users, title: "Servizi a valore aggiunto", desc: "Differenziati dalla concorrenza offrendo un percorso di autoanalisi professionale incluso nel servizio di placement.", bg: "bg-violet-50 border-violet-200" },
          ].map(f => (
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
        <h2 className="text-2xl font-bold mb-6 text-center">Vantaggi competitivi per la tua agenzia</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            { icon: Zap, title: "Onboarding più rapido", desc: "Il profilo RIASEC accelera la comprensione del candidato sin dal primo colloquio." },
            { icon: BarChart3, title: "Dati per il consulente", desc: "Il consulente ha dati oggettivi da affiancare alla propria esperienza nel mercato." },
            { icon: CheckCircle2, title: "Matching di qualità", desc: "Candidati più consapevoli producono match migliori e minori drop-out a contratto firmato." },
          ].map(f => (
            <div key={f.title} className="p-5 rounded-xl border bg-card text-center">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center mx-auto mb-3">
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
              <p className="text-xs text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-3xl bg-primary text-primary-foreground p-10 text-center">
        <h2 className="text-2xl font-bold mb-3">Potenzia il tuo servizio di placement</h2>
        <p className="text-primary-foreground/75 mb-6 max-w-md mx-auto">
          Referral commission o licenza multi-consulente. Demo gratuita in 30 minuti.
        </p>
        <Button size="lg" variant="secondary" className="rounded-full px-8" asChild>
          <Link href="/affiliazione#contatto">Richiedi la demo <ArrowRight className="ml-2 w-4 h-4" /></Link>
        </Button>
      </div>
    </div>
  );
}
