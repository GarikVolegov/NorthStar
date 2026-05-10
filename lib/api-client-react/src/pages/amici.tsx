/**
 * amici.tsx — Pagina /amici (Network Section)
 *
 * Step 3: notifiche real-time
 *   - useNotificationsStream al posto di useNotificationsSnapshot
 *   - refetch automatico useFriends quando arriva friend_request via SSE
 *   - Toast in-page per nuove richieste amicizia
 *   - Invalidazione cache DM quando arriva new_message
 *
 * Step 5 (DM deep-link):
 *   - Legge ?dm=<userId>&name=<name> da URL al mount
 *   - Apre automaticamente il tab Messaggi con la conversazione pre-selezionata
 *   - Rimuove il query param dall'URL dopo l'apertura (history replace)
 *
 * Struttura:
 *   - Header con titolo + contatore
 *   - 4 Tab: Connessioni | Richieste (badge) | Esplora | Messaggi (badge DM)
 *   - Tab Messaggi: lista conversazioni + finestra chat inline
 *   - Tab Esplora: barra di ricerca con debounce 300ms
 *   - Contenuto animato con framer-motion
 *   - Skeleton loader durante il caricamento
 *   - Empty state curato per ogni tab
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, UserPlus, Compass, UserCheck, UserX, Clock,
  Star, Zap, Search, X, Loader2,
  MessageCircle, Send, Trash2, ArrowLeft, ChevronUp, Bell,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFriends, type Friend, type FriendRequest, type Suggestion } from "@/hooks/useFriends";
import {
  useConversations,
  useMessages,
  useSendMessage,
  useDeleteMessage,
  useDMStream,
  dmKeys,
  type DMConversation,
  type DMMessage,
} from "@/hooks/useDirectMessages";
import {
  useNotificationsStream,
  useAcceptFriendRequest,
  useDeclineFriendRequest,
  type FriendRequestNotification,
} from "@/hooks/useNotifications";
import { apiClient } from "@/lib/api-client";

// ── Hook: useMyId ─────────────────────────────────────────────────────────────

function useMyId(): number {
  const { data } = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => apiClient.get<{ id: number; name: string }>("/auth/me"),
    staleTime: Infinity,
    retry: false,
  });
  return data?.id ?? 0;
}

// ── Tipi ─────────────────────────────────────────────────────────────────────

type Tab = "connessioni" | "richieste" | "esplora" | "messaggi";

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

// ── Costanti animazione ──────────────────────────────────────────────────────

const listVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.06 } },
};
const cardVariants = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } },
  exit:    { opacity: 0, scale: 0.96, transition: { duration: 0.18 } },
};

// ── Toast notifica richiesta amicizia ─────────────────────────────────────────

function FriendRequestToast({
  notif,
  onClose,
}: {
  notif: FriendRequestNotification;
  onClose: () => void;
}) {
  const accept  = useAcceptFriendRequest();
  const decline = useDeclineFriendRequest();
  const [progress, setProgress] = useState(100);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const DURATION = 6000;
    const TICK     = 50;
    let elapsed    = 0;

    intervalRef.current = setInterval(() => {
      elapsed += TICK;
      setProgress(Math.max(0, 100 - (elapsed / DURATION) * 100));
      if (elapsed >= DURATION) onClose();
    }, TICK);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [onClose]);

  const stopTimer = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  async function handleAccept() {
    stopTimer();
    await accept.mutateAsync(notif.friendshipId);
    onClose();
  }

  async function handleDecline() {
    stopTimer();
    await decline.mutateAsync(notif.friendshipId);
    onClose();
  }

  const initials = notif.from.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0,  scale: 1 }}
      exit={{    opacity: 0, y: 16, scale: 0.95 }}
      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      onMouseEnter={stopTimer}
      className="
        w-[320px] rounded-2xl overflow-hidden
        bg-[#0d1421] border border-[#1a3a6b]/60
        shadow-[0_8px_32px_rgba(0,0,0,0.4)]
      "
      role="alert"
      aria-live="polite"
    >
      <div className="h-0.5 bg-[#1a2d4f]">
        <motion.div
          className="h-full bg-[#4a8bff]"
          style={{ width: `${progress}%` }}
          transition={{ duration: 0.05 }}
        />
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Bell className="w-3.5 h-3.5 text-[#4a8bff]" />
            <span className="text-[11px] font-semibold text-[#4a8bff] uppercase tracking-wide">
              Nuova richiesta
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Chiudi notifica"
            className="p-0.5 rounded text-[#4a5a75] hover:text-[#7c8db5] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-3">
          {notif.from.avatarUrl ? (
            <img
              src={notif.from.avatarUrl}
              alt={notif.from.name}
              width={40}
              height={40}
              loading="lazy"
              className="w-10 h-10 rounded-full object-cover flex-shrink-0 ring-2 ring-white/5"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-[#1e2333] flex items-center justify-center flex-shrink-0 ring-2 ring-white/5">
              <span className="text-xs font-semibold text-[#7c8db5]">{initials}</span>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[14px] font-semibold text-[#dce6f5] truncate">
              {notif.from.name}
            </p>
            {notif.from.sectorName && (
              <p className="text-[12px] text-[#7c8db5] truncate">{notif.from.sectorName}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleDecline}
            disabled={accept.isPending || decline.isPending}
            className="
              flex-1 py-1.5 rounded-lg text-[12px] font-medium
              text-[#7c8db5] hover:bg-white/[0.05] hover:text-[#a8b8d0]
              transition-colors disabled:opacity-50
            "
          >
            Rifiuta
          </button>
          <button
            onClick={handleAccept}
            disabled={accept.isPending || decline.isPending}
            className="
              flex-1 py-1.5 rounded-lg text-[12px] font-semibold
              bg-[#1a3a6b] text-[#7eb3ff] hover:bg-[#1f4480]
              transition-colors disabled:opacity-50
              flex items-center justify-center gap-1.5
            "
          >
            {accept.isPending
              ? <span className="w-3 h-3 border-2 border-[#7eb3ff]/30 border-t-[#7eb3ff] rounded-full animate-spin" />
              : <UserCheck className="w-3.5 h-3.5" />}
            Accetta
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function ToastContainer({ toasts, onDismiss }: {
  toasts: FriendRequestNotification[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 items-end"
      aria-label="Notifiche"
    >
      <AnimatePresence mode="sync">
        {toasts.slice(-3).map((n) => (
          <FriendRequestToast
            key={n.id}
            notif={n}
            onClose={() => onDismiss(n.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

// ── Hook: useSearch ───────────────────────────────────────────────────────────

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
        status:  "done",
        results: data.results ?? [],
        query:   q.trim(),
        hasMore: data.hasMore ?? false,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setState({ status: "error", message: "Connessione non riuscita" });
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query, sectorFilter), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
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

  return { query, setQuery, sectorFilter, setSector, state, clear, pendingIds, markSending, markSent };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Avatar({ user, size = "md" }: { user: { name: string; avatarUrl: string | null }; size?: "sm" | "md" }) {
  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const cls = size === "sm"
    ? "w-8 h-8 rounded-full text-xs"
    : "w-11 h-11 rounded-full text-sm";

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        width={size === "sm" ? 32 : 44}
        height={size === "sm" ? 32 : 44}
        loading="lazy"
        className={`${cls} object-cover flex-shrink-0 ring-2 ring-white/5`}
      />
    );
  }
  return (
    <div className={`${cls} bg-[#1e2333] flex items-center justify-center flex-shrink-0 ring-2 ring-white/5`}>
      <span className="font-semibold text-[#7c8db5]">{initials}</span>
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

function formatTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Ieri";
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short" });
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

// ── Empty states ───────────────────────────────────────────────────────────────

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

// ── Schede network ─────────────────────────────────────────────────────────────

function FriendCard({
  friend, onRemove, removing,
}: { friend: Friend; onRemove: () => void; removing: boolean }) {
  const sinceDate = new Date(friend.since).toLocaleDateString("it-IT", {
    month: "short", year: "numeric",
  });
  return (
    <motion.div
      variants={cardVariants} layout
      className="flex items-center gap-3 p-4 rounded-xl bg-[#0d1421] border border-white/[0.06]
                 hover:border-white/10 transition-all group"
    >
      <Link href={`/profilo/${friend.user.id}`} aria-label={`Vai al profilo di ${friend.user.name}`}>
        <Avatar user={friend.user} />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Link href={`/profilo/${friend.user.id}`}
            className="text-[14px] font-semibold text-[#dce6f5] truncate hover:text-[#7eb3ff] transition-colors">
            {friend.user.name}
          </Link>
          <JourneyBadge type={friend.user.journeyType} />
        </div>
        <div className="flex items-center gap-3 text-[12px] text-[#7c8db5]">
          {friend.user.sectorName && <span className="truncate">{friend.user.sectorName}</span>}
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
      <button onClick={onRemove} disabled={removing} aria-label="Rimuovi connessione"
        className="opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-lg
                   hover:bg-red-500/10 text-[#4a5a75] hover:text-red-400
                   disabled:opacity-50 disabled:cursor-not-allowed">
        <UserX className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

function RequestCard({
  request, onAccept, onDecline, accepting, declining,
}: { request: FriendRequest; onAccept: () => void; onDecline: () => void; accepting: boolean; declining: boolean }) {
  return (
    <motion.div
      variants={cardVariants} layout
      className="flex items-center gap-3 p-4 rounded-xl bg-[#0d1421] border border-[#1a3a6b]/40
                 hover:border-[#1a3a6b]/70 transition-all"
    >
      <Link href={`/profilo/${request.user.id}`} aria-label={`Vai al profilo di ${request.user.name}`}>
        <Avatar user={request.user} />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Link href={`/profilo/${request.user.id}`}
            className="text-[14px] font-semibold text-[#dce6f5] truncate hover:text-[#7eb3ff] transition-colors">
            {request.user.name}
          </Link>
        </div>
        <div className="flex items-center gap-3 text-[12px] text-[#7c8db5]">
          {request.user.sectorName && <span className="truncate">{request.user.sectorName}</span>}
          <JourneyBadge type={request.user.journeyType} />
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={onDecline} disabled={declining || accepting} aria-label="Rifiuta richiesta"
          className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-[#7c8db5]
                     hover:bg-red-500/10 hover:text-red-400 transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed">
          Rifiuta
        </button>
        <button onClick={onAccept} disabled={accepting || declining} aria-label="Accetta richiesta"
          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white
                     bg-[#1a3a6b] hover:bg-[#1f4480] transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
          {accepting
            ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            : <UserCheck className="w-3.5 h-3.5" />}
          Accetta
        </button>
      </div>
    </motion.div>
  );
}

function SuggestionCard({
  suggestion, onConnect, sending,
}: { suggestion: Suggestion; onConnect: () => void; sending: boolean }) {
  return (
    <motion.div
      variants={cardVariants} layout
      className="flex items-center gap-3 p-4 rounded-xl bg-[#0d1421] border border-white/[0.06]
                 hover:border-white/10 transition-all"
    >
      <Link href={`/profilo/${suggestion.id}`} aria-label={`Vai al profilo di ${suggestion.name}`}>
        <Avatar user={suggestion} />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Link href={`/profilo/${suggestion.id}`}
            className="text-[14px] font-semibold text-[#dce6f5] truncate hover:text-[#7eb3ff] transition-colors">
            {suggestion.name}
          </Link>
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
      <button onClick={onConnect} disabled={sending} aria-label={`Connettiti con ${suggestion.name}`}
        className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#7eb3ff]
                   bg-[#1a3a6b]/60 hover:bg-[#1a3a6b] transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
        {sending
          ? <span className="w-3.5 h-3.5 border-2 border-[#7eb3ff]/30 border-t-[#7eb3ff] rounded-full animate-spin" />
          : <UserPlus className="w-3.5 h-3.5" />}
        Connetti
      </button>
    </motion.div>
  );
}

function SearchResultCard({
  user, onConnect, status,
}: { user: SearchResult; onConnect: () => void; status: "idle" | "sending" | "sent" }) {
  return (
    <motion.div
      variants={cardVariants} layout
      className="flex items-center gap-3 p-4 rounded-xl bg-[#0d1421] border border-white/[0.06]
                 hover:border-white/10 transition-all"
    >
      <Link href={`/profilo/${user.id}`} aria-label={`Vai al profilo di ${user.name}`}>
        <Avatar user={user} />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Link href={`/profilo/${user.id}`}
            className="text-[14px] font-semibold text-[#dce6f5] truncate hover:text-[#7eb3ff] transition-colors">
            {user.name}
          </Link>
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
        {user.journeyType && <div className="mt-1"><JourneyBadge type={user.journeyType} /></div>}
      </div>
      {status === "sent" ? (
        <span className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-emerald-400 bg-emerald-400/10 flex items-center gap-1.5">
          <UserCheck className="w-3.5 h-3.5" />
          Inviata
        </span>
      ) : (
        <button onClick={onConnect} disabled={status === "sending"} aria-label={`Connettiti con ${user.name}`}
          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#7eb3ff]
                     bg-[#1a3a6b]/60 hover:bg-[#1a3a6b] transition-colors
                     disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5">
          {status === "sending" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
          Connetti
        </button>
      )}
    </motion.div>
  );
}

function SearchBar({
  query, onChange, onClear, isSearching,
}: { query: string; onChange: (v: string) => void; onClear: () => void; isSearching: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#4a5a75] pointer-events-none">
        {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
      </div>
      <input ref={inputRef} type="search" value={query} onChange={(e) => onChange(e.target.value)}
        placeholder="Cerca per nome…" autoComplete="off" spellCheck={false}
        aria-label="Cerca utenti per nome"
        className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-[#0d1421] border border-white/[0.08]
                   text-[14px] text-[#dce6f5] placeholder:text-[#4a5a75]
                   focus:outline-none focus:border-[#2a4a8b]/70 focus:ring-1 focus:ring-[#2a4a8b]/40
                   transition-all" />
      {query.length > 0 && (
        <button onClick={onClear} aria-label="Cancella ricerca"
          className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded text-[#4a5a75]
                     hover:text-[#7c8db5] transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ── TabEsplora ─────────────────────────────────────────────────────────────────

function TabEsplora({
  suggestions, pendingFriendIds, onConnectSuggestion,
}: { suggestions: Suggestion[]; pendingFriendIds: Record<string, string>; onConnectSuggestion: (id: number) => void }) {
  const search = useSearch();

  async function handleConnectSearch(user: SearchResult) {
    search.markSending(user.id);
    try {
      const res = await fetch(`/api/friends/request/${user.id}`, {
        method: "POST", credentials: "include",
      });
      if (res.ok || res.status === 409) search.markSent(user.id);
      else search.markSending(user.id);
    } catch { /* ignora */ }
  }

  const isActiveSearch = search.query.trim().length >= 2;

  return (
    <div className="space-y-4">
      <SearchBar query={search.query} onChange={search.setQuery}
        onClear={search.clear} isSearching={search.state.status === "searching"} />

      <AnimatePresence mode="wait">
        {isActiveSearch ? (
          <motion.div key="search-results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {search.state.status === "searching" && <SkeletonList count={3} />}
            {search.state.status === "error" && (
              <div className="text-center py-8 text-[#7c8db5] text-[13px]"><p>{search.state.message}</p></div>
            )}
            {search.state.status === "done" && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[12px] text-[#4a5a75]">
                    {search.state.results.length === 0
                      ? `Nessun risultato per "${search.state.query}"`
                      : `${search.state.results.length}${search.state.hasMore ? "+" : ""} risultat${search.state.results.length === 1 ? "o" : "i"} per "${search.state.query}"`}
                  </p>
                </div>
                {search.state.results.length === 0 ? (
                  <EmptyState icon={Search} title="Nessun utente trovato" description={`Non ci sono utenti con il nome "${search.state.query}"`} />
                ) : (
                  <motion.div variants={listVariants} initial="hidden" animate="visible" className="space-y-3">
                    {search.state.results.map((u) => (
                      <SearchResultCard key={u.id} user={u}
                        status={search.pendingIds[u.id] === "sent" ? "sent" : search.pendingIds[u.id] === "sending" ? "sending" : "idle"}
                        onConnect={() => handleConnectSearch(u)} />
                    ))}
                  </motion.div>
                )}
                {search.state.hasMore && (
                  <p className="text-center text-[11px] text-[#4a5a75] mt-3">Affina la ricerca per risultati più specifici</p>
                )}
              </>
            )}
          </motion.div>
        ) : (
          <motion.div key="suggestions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            {suggestions.length === 0 ? (
              <EmptyState icon={Compass} title="Nessun suggerimento al momento" description="Completa il tuo profilo per essere trovato da altri utenti" />
            ) : (
              <>
                <p className="text-[12px] text-[#4a5a75] mb-4 flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-amber-400/60" />
                  Persone con il tuo stesso settore o percorso
                </p>
                <motion.div variants={listVariants} initial="hidden" animate="visible" className="space-y-3">
                  {suggestions.map((s) => (
                    <SuggestionCard key={s.id} suggestion={s}
                      sending={pendingFriendIds[s.id] === "sending"}
                      onConnect={() => onConnectSuggestion(s.id)} />
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

// ── ChatWindow ─────────────────────────────────────────────────────────────────

function ChatWindow({
  conversation,
  myId,
  onBack,
}: {
  conversation: DMConversation;
  myId: number;
  onBack: () => void;
}) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useMessages(conversation.participant.id);
  const sendMsg   = useSendMessage();
  const deleteMsg = useDeleteMessage();

  const [text, setText]           = useState("");
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const scrollRef                 = useRef<HTMLDivElement>(null);
  const isAtBottomRef             = useRef(true);

  const allMessages: DMMessage[] = data?.pages
    .flatMap((p) => p.messages)
    .filter((m) => !m.isDeleted) ?? [];

  useDMStream(conversation.participant.id, () => {
    if (isAtBottomRef.current) {
      requestAnimationFrame(() =>
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
      );
    }
  });

  useEffect(() => {
    if (!isLoading && allMessages.length > 0 && isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMessages.length, isLoading]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isAtBottomRef.current = distFromBottom < 60;
  }

  async function handleSend() {
    const content = text.trim();
    if (!content || sendMsg.isPending) return;
    setText("");
    isAtBottomRef.current = true;
    await sendMsg.mutateAsync({ userId: conversation.participant.id, content });
    requestAnimationFrame(() =>
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col h-[540px] rounded-2xl bg-[#0a111e] border border-white/[0.06] overflow-hidden"
    >
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] flex-shrink-0">
        <button
          onClick={onBack}
          aria-label="Torna alle conversazioni"
          className="p-1.5 rounded-lg text-[#7c8db5] hover:text-[#dce6f5] hover:bg-white/[0.05] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <Avatar user={conversation.participant} size="sm" />
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-[#dce6f5] truncate">
            {conversation.participant.name}
          </p>
        </div>
        <Link
          href={`/profilo/${conversation.participant.id}`}
          className="text-[11px] text-[#4a5a75] hover:text-[#7eb3ff] transition-colors"
        >
          Vedi profilo
        </Link>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-2 scroll-smooth"
      >
        {hasNextPage && (
          <div className="flex justify-center mb-2">
            <button
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="flex items-center gap-1.5 text-[12px] text-[#4a5a75] hover:text-[#7c8db5]
                         px-3 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors"
            >
              {isFetchingNextPage
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <ChevronUp className="w-3.5 h-3.5" />}
              Carica messaggi precedenti
            </button>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`flex ${i % 2 === 0 ? "justify-end" : "justify-start"}`}>
                <div className="h-8 w-40 rounded-2xl bg-[#1e2c42] animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && allMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Avatar user={conversation.participant} />
            <p className="mt-3 text-[14px] font-semibold text-[#c5cee0]">
              {conversation.participant.name}
            </p>
            <p className="mt-1 text-[12px] text-[#4a5a75] max-w-[24ch]">
              Inizia la conversazione con un messaggio
            </p>
          </div>
        )}

        {allMessages.map((msg) => {
          const isMe = myId > 0 && msg.senderId === myId;
          return (
            <div
              key={msg.id}
              className={`flex items-end gap-2 group ${isMe ? "justify-end" : "justify-start"}`}
              onMouseEnter={() => setHoveredId(msg.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {isMe && hoveredId === msg.id && (
                <button
                  onClick={() => deleteMsg.mutate({ messageId: msg.id })}
                  aria-label="Elimina messaggio"
                  className="p-1 rounded text-[#4a5a75] hover:text-red-400 hover:bg-red-400/10 transition-colors flex-shrink-0"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
              <div
                className={`
                  max-w-[75%] px-3 py-2 rounded-2xl text-[13px] leading-relaxed break-words
                  ${
                    isMe
                      ? "bg-[#1a3a6b] text-[#dce6f5] rounded-br-sm"
                      : "bg-[#131929] text-[#c5cee0] rounded-bl-sm border border-white/[0.04]"
                  }
                `}
              >
                {msg.content}
              </div>
              <span className="text-[10px] text-[#3a4a65] flex-shrink-0 mb-0.5">
                {formatTime(msg.createdAt)}
              </span>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      <div className="px-4 py-3 border-t border-white/[0.06] flex-shrink-0">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Scrivi un messaggio…"
            rows={1}
            maxLength={2000}
            aria-label="Scrivi un messaggio"
            className="
              flex-1 resize-none rounded-xl px-3 py-2.5
              bg-[#131929] border border-white/[0.08]
              text-[13px] text-[#dce6f5] placeholder:text-[#4a5a75]
              focus:outline-none focus:border-[#2a4a8b]/60 focus:ring-1 focus:ring-[#2a4a8b]/30
              transition-all min-h-[40px] max-h-[120px] overflow-y-auto
              leading-relaxed
            "
            style={{ height: "auto" }}
            onInput={(e) => {
              const t = e.currentTarget;
              t.style.height = "auto";
              t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
            }}
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sendMsg.isPending}
            aria-label="Invia messaggio"
            className="
              p-2.5 rounded-xl bg-[#1a3a6b] text-[#7eb3ff]
              hover:bg-[#1f4480] disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors flex-shrink-0
            "
          >
            {sendMsg.isPending
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-[#2a3a55] mt-1.5 text-right">
          {text.length > 0 ? `${text.length}/2000` : "Invio con Enter, nuova riga con Shift+Enter"}
        </p>
      </div>
    </motion.div>
  );
}

// ── ConversationList ───────────────────────────────────────────────────────────

function ConversationList({
  onSelect,
}: {
  onSelect: (conv: DMConversation) => void;
}) {
  const { data, isLoading } = useConversations();
  const conversations = data ?? [];

  if (isLoading) return <SkeletonList count={3} />;

  if (conversations.length === 0) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="Nessuna conversazione"
        description="Inizia una chat con una delle tue connessioni visitando il loro profilo"
      />
    );
  }

  return (
    <motion.div variants={listVariants} initial="hidden" animate="visible" className="space-y-2">
      {conversations.map((conv) => (
        <motion.button
          key={conv.conversationId}
          variants={cardVariants}
          onClick={() => onSelect(conv)}
          className="
            w-full flex items-center gap-3 p-3.5 rounded-xl text-left
            bg-[#0d1421] border border-white/[0.06]
            hover:border-white/10 hover:bg-[#0f1828] transition-all
          "
        >
          <div className="relative flex-shrink-0">
            <Avatar user={conv.participant} />
            {conv.unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1
                               rounded-full bg-blue-500 text-[10px] font-bold text-white
                               flex items-center justify-center">
                {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-0.5">
              <span className={`text-[14px] font-semibold truncate ${
                conv.unreadCount > 0 ? "text-[#dce6f5]" : "text-[#a8b8d0]"
              }`}>
                {conv.participant.name}
              </span>
              {conv.lastMessage && (
                <span className="text-[11px] text-[#3a4a65] flex-shrink-0 ml-2">
                  {formatTime(conv.lastMessage.createdAt)}
                </span>
              )}
            </div>
            {conv.lastMessage && (
              <p className={`text-[12px] truncate ${
                conv.unreadCount > 0 ? "text-[#7c8db5]" : "text-[#4a5a75]"
              }`}>
                {conv.lastMessage.content}
              </p>
            )}
          </div>
        </motion.button>
      ))}
    </motion.div>
  );
}

// ── TabMessaggi ────────────────────────────────────────────────────────────────
//
// Accetta initialUserId e initialUserName per il deep-link da /profilo.
// Se initialUserId > 0, crea al volo un DMConversation "stub" da aprire
// immediatamente (i messaggi reali vengono caricati da useMessages).

function TabMessaggi({
  myId,
  initialUserId,
  initialUserName,
}: {
  myId: number;
  initialUserId?: number;
  initialUserName?: string;
}) {
  const [selectedConv, setSelectedConv] = useState<DMConversation | null>(() => {
    if (initialUserId && initialUserId > 0) {
      return {
        conversationId: -1, // placeholder — non usato per i messaggi
        participant: {
          id: initialUserId,
          name: initialUserName ?? "...",
          avatarUrl: null,
        },
        lastMessage: null,
        unreadCount: 0,
        updatedAt: null,
      };
    }
    return null;
  });

  return (
    <AnimatePresence mode="wait">
      {selectedConv ? (
        <ChatWindow
          key={`chat-${selectedConv.participant.id}`}
          conversation={selectedConv}
          myId={myId}
          onBack={() => setSelectedConv(null)}
        />
      ) : (
        <motion.div
          key="conv-list"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <ConversationList onSelect={setSelectedConv} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Pagina principale ──────────────────────────────────────────────────────────

export default function AmiciPage() {
  const [activeTab, setActiveTab] = useState<Tab>("connessioni");
  const queryClient = useQueryClient();
  const [location, navigate] = useLocation();

  // ── Deep-link ?dm=<userId>&name=<name> ───────────────────────────────────
  //
  // Quando si arriva da /profilo via bottone "Messaggio", leggiamo i param
  // e switchiamo automaticamente al tab messaggi con la chat già aperta.
  // Puliamo l'URL subito dopo (history replace) per non sporcare la history.

  const [dmTarget, setDmTarget] = useState<{ userId: number; name: string } | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dmId   = parseInt(params.get("dm") ?? "", 10);
    const dmName = params.get("name") ?? "";

    if (!isNaN(dmId) && dmId > 0) {
      setDmTarget({ userId: dmId, name: decodeURIComponent(dmName) });
      setActiveTab("messaggi");
      // Rimuovi ?dm= dall'URL senza aggiungere voce alla history
      navigate("/amici", { replace: true });
    }
  // Esegui solo al primo mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { friends, requests, suggestions, loading, error, pendingIds, actions, refetch } = useFriends();

  const [toasts, setToasts] = useState<FriendRequestNotification[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const { data: notifData } = useNotificationsStream({
    onFriendRequest: useCallback((notif: FriendRequestNotification) => {
      void refetch();
      setToasts((prev) => [
        ...prev.filter((t) => t.id !== notif.id),
        notif,
      ]);
    }, [refetch]),

    onNewDM: useCallback(() => {
      queryClient.invalidateQueries({ queryKey: dmKeys.conversations() });
    }, [queryClient]),
  });

  const dmBadge = (notifData?.unreadMessagesCount ?? 0) > 0
    ? notifData!.unreadMessagesCount
    : undefined;

  const myId = useMyId();

  const tabs: {
    id: Tab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[] = [
    { id: "connessioni", label: "Connessioni", icon: Users,         badge: friends.length || undefined },
    { id: "richieste",   label: "Richieste",   icon: UserPlus,      badge: requests.length || undefined },
    { id: "esplora",     label: "Esplora",     icon: Compass },
    { id: "messaggi",    label: "Messaggi",    icon: MessageCircle, badge: dmBadge },
  ];

  return (
    <>
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
                      tab.id === "richieste" || tab.id === "messaggi"
                        ? "bg-blue-500 text-white"
                        : "bg-white/10 text-[#7eb3ff]"
                    }
                  `}
                >
                  {tab.badge > 99 ? "99+" : tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Contenuto tab */}
        <AnimatePresence mode="wait">
          {loading && activeTab !== "messaggi" ? (
            <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <SkeletonList />
            </motion.div>
          ) : error && activeTab !== "messaggi" ? (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center py-12 text-[#7c8db5] text-sm">
              <p>Errore nel caricamento.</p>
              <button onClick={() => window.location.reload()} className="mt-3 text-[#7eb3ff] hover:underline">
                Riprova
              </button>
            </motion.div>
          ) : activeTab === "connessioni" ? (
            <motion.div key="connessioni" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {friends.length === 0 ? (
                <EmptyState icon={Users} title="Ancora nessuna connessione"
                  description="Esplora i profili e connettiti con persone nel tuo settore"
                  cta="Scopri persone" onCta={() => setActiveTab("esplora")} />
              ) : (
                <motion.div variants={listVariants} initial="hidden" animate="visible" className="space-y-3">
                  {friends.map((f) => (
                    <FriendCard key={f.friendshipId} friend={f}
                      removing={pendingIds[f.friendshipId] === "removing"}
                      onRemove={() => actions.remove(f.friendshipId)} />
                  ))}
                </motion.div>
              )}
            </motion.div>
          ) : activeTab === "richieste" ? (
            <motion.div key="richieste" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {requests.length === 0 ? (
                <EmptyState icon={UserPlus} title="Nessuna richiesta in attesa"
                  description="Quando qualcuno ti invierà una richiesta, apparirà qui" />
              ) : (
                <motion.div variants={listVariants} initial="hidden" animate="visible" className="space-y-3">
                  {requests.map((r) => (
                    <RequestCard key={r.friendshipId} request={r}
                      accepting={pendingIds[r.friendshipId] === "accepting"}
                      declining={pendingIds[r.friendshipId] === "removing"}
                      onAccept={() => actions.acceptRequest(r.friendshipId, r.user.id)}
                      onDecline={() => actions.remove(r.friendshipId)} />
                  ))}
                </motion.div>
              )}
            </motion.div>
          ) : activeTab === "esplora" ? (
            <motion.div key="esplora" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <TabEsplora suggestions={suggestions} pendingFriendIds={pendingIds}
                onConnectSuggestion={(id) => actions.sendRequest(id)} />
            </motion.div>
          ) : (
            <motion.div key="messaggi" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <TabMessaggi
                myId={myId}
                initialUserId={dmTarget?.userId}
                initialUserName={dmTarget?.name}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
