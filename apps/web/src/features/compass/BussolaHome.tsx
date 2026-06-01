/**
 * BussolaHome — il corpo della casa dell'indeciso, riusabile.
 *
 * Usato sia a /bussola sia dentro il dashboard (dashboard e Bussola unificati).
 * Una sola fonte di verità: lo `stage`. Tutto è organizzato nei 4 momenti del
 * viaggio, con UN prossimo passo in evidenza e ogni strumento al posto giusto —
 * inclusi i tool storici (Test, Sessione Socratica, News): niente eliminato.
 */
import { useCompass, type CompassStage, type CompassBlockType } from "@/features/compass/useCompass";
import { CommittedActionPlan } from "@/features/compass/CommittedActionPlan";
import {
  Compass, Sparkles, Target, Zap, ArrowRight, HelpCircle, Swords, FlaskConical,
  Layers, BookOpen, HeartHandshake, Briefcase, Rocket, BrainCircuit, Newspaper,
  UserCircle, type LucideIcon,
} from "lucide-react";
import { Link, useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

const STAGES: { id: CompassStage; label: string; hint: string }[] = [
  { id: "zero_ideas", label: "Zero idee", hint: "Esploriamo" },
  { id: "hypotheses", label: "Ipotesi", hint: "Stanno emergendo direzioni" },
  { id: "experimenting", label: "In prova", hint: "Spike attivo" },
  { id: "committed", label: "Direzione", hint: "Confermata dall'esperienza" },
];

const BLOCK_LABEL: Record<CompassBlockType, string> = {
  too_many_interests: "Troppi interessi",
  no_interests: "Niente mi accende",
  fear_economic: "Paura economica",
  external_pressure: "Pressione esterna",
  fear_mediocrity: "Paura di essere mediocre",
  unknown: "Da capire",
};

interface Tool { href: string; icon: LucideIcon; title: string; desc: string }
interface Phase { id: string; n: number; label: string; tagline: string; stages: CompassStage[]; tools: Tool[] }

const PHASES: Phase[] = [
  {
    id: "scopri", n: 1, label: "Scopri", tagline: "Cosa ti muove, per davvero",
    stages: ["zero_ideas"],
    tools: [
      { href: `${BASE}bussola/blocco`, icon: HelpCircle, title: "Cosa ti blocca", desc: "Diamo un nome all'indecisione" },
      { href: `${BASE}bussola/specchio`, icon: Sparkles, title: "Lo Specchio", desc: "Reagisci a momenti reali: emergono le preferenze" },
      { href: `${BASE}test`, icon: Zap, title: "Test di personalità", desc: "Mappa il tuo profilo RIASEC" },
      { href: `${BASE}diario?mode=indizi`, icon: BookOpen, title: "Diario degli Indizi", desc: "Annota un momento di energia o curiosità" },
      { href: `${BASE}coach?mode=socratic`, icon: BrainCircuit, title: "Sessione Socratica", desc: "4 step con Wendy per fare chiarezza" },
      { href: `${BASE}mood`, icon: HeartHandshake, title: "Mood check-in", desc: "60s: come stai? Ti suggerisco una cosa" },
    ],
  },
  {
    id: "sperimenta", n: 2, label: "Sperimenta", tagline: "Senti com'è davvero, prima di scegliere",
    stages: ["zero_ideas", "hypotheses"],
    tools: [
      { href: `${BASE}settori`, icon: Layers, title: "Scegli settore e ruolo", desc: "Trova l'area, poi il ruolo da approfondire" },
      { href: `${BASE}ruoli`, icon: Rocket, title: "Prova una giornata", desc: "Assaggia un ruolo concreto prima di puntarci" },
      { href: `${BASE}news`, icon: Newspaper, title: "Notizie lavoro", desc: "Cosa si muove nel mercato del lavoro" },
    ],
  },
  {
    id: "restringi", n: 3, label: "Restringi", tagline: "Per sottrazione: quale ti tira di più?",
    stages: ["hypotheses"],
    tools: [
      { href: `${BASE}bussola/torneo`, icon: Swords, title: "Il Torneo", desc: "Scegli a coppie: la direzione si affina" },
    ],
  },
  {
    id: "agisci", n: 4, label: "Decidi & Agisci", tagline: "Un test reversibile, poi il lavoro vero",
    stages: ["experimenting", "committed"],
    tools: [
      { href: `${BASE}bussola/spike`, icon: FlaskConical, title: "Mettila alla prova", desc: "Uno spike di 2 settimane, reversibile" },
      { href: `${BASE}candidature`, icon: Briefcase, title: "Le mie candidature", desc: "Quando la direzione regge: candidati e traccia" },
    ],
  },
];

/** L'UNICO prossimo passo consigliato, derivato dallo stage + blocco. */
function nextStep(stage: CompassStage, block: CompassBlockType, hasHypotheses: boolean): Tool {
  if (block === "unknown") {
    return { href: `${BASE}bussola/blocco`, icon: HelpCircle, title: "Capiamo cosa ti blocca", desc: "Dare un nome all'indecisione è il primo passo per scioglierla." };
  }
  switch (stage) {
    case "zero_ideas":
      return block === "too_many_interests"
        ? { href: `${BASE}bussola/torneo`, icon: Swords, title: "Restringi col Torneo", desc: "Hai tanti interessi: procediamo per sottrazione." }
        : { href: `${BASE}bussola/specchio`, icon: Sparkles, title: "Fai lo Specchio", desc: "La direzione emerge da come reagisci, non da un quiz." };
    case "hypotheses":
      return hasHypotheses
        ? { href: `${BASE}bussola/torneo`, icon: Swords, title: "Affina col Torneo", desc: "Hai delle ipotesi: mettile a confronto per farne emergere una netta." }
        : { href: `${BASE}bussola/specchio`, icon: Sparkles, title: "Continua con lo Specchio", desc: "Servono ancora segnali perché una direzione emerga." };
    case "experimenting":
      return { href: `${BASE}bussola/spike`, icon: FlaskConical, title: "Rivedi il tuo spike", desc: "È un test reversibile: cosa hai scoperto in queste settimane?" };
    case "committed":
      return { href: `${BASE}candidature`, icon: Briefcase, title: "Passa all'azione", desc: "La direzione ha retto: ora trasformala in candidature reali." };
  }
}

export function BussolaHome({ showHeader = true }: { showHeader?: boolean }) {
  const { profile, loading, error } = useCompass();
  const [, setLocation] = useLocation();

  if (loading) {
    return <div className="p-6 text-muted-foreground">Calibro la tua bussola…</div>;
  }
  if (error || !profile) {
    return <div className="p-6 text-destructive">Non riesco a leggere la bussola. {error}</div>;
  }

  const stageIdx = STAGES.findIndex((s) => s.id === profile.stage);
  const openHyp = profile.hypotheses.filter((h) => h.verdict !== "discarded");
  const energizers = profile.energyProfile?.energizers ?? [];
  const step = nextStep(profile.stage, profile.blockType, openHyp.length > 0);
  const StepIcon = step.icon;

  return (
    <div className="space-y-8">
      {showHeader && (
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Compass className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">La tua Bussola</h1>
              <p className="text-sm text-muted-foreground">Non una mappa, una direzione che si calibra mentre esplori.</p>
            </div>
          </div>
          <Link href={`${BASE}chi-sono`} className="hidden items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition hover:border-primary/50 sm:flex">
            <UserCircle className="h-4 w-4 text-primary" /> Chi sono
          </Link>
        </header>
      )}

      {/* Il ponte verso il lavoro vero (solo se direzione confermata / committed) */}
      <CommittedActionPlan />

      {/* IL PROSSIMO PASSO — un'azione chiara in evidenza */}
      <button
        onClick={() => setLocation(step.href)}
        className="group flex w-full items-center justify-between gap-4 rounded-2xl border-2 border-primary/40 bg-primary/5 p-5 text-left transition hover:border-primary"
      >
        <span className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <StepIcon className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-xs font-semibold uppercase tracking-wide text-primary">Il tuo prossimo passo</span>
            <span className="block text-lg font-bold">{step.title}</span>
            <span className="block text-sm text-muted-foreground">{step.desc}</span>
          </span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 text-primary transition group-hover:translate-x-1" />
      </button>

      {/* Stage progress — "sei qui" */}
      <section className="rounded-xl border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Il tuo punto del viaggio</span>
          <span className="text-xs text-muted-foreground">
            confidenza direzione {Math.round(profile.directionConfidence * 100)}%
          </span>
        </div>
        <div className="flex items-center gap-2">
          {STAGES.map((s, i) => (
            <div key={s.id} className="flex flex-1 flex-col items-center gap-1">
              <div className={`h-2 w-full rounded-full ${i <= stageIdx ? "bg-primary" : "bg-muted"}`} />
              <span className={`text-[11px] ${i === stageIdx ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {STAGES[stageIdx >= 0 ? stageIdx : 0]?.hint} · {profile.signalCount} segnali raccolti
          {profile.blockType !== "unknown" && ` · blocco: ${BLOCK_LABEL[profile.blockType]}`}
        </p>
      </section>

      {/* Ipotesi */}
      {openHyp.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Ipotesi che stanno emergendo</h2>
          </div>
          <ul className="space-y-2">
            {openHyp.map((h) => (
              <li key={h.clusterId} className="rounded-lg border bg-card p-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{h.label}</span>
                  <span className="text-xs text-muted-foreground">{Math.round(h.confidence * 100)}%</span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
                  <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.round(h.confidence * 100)}%` }} />
                </div>
                {h.source.length > 0 && (
                  <p className="mt-2 text-[11px] text-muted-foreground">da: {h.source.join(", ")}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Energia */}
      {energizers.length > 0 && (
        <section className="rounded-xl border bg-card p-5">
          <div className="mb-2 flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold">Cosa ti accende</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {energizers.map((e) => (
              <span key={e} className="rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">{e}</span>
            ))}
          </div>
        </section>
      )}

      {/* I 4 momenti — tutto a portata, raggruppato; la fase corrente in evidenza */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Il tuo viaggio, in 4 momenti</h2>
          <Link href={`${BASE}chi-sono`} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
            <UserCircle className="h-4 w-4" /> Chi sono
          </Link>
        </div>
        {PHASES.map((phase) => {
          const active = phase.stages.includes(profile.stage);
          return (
            <div
              key={phase.id}
              className={`rounded-xl border p-4 transition ${active ? "border-primary/40 bg-primary/5" : "border-border bg-card/40"}`}
            >
              <div className="mb-3 flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {phase.n}
                </span>
                <span className="font-semibold">{phase.label}</span>
                <span className="text-xs text-muted-foreground">· {phase.tagline}</span>
                {active && <span className="ml-auto rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">sei qui</span>}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {phase.tools.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.href}
                      onClick={() => setLocation(t.href)}
                      className="group flex items-center justify-between gap-2 rounded-lg border bg-card p-3 text-left transition hover:border-primary/50"
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="h-5 w-5 shrink-0 text-primary" />
                        <span>
                          <span className="block text-sm font-medium">{t.title}</span>
                          <span className="block text-xs text-muted-foreground">{t.desc}</span>
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-1" />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
