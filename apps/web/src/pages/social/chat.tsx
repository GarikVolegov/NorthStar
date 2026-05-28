import { ChatDrawer } from "@/components/chat/ChatDrawer";
import { useAuth } from "@/contexts/AuthContext";
import { CommunityChannel } from "@/features/social/CommunityChannel";
import { CommunitySidebar } from "@/features/social/CommunitySidebar";
import { CreateCommunityDialog } from "@/features/social/CreateCommunityDialog";
import { ChatPanel } from "@/features/social/SocialPanels";
import type { ChatFriend, Community, CommunityChannel as Channel, FriendEntry } from "@/features/social/socialTypes";
import { useCommunities } from "@/hooks/useCommunities";
import { useChatEncryption } from "@/hooks/useChatEncryption";
import { useWebSocket } from "@/hooks/useWebSocket";
import { apiFetch } from "@/lib/api-fetch";
import { readJsonResponse } from "@/lib/readJsonResponse";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL || "/";

export default function SocialChatPage() {
  const { user, token } = useAuth();
  const [mode, setMode] = useState<"dm" | "communities">("dm");
  const [chatFriend, setChatFriend] = useState<ChatFriend | null>(null);
  const [activeCommunity, setActiveCommunity] = useState<Community | null>(null);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const wss = useWebSocket(token, user?.id ?? null);
  const { ensureKeys } = useChatEncryption(user?.id ?? null);
  const communitiesQuery = useCommunities();

  useEffect(() => {
    ensureKeys();
  }, [ensureKeys]);

  const friendsQuery = useQuery({
    queryKey: ["social-friends", user?.id],
    queryFn: async () =>
      readJsonResponse<{ friends: FriendEntry[]; incoming: FriendEntry[]; outgoing: FriendEntry[] }>(
        await apiFetch(`${BASE}api/friends/${user!.id}`),
      ),
    enabled: !!user?.id,
  });

  return (
    <div className="min-h-screen bg-muted/30 pb-28 pt-16">
      <main className="mx-auto max-w-5xl space-y-4 px-4 py-6 md:px-8">
        <div className="flex flex-col gap-3 rounded-2xl border bg-background p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid grid-cols-2 rounded-xl border bg-muted/40 p-1">
            {[
              ["dm", "Messaggi diretti"],
              ["communities", "Comunita"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setMode(id as "dm" | "communities")}
                className={cn(
                  "min-h-10 rounded-lg px-3 text-xs font-semibold transition-colors",
                  mode === id ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          {mode === "communities" ? <CreateCommunityDialog /> : null}
        </div>

        {mode === "dm" ? (
          <ChatPanel friends={friendsQuery.data?.friends ?? []} onChat={setChatFriend} loading={friendsQuery.isLoading} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
            <CommunitySidebar
              communities={communitiesQuery.data?.communities ?? []}
              activeCommunityId={activeCommunity?.id ?? null}
              activeChannelId={activeChannel?.id ?? null}
              onSelectCommunity={(community) => {
                setActiveCommunity(community);
                setActiveChannel(null);
              }}
              onSelectChannel={setActiveChannel}
            />
            <CommunityChannel communityId={activeCommunity?.id ?? null} channel={activeChannel} wss={wss} />
          </div>
        )}
      </main>

      {chatFriend && user?.id ? (
        <ChatDrawer friend={chatFriend} userId={user.id} wssSend={wss.send} wssOn={wss.on} onClose={() => setChatFriend(null)} />
      ) : null}
    </div>
  );
}
