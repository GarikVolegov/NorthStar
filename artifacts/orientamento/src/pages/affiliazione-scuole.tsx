import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePageMeta } from "@/lib/seo";
import { School, GraduationCap, CheckCircle2, ArrowRight, Brain, Compass, BarChart3, Users, BookOpen } from "lucide-react";

export default function AffiliazioneScuole() {
  usePageMeta({
    title: "NorthStar per le scuole — Orientamento scolastico digitale",
    description: "Porta il test RIASEC e l'orientamento digitale nella tua scuola media o superiore. Programma partner NorthStar per istituti formativi italiani.",
    path: "/affiliazione/scuole",
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
        <div className="inline-flex items-center gap-2 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center">
            <School className="w-6 h-6" />
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <GraduationCap className="w-6 h-6" />
          </div>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
          NorthStar per le scuole
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
          Dalle medie alle superiori: strumenti digitali di orientamento che accompagnano gli studenti nella scoperta di sé e del mercato del lavoro reale.
        </p>
        <Button size="lg" className="rounded-full px-8" asChild>
          <Link href="/affiliazione#contatto">Richiedi una demo gratuita <ArrowRight className="ml-2 w-4 h-4" /></Link>
        </Button>
      </div>

      {/* Uso per medie vs superiori */}
      <div className="grid md:grid-cols-2 gap-8 mb-16">
        <div className="p-8 rounded-2xl border bg-blue-50/50 border-blue-200">
          <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center mb-4">
            <School className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold mb-2 text-blue-900">Scuole medie</h2>
          <p className="text-sm text-blue-800/70 mb-4">Primo orientamento, scoperta degli interessi, supporto alla scelta del percorso superiore.</p>
          <ul className="space-y-2">
            {["Test semplice e accessibile (8–14 anni)", "Scoperta degli interessi naturali", "Workshop in classe con il docente", "Supporto alla scelta della scuola superiore"].map(u => (
              <li key={u} className="flex items-center gap-2 text-sm text-blue-800">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" /> {u}
              </li>
            ))}
          </ul>
        </div>
        <div className="p-8 rounded-2xl border bg-emerald-50/50 border-emerald-200">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-4">
            <GraduationCap className="w-5 h-5" />
          </div>
          <h2 className="text-xl font-bold mb-2 text-emerald-900">Scuole superiori</h2>
          <p className="text-sm text-emerald-800/70 mb-4">Orientamento post-diploma verso università, ITS Academy, formazione professionale o lavoro.</p>
          <ul className="space-y-2">
            {["Profilo RIASEC completo con Bussola Interiore", "Matching con 21 settori professionali", "Dati su stipendi, crescita e rischio AI", "Confronto tra percorsi universitari e ITS"].map(u => (
              <li key={u} className="flex items-center gap-2 text-sm text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> {u}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Funzionalità chiave */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold mb-8 text-center">Cosa ottiene il tuo istituto</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
          {[
            { icon: Brain, title: "Test RIASEC validato", desc: "Un modello usato nelle scuole di tutto il mondo, adattato al contesto italiano." },
            { icon: Compass, title: "Matching settori", desc: "Ogni studente scopre i 3 settori più coerenti con il proprio profilo." },
            { icon: BarChart3, title: "Dati di mercato reali", desc: "Stipendi, crescita e rischio AI: orientamento basato su informazioni aggiornate." },
            { icon: Users, title: "Uso collettivo in classe", desc: "Decine di studenti possono fare il test nello stesso momento, senza conflitti." },
            { icon: BookOpen, title: "Materiali didattici", desc: "Forniamo slide e guide per integrare NorthStar nell'ora di orientamento." },
            { icon: CheckCircle2, title: "Privacy by design", desc: "GDPR compliant. I dati degli studenti sono protetti e non ceduti a terzi." },
          ].map(f => (
            <div key={f.title} className="p-5 rounded-xl border bg-card">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-3">
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
        <h2 className="text-2xl font-bold mb-3">Porta NorthStar nella tua scuola</h2>
        <p className="text-primary-foreground/75 mb-6 max-w-md mx-auto">
          Demo gratuita di 30 minuti, materiali didattici inclusi, nessun impegno.
        </p>
        <Button size="lg" variant="secondary" className="rounded-full px-8" asChild>
          <Link href="/affiliazione#contatto">Richiedi la demo <ArrowRight className="ml-2 w-4 h-4" /></Link>
        </Button>
      </div>
    </div>
  );
}
