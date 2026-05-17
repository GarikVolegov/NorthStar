import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { Linkedin, TrendingUp } from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { usePageModule } from "@/hooks/usePageModule";
import { ProfileSettings } from "@/components/profile/ProfileSettings";
import { BadgesAchievements } from "@/components/profile/sections/BadgesAchievements";
import { JourneySectionRenderer, type JourneyType } from "@/components/profile/profile-sections";
import { LinkedInImportWizard } from "@/components/LinkedInImportWizard";

const BASE = import.meta.env.BASE_URL || "/";

interface ProfileData {
  id: number;
  name: string;
  email: string;
  emailVerified: boolean;
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

export default function Profilo() {
  const { t } = useTranslation();
  const { user, logout, isLoggedIn, updateUser } = useAuth();
  usePageModule({ pageId: "profilo" });
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(user?.avatarUrl);
  const [bannerUrl, setBannerUrl] = useState<string | null | undefined>();
  const [linkedinWizardOpen, setLinkedinWizardOpen] = useState(false);
  const { data: profile } = useProfile(user?.id ?? 0);

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
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">{t("profilo.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("profilo.subtitle", { defaultValue: "Gestisci il tuo account e consulta la tua storia" })}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {showLinkedInImport && (
            <Button
              variant="outline" size="sm"
              className="rounded-full gap-2 text-xs border-[#0077B5]/30 text-[#0077B5] hover:bg-[#0077B5]/10"
              onClick={() => setLinkedinWizardOpen(true)}
            >
              <Linkedin className="w-3.5 h-3.5" /> Importa da LinkedIn
            </Button>
          )}
          <Link href={`/score/${user.id}`}>
            <Button variant="outline" size="sm" className="rounded-full gap-2 text-xs border-primary/30 text-primary hover:bg-primary/10">
              <TrendingUp className="w-3.5 h-3.5" /> Il tuo Score
            </Button>
          </Link>
          <Button variant="outline" size="sm" className="rounded-full w-fit" onClick={logout}>
            {t("profilo.logout", { defaultValue: "Esci dall'account" })}
          </Button>
        </div>
        <LinkedInImportWizard open={linkedinWizardOpen} onClose={() => setLinkedinWizardOpen(false)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1 space-y-5">
          <ProfileSettings
            user={user}
            avatarUrl={avatarUrl}
            onAvatarUpdate={(url) => {
              setAvatarUrl(url);
              updateUser({ avatarUrl: url });
            }}
            bannerUrl={bannerUrl}
            onBannerUpdate={setBannerUrl}
            createdAt={profile?.createdAt}
          />
          <BadgesAchievements completionData={completionData ?? null} />
        </div>

        <div className="md:col-span-2 space-y-5">
          <JourneySectionRenderer
            journeyType={journeyType}
            userId={user.id}
            completionData={completionData ?? null}
          />
        </div>
      </div>
    </div>
  );
}
