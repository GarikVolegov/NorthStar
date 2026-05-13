/**
 * DashboardAutonomo.tsx
 *
 * Dashboard per utenti con journeyType === "autonomo".
 *
 * Profilo: freelance, imprenditore, o chi lavora in proprio.
 * Non cerca un lavoro dipendente — vuole far crescere il suo business.
 *
 * Sezioni:
 *   1. Header: saluto + razzo + revenue snapshot
 *   2. Pipeline clienti (Prospect → Proposta → Attivo → Completato)
 *   3. Validatore idea (form + AI feedback)
 *   4. News settore filtrabili
 *   5. Azioni rapide: Pitch AI / Network / Contratti / Analytics
 */
import { useState } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Rocket, TrendingUp, TrendingDown, Users, FileText,
  Lightbulb, Newspaper, ChevronRight, ArrowUpRight,
  BarChart2, Globe, Zap, CheckCircle2, Clock,
  CircleDot, DollarSign, Sparkles, Send, RefreshCw,
  Tag, ExternalLink,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/useAuth';

// ── Tipi ─────────────────────────────────────────────────────────────────────

type RevenueStats = {
  currentMonth: number;
  previousMonth: number;
  currency: string;
  activeClients: number;
  pendingProposals: number;
};

type PipelineClient = {
  id: number;
  name: string;
  company: string | null;
  stage: 'prospect' | 'proposta' | 'attivo' | 'completato';
  value: number | null;
  currency: string;
  updatedAt: string;
};

type SectorNews = {
  id: number;
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  tags: string[];
  summary: string;
};

// ── Costanti ──────────────────────────────────────────────────────────────────

const PIPELINE_STAGES: { key: PipelineClient['stage']; label: string; color: string; bg: string; icon: React.ElementType }[] = [
  { key: 'prospect',   label: 'Prospect',   color: 'text-blue-400',   bg: 'bg-blue-400/10',   icon: CircleDot },
  { key: 'proposta',   label: 'Proposta',   color: 'text-amber-400',  bg: 'bg-amber-400/10',  icon: FileText },
  { key: 'attivo',     label: 'Attivo',     color: 'text-emerald-400',bg: 'bg-emerald-400/10',icon: Zap },
  { key: 'completato', label: 'Completato', color: 'text-slate-400',  bg: 'bg-slate-400/10',  icon: CheckCircle2 },
];

const AZIONI = [
  {
    href: '/pitch-ai',   icon: Lightbulb,  label: 'Pitch AI',
    desc: 'Genera un pitch per il tuo prossimo cliente',
    gradient: 'from-violet-500/20 to-violet-600/5',
    accent: 'text-violet-400', border: 'border-violet-500/20 hover:border-violet-500/40',
  },
  {
    href: '/amici',      icon: Users,      label: 'Network',
    desc: 'Connettiti con altri professionisti',
    gradient: 'from-blue-500/20 to-blue-600/5',
    accent: 'text-blue-400', border: 'border-blue-500/20 hover:border-blue-500/40',
  },
  {
    href: '/contratti',  icon: FileText,   label: 'Contratti',
    desc: 'Modelli e template legali pronti',
    gradient: 'from-amber-500/20 to-amber-600/5',
    accent: 'text-amber-400', border: 'border-amber-500/20 hover:border-amber-500/40',
  },
  {
    href: '/analytics',  icon: BarChart2,  label: 'Analytics',
    desc: 'Revenue, clienti e trend nel tempo',
    gradient: 'from-emerald-500/20 to-emerald-600/5',
    accent: 'text-emerald-400', border: 'border-emerald-500/20 hover:border-emerald-500/40',
  },
];

