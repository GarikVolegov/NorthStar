import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, EmptyState, LoadingList, timeAgo } from "@/features/social/SocialShared";
import type { CommunityChannel as Channel, CommunityMessage } from "@/features/social/socialTypes";
import { useCommunityActions, useCommunityMessages } from "@/hooks/useCommunities";
import type { useWebSocket } from "@/hooks/useWebSocket";
import { useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { useEffect, useState } from "react";

type Wss = ReturnType<typeof useWebSocket>;

export function CommunityChannel({
  communityId,
  channel,
  wss,
}: {
  communityId: number | null;
  channel: Channel | null;
  wss: Wss;
}) {
  const [content, setContent] = useState("");
  const queryClient = useQueryClient();
  const messagesQuery = useCommunityMessages(communityId, channel?.id ?? null);
  const { sendMessage } = useCommunityActions();

  useEffect(() => {
    if (!communityId || !channel) return;
    return wss.on<{ communityId: number; channelId: number; message: CommunityMessage }>("community_message", (payload) => {
      if (payload.communityId !== communityId || payload.channelId !== channel.id) return;
      queryClient.setQueryData<{ messages: CommunityMessage[] }>(
        ["community-messages", communityId, channel.id],
        (current) => {
          const messages = current?.messages ?? [];
          if (messages.some((message) => message.id === payload.message.id)) return current ?? { messages };
          return { messages: [...messages, payload.message] };
        },
      );
    });
  }, [channel, communityId, queryClient, wss]);

  function submit() {
    if (!communityId || !channel || !content.trim()) return;
    sendMessage.mutate(
      { communityId, channelId: channel.id, content: content.trim() },
      { onSuccess: () => setContent("") },
    );
  }

  if (!communityId || !channel) {
    return <EmptyState title="Scegli una comunita" description="Seleziona una comunita e un canale per iniziare." />;
  }

  const messages = messagesQuery.data?.messages ?? [];

  return (
    <section className="flex min-h-[520px] flex-col overflow-hidden rounded-2xl border bg-background">
      <div className="border-b px-4 py-3">
        <p className="text-sm font-bold"># {channel.name}</p>
        <p className="text-xs text-muted-foreground">{channel.description || "Messaggi di canale non cifrati E2E"}</p>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messagesQuery.isLoading ? (
          <LoadingList rows={5} />
        ) : messages.length === 0 ? (
          <EmptyState title="Nessun messaggio" description="Apri tu la conversazione del canale." compact />
        ) : (
          messages.map((message) => (
            <div key={message.id} className="flex gap-3">
              <Avatar user={message.author} size="sm" />
              <div className="min-w-0 flex-1 rounded-xl bg-muted/40 px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold">{message.author.name}</p>
                  <p className="text-[11px] text-muted-foreground">{timeAgo(message.createdAt)}</p>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                {message.mediaUrl ? <img src={message.mediaUrl} alt="Media del messaggio" className="mt-2 aspect-video max-h-56 rounded-lg object-cover" /> : null}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-2 border-t p-3">
        <Input
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) submit();
          }}
          className="min-h-11 rounded-xl"
          placeholder={`Scrivi in #${channel.name}`}
        />
        <Button className="min-h-11 rounded-xl" disabled={!content.trim() || sendMessage.isPending} onClick={submit} aria-label="Invia messaggio">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </section>
  );
}
