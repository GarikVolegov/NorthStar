import { useAuth } from "@/contexts/AuthContext";
import { PublicProfilePreview } from "@/features/social/SocialPanels";
import type { SocialPost } from "@/features/social/socialTypes";
import { apiFetch } from "@/lib/api-fetch";
import { readJsonResponse } from "@/lib/readJsonResponse";
import { useQuery } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL || "/";

export default function SocialProfilePage() {
  const { user } = useAuth();
  const myPostsQuery = useQuery({
    queryKey: ["social-my-posts", user?.id],
    queryFn: async () => readJsonResponse<{ posts: SocialPost[] }>(await apiFetch(`${BASE}api/social/users/${user!.id}/posts`)),
    enabled: !!user?.id,
  });

  return (
    <div className="min-h-screen bg-muted/30 pb-28 pt-16">
      <main className="mx-auto max-w-5xl px-4 py-6 md:px-8">
        <PublicProfilePreview userId={user?.id ?? 0} posts={myPostsQuery.data?.posts ?? []} loading={myPostsQuery.isLoading} />
      </main>
    </div>
  );
}
