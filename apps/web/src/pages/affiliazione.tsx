import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiClientError, postJson } from "@/lib/apiClient";
import { usePageMeta } from "@/lib/seo";
import {
  ArrowRight,
  Award,
  BarChart3,
  BookOpen,
  Brain,
  Briefcase,
  Building2,
  CheckCircle2,
  ChevronRight,
  Compass,
  Globe,
  GraduationCap,
  Handshake, Mail,
  MessageSquare,
  School,
  Shield,
  Star,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL ?? "/";

function LeadForm() {
  const { t } = useTranslation();
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
      await postJson(`${BASE}api/affiliazione/lead`, form);
      setStatus("ok");
    } catch (error) {
      setStatus("err");
      setErrMsg(
        error instanceof ApiClientError
          ? error.message
          : t("affiliazione.formErrorNetwork"),
      );
    }
  }

  if (status === "ok") {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-xl font-bold mb-2">{t("affiliazione.formSuccessTitle")}</h3>
        <p className="text-muted-foreground">{t("affiliazione.formSuccessDesc")}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1">{t("affiliazione.formInstitution")}</label>
          <input
            required
            value={form.institutionName}
            onChange={e => set("institutionName", e.target.value)}
            placeholder={t("affiliazione.formInstitutionPlaceholder")}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("affiliazione.formPartnerType")}</label>
          <select
            required
            value={form.partnerType}
            onChange={e => set("partnerType", e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">{t("affiliazione.formSelect")}</option>
            <option value="scuola_media">{t("affiliazione.partnerTypes.scuolaMedie")}</option>
            <option value="scuola_superiore">{t("affiliazione.partnerTypes.scuoleSuperiori")}</option>
            <option value="universita">{t("affiliazione.partnerTypes.universita")}</option>
            <option value="agenzia_lavoro">{t("affiliazione.partnerTypes.agenziaLavoro")}</option>
            <option value="centro_formazione">{t("affiliazione.partnerTypes.centroFormazione")}</option>
            <option value="ente_pubblico">{t("affiliazione.partnerTypes.entePubblico")}</option>
            <option value="orientatore">{t("affiliazione.partnerTypes.orientatore")}</option>
            <option value="altro">{t("affiliazione.partnerTypes.altro")}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("affiliazione.formUsers")}</label>
          <select
            value={form.estimatedUsers}
            onChange={e => set("estimatedUsers", e.target.value)}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">{t("affiliazione.formUsersUnknown")}</option>
            <option value="< 100">{t("affiliazione.userRanges.lt100")}</option>
            <option value="100-500">{t("affiliazione.userRanges.r100_500")}</option>
            <option value="500-2000">{t("affiliazione.userRanges.r500_2000")}</option>
            <option value="> 2000">{t("affiliazione.userRanges.gt2000")}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("affiliazione.formName")}</label>
          <input
            required
            value={form.contactName}
            onChange={e => set("contactName", e.target.value)}
            placeholder={t("affiliazione.formNamePlaceholder")}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("affiliazione.formEmail")}</label>
          <input
            required
            type="email"
            value={form.email}
            onChange={e => set("email", e.target.value)}
            placeholder={t("affiliazione.formEmailPlaceholder")}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("affiliazione.formPhone")}</label>
          <input
            type="tel"
            value={form.phone}
            onChange={e => set("phone", e.target.value)}
            placeholder={t("affiliazione.formPhonePlaceholder")}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium mb-1">{t("affiliazione.formMessage")}</label>
          <textarea
            rows={4}
            value={form.message}
            onChange={e => set("message", e.target.value)}
            placeholder={t("affiliazione.formMessagePlaceholder")}
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
          />
        </div>
      </div>
      {status === "err" && (
        <p className="text-destructive text-sm">{errMsg}</p>
      )}
      <Button type="submit" disabled={status === "sending"} className="w-full rounded-full" size="lg">
        {status === "sending" ? t("affiliazione.formSending") : t("affiliazione.formSubmit")}
        {status !== "sending" && <ArrowRight className="ml-2 w-4 h-4" />}
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        {t("affiliazione.formNote")}{" "}
        <Link href="/privacy-policy" className="underline hover:text-primary">{t("affiliazione.formPrivacy")}</Link>.
      </p>
    </form>
  );
}

