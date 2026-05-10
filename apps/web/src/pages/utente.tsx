import { useParams } from "wouter";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Users, UserPlus, UserCheck, Lock, Globe, Clock,
  Loader2, ArrowLeft, Check, X, UserMinus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const BASE = import.meta.env.BASE_URL || "/";

type FriendshipStatus = "pending" | "accepted" | "rejected";

interface PublicProfile {
  id: number;
  name: string;
  isPublic: boolean;
  createdAt: string;
  canView: boolean;
  areFriends: boolean;
  friendshipStatus: FriendshipStatus | null;
  friendshipId: number | null;
}

const AVATAR_COLORS = [
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
];

function avatarColor(id: number) { return AVATAR_COLORS[id % AVATAR_COLORS.length]; }
function initials(name: string) { return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2); }

export default function Utente() {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const targetId = parseInt(id, 10);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(i18n.language, { month: "long", year: "numeric" });
  }

  const { data: profile, isLoading } = useQuery<PublicProfile>({
    queryKey: ["public-profile", targetId, user?.id],
    queryFn: async () => {
      const viewerParam = user?.id ? `?viewerId=${user.id}` : "";
      const res = await fetch(`${BASE}api/users/${targetId}/public${viewerParam}`);
      if (!res.ok) throw new Error("Profilo non trovato");
      return res.json();
    },
    enabled: !isNaN(targetId),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["public-profile", targetId, user?.id] });
    queryClient.invalidateQueries({ queryKey: ["friends", user?.id] });
  };

  const sendRequestMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${BASE}api/friends/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requesterId: user!.id, receiverId: targetId }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Errore"); }
      return res.json();
    },
    onSuccess: invalidate,
  });

  const cancelMutation = useMutation({
    mutationFn: async (friendshipId: number) => {
      await fetch(`${BASE}api/friends/${friendshipId}`, { method: "DELETE" });
    },
    onSuccess: invalidate,
  });

  const acceptMutation = useMutation({
    mutationFn: async (friendshipId: number) => {
      await fetch(`${BASE}api/friends/${friendshipId}/accept`, { method: "PATCH" });
    },
    onSuccess: invalidate,
  });

  const rejectMutation = useMutation({
    mutationFn: async (friendshipId: number) => {
      await fetch(`${BASE}api/friends/${friendshipId}/reject`, { method: "PATCH" });
    },
    onSuccess: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: async (friendshipId: number) => {
      await fetch(`${BASE}api/friends/${friendshipId}`, { method: "DELETE" });
    },
    onSuccess: invalidate,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <Lock className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-semibold mb-2">{t("utente.notFound")}</h2>
        <p className="text-muted-foreground mb-6">{t("utente.notFoundDesc")}</p>
        <Button asChild variant="outline">
          <Link href="/amici"><ArrowLeft className="w-4 h-4 mr-2" /> {t("utente.backToFriends")}</Link>
        </Button>
      </div>
    );
  }

  const isOwnProfile = user?.id === profile.id;
  const isFriend = profile.areFriends;
  const isPending = profile.friendshipStatus === "pending";

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="max-w-lg mx-auto px-4 py-10">

        {/* Back */}
        <Link href="/amici" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> {t("amici.title")}
        </Link>

        {/* Profile card */}
        <div className="bg-background rounded-3xl border shadow-sm p-8 text-center">
          {/* Avatar */}
          <div className={cn(
            "w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4",
            avatarColor(profile.id),
          )}>
            {initials(profile.name)}
          </div>

          <h1 className="text-2xl font-serif font-bold text-foreground mb-1">{profile.name}</h1>

          {/* Privacy badge */}
          <div className="flex items-center justify-center gap-1.5 mb-4">
            {profile.isPublic
              ? <><Globe className="w-3.5 h-3.5 text-emerald-500" /><span className="text-sm text-emerald-600 font-medium">{t("utente.publicProfile")}</span></>
              : <><Lock className="w-3.5 h-3.5 text-muted-foreground" /><span className="text-sm text-muted-foreground">{t("utente.privateProfile")}</span></>}
          </div>

          {/* Member since */}
          <p className="text-xs text-muted-foreground mb-6">
            {t("utente.memberSince", { date: formatDate(profile.createdAt) })}
          </p>

          {/* Friendship action */}
          {!isOwnProfile && user && (
            <div className="flex justify-center gap-2">
              {isFriend ? (
                <>
                  <div className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-full">
                    <UserCheck className="w-4 h-4" /> {t("utente.areFriends")}
                  </div>
                  <Button variant="outline" size="sm" className="rounded-full gap-1.5 text-muted-foreground"
                    onClick={() => profile.friendshipId && removeMutation.mutate(profile.friendshipId)}
                    disabled={removeMutation.isPending}>
                    {removeMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserMinus className="w-3.5 h-3.5" />}
                    {t("utente.removeFriend")}
                  </Button>
                </>
              ) : isPending && profile.friendshipId ? (
                <>
                  <Button variant="outline" size="sm" className="rounded-full gap-1.5 text-amber-600 border-amber-200 bg-amber-50">
                    <Clock className="w-3.5 h-3.5" /> {t("utente.requestSent")}
                  </Button>
                  <Button variant="ghost" size="sm" className="rounded-full gap-1.5 text-muted-foreground"
                    onClick={() => cancelMutation.mutate(profile.friendshipId!)}
                    disabled={cancelMutation.isPending}>
                    {cancelMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                    {t("utente.cancelRequest")}
                  </Button>
                </>
              ) : profile.friendshipStatus === "pending" && profile.friendshipId ? (
                <div className="flex gap-2">
                  <Button size="sm" className="rounded-full gap-1.5"
                    onClick={() => acceptMutation.mutate(profile.friendshipId!)}
                    disabled={acceptMutation.isPending}>
                    {acceptMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    {t("utente.acceptRequest")}
                  </Button>
                  <Button variant="outline" size="sm" className="rounded-full gap-1.5"
                    onClick={() => rejectMutation.mutate(profile.friendshipId!)}
                    disabled={rejectMutation.isPending}>
                    {rejectMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                    {t("utente.rejectRequest")}
                  </Button>
                </div>
              ) : (
                <Button className="rounded-full gap-2" onClick={() => sendRequestMutation.mutate()}
                  disabled={sendRequestMutation.isPending}>
                  {sendRequestMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  {t("utente.addFriend")}
                </Button>
              )}
            </div>
          )}

          {isOwnProfile && (
            <Link href="/profilo">
              <Button variant="outline" className="rounded-full gap-2">
                {t("utente.editProfile")}
              </Button>
            </Link>
          )}
        </div>

        {/* Locked content */}
        {!profile.canView && !isOwnProfile && (
          <div className="mt-4 bg-background rounded-2xl border p-6 text-center">
            <Lock className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium mb-1">{t("utente.privateContent")}</p>
            <p className="text-xs text-muted-foreground">
              {t("utente.privateContentDesc", { name: profile.name })}
            </p>
          </div>
        )}

        {/* Friends CTA */}
        {!user && (
          <div className="mt-4 bg-background rounded-2xl border p-5 text-center">
            <p className="text-sm text-muted-foreground mb-3">
              {t("utente.loginToAdd")}
            </p>
            <Button asChild className="rounded-full"><Link href="/">{t("utente.goHome")}</Link></Button>
          </div>
        )}
      </div>
    </div>
  );
}
