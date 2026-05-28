import { ChatDrawer } from "@/components/chat/ChatDrawer";
import { useAuth } from "@/contexts/AuthContext";
import {
  ComposePostCard,
  CreateStoryCard,
  PostCard,
  QuickFriends,
  StoriesStrip,
} from "@/features/social/SocialPanels";
import { EmptyState, ErrorState, LoadingList } from "@/features/social/SocialShared";
import type { ChatFriend, FriendEntry, SocialPost, SocialStory, Visibility } from "@/features/social/socialTypes";
import { useChatEncryption } from "@/hooks/useChatEncryption";
import { useWebSocket } from "@/hooks/useWebSocket";
import { apiFetch } from "@/lib/api-fetch";
import { readJsonResponse } from "@/lib/readJsonResponse";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

export default function SocialFeedPage() {
  const { user, token } = useAuth();
  const queryClient = useQueryClient();
  const [postText, setPostText] = useState("");
  const [mediaDataUrl, setMediaDataUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [mediaDescription, setMediaDescription] = useState("");
  const [hashtagsText, setHashtagsText] = useState("");
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

  const createPost = useMutation({
    mutationFn: async () =>
      readJsonResponse<{ post: SocialPost }>(
        await apiFetch(`${BASE}api/social/posts`, {
          method: "POST",
          body: JSON.stringify({
            content: postText,
            visibility,
            ...(mediaDataUrl && mediaType ? { mediaDataUrl, mediaType } : {}),
            ...(mediaDescription.trim() ? { mediaDescription: mediaDescription.trim() } : {}),
            hashtags: hashtagsText
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          }),
        }),
      ),
    onSuccess: () => {
      setPostText("");
      setMediaDataUrl("");
      setMediaType(null);
      setMediaDescription("");
      setHashtagsText("");
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

  const me = {
    id: user?.id ?? 0,
    name: user?.name ?? "Utente",
    ...(user?.email !== undefined ? { email: user.email } : {}),
    ...(user?.avatarUrl !== undefined ? { avatarUrl: user.avatarUrl } : {}),
  };
  const friends = friendsQuery.data?.friends ?? [];
  const posts = feedQuery.data?.posts ?? [];

  return (
    <div className="min-h-screen bg-muted/30 pb-28 pt-16">
      <main className="mx-auto grid max-w-5xl gap-5 px-4 py-6 md:grid-cols-[minmax(0,1fr)_320px] md:px-8">
        <section className="space-y-4">
          <ComposePostCard
            currentUser={me}
            postText={postText}
            setPostText={setPostText}
            visibility={visibility}
            setVisibility={setVisibility}
            mediaDataUrl={mediaDataUrl}
            setMediaDataUrl={setMediaDataUrl}
            mediaType={mediaType}
            setMediaType={setMediaType}
            mediaDescription={mediaDescription}
            setMediaDescription={setMediaDescription}
            hashtagsText={hashtagsText}
            setHashtagsText={setHashtagsText}
            isPending={createPost.isPending}
            error={createPost.error}
            onCreate={() => createPost.mutate()}
          />

          <StoriesStrip
            stories={storiesQuery.data?.stories ?? []}
            loading={storiesQuery.isLoading}
            currentUserId={user?.id ?? 0}
            onDelete={(id) => deleteStory.mutate(id)}
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
                <PostCard key={post.id} post={post} currentUserId={user?.id ?? 0} onDelete={() => deletePost.mutate(post.id)} />
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
          <QuickFriends friends={friends.slice(0, 4)} onChat={setChatFriend} onOpenFriends={() => {}} />
          <Link href="/social/chat" className="block rounded-2xl border bg-background p-4 text-sm font-semibold text-primary hover:bg-muted/40">
            Apri chat e comunita
          </Link>
        </aside>
      </main>

      {chatFriend && user?.id ? (
        <ChatDrawer friend={chatFriend} userId={user.id} wssSend={wss.send} wssOn={wss.on} onClose={() => setChatFriend(null)} />
      ) : null}
    </div>
  );
}