export default function Affiliazione() {
  const { t } = useTranslation();

  usePageMeta({
    title: "Partner e Partnership istituzionale",
    description: "Porta NorthStar nella tua scuola, università o agenzia. Programma di partnership B2B per istituzioni formative: referral, licenza istituzionale, white label e ambassador.",
    path: "/affiliazione",
  });

  const PARTNER_TYPES = useMemo(() => [
    {
      icon: School,
      label: t("affiliazione.partnerTypes.scuolaMedie"),
      href: "/affiliazione/scuole",
      color: "bg-blue-50 text-blue-700 border-blue-200",
      iconBg: "bg-blue-100 text-blue-700",
      uses: ["Orientamento iniziale", "Scoperta degli interessi", "Supporto alla scelta futura", "Workshop in classe"],
    },
    {
      icon: GraduationCap,
      label: t("affiliazione.partnerTypes.scuoleSuperiori"),
      href: "/affiliazione/scuole",
      color: "bg-emerald-50 text-emerald-700 border-emerald-200",
      iconBg: "bg-emerald-100 text-emerald-700",
      uses: ["Orientamento post-diploma", "Supporto università / ITS / lavoro", "Test attitudinali", "Presentazione aree"],
    },
    {
      icon: Building2,
      label: t("affiliazione.partnerTypes.universita"),
      href: "/affiliazione/universita",
      color: "bg-violet-50 text-violet-700 border-violet-200",
      iconBg: "bg-violet-100 text-violet-700",
      uses: ["Orientamento in ingresso", "Studenti indecisi", "Career planning", "Retention formativa"],
    },
    {
      icon: Briefcase,
      label: t("affiliazione.partnerTypes.agenziaLavoro"),
      href: "/affiliazione/agenzie-lavoro",
      color: "bg-orange-50 text-orange-700 border-orange-200",
      iconBg: "bg-orange-100 text-orange-700",
      uses: ["Matching candidati", "Orientamento professionale", "Ricollocazione", "Analisi competenze"],
    },
    {
      icon: BookOpen,
      label: t("affiliazione.partnerTypes.centroFormazione"),
      href: "/affiliazione/centri-formazione",
      color: "bg-rose-50 text-rose-700 border-rose-200",
      iconBg: "bg-rose-100 text-rose-700",
      uses: ["Scelta percorsi pratici", "Formazione tecnica", "Valorizzazione mestieri", "Accompagnamento ITS"],
    },
    {
      icon: Users,
      label: t("affiliazione.partnerTypes.entePubblico"),
      href: "/affiliazione",
      color: "bg-teal-50 text-teal-700 border-teal-200",
      iconBg: "bg-teal-100 text-teal-700",
      uses: ["Progetti di orientamento", "Bandi territoriali", "Sportelli lavoro", "Iniziative formative"],
    },
  ], [t]);

  const INSTITUTION_BENEFITS = useMemo(() => [
    { icon: Zap, title: "Servizio digitale innovativo", desc: "Offri ai tuoi utenti uno strumento moderno, basato su dati reali e psicologia validata." },
    { icon: BarChart3, title: "Dati e reportistica", desc: "Accedi a dashboard aggregate sull'utilizzo e sui profili dei tuoi utenti (nel rispetto della privacy)." },
    { icon: Brain, title: "Test personalizzati", desc: "Il test RIASEC + Bussola Interiore si adatta a ogni contesto: studenti, candidati, lavoratori." },
    { icon: TrendingUp, title: "Contenuti sempre aggiornati", desc: "21 aree con dati aggiornati su stipendi, crescita e trend del mercato del lavoro italiano." },
    { icon: Award, title: "Reputazione e qualità percepita", desc: "Associare il tuo brand a NorthStar aumenta la qualità percepita del servizio offerto." },
    { icon: Globe, title: "Scalabile e multi-utente", desc: "Gestisci decine, centinaia o migliaia di utenti da un'unica piattaforma condivisa." },
  ], []);

  const USER_BENEFITS = useMemo(() => [
    { icon: Compass, title: "Chiarezza nella scelta", desc: "Trasforma il disorientamento in direzione concreta, senza promesse vuote." },
    { icon: Brain, title: "Conoscenza di sé", desc: "Scopre il proprio profilo RIASEC e la Bussola Interiore in meno di 3 minuti." },
    { icon: BarChart3, title: "Dati reali sul mercato", desc: "Stipendi, crescita, rischio AI: informazioni vere per decidere con consapevolezza." },
    { icon: Star, title: "Piano personalizzato", desc: "Wiki, Roadmap e Mappa della Conoscenza per costruire il proprio piano d'azione." },
  ], []);

  const MODELS = useMemo(() => [
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
  ], []);

  const HOW_STEPS = useMemo(() => [
    { n: "01", title: "Contattaci", desc: "Compila il form o scrivici a partners@northstar.app. Ti rispondiamo entro 24 ore lavorative." },
    { n: "02", title: "Demo personalizzata", desc: "Organizziamo una sessione di 30 minuti per mostrare la piattaforma nel vostro contesto specifico." },
    { n: "03", title: "Accordo su misura", desc: "Definiamo insieme il modello di collaborazione più adatto: referral, licenza, white label o ambassador." },
    { n: "04", title: "Onboarding e lancio", desc: "Supporto tecnico e materiali dedicati per introdurre NorthStar ai vostri utenti nel modo più efficace." },
  ], []);

  const FAQ_ITEMS = useMemo(() => [
    { q: "A chi si rivolge il programma di affiliazione?", a: "A scuole medie e superiori, università, agenzie per il lavoro, centri di formazione professionale, enti pubblici e privati, orientatori e consulenti individuali." },
    { q: "Come funziona la partnership concretamente?", a: "Dipende dal modello scelto. Per il referral: condividi un link dedicato e ricevi commissione sulle conversioni. Per la licenza: un contratto flat con accesso multiplo." },
    { q: "È possibile personalizzare la piattaforma?", a: "Il white label parziale prevede personalizzazione di logo, colori e URL. Per esigenze più avanzate, valutiamo soluzioni su misura." },
    { q: "NorthStar è adatto all'orientamento scolastico?", a: "Sì. Il test RIASEC è usato in ambito accademico e scolastico da decenni. La nostra versione è pensata per il contesto italiano: 21 aree, dati aggiornati, linguaggio accessibile." },
    { q: "Come viene gestita la privacy degli utenti?", a: "NorthStar è conforme al GDPR. I dati degli utenti sono cifrati, non venduti a terzi e non condivisi con le istituzioni partner senza il consenso esplicito dell'utente." },
    { q: "Esiste una demo gratuita?", a: "Sì. Compila il form in fondo a questa pagina e ti organizziamo una demo personalizzata gratuita di 30 minuti, senza impegno." },
    { q: "Qual è il costo per l'istituzione?", a: "Dipende dal modello. Il referral non ha costi iniziali. La licenza istituzionale è concordata su volume. Contattaci per un preventivo gratuito." },
  ], []);

  const STATS = useMemo(() => [
    { n: "21", label: t("affiliazione.schools") === "Schools" ? "Professional areas" : "Aree professionali" },
    { n: "RIASEC", label: t("affiliazione.schools") === "Schools" ? "Globally validated test" : "Test validato globalmente" },
    { n: "100%", label: "GDPR" },
    { n: "Free", label: t("affiliazione.contactFree").split(",")[0] },
  ], [t]);
  void STATS;

  const SOLUTION_FEATURES = [
    { icon: Brain, title: "Test di personalità", desc: "RIASEC + Bussola Interiore in meno di 3 minuti. Validato scientificamente, pensato per il contesto italiano." },
    { icon: Compass, title: "Matching con 21 aree", desc: "L'algoritmo incrocia il profilo con dati reali di mercato: stipendi, crescita, rischio AI, trend." },
    { icon: TrendingUp, title: "Percorsi formativi", desc: "Wiki, Roadmap e Mappa della Conoscenza per costruire un piano d'azione concreto e personalizzato." },
    { icon: BarChart3, title: "Dati aggiornati", desc: "21 aree professionali con dati sul mercato del lavoro italiano costantemente aggiornati." },
    { icon: Shield, title: "Privacy GDPR", desc: "Gestione dei dati conforme al regolamento europeo. DPA incluso in ogni partnership istituzionale." },
    { icon: Globe, title: "Multidevice e scalabile", desc: "Accessibile da qualsiasi dispositivo. Funziona con 10 utenti come con 10.000." },
  ];

  const FACTS = [
    "Il 42% degli studenti universitari si dichiara insoddisfatto della scelta compiuta",
    "Il 30% degli iscritti abbandona il percorso nei primi 2 anni",
    "Meno del 20% degli istituti usa strumenti digitali per l'orientamento",
    "Il mismatch tra formazione e lavoro costa all'Italia miliardi ogni anno",
  ];

  return (
    <div className="max-w-6xl mx-auto px-4">

      {/* ── HERO ── */}
      <section className="py-20 md:py-28 text-center">
        <Badge variant="outline" className="mb-6 px-4 py-1.5 text-sm font-medium rounded-full border-primary/30 text-primary">
          {t("affiliazione.heroBadge")}
        </Badge>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6 max-w-4xl mx-auto leading-tight">
          {t("affiliazione.heroTitle")} <span className="text-primary">NorthStar</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          {t("affiliazione.heroDesc")}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button size="lg" className="rounded-full px-8" asChild>
            <a href="#contatto">{t("affiliazione.requestDemo")} <ArrowRight className="ml-2 w-4 h-4" /></a>
          </Button>
          <Button size="lg" variant="outline" className="rounded-full px-8" asChild>
            <a href="#come-funziona">{t("affiliazione.howItWorks")}</a>
          </Button>
        </div>
        <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto text-center">
          {[
            { n: "21", label: "Aree" },
            { n: "RIASEC", label: "Test validato" },
            { n: "100%", label: "GDPR" },
            { n: "Free", label: t("affiliazione.contactFree").split(",")[0] },
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
            <h2 className="text-3xl font-bold mb-4">{t("affiliazione.problemTitle")}</h2>
            <p className="text-muted-foreground mb-4 leading-relaxed">
              Il mercato del lavoro cambia più velocemente dei programmi formativi. Studenti e candidati si trovano davanti a scelte cruciali con strumenti obsoleti: brochure, colloqui occasionali, test carta-penna.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Il risultato? Scelte sbagliate, abbandoni, demotivazione. Le istituzioni che offrono un'esperienza moderna di orientamento si distinguono, aumentano la fidelizzazione e producono risultati migliori.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {FACTS.map((fact, i) => (
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
          <h2 className="text-3xl font-bold mb-4">{t("affiliazione.solutionTitle")}</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">{t("affiliazione.solutionDesc")}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {SOLUTION_FEATURES.map(f => (
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
          <h2 className="text-3xl font-bold mb-4">{t("affiliazione.partnerTypesTitle")}</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">{t("affiliazione.partnerTypesDesc")}</p>
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
            <h2 className="text-2xl font-bold mb-8">{t("affiliazione.institutionBenefitsTitle")}</h2>
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
            <h2 className="text-2xl font-bold mb-8">{t("affiliazione.userBenefitsTitle")}</h2>
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
                {t("affiliazione.quote")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── MODELLI DI AFFILIAZIONE ── */}
      <section className="py-16 border-t">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">{t("affiliazione.modelsTitle")}</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">{t("affiliazione.modelsDesc")}</p>
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
          <h2 className="text-3xl font-bold mb-4">{t("affiliazione.howFunctionTitle")}</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">{t("affiliazione.howFunctionDesc")}</p>
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
            <h2 className="text-3xl font-bold mb-4">{t("affiliazione.contactTitle")}</h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">{t("affiliazione.contactDesc")}</p>
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Mail className="w-4 h-4 text-primary shrink-0" />
                <span>partners@northstar.app</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <MessageSquare className="w-4 h-4 text-primary shrink-0" />
                <span>{t("affiliazione.contactReply")}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                <span>{t("affiliazione.contactFree")}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Shield className="w-4 h-4 text-primary shrink-0" />
                <span>{t("affiliazione.contactGdpr")}</span>
              </div>
            </div>
            <div className="mt-8 pt-8 border-t space-y-3">
              <p className="text-sm font-medium">{t("affiliazione.usefulLinks")}</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { href: "/chi-siamo", label: "Chi siamo" },
                  { href: "/come-funziona", label: "Come funziona" },
                  { href: "/settori", label: "Esplora aree" },
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
          <h2 className="text-3xl font-bold mb-8 text-center">{t("affiliazione.faqTitle")}</h2>
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
          <h2 className="text-3xl font-bold mb-4">{t("affiliazione.ctaTitle")}</h2>
          <p className="text-primary-foreground/75 max-w-xl mx-auto mb-8">{t("affiliazione.ctaDesc")}</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" className="rounded-full px-8" asChild>
              <a href="#contatto">{t("affiliazione.requestDemoShort")} <ArrowRight className="ml-2 w-4 h-4" /></a>
            </Button>
            <Button size="lg" variant="outline" className="rounded-full px-8 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" asChild>
              <Link href="/contatti">{t("affiliazione.ctaContact")}</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
