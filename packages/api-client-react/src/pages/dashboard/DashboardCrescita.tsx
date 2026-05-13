/**
 * DashboardCrescita.tsx
 *
 * Dashboard per utenti con journeyType === "in_crescita".
 *
 * Profilo: sa già dove è e vuole salire di livello nel suo ruolo attuale.
 * Non cambia direzione — vuole crescere in profondità.
 *
 * Sezioni:
 *   1. Header: livello + settore + XP barra animata
 *   2. Streak settimanale — calendario 7 giorni
 *   3. Obiettivi attivi con progress bar
 *   4. Certificazioni consigliate per il settore
 *   5. Ranking nel settore (preview leaderboard)
 *   6. Azioni rapide: percorso, skills-gap, coach, certificazioni
 */
import { useState } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Zap, Flame, Target, Star, ChevronRight,
  ArrowRight, TrendingUp, Award, Users, BookOpen,
  CheckCircle2, Circle, Lock, BarChart2, Sparkles,
  GraduationCap, Brain, Rocket, Clock,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';

// ── Tipi ──────────────────────────────────────────────────────────────────

type UserStats = {
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  completedObjectives: number;
  level: number;
};

type Objective = {
  id: number;
  title: string;
  description: string | null;
  progress: number;      // 0-100
  targetValue: number;
  currentValue: number;
  unit: string | null;
  dueDate: string | null;
  completed: boolean;
};

type LeaderboardEntry = {
  rank: number;
  userId: number;
  name: string;
  avatarUrl: string | null;
  totalXp: number;
  isCurrentUser: boolean;
};

// ── Costanti ─────────────────────────────────────────────────────────────────

const AZIONI_RAPIDE = [
  {
    href: '/percorso', icon: Rocket, label: 'Il tuo percorso',
    desc: 'Roadmap e milestone personalizzata',
    gradient: 'from-amber-500/20 to-amber-600/5',
    accent: 'text-amber-400', border: 'border-amber-500/20 hover:border-amber-500/40',
  },
  {
    href: '/skills-gap', icon: BarChart2, label: 'Skills Gap',
    desc: 'Analizza le competenze che mancano',
    gradient: 'from-blue-500/20 to-blue-600/5',
    accent: 'text-blue-400', border: 'border-blue-500/20 hover:border-blue-500/40',
  },
  {
    href: '/coach', icon: Brain, label: 'Coach AI',
    desc: 'Sessione di coaching personalizzata',
    gradient: 'from-violet-500/20 to-violet-600/5',
    accent: 'text-violet-400', border: 'border-violet-500/20 hover:border-violet-500/40',
  },
  {
    href: '/certificazioni', icon: GraduationCap, label: 'Certificazioni',
    desc: 'Le certificazioni più rilevanti per il tuo ruolo',
    gradient: 'from-emerald-500/20 to-emerald-600/5',
    accent: 'text-emerald-400', border: 'border-emerald-500/20 hover:border-emerald-500/40',
  },
];

const CERT_MOCK = [
  { id: 1, name: 'Google Data Analytics',        provider: 'Google',     hours: 180, level: 'Intermedio', hot: true  },
  { id: 2, name: 'AWS Cloud Practitioner',        provider: 'Amazon',     hours: 60,  level: 'Base',       hot: false },
  { id: 3, name: 'Meta Front-End Developer',      provider: 'Meta',       hours: 240, level: 'Avanzato',   hot: true  },
  { id: 4, name: 'IBM Data Science Professional', provider: 'IBM',        hours: 300, level: 'Avanzato',   hot: false },
];

const DAYS_IT = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

// ── Animazioni ─────────────────────────────────────────────────────────────────

const stagger  = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const fadeUp   = { hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } } };

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Sk({ className = '' }: { className?: string }) {
  return <div className={`rounded-xl bg-[hsl(var(--card))] animate-pulse ${className}`} />;
}

// ── Header XP ────────────────────────────────────────────────────────────────

