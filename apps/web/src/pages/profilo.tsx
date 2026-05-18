import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import {
  Calendar,
  Camera,
  Loader2,
  Linkedin,
  Mail,
  ShieldCheck,
  Trash2,
  TrendingUp,
  User,
} from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { usePageModule } from "@/hooks/usePageModule";
import { useWendyPageContext } from "@/hooks/useWendyPageContext";
import { ProfileSettings } from "@/components/profile/ProfileSettings";
import { BadgesAchievements } from "@/components/profile/sections/BadgesAchievements";
import { JourneySectionRenderer, type JourneyType } from "@/components/profile/profile-sections";
import { LinkedInImportWizard } from "@/components/LinkedInImportWizard";
import type { AuthUser } from "@/contexts/AuthContext";

const BASE = import.meta.env.BASE_URL || "/";

interface ProfileData {
  id: number;
  name: string;
  email: string;
  emailVerified: boolean;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  createdAt: string;
}

function useProfile(userId: number) {
  return useQuery<ProfileData>({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const res = await apiFetch(`${BASE}api/profile/${userId}`);
      if (!res.ok) throw new Error("Errore caricamento profilo");
      return res.json();
    },
    enabled: !!userId,
  });
}

function formatDate(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function readImageAsDataUrl(file: File, maxSize: number, maxLabel: string) {
  if (file.size > maxSize) {
    throw new Error(`Max ${maxLabel}`);
  }
  if (!file.type.startsWith("image/")) {
    throw new Error("Solo immagini");
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

type CompletionResponse = {
  hasTestSession: boolean;
  hasConfirmedSector: boolean;
  hasWorkPreference: boolean;
  hasCv: boolean;
  isPublic: boolean;
  streakDays: number;
  totalObjectives: number;
  completedObjectives: number;
};

function ProfileHero({
  user,
  avatarUrl,
  bannerUrl,
  createdAt,
  emailVerified,
  showLinkedInImport,
  onAvatarUpdate,
  onBannerUpdate,
  onLinkedInImport,
  onLogout,
}: {
  user: AuthUser;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  createdAt?: string;
  emailVerified?: boolean;
  showLinkedInImport: boolean;
  onAvatarUpdate: (url: string | null) => void;
  onBannerUpdate: (url: string | null) => void;
  onLinkedInImport: () => void;
  onLogout: () => void;
}) {
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<"avatar" | "banner" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const joinedAt = formatDate(createdAt);
  const initial = user.name.charAt(0).toUpperCase();

  const uploadImage = async (
    kind: "avatar" | "banner",
    file: File | undefined,
  ) => {
    if (!file) return;
    setError(null);
    setUploading(kind);
    try {
      const maxSize = kind === "avatar" ? 2_000_000 : 1_500_000;
      const maxLabel = kind === "avatar" ? "2 MB" : "1.5 MB";
      const dataUrl = await readImageAsDataUrl(file, maxSize, maxLabel);
      const res = await apiFetch(`${BASE}api/profile/${user.id}/${kind}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          kind === "avatar"
            ? { avatarDataUrl: dataUrl }
            : { bannerDataUrl: dataUrl },
        ),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? "Errore upload");
      }

      const json = await res.json();
      if (kind === "avatar") onAvatarUpdate(json.avatarUrl);
      else onBannerUpdate(json.bannerUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore upload");
    } finally {
      setUploading(null);
      if (kind === "avatar" && avatarInputRef.current) avatarInputRef.current.value = "";
      if (kind === "banner" && bannerInputRef.current) bannerInputRef.current.value = "";
    }
  };

  const removeImage = async (kind: "avatar" | "banner") => {
    setError(null);
    setUploading(kind);
    try {
      await apiFetch(`${BASE}api/profile/${user.id}/${kind}`, { method: "DELETE" });
      if (kind === "avatar") onAvatarUpdate(null);
      else onBannerUpdate(null);
    } catch {
      setError("Errore rimozione");
    } finally {
      setUploading(null);
    }
  };

  return (
    <section className="relative mb-8">
      <div className="group/banner relative h-48 w-full overflow-hidden bg-muted sm:h-56 md:h-64">
        {bannerUrl ? (
          <img
            src={bannerUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full bg-[linear-gradient(135deg,hsl(var(--primary)/0.18),hsl(var(--background)),hsl(var(--growth)/0.14))]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        <div className="absolute right-3 top-3 hidden items-center gap-2 rounded-full border border-white/20 bg-background/85 p-1.5 opacity-0 shadow-sm backdrop-blur transition-opacity duration-200 group-hover/banner:opacity-100 group-focus-within/banner:opacity-100 sm:right-4 sm:top-4 md:flex">
          <button
            type="button"
            onClick={() => bannerInputRef.current?.click()}
            disabled={uploading === "banner"}
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 sm:px-4"
          >
            {uploading === "banner" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            {bannerUrl ? "Cambia banner" : "Aggiungi banner"}
          </button>
          {bannerUrl && (
            <button
              type="button"
              onClick={() => removeImage("banner")}
              disabled={uploading === "banner"}
              className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:opacity-60 sm:px-4"
              aria-label="Rimuovi banner profilo"
            >
              <Trash2 className="h-4 w-4" />
              Rimuovi
            </button>
          )}
        </div>
        <div className="absolute right-3 top-3 md:hidden">
          <details className="group/actions">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-white/20 bg-background/85 px-4 text-sm font-semibold text-foreground shadow-sm backdrop-blur transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-details-marker]:hidden">
              <Camera className="h-4 w-4" />
              Modifica
            </summary>
            <div className="absolute right-0 mt-2 flex min-w-44 flex-col overflow-hidden rounded-2xl border border-border bg-card p-1 shadow-xl">
              <button
                type="button"
                onClick={() => bannerInputRef.current?.click()}
                disabled={uploading === "banner"}
                className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-left text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-60"
              >
                {uploading === "banner" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                {bannerUrl ? "Cambia banner" : "Aggiungi banner"}
              </button>
              {bannerUrl && (
                <button
                  type="button"
                  onClick={() => removeImage("banner")}
                  disabled={uploading === "banner"}
                  className="flex min-h-11 items-center gap-2 rounded-xl px-3 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
                >
                  <Trash2 className="h-4 w-4" />
                  Rimuovi banner
                </button>
              )}
            </div>
          </details>
        </div>
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={(event) => uploadImage("banner", event.target.files?.[0])}
          aria-label="Carica banner profilo"
        />
      </div>

      <div className="container mx-auto max-w-5xl px-4">
        <div className="relative -mt-14 flex flex-col gap-5 rounded-2xl border border-border bg-card/95 p-5 shadow-sm backdrop-blur md:-mt-16 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-end sm:text-left">
            <div className="relative">
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploading === "avatar"}
                className="group flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl border-4 border-card bg-primary/10 shadow-lg transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Cambia foto profilo"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={user.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="font-serif text-4xl font-bold text-primary">{initial}</span>
                )}
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
                  {uploading === "avatar" ? (
                    <Loader2 className="h-6 w-6 animate-spin text-white" />
                  ) : (
                    <Camera className="h-6 w-6 text-white" />
                  )}
                </span>
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => removeImage("avatar")}
                  disabled={uploading === "avatar"}
                  className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive disabled:opacity-60"
                  aria-label="Rimuovi foto profilo"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={(event) => uploadImage("avatar", event.target.files?.[0])}
                aria-label="Carica foto profilo"
              />
            </div>

            <div className="min-w-0 pb-1">
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">
                Profilo personale
              </p>
              <h1 className="mt-1 text-3xl font-serif font-bold text-foreground md:text-4xl">
                {user.name}
              </h1>
              <div className="mt-3 flex flex-wrap justify-center gap-2 text-sm text-muted-foreground sm:justify-start">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
                  <Mail className="h-3.5 w-3.5" />
                  {user.email}
                </span>
                {joinedAt && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Dal {joinedAt}
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${
                    emailVerified === false
                      ? "border-amber-500/25 bg-amber-500/10 text-amber-700"
                      : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700"
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {emailVerified === false ? "Email non verificata" : "Email verificata"}
                </span>
              </div>
              {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
            </div>
          </div>

          <div className="flex flex-wrap justify-center gap-2 md:justify-end">
            {showLinkedInImport && (
              <Button
                variant="outline"
                className="min-h-11 rounded-full gap-2 border-[#0077B5]/30 text-[#0077B5] hover:bg-[#0077B5]/10"
                onClick={onLinkedInImport}
              >
                <Linkedin className="h-4 w-4" />
                Importa da LinkedIn
              </Button>
            )}
            <Button asChild variant="outline" className="min-h-11 rounded-full gap-2 border-primary/30 text-primary hover:bg-primary/10">
              <Link href={`/score/${user.id}`}>
                <TrendingUp className="h-4 w-4" />
                Il tuo Score
              </Link>
            </Button>
            <Button variant="outline" className="min-h-11 rounded-full" onClick={onLogout}>
              Esci dall'account
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Profilo() {
  const { t } = useTranslation();
  const { user, logout, isLoggedIn, updateUser } = useAuth();
  usePageModule({ pageId: "profilo" });
  useWendyPageContext({
    page: "profilo",
    title: "Profilo",
    capabilities: ["navigate", "fill_form"],
    fields: ["profile.avatar", "profile.banner", "profile.settings"],
    actions: ["Apri impostazioni", "Spiega completamento profilo"],
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(user?.avatarUrl);
  const [bannerUrl, setBannerUrl] = useState<string | null | undefined>();
  const [linkedinWizardOpen, setLinkedinWizardOpen] = useState(false);
  const { data: profile } = useProfile(user?.id ?? 0);

  useEffect(() => {
    if (profile?.bannerUrl) {
      setBannerUrl(profile.bannerUrl);
    }
  }, [profile?.bannerUrl]);

  useEffect(() => {
    if (profile?.avatarUrl) {
      setAvatarUrl(profile.avatarUrl);
    }
  }, [profile?.avatarUrl]);

  const { data: completionData } = useQuery<CompletionResponse>({
    queryKey: ["completion-me"],
    queryFn: async () => {
      const res = await apiFetch(`${BASE}api/completion/me`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user?.id,
    staleTime: 60_000,
    retry: false,
  });

  if (!isLoggedIn || !user) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <p className="text-muted-foreground mb-6">{t("profilo.notLoggedIn")}</p>
        <Button asChild><Link href="/">{t("notFound.goHome")}</Link></Button>
      </div>
    );
  }

  const journeyType = (user.journeyType ?? "indeciso") as JourneyType;
  const showLinkedInImport = journeyType === "dipendente" || journeyType === "autonomo";

  return (
    <div className="pb-10">
      <ProfileHero
        user={user}
        avatarUrl={avatarUrl}
        bannerUrl={bannerUrl}
        createdAt={profile?.createdAt}
        emailVerified={profile?.emailVerified}
        showLinkedInImport={showLinkedInImport}
        onAvatarUpdate={(url) => {
          setAvatarUrl(url);
          updateUser({ avatarUrl: url });
        }}
        onBannerUpdate={setBannerUrl}
        onLinkedInImport={() => setLinkedinWizardOpen(true)}
        onLogout={logout}
      />

      <div className="container mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 md:grid-cols-3">
        <div className="space-y-5 md:col-span-1">
          <div id="impostazioni" className="scroll-mt-20">
            <ProfileSettings user={user} createdAt={profile?.createdAt} />
          </div>
          <BadgesAchievements completionData={completionData ?? null} />
        </div>

        <div className="space-y-5 md:col-span-2">
          <JourneySectionRenderer
            journeyType={journeyType}
            userId={user.id}
          />
        </div>
      </div>
      <LinkedInImportWizard open={linkedinWizardOpen} onClose={() => setLinkedinWizardOpen(false)} />
    </div>
  );
}
