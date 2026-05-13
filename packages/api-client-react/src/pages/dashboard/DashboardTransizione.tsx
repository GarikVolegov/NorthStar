/**
 * DashboardTransizione.tsx
 *
 * Dashboard per utenti con journeyType === "in_transizione".
 * Profilo: sa dove vuole arrivare ma non è ancora lì.
 *
 * Sezioni:
 *   1. Header: ruolo attuale → ruolo target + % completamento piano
 *   2. KPI strip: XP · Streak · Obiettivi completati
 *   3. Azioni rapide: Coach AI / Esplora ruoli / Skills Gap / Network
 *   4. Skills gap: barre competenze attuale vs richiesto
 *   5. Roadmap a 3 fasi accordion (done/active/locked)
 *   6. Obiettivi di transizione con progress bar
 *   7. Mentor / connessioni nel settore target
 */
import { useState } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Compass, Target, Users,
  ChevronRight, CheckCircle2, Circle, Lock,
  TrendingUp, Brain, Search, Zap, Star,
  BarChart2, BookOpen, Clock, Sparkles,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';

// ── Tipi ──────────────────────────────────────────────────────────────────────

type TransitionData = {
  currentRole:         string | null;
  targetRole:          string | null;
  targetSector:        string | null;
  phasesCompleted:     number;
  totalXp:             number;
  currentStreak:       number;
  completedObjectives: number;
};

type Objective = {
  id:           number;
  title:        string;
  description:  string | null;
  progress:     number;
  targetValue:  number;
  currentValue: number;
  unit:         string | null;
  dueDate:      string | null;
  completed:    boolean;
};

// ── Costanti ──────────────────────────────────────────────────────────────────

const AZIONI = [
  {
    href: '/coach',
    icon: Brain,
    label: 'Coach AI',
    desc: "Pianifica la tua transizione con l'AI",
    gradient: 'from-violet-500/20 to-violet-600/5',
    accent: 'text-violet-400',
    border: 'border-violet-500/20 hover:border-violet-500/40',
  },
  {
    href: '/esplora',
    icon: Search,
    label: 'Esplora ruoli',
    desc: 'Scopri ruoli nel tuo settore target',
    gradient: 'from-blue-500/20 to-blue-600/5',
    accent: 'text-blue-400',
    border: 'border-blue-500/20 hover:border-blue-500/40',
  },
  {
    href: '/skills-gap',
    icon: BarChart2,
    label: 'Skills Gap',
    desc: 'Analizza le competenze da acquisire',
    gradient: 'from-amber-500/20 to-amber-600/5',
    accent: 'text-amber-400',
    border: 'border-amber-500/20 hover:border-amber-500/40',
  },
  {
    href: '/amici',
    icon: Users,
    label: 'Network target',
    desc: 'Connettiti con chi lavora già lì',
    gradient: 'from-emerald-500/20 to-emerald-600/5',
    accent: 'text-emerald-400',
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
  },
];

const SKILLS_MOCK = [
  { name: 'Python / Data Analysis', current: 30, required: 80 },
  { name: 'SQL & Database',         current: 55, required: 70 },
  { name: 'Machine Learning',       current: 10, required: 60 },
  { name: 'Data Visualization',     current: 40, required: 65 },
  { name: 'Comunicazione dati',     current: 70, required: 75 },
];

const ROADMAP_PHASES = [
  {
    phase: 1,
    label: 'Fondamenta',
    desc: 'Costruisci le skill base del ruolo target',
    weeks: '4–6 settimane',
    tasks: ['Completa corso Python base', 'Certificazione SQL', 'Portfolio 2 progetti'],
  },
  {
    phase: 2,
    label: 'Esperienza',
    desc: 'Progetti reali e networking nel settore',
    weeks: '8–12 settimane',
    tasks: ['Progetto Kaggle completato', '5 connessioni nel settore target', 'Aggiorna LinkedIn'],
  },
  {
    phase: 3,
    label: 'Transizione',
    desc: 'Candidature mirate e colloqui',
    weeks: '4–8 settimane',
    tasks: ['CV ottimizzato per il ruolo', '10 candidature inviate', 'Almeno 3 colloqui'],
  },
];

