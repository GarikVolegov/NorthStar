/**
 * DashboardIndeciso.tsx
 *
 * Dashboard per utenti con journeyType === "indeciso".
 *
 * Obiettivo: guidare l'utente nell'esplorazione.
 * Non sa ancora cosa vuole fare → la dashboard è una bussola.
 *
 * Sezioni:
 *   1. Header benvenuto personalizzato + bussola animata
 *   2. Stato avanzamento (XP + streak)
 *   3. Azioni rapide (test, settori, network)
 *   4. Settori consigliati basati sul test (se fatto)
 *   5. "Cosa fa un X?" — ruoli professionali da esplorare
 *   6. Banner completa profilo (se manca journeyType o settore)
 */
import { useState } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Compass, Zap, Flame, ArrowRight, BookOpen,
  Users, Star, ChevronRight, Sparkles, Target,
  Map, Trophy, TrendingUp, HelpCircle, Briefcase,
  GraduationCap, Code2, PenTool, HeartHandshake,
  BarChart2, Megaphone, Stethoscope, Scale, FlaskConical,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';

// ── Tipi ─────────────────────────────────────────────────────────────────────

type UserStats = {
  totalXp: number;
  currentStreak: number;
  longestStreak: number;
  completedObjectives: number;
  level: number;
};

type Sector = {
  id: number;
  name: string;
  description: string | null;
  iconName: string | null;
  color: string | null;
};

// ── Costanti ──────────────────────────────────────────────────────────────────

const RUOLI_ESPLORABILI = [
  { icon: Code2,          label: 'Sviluppatore',        desc: 'Costruisce software e applicazioni',              settore: 'Tech' },
  { icon: PenTool,        label: 'Designer',             desc: 'Crea interfacce e esperienze visive',             settore: 'Creatività' },
  { icon: BarChart2,      label: 'Analista dati',        desc: 'Trasforma i dati in decisioni',                   settore: 'Analytics' },
  { icon: Megaphone,      label: 'Marketing',            desc: 'Porta i prodotti alle persone giuste',            settore: 'Marketing' },
  { icon: HeartHandshake, label: 'HR & Recruiting',      desc: 'Seleziona e sviluppa i talenti',                  settore: 'Persone' },
  { icon: Briefcase,      label: 'Project Manager',      desc: 'Coordina team e porta i progetti al traguardo',   settore: 'Management' },
  { icon: FlaskConical,   label: 'Ricerca & Sviluppo',   desc: 'Sperimenta e innova nei processi',                settore: 'Scienze' },
  { icon: Scale,          label: 'Legale & Compliance',  desc: 'Tutela le regole e i diritti',                    settore: 'Giuridico' },
  { icon: Stethoscope,    label: 'Salute & Benessere',   desc: 'Si prende cura delle persone',                    settore: 'Sanità' },
  { icon: GraduationCap,  label: 'Formazione',           desc: 'Insegna e trasferisce conoscenza',                settore: 'Educazione' },
];

const AZIONI_RAPIDE = [
  {
    href:  '/test',
    icon:  HelpCircle,
    label: 'Fai il test',
    desc:  'Scopri quale percorso fa per te',
    color: 'from-violet-500/20 to-violet-600/5',
    accent: 'text-violet-400',
    border: 'border-violet-500/20 hover:border-violet-500/40',
  },
  {
    href:  '/settori',
    icon:  Map,
    label: 'Esplora settori',
    desc:  'Tutti i percorsi professionali',
    color: 'from-blue-500/20 to-blue-600/5',
    accent: 'text-blue-400',
    border: 'border-blue-500/20 hover:border-blue-500/40',
  },
  {
    href:  '/amici',
    icon:  Users,
    label: 'Incontra persone',
    desc:  'Connettiti con chi è nel tuo stesso momento',
    color: 'from-emerald-500/20 to-emerald-600/5',
    accent: 'text-emerald-400',
    border: 'border-emerald-500/20 hover:border-emerald-500/40',
  },
];

// ── Animazioni ────────────────────────────────────────────────────────────────

const stagger = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.07 } },
};

