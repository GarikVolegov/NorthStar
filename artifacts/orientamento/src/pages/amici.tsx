import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Users, UserPlus, Search, Check, X, Loader2, Star,
  UserCheck, Clock, Globe, Lock, Trash2, ExternalLink,
  UserMinus, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL || "/";

type Tab = "amici" | "richieste" | "cerca";
type FriendshipStatus = "pending" | "accepted" | "rejected";

interface FriendEntry {
  friendshipId: number;
  id: number;
  name: string;
  email: string;
  isPublic: boolean;
  createdAt?: string;
}

interface SearchResult {
  id: number;
  name: string;
  email: string;
  isPublic: boolean;
  friendshipId: number | null;
  friendshipStatus: FriendshipStatus | null;
  iAmRequester: boolean | null;
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

function formatRelDate(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d === 0) return "Oggi";
  if (d === 1) return "Ieri";
  if (d < 7) return `${d}g fa`;
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];

function avatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length];
}

/* ═══════════════════════════════════════════════════════════════════════ */
export default function Amici() {
  const { user, isLoggedIn } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("amici");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const searchRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(searchRef.current);
  }, [search]);

  const { data: friendsData, isLoading: friendsLoading } = useQuery({
    queryKey: ["friends", user?.id],
    queryFn: async () => {
      const res = await fetch(`${BASE}api/friends/${user!.id}`);
      return res.json() as Promise<{ friends: FriendEntry[]; incoming: FriendEntry[]; outgoing: FriendEntry[] }>;
    },
    enabled: !!user?.id,
  });

  const { data: searchData, isLoading: searchLoading } = useQuery({
    queryKey: ["users-search", debouncedSearch, user?.id],
    queryFn: async () => {
      const res = await fetch(`${BASE}api/users/search?q=${encodeURIComponent(debouncedSearch)}&userId=${user!.id}`);
      return res.json() as Promise<{ users: SearchResult[] }>;
    },
    enabled: !!user?.id && debouncedSearch.length >= 2,
  });

  const invalidateFriends = () => queryClient.invalidateQueries({ queryKey: ["friends", user?.id] });
  const invalidateSearch = () => queryClient.invalidateQueries({ queryKey: ["users-search"] });

  const sendRequestMutation = useMutation({
    mutationFn: async (receiverId: number) => {
      const res = await fetch(`${BASE}api/friends/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterId: user!.id, receiverId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Errore"); }
      return res.json();
    },
    onSuccess: () => { invalidateFriends(); invalidateSearch(); },
  });

  const acceptMutation = useMutation({
    mutationFn: async (friendshipId: number) => {
      const res = await fetch(`${BASE}api/friends/${friendshipId}/accept`, { method: "PATCH" });
      if (!res.ok) throw new Error("Errore");
    },
    onSuccess: () => { invalidateFriends(); invalidateSearch(); },
  });

  const rejectMutation = useMutation({
    mutationFn: async (friendshipId: number) => {
      const res = await fetch(`${BASE}api/friends/${friendshipId}/reject`, { method: "PATCH" });
      if (!res.ok) throw new Error("Errore");
    },
    onSuccess: () => { invalidateFriends(); invalidateSearch(); },
  });

  const removeMutation = useMutation({
    mutationFn: async (friendshipId: number) => {
      const res = await fetch(`${BASE}api/friends/${friendshipId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Errore");
    },
    onSuccess: () => { invalidateFriends(); invalidateSearch(); },
  });

  if (!isLoggedIn) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <Users className="w-12 h-12 text-primary/30 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Accedi per vedere i tuoi amici</h2>
        <p className="text-muted-foreground mb-6">Connettiti con altri utenti NorthStar.</p>
        <Button asChild><Link href="/">Vai alla home</Link></Button>
      </div>
    );
  }

  const friends = friendsData?.friends ?? [];
  const incoming = friendsData?.incoming ?? [];
  const outgoing = friendsData?.outgoing ?? [];
  const pendingCount = incoming.length;

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-background border-b">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-6">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h1 className="text-2xl font-serif font-bold text-foreground flex items-center gap-2">
                <Users className="w-6 h-6 text-primary" /> Amici
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {friends.length === 0 ? "Connettiti con altri utenti NorthStar" : `${friends.length} amici su NorthStar`}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {([
              { id: "amici", label: "Amici", count: friends.length },
              { id: "richieste", label: "Richieste", count: pendingCount },
              { id: "cerca", label: "Cerca", count: null },
            ] as { id: Tab; label: string; count: number | null }[]).map(({ id, label, count }) => (
              <button
                key={id}
                onClick={() => { setTab(id); if (id === "cerca") setTimeout(() => document.getElementById("search-input")?.focus(), 100); }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                  tab === id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                {label}
                {count !== null && count > 0 && (
                  <span className={cn(
                    "text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1",
                    id === "richieste" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}>
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-6">

        {/* ── TAB: AMICI ── */}
        {tab === "amici" && (
          friendsLoading ? (
            <LoadingGrid />
          ) : friends.length === 0 ? (
            <EmptyState
              icon={<Users className="w-10 h-10 text-muted-foreground/30" />}
              title="Nessun amico ancora"
              desc="Cerca altri utenti con profilo pubblico e invia loro una richiesta di amicizia."
              action={<Button onClick={() => setTab("cerca")} className="rounded-full gap-2"><Search className="w-4 h-4" /> Cerca utenti</Button>}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {friends.map((f) => (
                <FriendCard
                  key={f.friendshipId}
                  friend={f}
                  onRemove={() => removeMutation.mutate(f.friendshipId)}
                  removing={removeMutation.isPending && (removeMutation.variables as number) === f.friendshipId}
                />
              ))}
            </div>
          )
        )}

        {/* ── TAB: RICHIESTE ── */}
        {tab === "richieste" && (
          friendsLoading ? <LoadingGrid rows={2} /> : (
            <div className="space-y-6">
              {/* Incoming */}
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  In arrivo ({incoming.length})
                </h2>
                {incoming.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground bg-background rounded-2xl border">
                    Nessuna richiesta in arrivo
                  </div>
                ) : (
                  <div className="space-y-2">
                    {incoming.map((f) => (
                      <div key={f.friendshipId} className="bg-background rounded-2xl border p-4 flex items-center gap-3">
                        <Avatar name={f.name} userId={f.id} size="md" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{f.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{f.email}</p>
                          {f.createdAt && (
                            <p className="text-[11px] text-muted-foreground/60 flex items-center gap-1 mt-0.5">
                              <Clock className="w-2.5 h-2.5" /> {formatRelDate(f.createdAt)}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-1.5 shrink-0">
                          <Button size="sm" className="rounded-full gap-1.5 h-8 px-3"
                            onClick={() => acceptMutation.mutate(f.friendshipId)}
                            disabled={acceptMutation.isPending}>
                            {acceptMutation.isPending && (acceptMutation.variables as number) === f.friendshipId
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <Check className="w-3.5 h-3.5" />}
                            Accetta
                          </Button>
                          <Button size="sm" variant="outline" className="rounded-full h-8 w-8 p-0"
                            onClick={() => rejectMutation.mutate(f.friendshipId)}
                            disabled={rejectMutation.isPending}
                            title="Rifiuta">
                            {rejectMutation.isPending && (rejectMutation.variables as number) === f.friendshipId
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <X className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Outgoing */}
              <section>
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Inviate ({outgoing.length})
                </h2>
                {outgoing.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground bg-background rounded-2xl border">
                    Nessuna richiesta inviata
                  </div>
                ) : (
                  <div className="space-y-2">
                    {outgoing.map((f) => (
                      <div key={f.friendshipId} className="bg-background rounded-2xl border p-4 flex items-center gap-3">
                        <Avatar name={f.name} userId={f.id} size="md" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{f.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{f.email}</p>
                          <p className="text-[11px] text-amber-600 font-medium flex items-center gap-1 mt-0.5">
                            <Clock className="w-2.5 h-2.5" /> In attesa di risposta
                          </p>
                        </div>
                        <Button size="sm" variant="outline" className="rounded-full h-8 px-3 gap-1.5 text-muted-foreground shrink-0"
                          onClick={() => removeMutation.mutate(f.friendshipId)}
                          disabled={removeMutation.isPending && (removeMutation.variables as number) === f.friendshipId}>
                          {removeMutation.isPending && (removeMutation.variables as number) === f.friendshipId
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <X className="w-3 h-3" />}
                          Annulla
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )
        )}

        {/* ── TAB: CERCA ── */}
        {tab === "cerca" && (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca per nome o email…"
                className="pl-9 rounded-xl h-11 text-sm"
              />
              {search && (
                <button onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {debouncedSearch.length < 2 ? (
              <div className="text-center py-12">
                <Globe className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Cerca tra gli utenti con profilo pubblico.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Scrivi almeno 2 caratteri per cercare</p>
              </div>
            ) : searchLoading ? (
              <LoadingGrid rows={3} />
            ) : !searchData?.users?.length ? (
              <EmptyState
                icon={<Search className="w-8 h-8 text-muted-foreground/30" />}
                title="Nessun risultato"
                desc={`Nessun utente trovato per "${debouncedSearch}". Solo i profili pubblici appaiono nei risultati.`}
              />
            ) : (
              <div className="space-y-2">
                {searchData.users.map((u) => (
                  <SearchResultCard
                    key={u.id}
                    user={u}
                    onSendRequest={() => sendRequestMutation.mutate(u.id)}
                    onCancel={() => u.friendshipId && removeMutation.mutate(u.friendshipId)}
                    sendingRequest={sendRequestMutation.isPending && (sendRequestMutation.variables as number) === u.id}
                    cancelling={removeMutation.isPending && (removeMutation.variables as number) === (u.friendshipId ?? -1)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sub-components ────────────────────────────────────────────────────── */

function Avatar({ name, userId, size = "md" }: { name: string; userId: number; size?: "sm" | "md" | "lg" }) {
  const sizeClass = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-14 h-14 text-xl" }[size];
  return (
    <div className={cn("rounded-full flex items-center justify-center font-bold shrink-0", sizeClass, avatarColor(userId))}>
      {initials(name)}
    </div>
  );
}

function FriendCard({ friend, onRemove, removing }: {
  friend: FriendEntry; onRemove: () => void; removing: boolean;
}) {
  return (
    <div className="bg-background rounded-2xl border p-4 flex items-center gap-3 hover:shadow-sm transition-shadow group">
      <Avatar name={friend.name} userId={friend.id} size="md" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{friend.name}</p>
        <p className="text-xs text-muted-foreground truncate">{friend.email}</p>
        <div className="flex items-center gap-1 mt-0.5">
          {friend.isPublic
            ? <><Globe className="w-2.5 h-2.5 text-emerald-500" /><span className="text-[10px] text-emerald-600 font-medium">Profilo pubblico</span></>
            : <><Lock className="w-2.5 h-2.5 text-muted-foreground" /><span className="text-[10px] text-muted-foreground">Profilo privato</span></>}
        </div>
      </div>
      <div className="flex gap-1.5 shrink-0">
        {friend.isPublic && (
          <Link href={`/utente/${friend.id}`}>
            <Button size="sm" variant="outline" className="rounded-full h-8 px-3 gap-1.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
              <ExternalLink className="w-3 h-3" /> Profilo
            </Button>
          </Link>
        )}
        <Button size="sm" variant="ghost"
          className="rounded-full h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          onClick={onRemove} disabled={removing} title="Rimuovi amico">
          {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />}
        </Button>
      </div>
    </div>
  );
}

function SearchResultCard({ user, onSendRequest, onCancel, sendingRequest, cancelling }: {
  user: SearchResult;
  onSendRequest: () => void;
  onCancel: () => void;
  sendingRequest: boolean;
  cancelling: boolean;
}) {
  const isAccepted = user.friendshipStatus === "accepted";
  const isPending = user.friendshipStatus === "pending";

  return (
    <div className="bg-background rounded-2xl border p-4 flex items-center gap-3">
      <Avatar name={user.name} userId={user.id} size="md" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{user.name}</p>
        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <Globe className="w-2.5 h-2.5 text-emerald-500" />
          <span className="text-[10px] text-emerald-600 font-medium">Profilo pubblico</span>
        </div>
      </div>
      <div className="shrink-0">
        {isAccepted ? (
          <Badge variant="outline" className="text-xs gap-1 bg-emerald-50 text-emerald-700 border-emerald-200">
            <UserCheck className="w-3 h-3" /> Amici
          </Badge>
        ) : isPending && !user.iAmRequester ? (
          <div className="flex gap-1.5">
            <Button size="sm" className="rounded-full h-8 px-3 gap-1.5 text-xs" onClick={onSendRequest} disabled={sendingRequest}>
              <Check className="w-3 h-3" /> Accetta
            </Button>
            <Button size="sm" variant="outline" className="rounded-full h-8 w-8 p-0" onClick={onCancel} disabled={cancelling}>
              <X className="w-3 h-3" />
            </Button>
          </div>
        ) : isPending && user.iAmRequester ? (
          <Button size="sm" variant="outline" className="rounded-full h-8 px-3 gap-1.5 text-xs text-muted-foreground" onClick={onCancel} disabled={cancelling}>
            {cancelling ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
            In attesa
          </Button>
        ) : (
          <Button size="sm" className="rounded-full h-8 px-3 gap-1.5 text-xs" onClick={onSendRequest} disabled={sendingRequest}>
            {sendingRequest ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
            Aggiungi
          </Button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon, title, desc, action }: {
  icon: React.ReactNode; title: string; desc: string; action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-4">{icon}</div>
      <h3 className="text-base font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-5">{desc}</p>
      {action}
    </div>
  );
}

function LoadingGrid({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-background rounded-2xl border p-4 flex items-center gap-3 animate-pulse">
          <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 bg-muted rounded w-32" />
            <div className="h-3 bg-muted rounded w-48" />
          </div>
        </div>
      ))}
    </div>
  );
}
