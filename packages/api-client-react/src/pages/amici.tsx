/**
 * amici.tsx — Pagina /amici (Network)
 *
 * 3 tab:
 *   1. Connessioni  — amici accettati con DM e rimuovi
 *   2. Richieste    — richieste in arrivo con Accetta / Rifiuta
 *   3. Esplora      — suggestions con matchScore + searchbar
 *
 * Tutti i dati vengono dagli hook useNetwork.ts che wrappano
 * gli endpoint /api/friends/* già esistenti nel backend.
 */
import { useState, useRef } from 'react';
import { Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, UserPlus, Compass, Search, X,
  MessageCircle, UserMinus, CheckCircle2,
  Sparkles, Zap, ChevronRight, Clock,
} from 'lucide-react';
import {
  useFriends,
  useRequests,
  useSuggestions,
  useSearchUsers,
  useSendRequest,
  useAcceptRequest,
  useRemoveFriend,
  type FriendEntry,
  type RequestEntry,
  type NetworkUser,
} from '@/hooks/useNetwork';
import { useDebounce } from '@/hooks/useDebounce';

// ── Tipi tab ────────────────────────────────────────────────────────────────

type Tab = 'connessioni' | 'richieste' | 'esplora';

// ── Helpers ─────────────────────────────────────────────────────────────────

function journeyLabel(jt: string | null): string {
  const map: Record<string, string> = {
    indeciso:       'In esplorazione',
    in_transizione: 'In transizione',
    in_crescita:    'In crescita',
    autonomo:       'Lavoratore autonomo',
  };
  return jt ? (map[jt] ?? jt) : '';
}

function matchColor(score: number): string {
  if (score >= 80) return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
  if (score >= 50) return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
  if (score >= 25) return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
  return 'text-[hsl(var(--muted-foreground) / 0.8)] bg-[hsl(var(--muted))] border-foreground/[0.06]';
}

function Avatar({ user, size = 10 }: { user: NetworkUser; size?: number }) {
  const initials = user.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        width={size * 4}
        height={size * 4}
        loading="lazy"
        className={`w-${size} h-${size} rounded-full object-cover flex-shrink-0`}
      />
    );
  }

  return (
    <div
      className={`w-${size} h-${size} rounded-full bg-[hsl(var(--muted))] flex items-center
                  justify-center flex-shrink-0 border border-foreground/[0.06]`}
    >
      <span className="text-[11px] font-bold text-[hsl(var(--muted-foreground))]">{initials}</span>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function Sk({ className = '' }: { className?: string }) {
  return <div className={`rounded-xl bg-[hsl(var(--card))] animate-pulse ${className}`} />;
}

function SkeletonList({ n = 4 }: { n?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4 rounded-xl bg-[hsl(var(--background))]
                                border border-foreground/[0.06]">
          <Sk className="w-10 h-10 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <Sk className="h-3.5 w-32" />
            <Sk className="h-3 w-24" />
          </div>
          <Sk className="h-7 w-16 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

// ── Tab: Connessioni ─────────────────────────────────────────────────────────

function TabConnessioni() {
  const { data, isLoading } = useFriends();
  const remove = useRemoveFriend();
  const friends = data?.friends ?? [];

  return (
    <div className="space-y-3">
      {isLoading ? (
        <SkeletonList />
      ) : friends.length === 0 ? (
        <EmptyState
          icon={<Users className="w-8 h-8 text-[hsl(var(--muted-foreground) / 0.8)]" />}
          title="Nessuna connessione"
          desc="Esplora la community e connettiti con altri professionisti."
          cta={{ label: 'Esplora', tab: 'esplora' }}
        />
      ) : (
        <motion.div
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
          initial="hidden"
          animate="visible"
          className="space-y-3"
        >
          {friends.map((f) => (
            <FriendCard key={f.friendshipId} entry={f} onRemove={() => remove.mutate(f.friendshipId)} />
          ))}
        </motion.div>
      )}
    </div>
  );
}

function FriendCard({ entry, onRemove }: { entry: FriendEntry; onRemove: () => void }) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const u = entry.user;

  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25 } } }}
      className="flex items-center gap-3 p-4 rounded-xl bg-[hsl(var(--background))]
                 border border-foreground/[0.06] hover:border-foreground/10 transition-all"
    >
      <Link href={`/profilo/${u.id}`}>
        <Avatar user={u} size={10} />
      </Link>

      <div className="flex-1 min-w-0">
        <Link href={`/profilo/${u.id}`}
          className="text-[13px] font-semibold text-[hsl(var(--foreground))] hover:text-[hsl(var(--foreground))] transition-colors truncate block">
          {u.name}
        </Link>
        <p className="text-[11px] text-[hsl(var(--muted-foreground) / 0.8)] truncate">
          {u.sectorName ?? journeyLabel(u.journeyType)}
        </p>
        {u.totalXp !== null && (
          <div className="flex items-center gap-1 mt-0.5">
            <Zap className="w-2.5 h-2.5 text-amber-400" />
            <span className="text-[10px] text-amber-400/70">
              {u.totalXp.toLocaleString('it-IT')} XP
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* DM */}
        <Link
          href={`/messaggi/${u.id}`}
          className="w-8 h-8 rounded-lg bg-[hsl(var(--muted))] border border-foreground/[0.06]
                     flex items-center justify-center hover:bg-[hsl(var(--muted))]
                     hover:border-foreground/10 transition-all"
          aria-label={`Messaggio a ${u.name}`}
        >
          <MessageCircle className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground))]" />
        </Link>

        {/* Rimuovi */}
        {confirmRemove ? (
          <div className="flex items-center gap-1">
            <button
              onClick={onRemove}
              className="text-[11px] font-semibold text-red-400 hover:text-red-300
                         px-2 py-1 rounded-lg bg-red-400/10 border border-red-400/20
                         transition-colors"
            >
              Conferma
            </button>
            <button
              onClick={() => setConfirmRemove(false)}
              className="w-6 h-6 flex items-center justify-center rounded-lg
                         text-[hsl(var(--muted-foreground) / 0.8)] hover:text-[hsl(var(--muted-foreground))] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmRemove(true)}
            className="w-8 h-8 rounded-lg bg-[hsl(var(--muted))] border border-foreground/[0.06]
                       flex items-center justify-center hover:bg-red-500/10
                       hover:border-red-500/20 transition-all"
            aria-label="Rimuovi connessione"
          >
            <UserMinus className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground) / 0.8)]" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── Tab: Richieste ───────────────────────────────────────────────────────────

