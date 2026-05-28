import { Button } from "@/components/ui/button";
import { useCommunityActions, useCommunityChannels } from "@/hooks/useCommunities";
import { cn } from "@/lib/utils";
import type { Community, CommunityChannel } from "./socialTypes";
import { Hash, Lock } from "lucide-react";

export function CommunitySidebar({
  communities,
  activeCommunityId,
  activeChannelId,
  onSelectCommunity,
  onSelectChannel,
}: {
  communities: Community[];
  activeCommunityId: number | null;
  activeChannelId: number | null;
  onSelectCommunity: (community: Community) => void;
  onSelectChannel: (channel: CommunityChannel) => void;
}) {
  const activeCommunity = communities.find((community) => community.id === activeCommunityId) ?? communities[0] ?? null;
  const channelsQuery = useCommunityChannels(activeCommunity?.id ?? null);
  const { joinCommunity } = useCommunityActions();

  return (
    <aside className="rounded-2xl border bg-background p-3">
      <div className="space-y-2">
        {communities.map((community) => (
          <button
            key={community.id}
            type="button"
            onClick={() => onSelectCommunity(community)}
            className={cn(
              "flex min-h-12 w-full items-center gap-2 rounded-xl px-2 text-left transition-colors",
              community.id === activeCommunity?.id ? "bg-primary/10 text-primary" : "hover:bg-muted",
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-xs font-black">
              {community.icon || "#"}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{community.name}</span>
              <span className="block text-[11px] text-muted-foreground">{community.memberCount} membri</span>
            </span>
            {!community.isPublic ? <Lock className="h-3.5 w-3.5 text-muted-foreground" /> : null}
          </button>
        ))}
      </div>

      {activeCommunity && !activeCommunity.isMember ? (
        <Button className="mt-3 min-h-10 w-full rounded-xl" disabled={joinCommunity.isPending} onClick={() => joinCommunity.mutate(activeCommunity.id)}>
          Entra
        </Button>
      ) : null}

      {activeCommunity?.isMember ? (
        <div className="mt-4 border-t pt-3">
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Canali</p>
          <div className="space-y-1">
            {(channelsQuery.data?.channels ?? []).map((channel) => (
              <button
                key={channel.id}
                type="button"
                onClick={() => onSelectChannel(channel)}
                className={cn(
                  "flex min-h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-sm transition-colors",
                  activeChannelId === channel.id ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                <Hash className="h-3.5 w-3.5" />
                <span className="truncate">{channel.name}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}
