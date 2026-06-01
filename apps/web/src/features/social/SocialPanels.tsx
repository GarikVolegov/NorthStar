import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api-fetch";
import { readJsonResponse } from "@/lib/readJsonResponse";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Lock, MessageCircle, Plus, Search, Send, Trash2, UserCheck, UserPlus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";

import { Avatar, EmptyState, LoadingList, timeAgo, VisibilityBadge } from "./SocialShared";
import type { ChatFriend, FriendEntry, SearchResult, SocialPost, SocialStory, Visibility } from "./socialTypes";

const BASE = import.meta.env.BASE_URL || "/";

export function VisibilityPicker({
  value,
  onChange,
}: {
  value: Visibility;
  onChange: (value: Visibility) => void;
}) {
  return (
    <div className="flex rounded-xl border bg-muted/40 p-1">
      {(["public", "friends"] as Visibility[]).map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onChange(item)}
          className={cn(
            "flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors",
            value === item ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {item === "public" ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
          {item === "public" ? "Pubblico" : "Amici"}
        </button>
      ))}
    </div>
  );
}

export function StoriesStrip({
  stories,
  loading,
  currentUserId,
  onDelete,
}: {
  stories: SocialStory[];
  loading: boolean;
  currentUserId: number;
  onDelete: (id: number) => void;
}) {
  if (loading) return <div className="h-24 rounded-2xl border bg-background animate-pulse" />;
  if (!stories.length) return null;

  return (
    <div className="overflow-x-auto rounded-2xl border bg-background p-3">
      <div className="flex gap-3">
        {stories.map((story) => (
          <div key={story.id} className="w-36 shrink-0 rounded-xl border bg-muted/30 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <Avatar user={story.author} size="sm" />
              {story.userId === currentUserId ? (
                <button onClick={() => onDelete(story.id)} className="rounded-full p-1 text-muted-foreground hover:bg-background hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <p className="line-clamp-3 text-xs font-medium text-foreground">{story.content}</p>
            <p className="mt-2 text-[10px] text-muted-foreground">{timeAgo(story.createdAt)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PostCard({
  post,
  currentUserId,
  onDelete,
}: {
  post: SocialPost;
  currentUserId: number;
  onDelete: () => void;
}) {
  return (
    <article className="rounded-2xl border bg-background p-4">
      <div className="flex items-start gap-3">
        <Avatar user={post.author} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/utente/${post.userId}`} className="font-semibold hover:text-primary">
              {post.author.name}
            </Link>
            <span className="text-xs text-muted-foreground">{timeAgo(post.createdAt)}</span>
            <VisibilityBadge visibility={post.visibility} />
          </div>
          {post.author.city ? <p className="text-xs text-muted-foreground">{post.author.city}</p> : null}
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">{post.content}</p>
        </div>
        {post.userId === currentUserId ? (
          <button
            onClick={onDelete}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label="Elimina post"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function QuickFriends({
  friends,
  onChat,
  onOpenFriends,
}: {
  friends: FriendEntry[];
  onChat: (friend: ChatFriend) => void;
  onOpenFriends: () => void;
}) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">Connessioni</p>
        <button onClick={onOpenFriends} className="text-xs font-semibold text-primary hover:underline">
          Vedi tutte
        </button>
      </div>
      {friends.length === 0 ? (
        <p className="text-sm text-muted-foreground">Cerca persone per iniziare a creare la tua rete.</p>
      ) : (
        <div className="space-y-2">
          {friends.map((friend) => (
            <button
              key={friend.friendshipId}
              onClick={() => onChat({ friendshipId: friend.friendshipId, id: friend.id, name: friend.name })}
              className="flex min-h-11 w-full items-center gap-2 rounded-xl px-2 text-left hover:bg-muted"
            >
              <Avatar user={{ id: friend.id, name: friend.name }} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{friend.name}</span>
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function FriendsPanel({
  friends,
  incoming,
  outgoing,
  loading,
  onChat,
}: {
  friends: FriendEntry[];
  incoming: FriendEntry[];
  outgoing: FriendEntry[];
  loading: boolean;
  onChat: (friend: ChatFriend) => void;
}) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const queryClient = useQueryClient();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [search]);

  const searchQuery = useQuery({
    queryKey: ["social-users-search", debouncedSearch],
    queryFn: async () =>
      readJsonResponse<{ users: SearchResult[] }>(
        await apiFetch(`${BASE}api/users/search?q=${encodeURIComponent(debouncedSearch)}`),
      ),
    enabled: !!user?.id && debouncedSearch.length >= 2,
  });

  const sendRequest = useMutation({
    mutationFn: async (receiverId: number) =>
      readJsonResponse<unknown>(
        await apiFetch(`${BASE}api/friends/request`, {
          method: "POST",
          body: JSON.stringify({ requesterId: user!.id, receiverId }),
        }),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-friends"] });
      queryClient.invalidateQueries({ queryKey: ["social-users-search"] });
    },
  });

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="space-y-4">
        <div className="rounded-2xl border bg-background p-4">
          <p className="text-sm font-semibold">I tuoi amici</p>
          <p className="mt-1 text-xs text-muted-foreground">{friends.length} connessioni attive</p>
          <div className="mt-4 space-y-2">
            {loading ? <LoadingList /> : friends.length === 0 ? (
              <EmptyState title="Nessun amico ancora" description="Usa la ricerca per trovare profili pubblici e inviare richieste." compact />
            ) : friends.map((friend) => (
              <FriendRow key={friend.friendshipId} friend={friend} onChat={() => onChat({ friendshipId: friend.friendshipId, id: friend.id, name: friend.name })} />
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-background p-4">
          <p className="text-sm font-semibold">Richieste</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <RequestList title="In entrata" items={incoming} />
            <RequestList title="In uscita" items={outgoing} />
          </div>
        </div>
      </section>

      <aside className="rounded-2xl border bg-background p-4">
        <p className="text-sm font-semibold">Trova persone</p>
        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} className="min-h-11 rounded-xl pl-9" placeholder="Nome, email o città" />
        </div>
        <div className="mt-4 space-y-2">
          {debouncedSearch.length < 2 ? (
            <p className="text-sm text-muted-foreground">Scrivi almeno 2 caratteri.</p>
          ) : searchQuery.isLoading ? (
            <LoadingList rows={3} />
          ) : (searchQuery.data?.users ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun risultato.</p>
          ) : searchQuery.data!.users.map((result) => (
            <div key={result.id} className="flex items-center gap-2 rounded-xl border p-2">
              <Avatar
                user={{
                  id: result.id,
                  name: result.name,
                  ...(result.avatarUrl !== undefined ? { avatarUrl: result.avatarUrl } : {}),
                }}
                size="sm"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{result.name}</p>
                <p className="truncate text-xs text-muted-foreground">{result.city || result.email}</p>
              </div>
              {result.friendshipStatus === "accepted" ? (
                <Badge variant="outline" className="gap-1"><UserCheck className="h-3 w-3" /> Amico</Badge>
              ) : (
                <Button
                  size="sm"
                  className="min-h-9 rounded-xl"
                  disabled={sendRequest.isPending || result.friendshipStatus === "pending"}
                  onClick={() => sendRequest.mutate(result.id)}
                >
                  {result.friendshipStatus === "pending" ? "Inviata" : <><UserPlus className="mr-1 h-3 w-3" /> Aggiungi</>}
                </Button>
              )}
            </div>
          ))}
        </div>
        {sendRequest.error ? <p className="mt-2 text-sm text-destructive">{sendRequest.error.message}</p> : null}
      </aside>
    </div>
  );
}

function FriendRow({ friend, onChat }: { friend: FriendEntry; onChat: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border p-3">
      <Avatar user={{ id: friend.id, name: friend.name }} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{friend.name}</p>
        <p className="truncate text-xs text-muted-foreground">{friend.email}</p>
      </div>
      <Button variant="outline" className="min-h-10 rounded-xl gap-2" onClick={onChat}>
        <MessageCircle className="h-4 w-4" /> Chat
      </Button>
    </div>
  );
}

function RequestList({ title, items }: { title: string; items: FriendEntry[] }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Nessuna richiesta.</p>
      ) : (
        <div className="mt-2 space-y-2">
          {items.map((item) => (
            <div key={item.friendshipId} className="flex items-center gap-2">
              <Avatar user={{ id: item.id, name: item.name }} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ChatPanel({
  friends,
  onChat,
  loading,
}: {
  friends: FriendEntry[];
  onChat: (friend: ChatFriend) => void;
  loading: boolean;
}) {
  if (loading) return <LoadingList />;
  if (!friends.length) {
    return <EmptyState title="Nessuna chat disponibile" description="Le chat si attivano quando una richiesta di amicizia viene accettata." />;
  }

  return (
    <div className="rounded-2xl border bg-background p-4">
      <p className="text-sm font-semibold">Chat interne</p>
      <p className="mt-1 text-xs text-muted-foreground">Messaggi privati con gli amici accettati.</p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {friends.map((friend) => (
          <FriendRow key={friend.friendshipId} friend={friend} onChat={() => onChat({ friendshipId: friend.friendshipId, id: friend.id, name: friend.name })} />
        ))}
      </div>
    </div>
  );
}

export function PublicProfilePreview({
  userId,
  posts,
  loading,
}: {
  userId: number;
  posts: SocialPost[];
  loading: boolean;
}) {
  const { user } = useAuth();
  const profileQuery = useQuery({
    queryKey: ["social-profile-preview", userId],
    queryFn: async () =>
      readJsonResponse<{
        name: string;
        email?: string;
        avatarUrl?: string | null;
        bannerUrl?: string | null;
        bio?: string | null;
        city?: string | null;
        journeyType?: string | null;
        isPublic?: boolean | null;
      }>(await apiFetch(`${BASE}api/users/${userId}/public`)),
    enabled: !!userId,
  });

  const profile = profileQuery.data;

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-2xl border bg-background">
        <div className="h-36 bg-muted">
          {profile?.bannerUrl ? <img src={profile.bannerUrl} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <div className="px-5 pb-5">
          <div className="-mt-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <Avatar
              user={{
                id: userId,
                name: profile?.name || user?.name || "Utente",
                avatarUrl: profile?.avatarUrl ?? user?.avatarUrl ?? null,
              }}
              size="lg"
            />
            <Button asChild variant="outline" className="min-h-11 rounded-xl">
              <Link href={`/utente/${userId}`}>Apri vista pubblica</Link>
            </Button>
          </div>
          <h2 className="mt-3 text-xl font-serif font-bold">{profile?.name || user?.name}</h2>
          <p className="text-sm text-muted-foreground">{profile?.bio || "Aggiungi una bio dal profilo per raccontare chi sei professionalmente."}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {profile?.city ? <Badge variant="outline">{profile.city}</Badge> : null}
            {profile?.journeyType ? <Badge variant="outline">{profile.journeyType}</Badge> : null}
            <Badge variant={profile?.isPublic ? "default" : "outline"}>{profile?.isPublic ? "Profilo pubblico" : "Profilo privato"}</Badge>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border bg-background p-4">
        <p className="text-sm font-semibold">Post pubblicati</p>
        <div className="mt-4 space-y-3">
          {loading ? <LoadingList /> : posts.length === 0 ? (
            <EmptyState title="Nessun post nel profilo" description="I post che pubblichi nel feed appariranno qui." compact />
          ) : posts.map((post) => (
            <PostCard key={post.id} post={post} currentUserId={0} onDelete={() => {}} />
          ))}
        </div>
      </section>
    </div>
  );
}

export function CreateStoryCard({
  storyText,
  setStoryText,
  isPending,
  error,
  onCreate,
}: {
  storyText: string;
  setStoryText: (value: string) => void;
  isPending: boolean;
  error: Error | null;
  onCreate: () => void;
}) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <p className="text-sm font-semibold">Crea una storia</p>
      <p className="mt-1 text-xs text-muted-foreground">Resta visibile per 24 ore.</p>
      <Textarea
        value={storyText}
        onChange={(event) => setStoryText(event.target.value)}
        placeholder="Un aggiornamento rapido..."
        className="mt-3 min-h-20 resize-none rounded-xl"
      />
      <Button
        variant="outline"
        className="mt-3 min-h-11 w-full rounded-xl gap-2"
        disabled={!storyText.trim() || isPending}
        onClick={onCreate}
      >
        <Plus className="h-4 w-4" /> Pubblica storia
      </Button>
      {error ? <p className="mt-2 text-sm text-destructive">{error.message}</p> : null}
    </div>
  );
}

export function ComposePostCard({
  currentUser,
  postText,
  setPostText,
  visibility,
  setVisibility,
  isPending,
  error,
  onCreate,
}: {
  currentUser: { id: number; name: string; email?: string; avatarUrl?: string | null };
  postText: string;
  setPostText: (value: string) => void;
  visibility: Visibility;
  setVisibility: (value: Visibility) => void;
  isPending: boolean;
  error: Error | null;
  onCreate: () => void;
}) {
  return (
    <div className="rounded-2xl border bg-background p-4">
      <div className="flex gap-3">
        <Avatar user={currentUser} />
        <div className="min-w-0 flex-1 space-y-3">
          <Textarea
            value={postText}
            onChange={(event) => setPostText(event.target.value)}
            placeholder="Condividi un aggiornamento lavorativo, un progetto, una candidatura o un progresso..."
            className="min-h-24 resize-none rounded-xl"
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <VisibilityPicker value={visibility} onChange={setVisibility} />
            <Button
              className="min-h-11 rounded-xl gap-2"
              disabled={postText.trim().length < 2 || isPending}
              onClick={onCreate}
            >
              <Send className="h-4 w-4" />
              Pubblica
            </Button>
          </div>
          {error ? <p className="text-sm text-destructive">{error.message}</p> : null}
        </div>
      </div>
    </div>
  );
}