function TabRichieste({ onCountChange }: { onCountChange?: (n: number) => void }) {
  const { data, isLoading } = useRequests();
  const accept  = useAcceptRequest();
  const decline = useRemoveFriend();
  const reqs    = data?.requests ?? [];

  // aggiorna il badge sul tab
  if (onCountChange && !isLoading) onCountChange(reqs.length);

  return (
    <div className="space-y-3">
      {isLoading ? (
        <SkeletonList n={3} />
      ) : reqs.length === 0 ? (
        <EmptyState
          icon={<UserPlus className="w-8 h-8 text-[hsl(var(--muted-foreground) / 0.8)]" />}
          title="Nessuna richiesta"
          desc="Quando qualcuno vuole connettersi con te, apparirà qui."
        />
      ) : (
        <motion.div
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
          initial="hidden"
          animate="visible"
          className="space-y-3"
        >
          {reqs.map((r) => (
            <RequestCard
              key={r.friendshipId}
              entry={r}
              onAccept={() => accept.mutate(r.friendshipId)}
              onDecline={() => decline.mutate(r.friendshipId)}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}

function RequestCard({
  entry,
  onAccept,
  onDecline,
}: {
  entry: RequestEntry;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const u = entry.user;

  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25 } } }}
      className="flex items-center gap-3 p-4 rounded-xl bg-[hsl(var(--background))]
                 border border-blue-500/15 hover:border-blue-500/25 transition-all"
    >
      <Link href={`/profilo/${u.id}`}>
        <Avatar user={u} size={10} />
      </Link>

      <div className="flex-1 min-w-0">
        <Link href={`/profilo/${u.id}`}
          className="text-[13px] font-semibold text-[hsl(var(--foreground))] hover:text-[hsl(var(--foreground))] transition-colors truncate block">
          {u.name}
        </Link>
        <p className="text-[11px] text-[hsl(var(--muted-foreground) / 0.8)] truncate">
          {u.sectorName ?? journeyLabel(u.journeyType)}
        </p>
        {entry.sentAt && (
          <div className="flex items-center gap-1 mt-0.5">
            <Clock className="w-2.5 h-2.5 text-[hsl(var(--muted-foreground) / 0.8)]" />
            <span className="text-[10px] text-[hsl(var(--muted-foreground) / 0.8)]">
              {new Date(entry.sentAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onAccept}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                     bg-blue-500/15 border border-blue-500/30 text-blue-400
                     text-[12px] font-semibold hover:bg-blue-500/25
                     hover:border-blue-500/50 transition-all"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Accetta
        </button>
        <button
          onClick={onDecline}
          className="w-8 h-8 rounded-lg bg-[hsl(var(--muted))] border border-foreground/[0.06]
                     flex items-center justify-center hover:bg-red-500/10
                     hover:border-red-500/20 transition-all"
          aria-label="Rifiuta richiesta"
        >
          <X className="w-3.5 h-3.5 text-[hsl(var(--muted-foreground) / 0.8)]" />
        </button>
      </div>
    </motion.div>
  );
}

// ── Tab: Esplora ─────────────────────────────────────────────────────────────

function TabEsplora() {
  const [query, setQuery]     = useState('');
  const debouncedQ            = useDebounce(query, 350);
  const inputRef              = useRef<HTMLInputElement>(null);

  const { data: suggestData, isLoading: loadingSugg } = useSuggestions();
  const { data: searchData,  isLoading: loadingSearch } = useSearchUsers(debouncedQ);
  const sendReq = useSendRequest();

  const isSearching = debouncedQ.trim().length >= 2;
  const users: NetworkUser[] = isSearching
    ? (searchData?.results ?? [])
    : (suggestData?.suggestions ?? []);
  const loading = isSearching ? loadingSearch : loadingSugg;

  return (
    <div className="space-y-4">
      {/* Searchbar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground) / 0.8)]"
          aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cerca per nome..."
          className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-[hsl(var(--background))]
                     border border-foreground/[0.06] focus:border-blue-500/40
                     text-[13px] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground) / 0.8)]
                     outline-none transition-colors"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); inputRef.current?.focus(); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground) / 0.8)]
                       hover:text-[hsl(var(--muted-foreground))] transition-colors"
            aria-label="Cancella ricerca"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Label sezione */}
      <p className="text-[11px] font-semibold text-[hsl(var(--muted-foreground) / 0.8)] uppercase tracking-wide">
        {isSearching
          ? `Risultati per “${debouncedQ}”`
          : 'Suggeriti per te'}
      </p>

      {/* Lista */}
      {loading ? (
        <SkeletonList />
      ) : users.length === 0 ? (
        <EmptyState
          icon={<Compass className="w-8 h-8 text-[hsl(var(--muted-foreground) / 0.8)]" />}
          title={isSearching ? 'Nessun risultato' : 'Nessun suggerimento'}
          desc={isSearching
            ? 'Prova un altro nome o cognome.'
            : 'Non ci sono utenti pubblici al momento.'}
        />
      ) : (
        <motion.div
          key={isSearching ? 'search' : 'suggestions'}
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}
          initial="hidden"
          animate="visible"
          className="space-y-3"
        >
          {users.map((u) => (
            <SuggestionCard
              key={u.id}
              user={u}
              onConnect={() => sendReq.mutate(u.id)}
              isPending={sendReq.isPending && (sendReq.variables as number) === u.id}
            />
          ))}
        </motion.div>
      )}
    </div>
  );
}

function SuggestionCard({
  user: u,
  onConnect,
  isPending,
}: {
  user: NetworkUser;
  onConnect: () => void;
  isPending: boolean;
}) {
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25 } } }}
      className="flex items-center gap-3 p-4 rounded-xl bg-[hsl(var(--background))]
                 border border-foreground/[0.06] hover:border-foreground/10 transition-all"
    >
      <Link href={`/profilo/${u.id}`}>
        <Avatar user={u} size={10} />
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/profilo/${u.id}`}
            className="text-[13px] font-semibold text-[hsl(var(--foreground))] hover:text-[hsl(var(--foreground))] transition-colors truncate">
            {u.name}
          </Link>
          {u.matchScore !== undefined && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
              matchColor(u.matchScore)
            }`}>
              {u.matchScore}% match
            </span>
          )}
        </div>
        <p className="text-[11px] text-[hsl(var(--muted-foreground) / 0.8)] truncate">
          {u.sectorName ?? journeyLabel(u.journeyType)}
        </p>
        {u.totalXp !== null && (
          <div className="flex items-center gap-1 mt-0.5">
            <Zap className="w-2.5 h-2.5 text-amber-400" />
            <span className="text-[10px] text-amber-400/70">
              {u.totalXp.toLocaleString('it-IT')} XP
            </span>
          </div>
        )}
      </div>

      <button
        onClick={onConnect}
        disabled={isPending}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg flex-shrink-0
                   bg-blue-500/15 border border-blue-500/30 text-blue-400
                   text-[12px] font-semibold hover:bg-blue-500/25
                   hover:border-blue-500/50 disabled:opacity-50
                   disabled:cursor-not-allowed transition-all"
      >
        <UserPlus className="w-3.5 h-3.5" />
        {isPending ? '...' : 'Connetti'}
      </button>
    </motion.div>
  );
}

// ── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({
  icon,
  title,
  desc,
  cta,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  cta?: { label: string; tab: Tab };
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center py-12 text-center"
    >
      <div className="mb-3 opacity-40">{icon}</div>
      <p className="text-[14px] font-semibold text-[hsl(var(--foreground))] mb-1">{title}</p>
      <p className="text-[12px] text-[hsl(var(--muted-foreground) / 0.8)] max-w-[32ch]">{desc}</p>
      {cta && (
        <span className="mt-4 text-[12px] text-[hsl(var(--chart-3))] hover:underline cursor-pointer flex items-center gap-1">
          {cta.label} <ChevronRight className="w-3.5 h-3.5" />
        </span>
      )}
    </motion.div>
  );
}

// ── Header ───────────────────────────────────────────────────────────────────

function NetworkHeader() {
  const { data } = useFriends();
  const count = data?.friends?.length ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold text-[hsl(var(--foreground))] tracking-tight">Network</h1>
          <p className="text-[13px] text-[hsl(var(--muted-foreground) / 0.8)] mt-0.5">
            {count > 0
              ? `${count} connession${count === 1 ? 'e' : 'i'} attiv${count === 1 ? 'a' : 'e'}`
              : 'Costruisci la tua rete professionale'}
          </p>
        </div>
        <div className="w-11 h-11 rounded-2xl bg-blue-500/10 border border-blue-500/20
                        flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-blue-400" />
        </div>
      </div>
    </motion.div>
  );
}

