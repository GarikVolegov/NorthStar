/**
 * amici.tsx — Pagina /amici (Network Section)
 *
 * Struttura:
 *   - Header con titolo + contatore
 *   - 3 Tab: Connessioni | Richieste (badge) | Esplora
 *   - Tab Esplora: barra di ricerca con debounce 300ms + filtro settore
 *   - Contenuto animato con framer-motion (stagger cards)
 *   - Skeleton loader durante il caricamento
 *   - Empty state curato per ogni tab
 *
 * Dipendenze:
 *   - useFriends (hook locale)
 *   - framer-motion (già in progetto — App.tsx)
 *   - Lucide icons (già in progetto)
 *   - Tailwind CSS
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, UserPlus, Compass, UserCheck, UserX, Clock,
  Star, Zap, Search, X, Loader2, SlidersHorizontal,
} from "lucide-react";
import { useFriends, type Friend, type FriendRequest, type Suggestion } from "@/hooks/useFriends";

// ── Tipi ──────────────────────────────────────────────────────────────────────
type Tab = "connessioni" | "richieste" | "esplora";

type SearchResult = {
  id: number;
  name: string;
  avatarUrl: string | null;
  sectorName: string | null;
  journeyType: string | null;
  totalXp: number | null;
};

type SearchState =
  | { status: "idle" }
  | { status: "searching" }
  | { status: "done"; results: SearchResult[]; query: string; hasMore: boolean }
  | { status: "error"; message: string };

// ── Costanti animazione ───────────────────────────────────────────────────────
const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};
const cardVariants = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, scale: 0.96, transition: { duration: 0.18 } },
};

// ── Hook: useSearch ───────────────────────────────────────────────────────────
//
// Gestisce la ricerca con debounce 300ms.
// Ritorna lo stato della ricerca e le azioni per agire sui risultati.

function useSearch() {
  const [query, setQuery]         = useState("");
  const [sectorFilter, setSector] = useState<number | null>(null);
  const [state, setState]         = useState<SearchState>({ status: "idle" });
  const [pendingIds, setPending]  = useState<Record<number, "sending" | "sent">>({}); 
  const debounceRef               = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef                  = useRef<AbortController | null>(null);

  const doSearch = useCallback(async (q: string, sector: number | null) => {
    if (q.trim().length < 2) {
      setState({ status: "idle" });
      return;
    }

    // Annulla richiesta precedente
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setState({ status: "searching" });

    try {
      const params = new URLSearchParams({ q: q.trim() });
      if (sector !== null) params.set("sector", String(sector));

      const res = await fetch(`/api/friends/search?${params}`, {
        credentials: "include",
        signal: ac.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setState({ status: "error", message: body.error ?? "Errore nella ricerca" });
        return;
      }

      const data = await res.json();
      setState({
        status:   "done",
        results:  data.results ?? [],
        query:    q.trim(),
        hasMore:  data.hasMore ?? false,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return; // richiesta annullata, ignora
      setState({ status: "error", message: "Connessione non riuscita" });
    }
  }, []);

  // Debounce: 300ms dopo l'ultimo keystroke
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query, sectorFilter), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, sectorFilter, doSearch]);

  const clear = useCallback(() => {
    setQuery("");
    setSector(null);
    setState({ status: "idle" });
    abortRef.current?.abort();
    setPending({});
  }, []);

  const markSending = useCallback((userId: number) => {
    setPending((p) => ({ ...p, [userId]: "sending" }));
  }, []);

  const markSent = useCallback((userId: number) => {
    setPending((p) => ({ ...p, [userId]: "sent" }));
  }, []);

  return {
    query,
    setQuery,
    sectorFilter,
    setSector,
    state,
    clear,
    pendingIds,
    markSending,
    markSent,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Avatar({ user }: { user: { name: string; avatarUrl: string | null } }) {
  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        width={44}
        height={44}
        loading="lazy"
        className="w-11 h-11 rounded-full object-cover flex-shrink-0 ring-2 ring-white/5"
      />
    );
  }

  return (
    <div className="w-11 h-11 rounded-full bg-[#1e2333] flex items-center justify-center flex-shrink-0 ring-2 ring-white/5">
      <span className="text-sm font-semibold text-[#7c8db5]">{initials}</span>
    </div>
  );
}

function JourneyBadge({ type }: { type: string | null }) {
  if (!type) return null;
  const map: Record<string, { label: string; color: string }> = {
    indeciso:       { label: "In esplorazione",  color: "text-amber-400 bg-amber-400/10" },
    in_transizione: { label: "In transizione",   color: "text-blue-400 bg-blue-400/10" },
    in_crescita:    { label: "In crescita",       color: "text-emerald-400 bg-emerald-400/10" },
    autonomo:       { label: "Autonomo",          color: "text-violet-400 bg-violet-400/10" },
  };
  const badge = map[type] ?? { label: type, color: "text-[#7c8db5] bg-white/5" };
  return (
    <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${badge.color}`}>
      {badge.label}
    </span>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-[#131929] animate-pulse">
      <div className="w-11 h-11 rounded-full bg-[#1e2c42] flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-32 bg-[#1e2c42] rounded" />
        <div className="h-3 w-20 bg-[#1e2c42] rounded" />
      </div>
      <div className="h-8 w-20 bg-[#1e2c42] rounded-lg" />
    </div>
  );
}

function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
}

// ── Empty states ─────────────────────────────────────────────────────────────

function EmptyState({
  icon: Icon,
  title,
  description,
  cta,
  onCta,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  cta?: string;
  onCta?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col items-center text-center py-16 px-6"
    >
      <div className="w-14 h-14 rounded-2xl bg-[#1e2333] flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-[#4a6fa1]" />
      </div>
      <h3 className="text-[15px] font-semibold text-[#c5cee0] mb-2">{title}</h3>
      <p className="text-[13px] text-[#7c8db5] max-w-[28ch] leading-relaxed">{description}</p>
      {cta && onCta && (
        <button
          onClick={onCta}
          className="mt-6 px-4 py-2 rounded-lg bg-[#1a3a6b] text-[#7eb3ff] text-sm font-medium
                     hover:bg-[#1f4480] transition-colors"
        >
          {cta}
        </button>
      )}
    </motion.div>
  );
}

// ── Schede ────────────────────────────────────────────────────────────────────

function FriendCard({
  friend,
  onRemove,
  removing,
}: {
  friend: Friend;
  onRemove: () => void;
  removing: boolean;
}) {
  const sinceDate = new Date(friend.since).toLocaleDateString("it-IT", {
    month: "short",
    year: "numeric",
  });

  return (
    <motion.div
      variants={cardVariants}
      layout
      className="flex items-center gap-3 p-4 rounded-xl bg-[#0d1421] border border-white/[0.06]
                 hover:border-white/10 transition-all group"
    >
      <Avatar user={friend.user} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[14px] font-semibold text-[#dce6f5] truncate">{friend.user.name}</span>
          <JourneyBadge type={friend.user.journeyType} />
        </div>
        <div className="flex items-center gap-3 text-[12px] text-[#7c8db5]">
          {friend.user.sectorName && (
            <span className="truncate">{friend.user.sectorName}</span>
          )}
          {friend.user.totalXp != null && (
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              {friend.user.totalXp.toLocaleString("it-IT")} XP
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 mt-1 text-[11px] text-[#4a5a75]">
          <Clock className="w-3 h-3" />
          <span>Connessi da {sinceDate}</span>
        </div>
      </div>
      <button
        onClick={onRemove}
        disabled={removing}
        aria-label="Rimuovi connessione"
        className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg
                   hover:bg-red-500/10 text-[#4a5a75] hover:text-red-400
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <UserX className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

function RequestCard({
  request,
  onAccept,
  onDecline,
  accepting,
  declining,
}: {
  request: FriendRequest;
  onAccept: () => void;
  onDecline: () => void;
  accepting: boolean;
  declining: boolean;
}) {
  return (
    <motion.div
      variants={cardVariants}
      layout
      className="flex items-center gap-3 p-4 rounded-xl bg-[#0d1421] border border-[#1a3a6b]/40
                 hover:border-[#1a3a6b]/70 transition-all"
    >
      <Avatar user={request.user} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[14px] font-semibold text-[#dce6f5] truncate">{request.user.name}</span>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-[#7c8db5]">
          {request.user.sectorName && <span className="truncate">{request.user.sectorName}</span>}
          <JourneyBadge type={request.user.journeyType} />
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={onDecline}
          disabled={declining || accepting}
          aria-label="Rifiuta richiesta"
          className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-[#7c8db5]
                     hover:bg-red-500/10 hover:text-red-400 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Rifiuta
        </button>
        <button
          onClick={onAccept}
          disabled={accepting || declining}
          aria-label="Accetta richiesta"
          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white
                     bg-[#1a3a6b] hover:bg-[#1f4480] transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {accepting ? (
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <UserCheck className="w-3.5 h-3.5" />
          )}
          Accetta
        </button>
      </div>
    </motion.div>
  );
}

function SuggestionCard({
  suggestion,
  onConnect,
  sending,
}: {
  suggestion: Suggestion;
  onConnect: () => void;
  sending: boolean;
}) {
  return (
    <motion.div
      variants={cardVariants}
      layout
      className="flex items-center gap-3 p-4 rounded-xl bg-[#0d1421] border border-white/[0.06]
                 hover:border-white/10 transition-all"
    >
      <Avatar user={suggestion} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[14px] font-semibold text-[#dce6f5] truncate">{suggestion.name}</span>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-[#7c8db5]">
          {suggestion.sectorName && <span className="truncate">{suggestion.sectorName}</span>}
          {suggestion.totalXp != null && (
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400" />
              {suggestion.totalXp.toLocaleString("it-IT")} XP
            </span>
          )}
        </div>
        <JourneyBadge type={suggestion.journeyType} />
      </div>
      <button
        onClick={onConnect}
        disabled={sending}
        aria-label={`Connettiti con ${suggestion.name}`}
        className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#7eb3ff]
                   bg-[#1a3a6b]/60 hover:bg-[#1a3a6b] transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
      >
        {sending ? (
          <span className="w-3.5 h-3.5 border-2 border-[#7eb3ff]/30 border-t-[#7eb3ff] rounded-full animate-spin" />
        ) : (
          <UserPlus className="w-3.5 h-3.5" />
        )}
        Connetti
      </button>
    </motion.div>
  );
}

// ── SearchResultCard ──────────────────────────────────────────────────────────
// Card per i risultati di ricerca: uguale a SuggestionCard ma con stato
// "sent" (richiesta già inviata) gestito separatamente.

function SearchResultCard({
  user,
  onConnect,
  status,
}: {
  user: SearchResult;
  onConnect: () => void;
  status: "idle" | "sending" | "sent";
}) {
  return (
    <motion.div
      variants={cardVariants}
      layout
      className="flex items-center gap-3 p-4 rounded-xl bg-[#0d1421] border border-white/[0.06]
                 hover:border-white/10 transition-all"
    >
      <Avatar user={user} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[14px] font-semibold text-[#dce6f5] truncate">{user.name}</span>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-[#7c8db5] flex-wrap">
          {user.sectorName && <span className="truncate max-w-[120px]">{user.sectorName}</span>}
          {user.totalXp != null && (
            <span className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-amber-400" />
              {user.totalXp.toLocaleString("it-IT")} XP
            </span>
          )}
        </div>
        {user.journeyType && (
          <div className="mt-1">
            <JourneyBadge type={user.journeyType} />
          </div>
        )}
      </div>

      {status === "sent" ? (
        <span className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-emerald-400 bg-emerald-400/10 flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5" />
          Inviata
        </span>
      ) : (
        <button
          onClick={onConnect}
          disabled={status === "sending"}
          aria-label={`Connettiti con ${user.name}`}
          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#7eb3ff]
                     bg-[#1a3a6b]/60 hover:bg-[#1a3a6b] transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
        >
          {status === "sending" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <UserPlus className="w-3.5 h-3.5" />
          )}
          Connetti
        </button>
      )}
    </motion.div>
  );
}

// ── SearchBar ─────────────────────────────────────────────────────────────────

function SearchBar({
  query,
  onChange,
  onClear,
  isSearching,
}: {
  query: string;
  onChange: (v: string) => void;
  onClear: () => void;
  isSearching: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5a75] pointer-events-none">
        {isSearching
          ? <Loader2 className="w-4 h-4 animate-spin" />
          : <Search className="w-4 h-4" />
        }
      </div>
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Cerca per nome…"
        autoComplete="off"
        spellCheck={false}
        aria-label="Cerca utenti per nome"
        className="
          w-full pl-10 pr-10 py-2.5 rounded-xl
          bg-[#0d1421] border border-white/[0.08]
          text-[14px] text-[#dce6f5] placeholder:text-[#4a5a75]
          focus:outline-none focus:border-[#2a4a8b]/70 focus:ring-1 focus:ring-[#2a4a8b]/40
          transition-all
        "
      />
      {query.length > 0 && (
        <button
          onClick={onClear}
          aria-label="Cancella ricerca"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-[#4a5a75]
                     hover:text-[#7c8db5] transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ── TabEsplora — contenuto completo della tab ─────────────────────────────────

function TabEsplora({
  suggestions,
  pendingFriendIds,
  onConnectSuggestion,
}: {
  suggestions: Suggestion[];
  pendingFriendIds: Record<string, string>;
  onConnectSuggestion: (id: string) => void;
}) {
  const search = useSearch();

  // Funzione che invia la richiesta e aggiorna lo stato ottimistico
  async function handleConnectSearch(user: SearchResult) {
    search.markSending(user.id);
    try {
      const res = await fetch(`/api/friends/request/${user.id}`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok || res.status === 409) {
        search.markSent(user.id);
      } else {
        // ripristina a idle su errore
        search.markSending(user.id); // trick: forza re-render
      }
    } catch {
      // ignora — l'utente può riprovare
    }
  }

  const isActiveSearch = search.query.trim().length >= 2;

  return (
    <div className="space-y-4">

      {/* ── Barra di ricerca ──────────────────────────────────────────── */}
      <SearchBar
        query={search.query}
        onChange={search.setQuery}
        onClear={search.clear}
        isSearching={search.state.status === "searching"}
      />

      {/* ── Risultati ricerca ─────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {isActiveSearch ? (
          <motion.div
            key="search-results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {search.state.status === "searching" && (
              <SkeletonList count={3} />
            )}

            {search.state.status === "error" && (
              <div className="text-center py-8 text-[#7c8db5] text-[13px]">
                <p>{search.state.message}</p>
              </div>
            )}

            {search.state.status === "done" && (
              <>
                {/* Header risultati */}
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[12px] text-[#4a5a75]">
                    {search.state.results.length === 0
                      ? `Nessun risultato per "${search.state.query}"`
                      : `${search.state.results.length}${
                          search.state.hasMore ? "+" : ""
                        } risultat${search.state.results.length === 1 ? "o" : "i"} per "${search.state.query}"`
                    }
                  </p>
                </div>

                {search.state.results.length === 0 ? (
                  <EmptyState
                    icon={Search}
                    title="Nessun utente trovato"
                    description={`Non ci sono utenti pubblici con il nome "${search.state.query}"`}
                  />
                ) : (
                  <motion.div
                    variants={listVariants}
                    initial="hidden"
                    animate="visible"
                    className="space-y-3"
                  >
                    {search.state.results.map((user) => (
                      <SearchResultCard
                        key={user.id}
                        user={user}
                        status={
                          search.pendingIds[user.id] === "sent"
                            ? "sent"
                            : search.pendingIds[user.id] === "sending"
                            ? "sending"
                            : "idle"
                        }
                        onConnect={() => handleConnectSearch(user)}
                      />
                    ))}
                  </motion.div>
                )}

                {search.state.hasMore && (
                  <p className="text-center text-[11px] text-[#4a5a75] mt-3">
                    Affina la ricerca per trovare risultati più specifici
                  </p>
                )}
              </>
            )}
          </motion.div>
        ) : (
          /* ── Suggerimenti (stato idle) ────────────────────────────── */
          <motion.div
            key="suggestions"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {suggestions.length === 0 ? (
              <EmptyState
                icon={Compass}
                title="Nessun suggerimento al momento"
                description="Completa il tuo profilo per essere trovato da altri utenti"
              />
            ) : (
              <>
                <p className="text-[12px] text-[#4a5a75] mb-4 flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-amber-400/60" />
                  Persone con il tuo stesso settore o percorso
                </p>
                <motion.div
                  variants={listVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-3"
                >
                  {suggestions.map((s) => (
                    <SuggestionCard
                      key={s.id}
                      suggestion={s}
                      sending={pendingFriendIds[s.id] === "sending"}
                      onConnect={() => onConnectSuggestion(s.id)}
                    />
                  ))}
                </motion.div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Pagina principale ─────────────────────────────────────────────────────────

export default function AmiciPage() {
  const [activeTab, setActiveTab] = useState<Tab>("connessioni");
  const {
    friends,
    requests,
    suggestions,
    loading,
    error,
    pendingIds,
    actions,
  } = useFriends();

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { id: "connessioni", label: "Connessioni", icon: Users,    badge: friends.length || undefined },
    { id: "richieste",   label: "Richieste",   icon: UserPlus, badge: requests.length || undefined },
    { id: "esplora",     label: "Esplora",     icon: Compass },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#dce6f5] tracking-tight">Network</h1>
        <p className="mt-1 text-[13px] text-[#7c8db5]">
          Connettiti con persone nel tuo stesso percorso professionale
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-[#0d1421] border border-white/[0.06] mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              relative flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg
              text-[13px] font-medium transition-all duration-200
              ${
                activeTab === tab.id
                  ? "bg-[#1a2d4f] text-[#dce6f5] shadow-sm"
                  : "text-[#7c8db5] hover:text-[#a8b8d0] hover:bg-white/[0.03]"
              }
            `}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.badge != null && tab.badge > 0 && (
              <span
                className={`
                  ml-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold
                  flex items-center justify-center
                  ${
                    tab.id === "richieste"
                      ? "bg-blue-500 text-white"
                      : "bg-white/10 text-[#7eb3ff]"
                  }
                `}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Contenuto tab */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <SkeletonList />
          </motion.div>
        ) : error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12 text-[#7c8db5] text-sm"
          >
            <p>Errore nel caricamento.</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 text-[#7eb3ff] hover:underline"
            >
              Riprova
            </button>
          </motion.div>
        ) : activeTab === "connessioni" ? (
          <motion.div key="connessioni" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {friends.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Ancora nessuna connessione"
                description="Esplora i profili e connettiti con persone nel tuo settore"
                cta="Scopri persone"
                onCta={() => setActiveTab("esplora")}
              />
            ) : (
              <motion.div
                variants={listVariants}
                initial="hidden"
                animate="visible"
                className="space-y-3"
              >
                {friends.map((f) => (
                  <FriendCard
                    key={f.friendshipId}
                    friend={f}
                    removing={pendingIds[f.friendshipId] === "removing"}
                    onRemove={() => actions.remove(f.friendshipId)}
                  />
                ))}
              </motion.div>
            )}
          </motion.div>
        ) : activeTab === "richieste" ? (
          <motion.div key="richieste" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {requests.length === 0 ? (
              <EmptyState
                icon={UserPlus}
                title="Nessuna richiesta in attesa"
                description="Quando qualcuno ti invierà una richiesta, apparirà qui"
              />
            ) : (
              <motion.div
                variants={listVariants}
                initial="hidden"
                animate="visible"
                className="space-y-3"
              >
                {requests.map((r) => (
                  <RequestCard
                    key={r.friendshipId}
                    request={r}
                    accepting={pendingIds[r.friendshipId] === "accepting"}
                    declining={pendingIds[r.friendshipId] === "removing"}
                    onAccept={() => actions.acceptRequest(r.friendshipId, r.user.id)}
                    onDecline={() => actions.remove(r.friendshipId)}
                  />
                ))}
              </motion.div>
            )}
          </motion.div>
        ) : (
          /* ── Tab Esplora ───────────────────────────────────────────────── */
          <motion.div key="esplora" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <TabEsplora
              suggestions={suggestions}
              pendingFriendIds={pendingIds}
              onConnectSuggestion={(id) => actions.sendRequest(id)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