const MENTOR_MOCK = [
  { id: 1, name: 'Giulia Moretti',  role: "Data Analyst @ Spotify",      xp: 2400 },
  { id: 2, name: 'Andrea Fabbri',   role: "ML Engineer @ Banca d'Italia", xp: 3100 },
  { id: 3, name: 'Sara Cattaneo',   role: 'Data Scientist @ Satispay',    xp: 1900 },
];

// ── Animazioni ────────────────────────────────────────────────────────────────

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const fadeUp  = {
  hidden:  { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
};

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Sk({ className = '' }: { className?: string }) {
  return <div className={`rounded-xl bg-[hsl(var(--card))] animate-pulse ${className}`} />;
}

// ── Header ────────────────────────────────────────────────────────────────────

function TransitionHeader({ data, name }: { data: TransitionData; name: string }) {
  const pct = Math.round((data.phasesCompleted / 3) * 100);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera';

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[13px] text-[hsl(var(--muted-foreground))] mb-0.5">{greeting}, {name} 🧭</p>
          <h1 className="text-[22px] font-bold text-[hsl(var(--foreground))] tracking-tight">
            In transizione
          </h1>
          <p className="text-[13px] text-[hsl(var(--muted-foreground) / 0.8)] mt-1 max-w-[42ch]">
            Stai costruendo il tuo prossimo capitolo. Ogni skill acquisita è un passo avanti.
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20
                          flex items-center justify-center">
            <Compass className="w-6 h-6 text-blue-400" />
          </div>
          <p className="text-[10px] text-blue-400 mt-1 font-semibold">{pct}% completato</p>
        </div>
      </div>

      {/* Freccia ruolo attuale → target */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="mt-4 flex items-center gap-3 p-4 rounded-2xl bg-[hsl(var(--background))]
                   border border-foreground/[0.06]"
      >
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-[hsl(var(--muted-foreground) / 0.8)] uppercase tracking-wide mb-0.5">Ruolo attuale</p>
          <p className="text-[13px] font-semibold text-[hsl(var(--muted-foreground))] truncate">
            {data.currentRole ?? 'Non specificato'}
          </p>
        </div>
        <div className="flex-shrink-0 flex flex-col items-center gap-0.5">
          <ArrowRight className="w-5 h-5 text-blue-400" />
          <div className="h-0.5 w-8 bg-gradient-to-r from-blue-600 to-blue-400 rounded-full" />
        </div>
        <div className="flex-1 min-w-0 text-right">
          <p className="text-[10px] font-semibold text-[hsl(var(--chart-3))] uppercase tracking-wide mb-0.5">Ruolo target</p>
          <p className="text-[13px] font-bold text-[hsl(var(--foreground))] truncate">
            {data.targetRole ?? 'Da definire'}
          </p>
        </div>
      </motion.div>

      {/* Barra progresso piano */}
      <div className="mt-3 space-y-1.5">
        <div className="flex justify-between text-[11px]">
          <span className="text-[hsl(var(--muted-foreground) / 0.8)]">Fase {data.phasesCompleted} di 3 completata</span>
          <span className="text-blue-400">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ── KPI Strip ─────────────────────────────────────────────────────────────────

function KpiStrip({ data, loading }: { data: TransitionData | undefined; loading: boolean }) {
  const items = [
    { label: 'XP totale',  value: loading ? '–' : (data?.totalXp ?? 0).toLocaleString('it-IT'), icon: Zap,          color: 'text-amber-400' },
    { label: 'Streak',     value: loading ? '–' : `${data?.currentStreak ?? 0}gg`,              icon: TrendingUp,   color: 'text-orange-400' },
    { label: 'Completati', value: loading ? '–' : String(data?.completedObjectives ?? 0),       icon: CheckCircle2, color: 'text-emerald-400' },
  ];

  return (
    <motion.div variants={fadeUp} className="grid grid-cols-3 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex flex-col items-center py-3 px-2 rounded-xl bg-[hsl(var(--background))]
                     border border-foreground/[0.06] text-center"
        >
          <item.icon className={`w-4 h-4 ${item.color} mb-1.5`} />
          <p className="text-[16px] font-bold text-[hsl(var(--foreground))] tabular-nums leading-none">
            {item.value}
          </p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground) / 0.8)] mt-0.5">{item.label}</p>
        </div>
      ))}
    </motion.div>
  );
}