function XpCard({ stats, sectorName }: { stats: UserStats; sectorName: string }) {
  const xpInLevel  = stats.totalXp % 500;
  const xpNeeded   = 500;
  const progress   = (xpInLevel / xpNeeded) * 100;

  const levelLabel = [
    '', 'Principiante', 'Apprendista', 'Praticante', 'Esperto',
    'Specialista', 'Senior', 'Lead', 'Principal', 'Director', 'VP',
  ];

  return (
    <motion.div variants={fadeUp}
      className="rounded-2xl bg-[hsl(var(--background))] border border-amber-500/20 p-5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-40 h-40 rounded-full
                      bg-amber-500/5 blur-3xl pointer-events-none" />
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-[12px] font-semibold text-amber-400/80 uppercase tracking-wide">
              Livello {stats.level}
            </span>
          </div>
          <h2 className="text-[20px] font-bold text-[hsl(var(--foreground))]">
            {levelLabel[Math.min(stats.level, 10)] ?? 'Maestro'}
          </h2>
          <p className="text-[12px] text-[hsl(var(--muted-foreground))] mt-0.5">{sectorName}</p>
        </div>
        <div className="text-right">
          <p className="text-[22px] font-bold text-[hsl(var(--foreground))] tabular-nums">
            {stats.totalXp.toLocaleString('it-IT')}
          </p>
          <p className="text-[11px] text-[hsl(var(--muted-foreground))]">XP totale</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px]">
          <span className="text-[hsl(var(--muted-foreground))]">{xpInLevel.toLocaleString('it-IT')} / {xpNeeded} XP</span>
          <span className="text-amber-400/70">{Math.round(progress)}%</span>
        </div>
        <div className="h-2 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }}
          />
        </div>
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {(xpNeeded - xpInLevel).toLocaleString('it-IT')} XP al livello {stats.level + 1}
        </p>
      </div>
    </motion.div>
  );
}

// ── Streak settimanale ───────────────────────────────────────────────────────

function StreakCard({ streak, longest }: { streak: number; longest: number }) {
  // Mostra gli ultimi 7 giorni. Coloriamo i giorni "attivi" basandoci sullo streak attuale.
  const today      = new Date().getDay(); // 0=dom
  const todayIdx   = today === 0 ? 6 : today - 1; // converti in L=0..D=6
  const activeDays = new Set<number>();
  for (let i = 0; i < Math.min(streak, 7); i++) {
    const d = ((todayIdx - i) + 7) % 7;
    activeDays.add(d);
  }

  return (
    <motion.div variants={fadeUp}
      className="rounded-2xl bg-[hsl(var(--background))] border border-foreground/[0.06] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Flame className={`w-4 h-4 ${streak > 0 ? 'text-orange-400' : 'text-[hsl(var(--muted-foreground))]'}`} />
          <span className="text-[12px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
            Streak attivo
          </span>
        </div>
        <span className="text-[13px] font-bold text-[hsl(var(--foreground))] tabular-nums">
          {streak} <span className="text-[11px] font-normal text-[hsl(var(--muted-foreground))]">gg</span>
        </span>
      </div>

      <div className="flex gap-1.5 justify-between">
        {DAYS_IT.map((label, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className={`
              w-full aspect-square rounded-lg flex items-center justify-center
              text-[10px] font-bold transition-colors
              ${
                i === todayIdx && activeDays.has(i)
                  ? 'bg-orange-500 text-[hsl(var(--foreground))]'
                  : activeDays.has(i)
                  ? 'bg-orange-500/30 text-orange-400'
                  : i === todayIdx
                  ? 'bg-[hsl(var(--muted))] text-[hsl(var(--chart-3))] ring-1 ring-[hsl(var(--chart-3))]/30'
                  : 'bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))]'
              }
            `}>
              {activeDays.has(i) ? '✓' : ''}
            </div>
            <span className="text-[9px] text-[hsl(var(--muted-foreground))]">{label}</span>
          </div>
        ))}
      </div>

      {longest > 0 && (
        <p className="text-[11px] text-[hsl(var(--muted-foreground))] mt-2.5 text-center">
          Record personale: <span className="text-amber-400/70 font-semibold">{longest} giorni</span>
        </p>
      )}
    </motion.div>
  );
}

// ── Obiettivi attivi ────────────────────────────────────────────────────────