const NEWS_MOCK: SectorNews[] = [
  {
    id: 1,
    title: 'Come i freelance italiani stanno aumentando i loro prezzi nel 2026',
    source: 'Il Sole 24 Ore',
    url: '#',
    publishedAt: new Date(Date.now() - 3_600_000).toISOString(),
    tags: ['pricing', 'freelance', 'mercato'],
    summary: "Un'indagine rivela che il 62% dei lavoratori autonomi ha aumentato le tariffe di almeno il 15% rispetto all'anno scorso.",
  },
  {
    id: 2,
    title: 'AI e automazione: quali servizi freelance resistono alla disruption',
    source: 'Wired Italia',
    url: '#',
    publishedAt: new Date(Date.now() - 86_400_000).toISOString(),
    tags: ['AI', 'automazione', 'futuro'],
    summary: 'Strategia, relazioni e creatività di alto livello rimangono le competenze più difficili da replicare.',
  },
  {
    id: 3,
    title: 'Regime forfettario 2026: tutto ciò che devi sapere',
    source: 'Fiscoetasse',
    url: '#',
    publishedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    tags: ['fisco', 'partita IVA', 'regime forfettario'],
    summary: "Le novità sull'aliquota e i nuovi limiti di reddito per restare nel regime agevolato.",
  },
  {
    id: 4,
    title: 'Come trovare clienti ricorrenti: il metodo dei top freelance',
    source: 'Freelancecamp',
    url: '#',
    publishedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    tags: ['clienti', 'strategia', 'business'],
    summary: 'Tre strategie concrete per trasformare un cliente one-shot in un cliente fedele a lungo termine.',
  },
];

const PIPELINE_MOCK: PipelineClient[] = [
  { id: 1, name: 'Luca Ferrari',    company: 'TechStartup Srl',  stage: 'attivo',     value: 3200,  currency: '€', updatedAt: new Date(Date.now() - 86_400_000).toISOString() },
  { id: 2, name: 'Sofia Bianchi',   company: null,               stage: 'proposta',   value: 1800,  currency: '€', updatedAt: new Date(Date.now() - 2 * 86_400_000).toISOString() },
  { id: 3, name: 'Marco Ricci',     company: 'AgencyXYZ',        stage: 'prospect',   value: null,  currency: '€', updatedAt: new Date(Date.now() - 5 * 86_400_000).toISOString() },
  { id: 4, name: 'Anna Conti',      company: 'E-commerce Co.',   stage: 'completato', value: 2400,  currency: '€', updatedAt: new Date(Date.now() - 7 * 86_400_000).toISOString() },
];

// ── Animazioni ────────────────────────────────────────────────────────────────

const stagger = { hidden: {}, visible: { transition: { staggerChildren: 0.07 } } };
const fadeUp  = { hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } } };

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Sk({ className = '' }: { className?: string }) {
  return <div className={`rounded-xl bg-[hsl(var(--card))] animate-pulse ${className}`} />;
}

// ── Revenue Widget ────────────────────────────────────────────────────────────