// ── Azioni rapide ─────────────────────────────────────────────────────────────

function AzioniRapide() {
  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-2 gap-3"
    >
      {AZIONI.map((a) => (
        <motion.div key={a.href} variants={fadeUp}>
          <Link
            href={a.href}
            className={`flex flex-col gap-2 p-4 rounded-2xl
              bg-gradient-to-br ${a.gradient} border ${a.border}
              transition-all duration-200 hover:scale-[1.02] hover:shadow-lg
              hover:shadow-black/20 block`}
          >
            <a.icon className={`w-5 h-5 ${a.accent}`} />
            <div>
              <p className="text-[13px] font-semibold text-[hsl(var(--foreground))]">{a.label}</p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground))] leading-snug">{a.desc}</p>
            </div>
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}

// ── Skills Gap ────────────────────────────────────────────────────────────────

function SkillsGapCard() {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? SKILLS_MOCK : SKILLS_MOCK.slice(0, 3);

  return (
    <motion.div
      variants={fadeUp}
      className="rounded-2xl bg-[hsl(var(--background))] border border-foreground/[0.06] p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[14px] font-semibold text-[hsl(var(--muted-foreground))] flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-amber-400" />
          Skills Gap
        </h2>
        <Link
          href="/skills-gap"
          className="text-[12px] text-[hsl(var(--chart-3))] hover:text-[hsl(var(--chart-3))] transition-colors flex items-center gap-1"
        >
          Dettaglio <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="space-y-3">
        {visible.map((skill) => {
          const gap     = Math.max(0, skill.required - skill.current);
          const covered = gap === 0;

          return (
            <div key={skill.name}>
              <div className="flex justify-between text-[12px] mb-1">
                <span className="text-[hsl(var(--foreground))] font-medium">{skill.name}</span>
                <span className={covered ? 'text-emerald-400' : 'text-amber-400/80'}>
                  {covered ? '✓ Ok' : `–${gap}% da fare`}
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                {/* required track (ghost) */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full opacity-20"
                  style={{
                    width: `${skill.required}%`,
                    background: covered ? 'hsl(var(--chart-2))' : 'hsl(var(--chart-1))',
                  }}
                />
                {/* current progress */}
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    background: covered
                      ? 'linear-gradient(90deg,hsl(var(--chart-2)),hsl(var(--chart-2)))'
                      : 'linear-gradient(90deg,hsl(var(--chart-1)),hsl(var(--chart-1)))',
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${skill.current}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {SKILLS_MOCK.length > 3 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-3 w-full text-[12px] text-[hsl(var(--muted-foreground) / 0.8)] hover:text-[hsl(var(--muted-foreground))] transition-colors"
        >
          {expanded
            ? 'Mostra meno ↑'
            : `Mostra altre ${SKILLS_MOCK.length - 3} skill ↓`}
        </button>
      )}
    </motion.div>
  );
}

// ── Roadmap fasi ──────────────────────────────────────────────────────────────

function RoadmapCard({ phasesCompleted }: { phasesCompleted: number }) {
  const [openPhase, setOpenPhase] = useState<number | null>(phasesCompleted + 1);

  return (
    <motion.div variants={fadeUp}>
      <h2 className="text-[14px] font-semibold text-[hsl(var(--muted-foreground))] flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-blue-400" />
        Piano di transizione
      </h2>

      <div className="space-y-2">
        {ROADMAP_PHASES.map((ph) => {
          const status: 'done' | 'active' | 'locked' =
            ph.phase <= phasesCompleted ? 'done'
            : ph.phase === phasesCompleted + 1 ? 'active'
            : 'locked';

          const isOpen = openPhase === ph.phase;

          const borderColor =
            status === 'done'   ? 'border-emerald-500/30' :
            status === 'active' ? 'border-blue-500/30' :
            'border-foreground/[0.06]';
          const bgColor =
            status === 'done'   ? 'bg-emerald-500/5' :
            status === 'active' ? 'bg-blue-500/5' :
            'bg-[hsl(var(--background))]';
          const IconComp =
            status === 'done'   ? CheckCircle2 :
            status === 'active' ? Zap :
            Lock;
          const iconColor =
            status === 'done'   ? 'text-emerald-400' :
            status === 'active' ? 'text-blue-400' :
            'text-[hsl(var(--muted-foreground) / 0.8)]';

          return (
            <motion.div
              key={ph.phase}
              layout
              className={`rounded-xl border ${borderColor} ${bgColor} overflow-hidden`}
            >
              <button
                onClick={() => setOpenPhase(isOpen ? null : ph.phase)}
                className="w-full flex items-center gap-3 p-4 text-left"
              >
                <IconComp className={`w-4 h-4 flex-shrink-0 ${iconColor}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[13px] font-semibold ${
                      status === 'locked' ? 'text-[hsl(var(--muted-foreground) / 0.8)]' : 'text-[hsl(var(--foreground))]'
                    }`}>
                      Fase {ph.phase}: {ph.label}
                    </span>
                    {status === 'active' && (
                      <span className="text-[10px] font-bold text-blue-400 bg-blue-400/10
                                       px-1.5 py-0.5 rounded-full">
                        IN CORSO
                      </span>
                    )}
                    {status === 'done' && (
                      <span className="text-[10px] font-bold text-emerald-400 bg-emerald-400/10
                                       px-1.5 py-0.5 rounded-full">
                        COMPLETATA
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[hsl(var(--muted-foreground) / 0.8)] mt-0.5">{ph.weeks}</p>
                </div>
                <ChevronRight
                  className={`w-4 h-4 flex-shrink-0 text-[hsl(var(--muted-foreground) / 0.8)] transition-transform ${
                    isOpen ? 'rotate-90' : ''
                  }`}
                />
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-1.5">
                      <p className="text-[12px] text-[hsl(var(--muted-foreground))] mb-2">{ph.desc}</p>
                      {ph.tasks.map((task, ti) => (
                        <div key={ti} className="flex items-center gap-2">
                          {status === 'done'
                            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                            : <Circle       className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground) / 0.8)] flex-shrink-0" />}
                          <span className={`text-[12px] ${
                            status === 'done'
                              ? 'line-through text-[hsl(var(--muted-foreground) / 0.8)]'
                              : 'text-[hsl(var(--muted-foreground))]'
                          }`}>
                            {task}
                          </span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── Obiettivi di transizione ───────────────────────────────────────────────────

function ObiettiviTransizione({
  objectives,
  loading,
}: {
  objectives: Objective[];
  loading: boolean;
}) {
  const active = objectives.filter((o) => !o.completed).slice(0, 4);

  return (
    <motion.div variants={fadeUp}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-semibold text-[hsl(var(--muted-foreground))] flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-violet-400" />
          Prossimi step
          {active.length > 0 && (
            <span className="text-[11px] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] px-2 py-0.5 rounded-full">
              {active.length}
            </span>
          )}
        </h2>
        <Link
          href="/percorso"
          className="text-[12px] text-[hsl(var(--chart-3))] hover:text-[hsl(var(--chart-3))] transition-colors flex items-center gap-1"
        >
          Tutti <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <Sk key={i} className="h-14" />)}
        </div>
      ) : active.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <Sparkles className="w-7 h-7 text-violet-400 mb-2" />
          <p className="text-[13px] text-[hsl(var(--foreground))] mb-1">Nessun passo attivo</p>
          <Link
            href="/percorso"
            className="text-[12px] text-[hsl(var(--chart-3))] hover:underline mt-1"
          >
            + Aggiungi obiettivo
          </Link>
        </div>
      ) : (
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          className="space-y-2"
        >
          {active.map((obj) => (
            <motion.div
              key={obj.id}
              variants={fadeUp}
              className="p-4 rounded-xl bg-[hsl(var(--background))] border border-foreground/[0.06]
                         hover:border-foreground/10 transition-all"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="text-[13px] font-semibold text-[hsl(var(--foreground))] leading-snug">
                  {obj.title}
                </p>
                {obj.dueDate && (
                  <div className="flex items-center gap-1 text-[11px] text-[hsl(var(--muted-foreground) / 0.8)] flex-shrink-0">
                    <Clock className="w-3 h-3" />
                    {new Date(obj.dueDate).toLocaleDateString('it-IT', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </div>
                )}
              </div>
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-[hsl(var(--muted-foreground) / 0.8)]">
                  {obj.currentValue} / {obj.targetValue}{obj.unit ? ` ${obj.unit}` : ''}
                </span>
                <span className="text-violet-400">{obj.progress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-violet-600 to-violet-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${obj.progress}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Mentor nel settore target ──────────────────────────────────────────────────

function MentorCard() {
  return (
    <motion.div variants={fadeUp}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-semibold text-[hsl(var(--muted-foreground))] flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-400" />
          Nel tuo settore target
        </h2>
        <Link
          href="/amici"
          className="text-[12px] text-[hsl(var(--chart-3))] hover:text-[hsl(var(--chart-3))] transition-colors flex items-center gap-1"
        >
          Connettiti <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="space-y-2">
        {MENTOR_MOCK.map((m) => (
          <motion.div
            key={m.id}
            variants={fadeUp}
            className="flex items-center gap-3 p-3.5 rounded-xl bg-[hsl(var(--background))]
                       border border-foreground/[0.06] hover:border-foreground/10 transition-all"
          >
            <div className="w-9 h-9 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] font-bold text-[hsl(var(--muted-foreground))]">
                {m.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[hsl(var(--foreground))] truncate">{m.name}</p>
              <p className="text-[11px] text-[hsl(var(--muted-foreground) / 0.8)] truncate">{m.role}</p>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-amber-400/70 flex-shrink-0">
              <Star className="w-3 h-3" />
              {m.xp.toLocaleString('it-IT')}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Pagina principale ─────────────────────────────────────────────────────────

export default function DashboardTransizione() {
  const { user } = useAuth();
  const name = (user as any)?.name?.split(' ')[0] ?? 'Professionista';

  const { data: transData, isLoading: loadingTrans } = useQuery<TransitionData>({
    queryKey: ['dashboard', 'transition'],
    queryFn:  () => apiClient.get<TransitionData>('/dashboard/transition'),
    staleTime: 60_000,
  });

  const { data: objData, isLoading: loadingObj } = useQuery<{ objectives: Objective[] }>({
    queryKey: ['dashboard', 'objectives'],
    queryFn:  () => apiClient.get<{ objectives: Objective[] }>('/dashboard/objectives'),
    staleTime: 30_000,
  });

  const objectives = objData?.objectives ?? [];

  const td: TransitionData = transData ?? {
    currentRole:         (user as any)?.currentRole ?? null,
    targetRole:          (user as any)?.targetRole  ?? null,
    targetSector:        null,
    phasesCompleted:     0,
    totalXp:             0,
    currentStreak:       0,
    completedObjectives: 0,
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      {loadingTrans ? (
        <div className="space-y-3">
          <Sk className="h-20" />
          <Sk className="h-16" />
        </div>
      ) : (
        <TransitionHeader data={td} name={name} />
      )}

      {/* KPI strip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <KpiStrip data={transData} loading={loadingTrans} />
      </motion.div>

      {/* Azioni rapide */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
        <h2 className="text-[13px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-3">
          Strumenti
        </h2>
        <AzioniRapide />
      </motion.div>

      {/* Skills gap */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <SkillsGapCard />
      </motion.div>

      {/* Roadmap */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
        <RoadmapCard phasesCompleted={td.phasesCompleted} />
      </motion.div>

      {/* Obiettivi */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        <ObiettiviTransizione objectives={objectives} loading={loadingObj} />
      </motion.div>

      {/* Mentor */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
        <MentorCard />
      </motion.div>

    </div>
  );
}