function ObjectiveCard({ obj }: { obj: Objective }) {
  const dueLabel = obj.dueDate
    ? new Date(obj.dueDate).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })
    : null;

  return (
    <motion.div variants={fadeUp} layout
      className={`
        p-4 rounded-xl border transition-all
        ${
          obj.completed
            ? 'bg-emerald-500/5 border-emerald-500/20'
            : 'bg-[hsl(var(--background))] border-foreground/[0.06] hover:border-foreground/10'
        }
      `}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0">
          {obj.completed
            ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            : <Circle className="w-4 h-4 text-[hsl(var(--muted-foreground))]" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-[13px] font-semibold ${
            obj.completed ? 'line-through text-[hsl(var(--muted-foreground))]' : 'text-[hsl(var(--foreground))]'
          }`}>
            {obj.title}
          </p>
          {obj.description && (
            <p className="text-[12px] text-[hsl(var(--muted-foreground))] mt-0.5 leading-snug">{obj.description}</p>
          )}

          {!obj.completed && (
            <div className="mt-2">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-[hsl(var(--muted-foreground))]">
                  {obj.currentValue}{obj.unit ? ` ${obj.unit}` : ''} / {obj.targetValue}{obj.unit ? ` ${obj.unit}` : ''}
                </span>
                <span className="text-[hsl(var(--chart-3))]">{Math.round(obj.progress)}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-blue-600 to-blue-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${obj.progress}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.1 }}
                />
              </div>
            </div>
          )}
        </div>
        {dueLabel && !obj.completed && (
          <div className="flex items-center gap-1 text-[11px] text-[hsl(var(--muted-foreground))] flex-shrink-0">
            <Clock className="w-3 h-3" />
            {dueLabel}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ObiettiviAttivi({ objectives, loading }: { objectives: Objective[]; loading: boolean }) {
  const [showAll, setShowAll] = useState(false);
  const active    = objectives.filter((o) => !o.completed);
  const completed = objectives.filter((o) => o.completed);
  const visible   = showAll ? active : active.slice(0, 3);

  return (
    <motion.div variants={fadeUp}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-semibold text-[hsl(var(--muted-foreground))] flex items-center gap-2">
          <Target className="w-4 h-4 text-[hsl(var(--chart-3))]" />
          Obiettivi attivi
          {active.length > 0 && (
            <span className="ml-1 text-[11px] bg-[hsl(var(--muted))] text-[hsl(var(--chart-3))] px-2 py-0.5 rounded-full">
              {active.length}
            </span>
          )}
        </h2>
        <Link href="/percorso"
          className="text-[12px] text-[hsl(var(--chart-3))] hover:text-[hsl(var(--chart-3))] transition-colors flex items-center gap-1">
          Tutti <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Sk key={i} className="h-16" />)}
        </div>
      ) : active.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-3" />
          <p className="text-[14px] font-semibold text-[hsl(var(--foreground))] mb-1">Tutti gli obiettivi completati!</p>
          <p className="text-[12px] text-[hsl(var(--muted-foreground))] max-w-[28ch]">Imposta nuovi traguardi dal tuo percorso</p>
          <Link href="/percorso"
            className="mt-4 px-4 py-2 rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--chart-3))] text-[12px] font-medium
                       hover:bg-[hsl(var(--muted))] transition-colors">
            Vai al percorso
          </Link>
        </div>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-2">
          <AnimatePresence>
            {visible.map((obj) => <ObjectiveCard key={obj.id} obj={obj} />)}
          </AnimatePresence>

          {active.length > 3 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="w-full py-2 rounded-xl text-[12px] font-medium text-[hsl(var(--muted-foreground))]
                         hover:text-[hsl(var(--muted-foreground))] border border-foreground/[0.04] hover:border-foreground/[0.08]
                         bg-[hsl(var(--background))] hover:bg-[hsl(var(--muted))] transition-all">
              {showAll ? 'Mostra meno ↑' : `Mostra altri ${active.length - 3} obiettivi ↓`}
            </button>
          )}

          {completed.length > 0 && (
            <p className="text-[11px] text-[hsl(var(--muted-foreground))] text-center pt-1">
              {completed.length} obiettiv{completed.length === 1 ? 'o' : 'i'} completat{completed.length === 1 ? 'o' : 'i'} di recente ✅
            </p>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Certificazioni consigliate ──────────────────────────────────────────────

function CertificazioniCard() {
  return (
    <motion.div variants={fadeUp}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-semibold text-[hsl(var(--muted-foreground))] flex items-center gap-2">
          <Award className="w-4 h-4 text-emerald-400" />
          Certificazioni consigliate
        </h2>
        <Link href="/certificazioni"
          className="text-[12px] text-[hsl(var(--chart-3))] hover:text-[hsl(var(--chart-3))] transition-colors flex items-center gap-1">
          Tutte <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="space-y-2">
        {CERT_MOCK.map((cert, i) => (
          <motion.div key={cert.id} variants={fadeUp}
            className="flex items-center gap-3 p-3.5 rounded-xl bg-[hsl(var(--background))]
                       border border-foreground/[0.06] hover:border-foreground/10 transition-all">
            <div className="w-9 h-9 rounded-xl bg-[hsl(var(--muted))] flex items-center justify-center flex-shrink-0">
              <GraduationCap className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[13px] font-semibold text-[hsl(var(--foreground))] truncate">{cert.name}</p>
                {cert.hot && (
                  <span className="text-[10px] font-bold text-orange-400 bg-orange-400/10
                                   px-1.5 py-0.5 rounded-full flex-shrink-0">
                    HOT
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                <span>{cert.provider}</span>
                <span>·</span>
                <span>{cert.hours}h</span>
                <span>·</span>
                <span>{cert.level}</span>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[hsl(var(--muted-foreground))] flex-shrink-0" />
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Leaderboard settore (preview) ───────────────────────────────────────────

function LeaderboardPreview({ entries, loading }: { entries: LeaderboardEntry[]; loading: boolean }) {
  if (loading) return <Sk className="h-40" />;
  if (entries.length === 0) return null;

  const medalColors = ['text-amber-400', 'text-slate-400', 'text-orange-600'];
  const medalBg     = ['bg-amber-400/10', 'bg-slate-400/10', 'bg-orange-600/10'];

  return (
    <motion.div variants={fadeUp}
      className="rounded-2xl bg-[hsl(var(--background))] border border-foreground/[0.06] p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-semibold text-[hsl(var(--muted-foreground))] flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-400" />
          Ranking nel settore
        </h2>
        <span className="text-[11px] text-[hsl(var(--muted-foreground))]">Top del mese</span>
      </div>

      <div className="space-y-2">
        {entries.slice(0, 5).map((entry) => (
          <div key={entry.userId}
            className={`
              flex items-center gap-3 p-2.5 rounded-lg transition-all
              ${
                entry.isCurrentUser
                  ? 'bg-[hsl(var(--muted))]/30 border border-[hsl(var(--muted))]/50'
                  : 'hover:bg-foreground/[0.02]'
              }
            `}>
            <div className={`
              w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0
              ${entry.rank <= 3 ? `${medalBg[entry.rank - 1]} ${medalColors[entry.rank - 1]}` : 'text-[hsl(var(--muted-foreground))]'}
            `}>
              {entry.rank}
            </div>
            {entry.avatarUrl ? (
              <img src={entry.avatarUrl} alt={entry.name}
                width={28} height={28} loading="lazy"
                className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-[hsl(var(--muted))] flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-bold text-[hsl(var(--muted-foreground))]">
                  {entry.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}
                </span>
              </div>
            )}
            <span className={`flex-1 text-[13px] truncate ${
              entry.isCurrentUser ? 'font-semibold text-[hsl(var(--chart-3))]' : 'text-[hsl(var(--foreground))]'
            }`}>
              {entry.name}{entry.isCurrentUser ? ' (tu)' : ''}
            </span>
            <span className="text-[12px] font-semibold text-amber-400/80 tabular-nums flex-shrink-0">
              {entry.totalXp.toLocaleString('it-IT')}
              <span className="text-[10px] font-normal text-[hsl(var(--muted-foreground))] ml-0.5">XP</span>
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Azioni rapide ────────────────────────────────────────────────────────────

function AzioniRapide() {
  return (
    <motion.div variants={stagger} initial="hidden" animate="visible"
      className="grid grid-cols-2 gap-3">
      {AZIONI_RAPIDE.map((a) => (
        <motion.div key={a.href} variants={fadeUp}>
          <Link href={a.href}
            className={`
              flex flex-col gap-2 p-4 rounded-2xl
              bg-gradient-to-br ${a.gradient}
              border ${a.border}
              transition-all duration-200 hover:scale-[1.02] hover:shadow-lg
              hover:shadow-black/20 block
            `}>
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

// ── Pagina principale ─────────────────────────────────────────────────────────

export default function DashboardCrescita() {
  const { user } = useAuth();

  const { data: stats, isLoading: loadingStats } = useQuery<UserStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn:  () => apiClient.get<UserStats>('/dashboard/stats'),
    staleTime: 60_000,
  });

  const { data: objData, isLoading: loadingObj } = useQuery<{ objectives: Objective[] }>({
    queryKey: ['dashboard', 'objectives'],
    queryFn:  () => apiClient.get<{ objectives: Objective[] }>('/dashboard/objectives'),
    staleTime: 30_000,
  });

  const { data: lbData, isLoading: loadingLb } = useQuery<{ entries: LeaderboardEntry[] }>({
    queryKey: ['leaderboard', 'sector'],
    queryFn:  () => apiClient.get<{ entries: LeaderboardEntry[] }>('/leaderboard/sector'),
    staleTime: 5 * 60_000,
  });

  const name       = (user as any)?.name?.split(' ')[0] ?? 'Professionista';
  const sectorName = (user as any)?.sectorName ?? 'il tuo settore';
  const objectives = objData?.objectives ?? [];
  const lbEntries  = lbData?.entries ?? [];

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera';

  // Calcola quanti obiettivi completati questa settimana
  const completedThisWeek = objectives.filter((o) => o.completed).length;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[13px] text-[hsl(var(--muted-foreground))] mb-0.5">{greeting}, {name} 🙌</p>
            <h1 className="text-[22px] font-bold text-[hsl(var(--foreground))] tracking-tight">
              Stai crescendo
            </h1>
            <p className="text-[13px] text-[hsl(var(--muted-foreground))] mt-1 max-w-[40ch]">
              Sai già dove sei. Ogni giorno che passi qui ti porta più in alto nel tuo settore.
            </p>
          </div>
          <div className="text-right">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20
                            flex items-center justify-center">
              <Trophy className="w-6 h-6 text-amber-400" />
            </div>
            {completedThisWeek > 0 && (
              <p className="text-[10px] text-emerald-400 mt-1">
                +{completedThisWeek} questa settimana
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── XP Card ─────────────────────────────────────────────────────── */}
      {loadingStats
        ? <Sk className="h-28" />
        : stats && <XpCard stats={stats} sectorName={sectorName} />}

      {/* ── Streak + Azioni rapide (grid 2 col) ──────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {loadingStats
          ? <Sk className="h-28" />
          : stats && <StreakCard streak={stats.currentStreak} longest={stats.longestStreak} />}

        {/* Mini KPI completati */}
        <motion.div variants={fadeUp}
          className="rounded-2xl bg-[hsl(var(--background))] border border-foreground/[0.06] p-4
                     flex flex-col justify-between">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-[12px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
              Completati
            </span>
          </div>
          <div>
            <p className="text-[32px] font-bold text-[hsl(var(--foreground))] tabular-nums leading-none">
              {loadingStats ? '–' : (stats?.completedObjectives ?? 0).toLocaleString('it-IT')}
            </p>
            <p className="text-[12px] text-[hsl(var(--muted-foreground))] mt-1">Obiettivi totali</p>
            <div className="mt-3 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] text-emerald-400">
                {completedThisWeek > 0 ? `+${completedThisWeek} questa settimana` : 'Nessuno questa settimana'}
              </span>
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* ── Azioni rapide ──────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <h2 className="text-[13px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-3">
          Strumenti di crescita
        </h2>
        <AzioniRapide />
      </motion.div>

      {/* ── Obiettivi attivi ─────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
        <ObiettiviAttivi objectives={objectives} loading={loadingObj} />
      </motion.div>

      {/* ── Certificazioni ──────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        <CertificazioniCard />
      </motion.div>

      {/* ── Leaderboard settore ──────────────────────────────────────────── */}
      {(lbEntries.length > 0 || loadingLb) && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
          <LeaderboardPreview entries={lbEntries} loading={loadingLb} />
        </motion.div>
      )}

    </div>
  );
}
