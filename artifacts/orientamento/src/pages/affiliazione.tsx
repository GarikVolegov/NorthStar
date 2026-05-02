import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { usePageMeta } from "@/lib/seo";
import {
  School, GraduationCap, Briefcase, BookOpen, Building2, Users,
  CheckCircle2, ArrowRight, Star, BarChart3, Compass, Brain,
  Handshake, Mail, Phone, Globe, Zap, Shield, TrendingUp, Award,
  MessageSquare, ChevronRight,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL ?? "/";

const PARTNER_TYPES = [
  {
    icon: School,
    label: "Scuole medie",
    href: "/affiliazione/scuole",
    color: "bg-blue-50 text-blue-700 border-blue-200",
    iconBg: "bg-blue-100 text-blue-700",
    uses: ["Orientamento iniziale", "Scoperta degli interessi", "Supporto alla scelta futura", "Workshop in classe"],
  },
  {
    icon: GraduationCap,
    label: "Scuole superiori",
    href: "/affiliazione/scuole",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200",
    iconBg: "bg-emerald-100 text-emerald-700",
    uses: ["Orientamento post-diploma", "Supporto università / ITS / lavoro", "Test attitudinali", "Presentazione settori"],
  },
  {
    icon: Building2,
    label: "Università",
    href: "/affiliazione/universita",
    color: "bg-violet-50 text-violet-700 border-violet-200",
    iconBg: "bg-violet-100 text-violet-700",
    uses: ["Orientamento in ingresso", "Studenti indecisi", "Career planning", "Retention formativa"],
  },
  {
    icon: Briefcase,
    label: "Agenzie per il lavoro",
    href: "/affiliazione/agenzie-lavoro",
    color: "bg-orange-50 text-orange-700 border-orange-200",
    iconBg: "bg-orange-100 text-orange-700",
    uses: ["Matching candidati", "Orientamento professionale", "Ricollocazione", "Analisi competenze"],
  },
  {
    icon: BookOpen,
    label: "Centri di formazione",
    href: "/affiliazione/centri-formazione",
    color: "bg-rose-50 text-rose-700 border-rose-200",
    iconBg: "bg-rose-100 text-rose-700",
    uses: ["Scelta percorsi pratici", "Formazione tecnica", "Valorizzazione mestieri", "Accompagnamento ITS"],
  },
  {
    icon: Users,
    label: "Enti pubblici e privati",
    href: "/affiliazione",
    color: "bg-teal-50 text-teal-700 border-teal-200",
    iconBg: "bg-teal-100 text-teal-700",
    uses: ["Progetti di orientamento", "Bandi territoriali", "Sportelli lavoro", "Iniziative formative"],
  },
];

const INSTITUTION_BENEFITS = [
  { icon: Zap, title: "Servizio digitale innovativo", desc: "Offri ai tuoi utenti uno strumento moderno, basato su dati reali e psicologia validata." },
  { icon: BarChart3, title: "Dati e reportistica", desc: "Accedi a dashboard aggregate sull'utilizzo e sui profili dei tuoi utenti (nel rispetto della privacy)." },
  { icon: Brain, title: "Test personalizzati", desc: "Il test RIASEC + Bussola Interiore si adatta a ogni contesto: studenti, candidati, lavoratori." },
  { icon: TrendingUp, title: "Contenuti sempre aggiornati", desc: "21 settori con dati aggiornati su stipendi, crescita e trend del mercato del lavoro italiano." },
  { icon: Award, title: "Reputazione e qualità percepita", desc: "Associare il tuo brand a NorthStar aumenta la qualità percepita del servizio offerto." },
  { icon: Globe, title: "Scalabile e multi-utente", desc: "Gestisci decine, centinaia o migliaia di utenti da un'unica piattaforma condivisa." },
];

const USER_BENEFITS = [
  { icon: Compass, title: "Chiarezza nella scelta", desc: "Trasforma il disorientamento in direzione concreta, senza promesse vuote." },
  { icon: Brain, title: "Conoscenza di sé", desc: "Scopre il proprio profilo RIASEC e la Bussola Interiore in meno di 3 minuti." },
  { icon: BarChart3, title: "Dati reali sul mercato", desc: "Stipendi, crescita, rischio AI: informazioni vere per decidere con consapevolezza." },
  { icon: Star, title: "Percorso personalizzato", desc: "Wiki, Roadmap e Grafo della Conoscenza per costruire il proprio piano d'azione." },
];

const MODELS = [
  {
    icon: Handshake,
    title: "Referral & Commissione",
    badge: "Semplice",
    badgeColor: "bg-emerald-100 text-emerald-700",
    desc: "Condividi NorthStar con i tuoi utenti e ricevi una commissione su ogni iscrizione premium generata dal tuo canale. Nessun costo iniziale.",
  },
  {
    icon: Building2,
    title: "Licenza Istituzionale",
    badge: "Più usato",
    badgeColor: "bg-primary/10 text-primary",
    desc: "Accesso multiplo per la tua organizzazione: tutti gli utenti Premium, un unico contratto. Tariffa flat su volume concordato.",
  },
  {
    icon: Globe,
    title: "White Label Parziale",
    badge: "Enterprise",
    badgeColor: "bg-violet-100 text-violet-700",
    desc: "La piattaforma con il tuo brand: logo, colori e dominio personalizzati. Ideale per università e grandi enti con identità forte.",
  },
  {
    icon: Users,
    title: "Ambassador Program",
    badge: "Individuale",
    badgeColor: "bg-orange-100 text-orange-700",
    desc: "Docenti, orientatori e consulenti che promuovono NorthStar ricevono accesso gratuito Premium e commissioni sulle conversioni.",
  },
];

const HOW_STEPS = [
  { n: "01", title: "Contattaci", desc: "Compila il form o scrivici a partners@northstar.app. Ti rispondiamo entro 24 ore lavorative." },
  { n: "02", title: "Demo personalizzata", desc: "Organizziamo una sessione di 30 minuti per mostrare la piattaforma nel vostro contesto specifico." },
  { n: "03", title: "Accordo su misura", desc: "Definiamo insieme il modello di collaborazione più adatto: referral, licenza, white label o ambassador." },
  { n: "04", title: "Onboarding e lancio", desc: "Supporto tecnico e materiali dedicati per introdurre NorthStar ai vostri utenti nel modo più efficace." },
];

const FAQ_ITEMS = [
  { q: "A chi si rivolge il programma di affiliazione?", a: "A scuole medie e superiori, università, agenzie per il lavoro, centri di formazione professionale, enti pubblici e privati, orientatori e consulenti individuali che operano nell'orientamento e nella crescita personale." },
  { q: "Come funziona la partnership concretamente?", a: "Dipende dal modello scelto. Per il referral: condividi un link dedicato e ricevi commissione sulle conversioni. Per la licenza: un contratto flat con accesso multiplo. Per il white label: personalizzazione completa su accordo specifico." },
  { q: "È possibile personalizzare la piattaforma?", a: "Il white label parziale prevede personalizzazione di logo, colori e URL. Per esigenze più avanzate di integrazione con sistemi gestionali esistenti, valutiamo soluzioni su misura." },
  { q: "NorthStar è adatto all'orientamento scolastico?", a: "Sì. Il test RIASEC è usato in ambito accademico e scolastico da decenni. La nostra versione è pensata per il contesto italiano: 21 settori, dati aggiornati, linguaggio accessibile anche a studenti delle medie." },
  { q: "Come viene gestita la privacy degli utenti?", a: "NorthStar è conforme al GDPR. I dati degli utenti sono cifrati, non venduti a terzi e non condivisi con le istituzioni partner senza il consenso esplicito dell'utente. Ogni partnership include un DPA (Data Processing Agreement)." },
  { q: "Esiste una demo gratuita?", a: "Sì. Compila il form in fondo a questa pagina e ti organizziamo una demo personalizzata gratuita di 30 minuti, senza impegno." },
  { q: "Qual è il costo per l'istituzione?", a: "Dipende dal modello. Il referral non ha costi iniziali. La licenza istituzionale è concordata su volume. Contattaci per un preventivo gratuito e senza impegno." },
];

function LeadForm() {
  const [form, setForm] = useState({
    institutionName: "",
    partnerType: "",
    contactName: "",
    email: "",
    phone: "",
    message: "",
    estimatedUsers: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "err">("idle");
  const [errMsg, setErrMsg] = useState("");

  function set(k: keyof typeof form, v: string) {
    setForm(f => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrMsg("");
    try {
      const res = await fetch(`${BASE}api/affiliazione/lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setStatus("err"); setErrMsg(data.error ?? "Errore imprevisto"); return; }
      setStatus("ok");
    } catch {
      setStatus("err");
      setErrMsg("Errore di rete. Riprova.");
    }
  }

  if (status === "ok") {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-xl font-bold mb-2">Richiesta inviata!</h3>
        <p className="text-muted-foreground">Ti contatteremo entro 24 ore lavorative per organizzare una demo personalizzata.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1">Nome istituzione *</label>
          <input
            required
            value={form.institutionName}
            onChange={e => set("institutionName", e.target.value)}
            placeholder="Es. Liceo Scientifico A. Volta di Milano"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Tipo di partner *</label>
          <select
            required
            value={form.partnerType}
            onChange={e => set("partnerType", e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Seleziona...</option>
            <option value="scuola_media">Scuola media</option>
            <option value="scuola_superiore">Scuola superiore</option>
            <option value="universita">Università / Politecnico</option>
            <option value="agenzia_lavoro">Agenzia per il lavoro</option>
            <option value="centro_formazione">Centro di formazione professionale</option>
            <option value="ente_pubblico">Ente pubblico / Regione / Comune</option>
            <option value="orientatore">Orientatore / Consulente individuale</option>
            <option value="altro">Altro</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Utenti stimati</label>
          <select
            value={form.estimatedUsers}
            onChange={e => set("estimatedUsers", e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">Non so ancora</option>
            <option value="< 100">Meno di 100</option>
            <option value="100-500">100 – 500</option>
            <option value="500-2000">500 – 2.000</option>
            <option value="> 2000">Oltre 2.000</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Il tuo nome *</label>
          <input
            required
            value={form.contactName}
            onChange={e => set("contactName", e.target.value)}
            placeholder="Nome e cognome"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email *</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={e => set("email", e.target.value)}
            placeholder="email@istituzione.it"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Telefono</label>
          <input
            type="tel"
            value={form.phone}
            onChange={e => set("phone", e.target.value)}
            placeholder="+39 02 1234567"
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1">Messaggio</label>
          <textarea
            rows={4}
            value={form.message}
            onChange={e => set("message", e.target.value)}
            placeholder="Descrivi brevemente il vostro contesto, le vostre necessità o qualsiasi domanda..."
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>
      </div>
      {status === "err" && (
        <p className="text-destructive text-sm">{errMsg}</p>
      )}
      <Button type="submit" disabled={status === "sending"} className="w-full rounded-full" size="lg">
        {status === "sending" ? "Invio in corso…" : "Richiedi una demo gratuita"}
        {status !== "sending" && <ArrowRight className="ml-2 w-4 h-4" />}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Nessun impegno. Risposta entro 24 ore lavorative. Dati trattati secondo la{" "}
        <Link href="/privacy-policy" className="underline hover:text-primary">Privacy Policy</Link>.
      </p>
    </form>
  );
}

export default function Affiliazione() {
  usePageMeta({
    title: "Affiliazione e Partnership istituzionale",
    description: "Porta NorthStar nella tua scuola, università o agenzia. Programma di partnership B2B per istituzioni formative: referral, licenza istituzionale, white label e ambassador.",
    path: "/affiliazione",
  });

  return (
    <div className="max-w-6xl mx-auto px-4">

      {/* ── HERO ── */}
      <section className="py-20 md:py-28 text-center">
        <Badge variant="outline" className="mb-6 px-4 py-1.5 text-sm font-medium rounded-full border-primary/30 text-primary">
          Programma Partner & Affiliazione
        </Badge>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 max-w-4xl mx-auto leading-tight">
          Porta l'orientamento nel tuo istituto con <span className="text-primary">NorthStar</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          Una piattaforma digitale per aiutare studenti, candidati e utenti a scoprire la propria direzione con test personalizzati, dati reali sui settori e percorsi concreti.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="rounded-full px-8" asChild>
            <a href="#contatto">Richiedi una demo gratuita <ArrowRight className="ml-2 w-4 h-4" /></a>
          </Button>
          <Button size="lg" variant="outline" className="rounded-full px-8" asChild>
            <a href="#come-funziona">Come funziona</a>
          </Button>
        </div>
        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto text-center">
          {[
            { n: "21", label: "Settori professionali" },
            { n: "RIASEC", label: "Test validato globalmente" },
            { n: "100%", label: "Conforme GDPR" },
            { n: "Free", label: "Demo senza impegno" },
          ].map(s => (
            <div key={s.label}>
              <p className="text-2xl font-bold text-primary">{s.n}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PROBLEMA ── */}
      <section className="py-16 border-t">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold mb-4">L'orientamento tradizionale non basta più</h2>
            <p className="text-muted-foreground mb-4 leading-relaxed">
              Il mercato del lavoro cambia più velocemente dei programmi formativi. Studenti e candidati si trovano davanti a scelte cruciali con strumenti obsoleti: brochure, colloqui occasionali, test carta-penna.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Il risultato? Scelte sbagliate, abbandoni, demotivazione. Le istituzioni che offrono un'esperienza moderna di orientamento si distinguono, aumentano la fidelizzazione e producono risultati migliori.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {[
              "Il 42% degli studenti universitari si dichiara insoddisfatto della scelta compiuta",
              "Il 30% degli iscritti abbandona il percorso nei primi 2 anni",
              "Meno del 20% degli istituti usa strumenti digitali per l'orientamento",
              "Il mismatch tra formazione e lavoro costa all'Italia miliardi ogni anno",
            ].map((fact, i) => (
              <div key={i} className="flex gap-3 p-4 rounded-xl bg-muted/50 border">
                <div className="w-6 h-6 rounded-full bg-destructive/10 text-destructive flex items-center justify-center shrink-0 text-sm font-bold mt-0.5">!</div>
                <p className="text-sm text-muted-foreground">{fact}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SOLUZIONE ── */}
      <section className="py-16 border-t">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">NorthStar: orientamento digitale per istituzioni</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Una piattaforma completa che puoi integrare nei tuoi servizi in pochi giorni, senza infrastrutture aggiuntive.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {[
            { icon: Brain, title: "Test di personalità", desc: "RIASEC + Bussola Interiore in meno di 3 minuti. Validato scientificamente, pensato per il contesto italiano." },
            { icon: Compass, title: "Matching con 21 settori", desc: "L'algoritmo incrocia il profilo con dati reali di mercato: stipendi, crescita, rischio AI, trend." },
            { icon: TrendingUp, title: "Percorsi formativi", desc: "Wiki, Roadmap e Grafo della Conoscenza per costruire un piano d'azione concreto e personalizzato." },
            { icon: BarChart3, title: "Dati aggiornati", desc: "21 settori professionali con dati sul mercato del lavoro italiano costantemente aggiornati." },
            { icon: Shield, title: "Privacy GDPR", desc: "Gestione dei dati conforme al regolamento europeo. DPA incluso in ogni partnership istituzionale." },
            { icon: Globe, title: "Multidevice e scalabile", desc: "Accessibile da qualsiasi dispositivo. Funziona con 10 utenti come con 10.000." },
          ].map(f => (
            <div key={f.title} className="p-6 rounded-2xl border bg-card hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PARTNER IDEALI ── */}
      <section className="py-16 border-t">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Chi può aderire</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Il programma è aperto a tutti i soggetti che operano nell'orientamento, nella formazione e nel mercato del lavoro.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {PARTNER_TYPES.map(pt => (
            <div key={pt.label} className={`p-6 rounded-2xl border ${pt.color} hover:shadow-md transition-shadow`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${pt.iconBg}`}>
                <pt.icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold mb-3">{pt.label}</h3>
              <ul className="space-y-1.5">
                {pt.uses.map(u => (
                  <li key={u} className="flex items-center gap-2 text-sm opacity-80">
                    <ChevronRight className="w-3.5 h-3.5 shrink-0" /> {u}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── BENEFICI ── */}
      <section className="py-16 border-t">
        <div className="grid md:grid-cols-2 gap-16">
          <div>
            <h2 className="text-2xl font-bold mb-8">Benefici per l'istituzione</h2>
            <div className="space-y-6">
              {INSTITUTION_BENEFITS.map(b => (
                <div key={b.title} className="flex gap-4">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <b.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">{b.title}</h3>
                    <p className="text-sm text-muted-foreground">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold mb-8">Benefici per i tuoi utenti</h2>
            <div className="space-y-6">
              {USER_BENEFITS.map(b => (
                <div key={b.title} className="flex gap-4">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <b.icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm mb-1">{b.title}</h3>
                    <p className="text-sm text-muted-foreground">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 p-6 rounded-2xl bg-primary/5 border border-primary/20">
              <p className="text-sm text-muted-foreground leading-relaxed">
                "NorthStar non sostituisce il docente o il consulente: li supporta con dati e strumenti che amplificano il valore del loro lavoro."
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── MODELLI DI AFFILIAZIONE ── */}
      <section className="py-16 border-t">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Modelli di collaborazione</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Ogni istituzione è diversa. Scegliamo insieme il modello più adatto alle vostre esigenze e alla vostra dimensione.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {MODELS.map(m => (
            <div key={m.title} className="p-6 rounded-2xl border bg-card hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-foreground">
                  <m.icon className="w-5 h-5" />
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${m.badgeColor}`}>{m.badge}</span>
              </div>
              <h3 className="font-semibold mb-2">{m.title}</h3>
              <p className="text-sm text-muted-foreground">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── COME FUNZIONA ── */}
      <section id="come-funziona" className="py-16 border-t scroll-mt-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Come funziona</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Dalla prima chiamata all'attivazione: un processo semplice e accompagnato.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {HOW_STEPS.map((s, i) => (
            <div key={s.n} className="relative">
              <div className="text-5xl font-bold text-muted-foreground/20 mb-3">{s.n}</div>
              <h3 className="font-semibold mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground">{s.desc}</p>
              {i < HOW_STEPS.length - 1 && (
                <ArrowRight className="hidden md:block absolute top-8 -right-3 w-5 h-5 text-muted-foreground/30" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── FORM CONTATTO ── */}
      <section id="contatto" className="py-16 border-t scroll-mt-20">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          <div>
            <h2 className="text-3xl font-bold mb-4">Diventa partner NorthStar</h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Compila il form: ti contatteremo entro 24 ore lavorative per organizzare una demo gratuita e personalizzata sul vostro contesto.
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Mail className="w-4 h-4 text-primary shrink-0" />
                <span>partners@northstar.app</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <MessageSquare className="w-4 h-4 text-primary shrink-0" />
                <span>Risposta garantita entro 24 ore lavorative</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <span>Demo gratuita, nessun obbligo</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Shield className="w-4 h-4 text-primary shrink-0" />
                <span>Dati trattati in conformità GDPR</span>
              </div>
            </div>
            <div className="mt-8 pt-8 border-t space-y-3">
              <p className="text-sm font-medium">Link utili</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { href: "/chi-siamo", label: "Chi siamo" },
                  { href: "/come-funziona", label: "Come funziona" },
                  { href: "/settori", label: "Esplora settori" },
                  { href: "/premium", label: "Piano Premium" },
                  { href: "/contatti", label: "Contatti generali" },
                ].map(l => (
                  <Link key={l.href} href={l.href}>
                    <Badge variant="outline" className="cursor-pointer hover:bg-muted transition-colors">{l.label}</Badge>
                  </Link>
                ))}
              </div>
            </div>
          </div>
          <div className="p-6 rounded-2xl border bg-card shadow-sm">
            <LeadForm />
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-16 border-t">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">Domande frequenti</h2>
          <Accordion type="single" collapsible className="space-y-2">
            {FAQ_ITEMS.map((faq, i) => (
              <AccordionItem key={i} value={`faq-${i}`} className="border rounded-xl px-4">
                <AccordionTrigger className="text-left font-medium text-sm py-4">{faq.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground pb-4">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* ── CTA FINALE ── */}
      <section className="py-16 border-t mb-8">
        <div className="rounded-3xl bg-primary text-primary-foreground p-10 md:p-14 text-center">
          <Star className="w-10 h-10 mx-auto mb-4 opacity-80" />
          <h2 className="text-3xl font-bold mb-4">Pronto a portare NorthStar nella tua istituzione?</h2>
          <p className="text-primary-foreground/75 max-w-xl mx-auto mb-8">
            Demo gratuita, nessun impegno, risposta in 24 ore. Inizia da qui.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" className="rounded-full px-8" asChild>
              <a href="#contatto">Richiedi la demo <ArrowRight className="ml-2 w-4 h-4" /></a>
            </Button>
            <Button size="lg" variant="outline" className="rounded-full px-8 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" asChild>
              <Link href="/contatti">Scrivi al team</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
