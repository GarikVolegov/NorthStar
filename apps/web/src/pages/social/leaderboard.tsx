import { SocialLeaderboard } from "@/features/social/SocialLeaderboard";

export default function SocialLeaderboardPage() {
  return (
    <div className="min-h-screen bg-muted/30 pb-28 pt-16">
      <main className="mx-auto max-w-5xl px-4 py-6 md:px-8">
        <SocialLeaderboard />
      </main>
    </div>
  );
}
