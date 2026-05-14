import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Mail, Calendar, ShieldCheck, KeyRound, Globe } from "lucide-react";
import { AvatarUpload } from "@/components/profile/settings/AvatarUpload";
import { BannerUpload } from "@/components/profile/settings/BannerUpload";
import { ChangePasswordSection } from "@/components/profile/settings/ChangePasswordSection";
import { PrivacyCard } from "@/components/profile/settings/PrivacyCard";
import type { AuthUser } from "@/contexts/AuthContext";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric", month: "long", year: "numeric",
  });
}

interface ProfileSettingsProps {
  user: AuthUser;
  avatarUrl: string | null | undefined;
  onAvatarUpdate: (url: string | null) => void;
  bannerUrl?: string | null;
  onBannerUpdate?: (url: string | null) => void;
  createdAt?: string;
}

export function ProfileSettings({ user, avatarUrl, onAvatarUpdate, bannerUrl, onBannerUpdate, createdAt }: ProfileSettingsProps) {
  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <User className="w-4 h-4 text-primary" /> Account
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border-b border-border pb-4 mb-2">
          <BannerUpload
            userId={user.id}
            currentUrl={bannerUrl}
            onUploaded={onBannerUpdate ?? (() => {})}
          />
        </div>

        <AvatarUpload
          userId={user.id}
          name={user.name}
          currentUrl={avatarUrl}
          onUploaded={onAvatarUpdate}
        />

        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Nome</p>
          <p className="font-semibold text-foreground">{user.name}</p>
        </div>

        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Email</p>
          <div className="flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 text-muted-foreground" />
            <p className="text-sm truncate">{user.email}</p>
          </div>
        </div>

        {createdAt && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Membro dal</p>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-sm">{formatDate(createdAt)}</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5 pt-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span className="text-xs text-emerald-700 font-medium">Email verificata</span>
        </div>

        <details className="group">
          <summary className="flex items-center gap-2 text-sm font-medium text-primary cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <KeyRound className="w-4 h-4" />
            <span>Cambia password</span>
            <span className="ml-auto text-xs text-muted-foreground group-open:rotate-180 transition-transform">▾</span>
          </summary>
          <div className="mt-3 pt-3 border-t border-border">
            <ChangePasswordSection userId={user.id} />
          </div>
        </details>

        <details className="group">
          <summary className="flex items-center gap-2 text-sm font-medium text-primary cursor-pointer list-none [&::-webkit-details-marker]:hidden">
            <Globe className="w-4 h-4" />
            <span>Visibilità profilo</span>
            <span className="ml-auto text-xs text-muted-foreground group-open:rotate-180 transition-transform">▾</span>
          </summary>
          <div className="mt-3 pt-3 border-t border-border">
            <PrivacyCard userId={user.id} />
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
