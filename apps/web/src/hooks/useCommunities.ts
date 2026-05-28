import type { Community, CommunityChannel, CommunityMessage } from "@/features/social/socialTypes";
import { apiFetch } from "@/lib/api-fetch";
import { readJsonResponse } from "@/lib/readJsonResponse";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL || "/";

export function useCommunities() {
  return useQuery({
    queryKey: ["communities"],
    queryFn: async () => readJsonResponse<{ communities: Community[] }>(await apiFetch(`${BASE}api/communities`)),
    staleTime: 30_000,
  });
}

export function useCommunityChannels(communityId: number | null) {
  return useQuery({
    queryKey: ["community-channels", communityId],
    queryFn: async () =>
      readJsonResponse<{ channels: CommunityChannel[] }>(await apiFetch(`${BASE}api/communities/${communityId}/channels`)),
    enabled: !!communityId,
  });
}

export function useCommunityMessages(communityId: number | null, channelId: number | null) {
  return useQuery({
    queryKey: ["community-messages", communityId, channelId],
    queryFn: async () =>
      readJsonResponse<{ messages: CommunityMessage[] }>(
        await apiFetch(`${BASE}api/communities/${communityId}/channels/${channelId}/messages`),
      ),
    enabled: !!communityId && !!channelId,
  });
}

export function useCommunityActions() {
  const queryClient = useQueryClient();

  const createCommunity = useMutation({
    mutationFn: async (payload: { name: string; description?: string; icon: string; isPublic: boolean }) =>
      readJsonResponse<{ community: Community }>(
        await apiFetch(`${BASE}api/communities`, { method: "POST", body: JSON.stringify(payload) }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["communities"] }),
  });

  const joinCommunity = useMutation({
    mutationFn: async (communityId: number) =>
      readJsonResponse<{ ok: true }>(await apiFetch(`${BASE}api/communities/${communityId}/join`, { method: "POST" })),
    onSuccess: (_, communityId) => {
      queryClient.invalidateQueries({ queryKey: ["communities"] });
      queryClient.invalidateQueries({ queryKey: ["community-channels", communityId] });
    },
  });

  const sendMessage = useMutation({
    mutationFn: async (payload: { communityId: number; channelId: number; content: string; mediaUrl?: string }) =>
      readJsonResponse<{ message: CommunityMessage }>(
        await apiFetch(`${BASE}api/communities/${payload.communityId}/channels/${payload.channelId}/messages`, {
          method: "POST",
          body: JSON.stringify({ content: payload.content, mediaUrl: payload.mediaUrl }),
        }),
      ),
    onSuccess: (data, payload) => {
      queryClient.setQueryData<{ messages: CommunityMessage[] }>(
        ["community-messages", payload.communityId, payload.channelId],
        (current) => ({ messages: [...(current?.messages ?? []), data.message] }),
      );
    },
  });

  return { createCommunity, joinCommunity, sendMessage };
}
