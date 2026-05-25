import { ChatDrawer } from "@/components/chat/ChatDrawer";
import { useAuth } from "@/contexts/AuthContext";
import { useChatEncryption } from "@/hooks/useChatEncryption";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  ChatPanel,
  ComposePostCard,
  CreateStoryCard,
  FriendsPanel,
  PostCard,
  PublicProfilePreview,
  QuickFriends,
  StoriesStrip,
} from "@/features/social/SocialPanels";
import { EmptyState, ErrorState, LoadingList } from "@/features/social/SocialShared";
import type { ChatFriend, FriendEntry, SocialPost, SocialStory, SocialTab, Visibility } from "@/features/social/socialTypes";
import { apiFetch } from "@/lib/api-fetch";
import { readJsonResponse } from "@/lib/readJsonResponse";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, MessageCircle, Sparkles, Users } from "lucide-react";
import { useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL || "/";

export default function SocialPage() {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<SocialTab>("feed");
  const [postText, setPostText] = useState("");
  const [storyText, setStoryText] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [chatFriend, setChatFriend] = useState<ChatFriend | null>(null);

  const wss = useWebSocket(token, user?.id ?? null);
  const { ensureKeys } = useChatEncryption(user?.id ?? null);
  useEffect(() => {
    ensureKeys();
  }, [ensureKeys]);

  const feedQuery = useQuery({
    queryKey: ["social-feed"],
    queryFn: async () => readJsonResponse<{ posts: SocialPost[] }>(await apiFetch(`${BASE}api/social/feed`)),
  });

  const storiesQuery = useQuery({
    queryKey: ["social-stories"],
    queryFn: async () => readJsonResponse<{ stories: SocialStory[] }>(await apiFetch(`${BASE}api/social/stories`)),
  });

  const friendsQuery = useQuery({
    queryKey: ["social-friends", user?.id],
    queryFn: async () =>
      readJsonResponse<{ friends: FriendEntry[]; incoming: FriendEntry[]; outgoing: FriendEntry[] }>(
        await apiFetch(`${BASE}api/friends/${user!.id}`),
      ),
    enabled: !!user?.id,
  });

  const myPostsQuery = useQuery({
    queryKey: ["social-my-posts", user?.id],
    queryFn: async () => readJsonResponse<{ posts: SocialPost[] }>(await apiFetch(`${BASE}api/social/users/${user!.id}/posts`)),
    enabled: !!user?.id,
  });

  const createPost = useMutation({
    mutationFn: async () =>
      readJsonResponse<{ post: SocialPost }>(
        await apiFetch(`${BASE}api/social/posts`, {
          method: "POST",
          body: JSON.stringify({ content: postText, visibility }),
        }),
      ),
    onSuccess: () => {
      setPostText("");
      queryClient.invalidateQueries({ queryKey: ["social-feed"] });
      queryClient.invalidateQueries({ queryKey: ["social-my-posts", user?.id] });
    },
  });

  const createStory = useMutation({
    mutationFn: async () =>
      readJsonResponse<{ story: SocialStory }>(
        await apiFetch(`${BASE}api/social/stories`, {
          method: "POST",
          body: JSON.stringify({ content: storyText, visibility }),
        }),
      ),
    onSuccess: () => {
      setStoryText("");
      queryClient.invalidateQueries({ queryKey: ["social-stories"] });
    },
  });

  const deletePost = useMutation({
    mutationFn: async (id: number) =>
      readJsonResponse<{ ok: true }>(await apiFetch(`${BASE}api/social/posts/${id}`, { method: "DELETE" })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-feed"] });
      queryClient.invalidateQueries({ queryKey: ["social-my-posts", user?.id] });
    },
  });

  const deleteStory = useMutation({
    mutationFn: async (id: number) =>
      readJsonResponse<{ ok: true }>(await apiFetch(`${BASE}api/social/stories/${id}`, { method: "DELETE" })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["social-stories"] }),
  });

  const friends = friendsQuery.data?.friends ?? [];
  const incoming = friendsQuery.data?.incoming ?? [];
  const tabs = [
    { id: "feed" as const, label: "Feed", icon: Sparkles },
    { id: "friends" as const, label: "Amici", icon: Users, count: incoming.length },
    { id: "chat" as const, label: "Chat", icon: MessageCircle },
    { id: "profile" as const, label: "Profilo pubblico", icon: Briefcase },
  ];

  const me = {
    id: user?.id ?? 0,
    name: user?.name ?? "Utente",
    ...(user?.email !== undefined ? { email: user.email } : {}),
    ...(user?.avatarUrl !== undefined ? { avatarUrl: user.avatarUrl } : {}),
  };

  return (
    <div className="min-h-screen bg-muted/30 pb-28">
      <header className="border-b bg-background">
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-foreground">Social</h1>
              <p className="text-sm text-muted-foreground">Connessioni professionali, post, storie e chat interna.</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-4 gap-1 rounded-2xl border bg-card/70 p-1">
            {tabs.map(({ id, label, icon: Icon, count }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "relative flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  tab === id ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">{label}</span>
                {count ? (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
                    {count}
                  </span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 md:px-8">
        {tab === "feed" && (
          <FeedTab
            me={me}
            postText={postText}
            setPostText={setPostText}
            storyText={storyText}
            setStoryText={setStoryText}
            visibility={visibility}
            setVisibility={setVisibility}
            feedQuery={feedQuery}
            storiesQuery={storiesQuery}
            createPost={createPost}
            createStory={createStory}
            deletePost={(id) => deletePost.mutate(id)}
            deleteStory={(id) => deleteStory.mutate(id)}
            friends={friends}
            currentUserId={user?.id ?? 0}
            onChat={setChatFriend}
            onOpenFriends={() => setTab("friends")}
          />
        )}

        {tab === "friends" && (
          <FriendsPanel
            friends={friends}
            incoming={incoming}
            outgoing={friendsQuery.data?.outgoing ?? []}
            loading={friendsQuery.isLoading}
            onChat={setChatFriend}
          />
        )}

        {tab === "chat" && <ChatPanel friends={friends} onChat={setChatFriend} loading={friendsQuery.isLoading} />}

        {tab === "profile" && (
          <PublicProfilePreview userId={user?.id ?? 0} posts={myPostsQuery.data?.posts ?? []} loading={myPostsQuery.isLoading} />
        )}
      </main>

      {chatFriend && user?.id ? (
        <ChatDrawer friend={chatFriend} userId={user.id} wssSend={wss.send} wssOn={wss.on} onClose={() => setChatFriend(null)} />
      ) : null}
    </div>
  );
}

type FeedTabProps = {
  me: { id: number; name: string; email?: string; avatarUrl?: string | null };
  postText: string;
  setPostText: (value: string) => void;
  storyText: string;
  setStoryText: (value: string) => void;
  visibility: Visibility;
  setVisibility: (value: Visibility) => void;
  feedQuery: ReturnType<typeof useQuery<{ posts: SocialPost[] }, Error>>;
  storiesQuery: ReturnType<typeof useQuery<{ stories: SocialStory[] }, Error>>;
  createPost: ReturnType<typeof useMutation<{ post: SocialPost }, Error, void>>;
  createStory: ReturnType<typeof useMutation<{ story: SocialStory }, Error, void>>;
  deletePost: (id: number) => void;
  deleteStory: (id: number) => void;
  friends: FriendEntry[];
  currentUserId: number;
  onChat: (friend: ChatFriend) => void;
  onOpenFriends: () => void;
};

function FeedTab({
  me,
  postText,
  setPostText,
  storyText,
  setStoryText,
  visibility,
  setVisibility,
  feedQuery,
  storiesQuery,
  createPost,
  createStory,
  deletePost,
  deleteStory,
  friends,
  currentUserId,
  onChat,
  onOpenFriends,
}: FeedTabProps) {
  const posts = feedQuery.data?.posts ?? [];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="space-y-4">
        <ComposePostCard
          currentUser={me}
          postText={postText}
          setPostText={setPostText}
          visibility={visibility}
          setVisibility={setVisibility}
          isPending={createPost.isPending}
          error={createPost.error}
          onCreate={() => createPost.mutate()}
        />

        <StoriesStrip
          stories={storiesQuery.data?.stories ?? []}
          loading={storiesQuery.isLoading}
          currentUserId={currentUserId}
          onDelete={deleteStory}
        />

        {feedQuery.isLoading ? (
          <LoadingList />
        ) : feedQuery.error ? (
          <ErrorState message={feedQuery.error.message} onRetry={() => feedQuery.refetch()} />
        ) : posts.length === 0 ? (
          <EmptyState title="Nessun post ancora" description="Aggiungi il primo aggiornamento o cerca persone con cui collegarti." />
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} currentUserId={currentUserId} onDelete={() => deletePost(post.id)} />
            ))}
          </div>
        )}
      </section>

      <aside className="space-y-4">
        <CreateStoryCard
          storyText={storyText}
          setStoryText={setStoryText}
          isPending={createStory.isPending}
          error={createStory.error}
          onCreate={() => createStory.mutate()}
        />
        <QuickFriends friends={friends.slice(0, 4)} onChat={onChat} onOpenFriends={onOpenFriends} />
      </aside>
    </div>
  );
}