// ── Tabs bar ─────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'connessioni', label: 'Connessioni', icon: Users },
  { id: 'richieste',   label: 'Richieste',   icon: UserPlus },
  { id: 'esplora',     label: 'Esplora',     icon: Compass },
];

function TabsBar({
  active,
  onChange,
  requestCount,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
  requestCount: number;
}) {
  return (
    <div className="flex gap-1 p-1 rounded-2xl bg-[hsl(var(--background))] border border-foreground/[0.06]">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl
            text-[12px] font-semibold transition-all relative ${
            active === tab.id
              ? 'bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] border border-foreground/[0.08]'
              : 'text-[hsl(var(--muted-foreground) / 0.8)] hover:text-[hsl(var(--muted-foreground))]'
          }`}
        >
          <tab.icon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{tab.label}</span>
          {/* Badge richieste */}
          {tab.id === 'richieste' && requestCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1
                             bg-blue-500 text-[hsl(var(--foreground))] text-[9px] font-bold
                             rounded-full flex items-center justify-center">
              {requestCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Pagina principale ────────────────────────────────────────────────────────

export default function AmiciPage() {
  const [activeTab, setActiveTab]     = useState<Tab>('connessioni');
  const [requestCount, setRequestCount] = useState(0);

  // Pre-fetch richieste al mount per il badge
  const { data: reqData } = useRequests();
  const actualCount = reqData?.requests?.length ?? requestCount;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">

      <NetworkHeader />

      <TabsBar
        active={activeTab}
        onChange={setActiveTab}
        requestCount={actualCount}
      />

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {activeTab === 'connessioni' && <TabConnessioni />}
          {activeTab === 'richieste'   && (
            <TabRichieste onCountChange={setRequestCount} />
          )}
          {activeTab === 'esplora'     && <TabEsplora />}
        </motion.div>
      </AnimatePresence>

    </div>
  );
}