function RevenueCard({ stats }: { stats: RevenueStats }) {
  const delta   = stats.currentMonth - stats.previousMonth;
  const pct     = stats.previousMonth > 0
    ? Math.round((delta / stats.previousMonth) * 100)
    : 0;
  const up      = delta >= 0;
  const fmt     = (n: number) => n.toLocaleString('it-IT', { maximumFractionDigits: 0 });

  return (
    <motion.div variants={fadeUp}
      className="rounded-2xl bg-[hsl(var(--background))] border border-emerald-500/20 p-5 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-44 h-44 rounded-full bg-emerald-500/5 blur-3xl pointer-events-none" />

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-[12px] font-semibold text-emerald-400/80 uppercase tracking-wide">
              Revenue questo mese
            </span>
          </div>
          <p className="text-[28px] font-bold text-[hsl(var(--foreground))] tabular-nums leading-none">
            {stats.currency}{fmt(stats.currentMonth)}
          </p>
          <div className={`flex items-center gap-1 mt-1.5 text-[12px] font-semibold ${
            up ? 'text-emerald-400' : 'text-red-400'
          }`}>
            {up
              ? <TrendingUp className="w-3.5 h-3.5" />
              : <TrendingDown className="w-3.5 h-3.5" />}
            {up ? '+' : ''}{pct}% vs mese scorso
            <span className="font-normal text-[hsl(var(--muted-foreground))] ml-1">
              ({up ? '+' : ''}{stats.currency}{fmt(delta)})
            </span>
          </div>
        </div>

        <div className="space-y-2 text-right">
          <div>
            <p className="text-[20px] font-bold text-[hsl(var(--foreground))] tabular-nums">{stats.activeClients}</p>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Clienti attivi</p>
          </div>
          <div>
            <p className="text-[20px] font-bold text-amber-400 tabular-nums">{stats.pendingProposals}</p>
            <p className="text-[11px] text-[hsl(var(--muted-foreground))]">Proposte aperte</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Pipeline clienti ──────────────────────────────────────────────────────────

function PipelineBoard({ clients }: { clients: PipelineClient[] }) {
  const [activeStage, setActiveStage] = useState<PipelineClient['stage'] | 'tutti'>('tutti');

  const filtered = activeStage === 'tutti'
    ? clients
    : clients.filter((c) => c.stage === activeStage);

  const stageOf = (key: PipelineClient['stage']) =>
    PIPELINE_STAGES.find((s) => s.key === key)!;

  const relTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const days = Math.floor(diff / 86_400_000);
    if (days === 0) return 'Oggi';
    if (days === 1) return 'Ieri';
    return `${days}gg fa`;
  };

  return (
    <motion.div variants={fadeUp}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-semibold text-[hsl(var(--muted-foreground))] flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-400" />
          Pipeline clienti
        </h2>
        <Link href="/clienti"
          className="text-[12px] text-[hsl(var(--chart-3))] hover:text-[hsl(var(--chart-3))] transition-colors flex items-center gap-1">
          Gestisci <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Filter pill */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-none">
        <button
          onClick={() => setActiveStage('tutti')}
          className={`flex-shrink-0 text-[11px] font-semibold px-3 py-1 rounded-full transition-all ${
            activeStage === 'tutti'
              ? 'bg-[hsl(var(--muted))] text-[hsl(var(--chart-3))]'
              : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--muted-foreground))]'
          }`}>
          Tutti ({clients.length})
        </button>
        {PIPELINE_STAGES.map((s) => {
          const count = clients.filter((c) => c.stage === s.key).length;
          return (
            <button
              key={s.key}
              onClick={() => setActiveStage(s.key)}
              className={`flex-shrink-0 text-[11px] font-semibold px-3 py-1 rounded-full transition-all ${
                activeStage === s.key
                  ? `${s.bg} ${s.color}`
                  : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--muted-foreground))]'
              }`}>
              {s.label} ({count})
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center">
          <Users className="w-7 h-7 text-[hsl(var(--muted-foreground))] mb-2" />
          <p className="text-[13px] text-[hsl(var(--muted-foreground))]">Nessun cliente in questa fase</p>
          <Link href="/clienti"
            className="mt-3 text-[12px] text-[hsl(var(--chart-3))] hover:underline">
            + Aggiungi cliente
          </Link>
        </div>
      ) : (
        <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filtered.map((client) => {
              const stage = stageOf(client.stage);
              const StageIcon = stage.icon;
              return (
                <motion.div key={client.id} layout variants={fadeUp}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className="flex items-center gap-3 p-3.5 rounded-xl bg-[hsl(var(--background))]
                             border border-foreground/[0.06] hover:border-foreground/10 transition-all">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${stage.bg}`}>
                    <StageIcon className={`w-3.5 h-3.5 ${stage.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[hsl(var(--foreground))] truncate">{client.name}</p>
                    <p className="text-[11px] text-[hsl(var(--muted-foreground))] truncate">
                      {client.company ?? 'Privato'} · {relTime(client.updatedAt)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {client.value != null && (
                      <p className={`text-[13px] font-bold tabular-nums ${stage.color}`}>
                        {client.currency}{client.value.toLocaleString('it-IT')}
                      </p>
                    )}
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${stage.bg} ${stage.color}`}>
                      {stage.label}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Validatore idea ───────────────────────────────────────────────────────────

const AI_RESPONSES = [
  (idea: string) => `"${idea}" ha potenziale in un mercato di nicchia. Punti di forza: bassa concorrenza locale, alta domanda latente. Rischio principale: ciclo di vendita lungo. Prossimo passo consigliato: 5 interviste con potenziali clienti in 2 settimane.`,
  (idea: string) => `"${idea}" è un mercato già saturo, ma puoi differenziarti su specializzazione verticale o pricing premium. Verifica se esiste un segmento underserved prima di investire tempo.`,
  (idea: string) => `"${idea}" si posiziona bene nel contesto attuale. Il rischio maggiore è la replicabilità — proteggi il know-how con processi documentati e relazioni forti con i clienti.`,
];

function ValidatoreIdea() {
  const [idea, setIdea]           = useState('');
  const [feedback, setFeedback]   = useState<string | null>(null);
  const [loading, setLoading]     = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!idea.trim()) return;
    setLoading(true);
    setFeedback(null);
    // Simula chiamata AI
    await new Promise((r) => setTimeout(r, 1400));
    const pick = AI_RESPONSES[Math.floor(Math.random() * AI_RESPONSES.length)];
    setFeedback(pick(idea.trim()));
    setLoading(false);
  };

  return (
    <motion.div variants={fadeUp}
      className="rounded-2xl bg-[hsl(var(--background))] border border-violet-500/20 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="w-4 h-4 text-violet-400" />
        <h2 className="text-[14px] font-semibold text-[hsl(var(--muted-foreground))]">Valida la tua idea</h2>
        <span className="text-[10px] font-bold text-violet-400 bg-violet-400/10 px-2 py-0.5 rounded-full">
          AI
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="Descrivi la tua idea di business o il servizio che vuoi offrire…"
          rows={3}
          className="w-full px-3 py-2.5 rounded-xl bg-[hsl(var(--card))] border border-foreground/[0.08]
                     text-[13px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]
                     focus:outline-none focus:border-violet-500/40 resize-none
                     transition-colors leading-relaxed"
        />
        <button
          type="submit"
          disabled={!idea.trim() || loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl
                     bg-violet-500/20 hover:bg-violet-500/30
                     border border-violet-500/30 hover:border-violet-500/50
                     text-[13px] font-semibold text-violet-300
                     disabled:opacity-40 disabled:cursor-not-allowed
                     transition-all duration-200">
          {loading
            ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Analisi in corso…</>
            : <><Sparkles className="w-3.5 h-3.5" /> Analizza con AI</>}
        </button>
      </form>

      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-4 p-4 rounded-xl bg-violet-500/5 border border-violet-500/15">
            <div className="flex items-start gap-2">
              <Sparkles className="w-3.5 h-3.5 text-violet-400 mt-0.5 flex-shrink-0" />
              <p className="text-[13px] text-[hsl(var(--foreground))] leading-relaxed">{feedback}</p>
            </div>
            <button
              onClick={() => { setFeedback(null); setIdea(''); }}
              className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--muted-foreground))] transition-colors">
              Valuta un'altra idea →
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── News settore ──────────────────────────────────────────────────────────────

function NewsFeed({ news }: { news: SectorNews[] }) {
  const allTags    = [...new Set(news.flatMap((n) => n.tags))];
  const [tag, setTag] = useState<string | null>(null);

  const filtered = tag ? news.filter((n) => n.tags.includes(tag)) : news;

  const relTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diff / 3_600_000);
    if (hours < 1)  return 'Adesso';
    if (hours < 24) return `${hours}h fa`;
    const days = Math.floor(hours / 24);
    return `${days}gg fa`;
  };

  return (
    <motion.div variants={fadeUp}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-semibold text-[hsl(var(--muted-foreground))] flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-blue-400" />
          News del settore
        </h2>
      </div>

      {/* Tag filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none">
        <button
          onClick={() => setTag(null)}
          className={`flex-shrink-0 flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all ${
            tag === null ? 'bg-[hsl(var(--muted))] text-[hsl(var(--chart-3))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--muted-foreground))]'
          }`}>
          Tutto
        </button>
        {allTags.map((t) => (
          <button
            key={t}
            onClick={() => setTag(t === tag ? null : t)}
            className={`flex-shrink-0 flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-all ${
              tag === t ? 'bg-[hsl(var(--muted))] text-[hsl(var(--chart-3))]' : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--muted-foreground))]'
            }`}>
            <Tag className="w-2.5 h-2.5" />{t}
          </button>
        ))}
      </div>

      <motion.div variants={stagger} initial="hidden" animate="visible" className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filtered.map((item) => (
            <motion.a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              layout
              variants={fadeUp}
              exit={{ opacity: 0 }}
              className="block p-4 rounded-xl bg-[hsl(var(--background))] border border-foreground/[0.06]
                         hover:border-foreground/10 transition-all group">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[13px] font-semibold text-[hsl(var(--foreground))] leading-snug
                               group-hover:text-[hsl(var(--foreground))] transition-colors">
                  {item.title}
                </h3>
                <ExternalLink className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))] group-hover:text-[hsl(var(--chart-3))]
                                         transition-colors flex-shrink-0 mt-0.5" />
              </div>
              <p className="text-[12px] text-[hsl(var(--muted-foreground))] mt-1.5 leading-snug">{item.summary}</p>
              <div className="flex items-center gap-3 mt-2.5">
                <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{item.source}</span>
                <span className="text-[hsl(var(--muted-foreground))]">·</span>
                <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{relTime(item.publishedAt)}</span>
                <div className="flex gap-1 ml-auto">
                  {item.tags.slice(0, 2).map((t) => (
                    <span key={t}
                      className="text-[10px] text-[hsl(var(--muted-foreground))] bg-[hsl(var(--muted))] px-1.5 py-0.5 rounded-full">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </motion.a>
          ))}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

// ── Azioni rapide ─────────────────────────────────────────────────────────────

function AzioniRapide() {
  return (
    <motion.div variants={stagger} initial="hidden" animate="visible"
      className="grid grid-cols-2 gap-3">
      {AZIONI.map((a) => (
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

export default function DashboardAutonomo() {
  const { user } = useAuth();

  const { data: revenueData, isLoading: loadingRevenue } = useQuery<RevenueStats>({
    queryKey: ['dashboard', 'revenue'],
    queryFn:  () => apiClient.get<RevenueStats>('/dashboard/revenue'),
    staleTime: 5 * 60_000,
  });

  const name = (user as any)?.name?.split(' ')[0] ?? 'Autonomo';

  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera';

  // Calcola pipeline value totale degli attivi
  const activePipelineValue = PIPELINE_MOCK
    .filter((c) => c.stage === 'attivo' || c.stage === 'proposta')
    .reduce((sum, c) => sum + (c.value ?? 0), 0);

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
            <p className="text-[13px] text-[hsl(var(--muted-foreground))] mb-0.5">{greeting}, {name} 🚀</p>
            <h1 className="text-[22px] font-bold text-[hsl(var(--foreground))] tracking-tight">
              Il tuo business
            </h1>
            <p className="text-[13px] text-[hsl(var(--muted-foreground))] mt-1 max-w-[40ch]">
              Sei il tuo capo. Ogni azione che fai oggi è un investimento nel tuo futuro.
            </p>
          </div>
          <div className="text-right">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20
                            flex items-center justify-center">
              <Rocket className="w-6 h-6 text-emerald-400" />
            </div>
            {activePipelineValue > 0 && (
              <p className="text-[10px] text-emerald-400 mt-1">
                €{activePipelineValue.toLocaleString('it-IT')} in pipeline
              </p>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Revenue card ───────────────────────────────────────────────── */}
      {loadingRevenue
        ? <Sk className="h-28" />
        : revenueData && <RevenueCard stats={revenueData} />}

      {/* ── Azioni rapide ──────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
        <h2 className="text-[13px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide mb-3">
          Strumenti
        </h2>
        <AzioniRapide />
      </motion.div>

      {/* ── Pipeline clienti ───────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
        <PipelineBoard clients={PIPELINE_MOCK} />
      </motion.div>

      {/* ── Validatore idea ────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
        <ValidatoreIdea />
      </motion.div>

      {/* ── News settore ───────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        <NewsFeed news={NEWS_MOCK} />
      </motion.div>

    </div>
  );
}