const fadeUp = {
  hidden:  { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
};

// ── Skeleton ──────────────────────────────────────────────────────────────────

function StatSkeleton() {
  return (
    <div className="flex gap-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex-1 h-20 rounded-2xl bg-[#131929] animate-pulse" />
      ))}
    </div>
  );
}

// ── Widget XP e streak ────────────────────────────────────────────────────────

function StatsRow({ stats }: { stats: UserStats }) {
  const xpForNextLevel = (stats.level + 1) * 500;
  const xpProgress = Math.min(100, (stats.totalXp % 500) / 5);

  return (
    <motion.div variants={stagger} initial="hidden" animate="visible"
      className="grid grid-cols-3 gap-3">

      {/* XP */}
      <motion.div variants={fadeUp}
        className="col-span-2 rounded-2xl bg-[#0d1421] border border-white/[0.06] p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-[12px] font-semibold text-[#7c8db5] uppercase tracking-wide">Esperienza</span>
          </div>
          <span className="text-[11px] text-[#4a5a75]">Lv. {stats.level}</span>
        </div>
        <p className="text-[22px] font-bold text-[#dce6f5] tabular-nums">
          {stats.totalXp.toLocaleString('it-IT')}
          <span className="text-[13px] font-normal text-[#7c8db5] ml-1">XP</span>
        </p>
        <div className="mt-2 h-1.5 rounded-full bg-[#1a2035] overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400"
            initial={{ width: 0 }}
            animate={{ width: `${xpProgress}%` }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
          />
        </div>
        <p className="mt-1 text-[10px] text-[#3a4a65]">
          {(xpForNextLevel - (stats.totalXp % 500)).toLocaleString('it-IT')} XP al prossimo livello
        </p>
      </motion.div>

      {/* Streak */}
      <motion.div variants={fadeUp}
        className="rounded-2xl bg-[#0d1421] border border-white/[0.06] p-4 flex flex-col items-center justify-center">
        <Flame className={`w-6 h-6 mb-1 ${
          stats.currentStreak > 0 ? 'text-orange-400' : 'text-[#3a4a65]'
        }`} />
        <p className="text-[22px] font-bold text-[#dce6f5] tabular-nums leading-none">
          {stats.currentStreak}
        </p>
        <p className="text-[11px] text-[#7c8db5] mt-0.5">Streak</p>
        {stats.currentStreak > 0 && (
          <p className="text-[10px] text-[#4a5a75] mt-0.5">
            max {stats.longestStreak}gg
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Azioni rapide ─────────────────────────────────────────────────────────────

function AzioniRapide() {
  return (
    <motion.div variants={stagger} initial="hidden" animate="visible"
      className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {AZIONI_RAPIDE.map((a) => (
        <motion.div key={a.href} variants={fadeUp}>
          <Link href={a.href}
            className={`
              flex flex-col gap-2 p-4 rounded-2xl
              bg-gradient-to-br ${a.color}
              border ${a.border}
              transition-all duration-200 hover:scale-[1.02] hover:shadow-lg
              hover:shadow-black/20 block
            `}>
            <a.icon className={`w-5 h-5 ${a.accent}`} />
            <div>
              <p className="text-[14px] font-semibold text-[#dce6f5]">{a.label}</p>
              <p className="text-[12px] text-[#7c8db5] leading-snug">{a.desc}</p>
            </div>
            <ArrowRight className={`w-3.5 h-3.5 ${a.accent} mt-auto self-end`} />
          </Link>
        </motion.div>
      ))}
    </motion.div>
  );
}

// ── Settori consigliati ───────────────────────────────────────────────────────

function SettoriConsigliati({ sectors }: { sectors: Sector[] }) {
  if (sectors.length === 0) return null;

  return (
    <motion.div variants={fadeUp}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-semibold text-[#a8b8d0] flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-400" />
          Settori da esplorare
        </h2>
        <Link href="/settori"
          className="text-[12px] text-[#4a8bff] hover:text-[#7eb3ff] transition-colors flex items-center gap-1">
          Tutti <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {sectors.slice(0, 6).map((s) => (
          <Link key={s.id} href={`/settore/${s.id}`}
            className="
              group flex items-center gap-2.5 p-3 rounded-xl
              bg-[#0d1421] border border-white/[0.06]
              hover:border-white/[0.12] hover:bg-[#0f1828]
              transition-all
            ">
            <div className="w-7 h-7 rounded-lg bg-[#1a2035] flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-3.5 h-3.5 text-[#4a8bff]" />
            </div>
            <span className="text-[13px] font-medium text-[#c5cee0] truncate
                             group-hover:text-[#dce6f5] transition-colors">
              {s.name}
            </span>
          </Link>
        ))}
      </div>
    </motion.div>
  );
}

// ── Ruoli da esplorare ────────────────────────────────────────────────────────

function RuoliEsplorabili() {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? RUOLI_ESPLORABILI : RUOLI_ESPLORABILI.slice(0, 4);

  return (
    <motion.div variants={fadeUp}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-semibold text-[#a8b8d0] flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-[#4a8bff]" />
          Cosa fa un professionista?
        </h2>
      </div>
      <motion.div variants={stagger} initial="hidden" animate="visible"
        className="space-y-2">
        <AnimatePresence>
          {visible.map((r) => (
            <motion.div key={r.label} variants={fadeUp} layout
              className="
                flex items-center gap-3 p-3.5 rounded-xl
                bg-[#0d1421] border border-white/[0.06]
                hover:border-white/[0.1] hover:bg-[#0f1828]
                transition-all cursor-default
              ">
              <div className="w-9 h-9 rounded-xl bg-[#1a2035] flex items-center justify-center flex-shrink-0">
                <r.icon className="w-4 h-4 text-[#7c8db5]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#c5cee0]">{r.label}</p>
                <p className="text-[12px] text-[#7c8db5] truncate">{r.desc}</p>
              </div>
              <span className="text-[11px] text-[#3a4a65] bg-[#1a2035] px-2 py-0.5 rounded-full flex-shrink-0">
                {r.settore}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </motion.div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="
          mt-3 w-full py-2 rounded-xl text-[12px] font-medium
          text-[#4a5a75] hover:text-[#7c8db5]
          border border-white/[0.04] hover:border-white/[0.08]
          bg-[#0d1421] hover:bg-[#0f1828]
          transition-all
        ">
        {expanded ? 'Mostra meno ↑' : `Mostra altri ${RUOLI_ESPLORABILI.length - 4} ruoli ↓`}
      </button>
    </motion.div>
  );
}

// ── Banner avanzamento ────────────────────────────────────────────────────────

function BannerAvanzamento({ hasCompletedTest }: { hasCompletedTest: boolean }) {
  if (hasCompletedTest) return null;

  return (
    <motion.div variants={fadeUp}
      className="
        relative overflow-hidden rounded-2xl p-5
        bg-gradient-to-br from-violet-600/15 via-[#0d1421] to-blue-600/10
        border border-violet-500/20
      ">
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full
                      bg-violet-500/5 blur-2xl pointer-events-none" />
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center flex-shrink-0">
          <Sparkles className="w-5 h-5 text-violet-400" />
        </div>
        <div className="flex-1">
          <p className="text-[14px] font-semibold text-[#dce6f5] mb-1">
            Inizia con il test di orientamento
          </p>
          <p className="text-[12px] text-[#7c8db5] leading-relaxed mb-3">
            Scopri qual è il percorso più adatto a te in base alle tue inclinazioni,
            interessi e obiettivi. Richiede solo 5 minuti.
          </p>
          <Link href="/test"
            className="
              inline-flex items-center gap-2 px-4 py-2 rounded-lg
              bg-violet-600/80 hover:bg-violet-600
              text-[13px] font-semibold text-white
              transition-colors
            ">
            Fai il test ora
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

// ── Obiettivo del giorno ──────────────────────────────────────────────────────

const OBIETTIVI_GIORNALIERI = [
  { icon: BookOpen,    text: 'Leggi un articolo su un settore che ti incuriosisce', xp: 50  },
  { icon: Users,       text: 'Connettiti con una persona nel tuo stesso momento',   xp: 30  },
  { icon: HelpCircle,  text: 'Completa il test di orientamento',                    xp: 100 },
  { icon: Target,      text: 'Visita il profilo di un professionista che ti ispira', xp: 20  },
  { icon: TrendingUp,  text: 'Esplora un settore che non conosci',                  xp: 40  },
];

function ObiettivoGiorno() {
  const today  = new Date().getDay();
  const obj    = OBIETTIVI_GIORNALIERI[today % OBIETTIVI_GIORNALIERI.length];
  const [done, setDone] = useState(false);

  return (
    <motion.div variants={fadeUp}
      className="rounded-2xl bg-[#0d1421] border border-white/[0.06] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-[#4a8bff]" />
        <span className="text-[12px] font-semibold text-[#7c8db5] uppercase tracking-wide">
          Obiettivo del giorno
        </span>
      </div>
      <div className="flex items-start gap-3">
        <div className={`
          w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
          ${done ? 'bg-emerald-500/20' : 'bg-[#1a2035]'}
        `}>
          {done
            ? <Trophy className="w-4 h-4 text-emerald-400" />
            : <obj.icon className="w-4 h-4 text-[#4a8bff]" />}
        </div>
        <div className="flex-1">
          <p className={`text-[13px] leading-snug transition-all ${
            done ? 'line-through text-[#4a5a75]' : 'text-[#c5cee0]'
          }`}>
            {obj.text}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[11px] text-amber-400 flex items-center gap-1">
              <Zap className="w-3 h-3" />+{obj.xp} XP
            </span>
            {!done && (
              <button
                onClick={() => setDone(true)}
                className="text-[11px] text-[#4a8bff] hover:text-[#7eb3ff] transition-colors">
                Segna come fatto
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Pagina principale ─────────────────────────────────────────────────────────

export default function DashboardIndeciso() {
  const { user } = useAuth();

  const { data: stats, isLoading: loadingStats } = useQuery<UserStats>({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => apiClient.get<UserStats>('/dashboard/stats'),
    staleTime: 60_000,
  });

  const { data: sectorsData } = useQuery<{ sectors: Sector[] }>({
    queryKey: ['sectors', 'list'],
    queryFn: () => apiClient.get<{ sectors: Sector[] }>('/sectors'),
    staleTime: 5 * 60_000,
  });

  const sectors: Sector[] = sectorsData?.sectors ?? [];
  const name = (user as any)?.name?.split(' ')[0] ?? 'Esploratore';
  const hasCompletedTest = !!(user as any)?.journeyType;

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Buongiorno' :
    hour < 18 ? 'Buon pomeriggio' :
                'Buonasera';

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
            <p className="text-[13px] text-[#7c8db5] mb-0.5">{greeting}, {name} 👋</p>
            <h1 className="text-[22px] font-bold text-[#dce6f5] tracking-tight">
              Stai esplorando
            </h1>
            <p className="text-[13px] text-[#4a5a75] mt-1 max-w-[40ch]">
              Non sai ancora quale direzione prendere — ed è perfettamente normale.
              Inizia a esplorare.
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#0d1421] border border-white/[0.06]
                          flex items-center justify-center flex-shrink-0">
            <Compass className="w-6 h-6 text-[#4a8bff]" />
          </div>
        </div>
      </motion.div>

      {/* ── Stats ──────────────────────────────────────────────────────── */}
      {loadingStats ? <StatSkeleton /> : stats ? <StatsRow stats={stats} /> : null}

      {/* ── Banner test (se non fatto) ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
      >
        <BannerAvanzamento hasCompletedTest={hasCompletedTest} />
      </motion.div>

      {/* ── Azioni rapide ──────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <h2 className="text-[13px] font-semibold text-[#7c8db5] uppercase tracking-wide mb-3"
          aria-label="Azioni rapide">
          Da dove iniziare
        </h2>
        <AzioniRapide />
      </motion.div>

      {/* ── Obiettivo del giorno ───────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
      >
        <ObiettivoGiorno />
      </motion.div>

      {/* ── Settori consigliati ────────────────────────────────────────── */}
      {sectors.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <SettoriConsigliati sectors={sectors} />
        </motion.div>
      )}

      {/* ── Ruoli da esplorare ─────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        <RuoliEsplorabili />
      </motion.div>

    </div>
  );
}
