import { useState, useRef } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { ObjectivesKanban } from "@/components/objectives/ObjectivesKanban";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User, Mail, Calendar, CheckCircle2, KeyRound, Sparkles, ShieldCheck, Globe, Lock, Bookmark, X, Users, Briefcase, Trophy, Flame, Award, Compass, TrendingUp, Camera, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useFavorites } from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";
import { ProssimiEventi } from "@/components/calendario/ProssimiEventi";
import { WorkModeSelector, useWorkPreference } from "@/components/WorkModeSelector";
import type { WorkPreference } from "@/components/WorkModeSelector";
import { useTranslation } from "react-i18next";
import { TestHistoryCard } from "@/components/TestHistoryCard";
import { ProfileCompletionCard } from "@/components/ProfileCompletionCard";
import { apiFetch } from "@/lib/api-fetch";
import { CertificationsSection } from "@/components/CertificationsSection";
import { JourneyScoreWidget } from "@/components/JourneyScoreWidget";

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
      const res = await fetch(`${BASE}api/profile/${userId}`);
      if (!res.ok) throw new Error("Errore caricamento profilo");
      return res.json();
    },
    enabled: !!userId,
  });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric", month: "long", year: "numeric",
  });
}

function PrivacyCard({ userId }: { userId: number }) {
  const queryClient = useQueryClient();
  const [isPublic, setIsPublic] = useState<boolean | null>(null);

  useQuery({
    queryKey: ["privacy-status", userId],
    queryFn: async () => {
      const res = await fetch(`${BASE}api/users/${userId}/public?viewerId=${userId}`);
      if (!res.ok) throw new Error("Errore");
      const d = await res.json();
      setIsPublic(d.isPublic ?? false);
      return d.isPublic as boolean;
    },
    enabled: !!userId,
  });

  const mutation = useMutation({
    mutationFn: async (newValue: boolean) => {
      const res = await fetch(`${BASE}api/users/${userId}/privacy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: newValue }),
      });
      if (!res.ok) throw new Error("Errore");
      return res.json();
    },
    onSuccess: (data) => {
      setIsPublic(data.isPublic);
      queryClient.invalidateQueries({ queryKey: ["privacy-status", userId] });
    },
  });

  const current = isPublic ?? false;

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" /> Visibilità profilo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            {current ? <Globe className="w-4 h-4 text-emerald-500 shrink-0" /> : <Lock className="w-4 h-4 text-muted-foreground shrink-0" />}
            <span className="text-sm font-medium">{current ? "Profilo pubblico" : "Profilo privato"}</span>
          </div>
          <button
            onClick={() => mutation.mutate(!current)}
            disabled={isPublic === null || mutation.isPending}
            className={cn(
              "relative w-11 h-6 rounded-full transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              current ? "bg-emerald-500" : "bg-muted-foreground/30",
              (isPublic === null || mutation.isPending) && "opacity-50 cursor-not-allowed",
            )}
            aria-label="Toggle visibilità profilo"
          >
            <span className={cn("absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200", current ? "translate-x-[22px]" : "translate-x-1")} />
            {mutation.isPending && <Loader2 className="absolute inset-0 m-auto w-3.5 h-3.5 animate-spin text-white" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {current
            ? "Il tuo profilo è visibile agli altri utenti. Possono trovarti tramite la ricerca e inviarti richieste di amicizia."
            : "Il tuo profilo è privato. Solo i tuoi amici attuali possono vederti; non appari nella ricerca."}
        </p>
        {current && (
          <Link href="/amici" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
            <Users className="w-3 h-3" /> Gestisci amici
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

const passwordSchema = z
  .object({
    oldPassword: z.string().min(1, "Inserisci la password attuale"),
    newPassword: z.string().min(6, "Minimo 6 caratteri"),
    confirm: z.string().min(1, "Conferma la nuova password"),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: "Le password non coincidono",
    path: ["confirm"],
  });

type PasswordFormData = z.infer<typeof passwordSchema>;

function ChangePasswordForm({ userId }: { userId: number }) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  });

  async function onSubmit(data: PasswordFormData) {
    setServerError(null);
    setSuccess(false);
    try {
      const res = await fetch(`${BASE}api/profile/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, oldPassword: data.oldPassword, newPassword: data.newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setServerError(json.error || "Errore cambio password");
      } else {
        setSuccess(true);
        reset();
      }
    } catch {
      setServerError("Errore di rete. Riprova.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
      <div>
        <Label htmlFor="old-password">Password attuale</Label>
        <Input
          id="old-password"
          type="password"
          placeholder="••••••••"
          {...register("oldPassword")}
          autoComplete="current-password"
          className={errors.oldPassword ? "border-destructive" : ""}
        />
        {errors.oldPassword && <p className="text-xs text-destructive mt-1">{errors.oldPassword.message}</p>}
      </div>
      <div>
        <Label htmlFor="new-password">Nuova password</Label>
        <Input
          id="new-password"
          type="password"
          placeholder="Min. 6 caratteri"
          {...register("newPassword")}
          autoComplete="new-password"
          className={errors.newPassword ? "border-destructive" : ""}
        />
        {errors.newPassword && <p className="text-xs text-destructive mt-1">{errors.newPassword.message}</p>}
      </div>
      <div>
        <Label htmlFor="confirm-password">Conferma nuova password</Label>
        <Input
          id="confirm-password"
          type="password"
          placeholder="Ripeti la nuova password"
          {...register("confirm")}
          autoComplete="new-password"
          className={errors.confirm ? "border-destructive" : ""}
        />
        {errors.confirm && <p className="text-xs text-destructive mt-1">{errors.confirm.message}</p>}
      </div>
      {serverError && (
        <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{serverError}</p>
      )}
      {success && (
        <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2 flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> Password aggiornata
        </p>
      )}
      <Button type="submit" className="rounded-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
        Aggiorna password
      </Button>
    </form>
  );
}

function SavedItems() {
  const { favorites, removeFavorite } = useFavorites();
  const savedSectors = favorites.filter((f) => f.type === "sector");

  if (favorites.length === 0) return null;

  return (
    <Card className="rounded-2xl mt-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-primary" /> Salvati
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {savedSectors.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Settori</p>
            <div className="space-y-2">
              {savedSectors.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{f.label}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeFavorite(f.id)} className="shrink-0">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WorkModeCard({ userId }: { userId: number }) {
  const { workPreference, save, isLoading } = useWorkPreference(userId);
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const queryClient = useQueryClient();

  const LABELS: Record<string, string> = {
    dipendente: "Dipendente",
    autonomo: "Autonomo / Freelance",
    ibrido: "Ibrido",
    unknown: "Non definita",
  };

  const handleSelect = async (mode: WorkPreference) => {
    await save(mode);
    queryClient.invalidateQueries({ queryKey: ["latest-recommendations"] });
    setSaved(true);
    setEditing(false);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary" /> Modalità di lavoro preferita
          </CardTitle>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-primary hover:underline font-medium"
            >
              Modifica
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {saved && (
          <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium mb-3 animate-in fade-in duration-300">
            <CheckCircle2 className="w-4 h-4" /> Preferenza salvata!
          </div>
        )}
        {!editing ? (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">{LABELS[workPreference] ?? workPreference}</p>
              <p className="text-xs text-muted-foreground">
                {workPreference === "unknown"
                  ? "Non hai ancora definito una preferenza di lavoro."
                  : "La tua preferenza influenza il ranking dei settori consigliati."}
              </p>
            </div>
          </div>
        ) : (
          <div>
            <WorkModeSelector
              initialValue={workPreference !== "unknown" ? workPreference : undefined}
              onSelect={handleSelect}
              isPending={isLoading}
            />
            <button
              onClick={() => setEditing(false)}
              className="mt-3 text-xs text-muted-foreground hover:text-foreground"
            >
              Annulla
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UserModeCard({ userId }: { userId: number }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery<{ userMode?: string }>({
    queryKey: ["user-mode", userId],
    queryFn: async () => {
      const res = await apiFetch(`${BASE}api/profile/${userId}`);
      if (!res.ok) throw new Error("Errore");
      return res.json();
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  const currentMode = (data?.userMode ?? "explorer") as "explorer" | "climber";

  const switchMode = async (mode: "explorer" | "climber") => {
    if (mode === currentMode || saving) return;
    setSaving(true);
    try {
      const res = await apiFetch(`${BASE}api/profile/${userId}/mode`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userMode: mode }),
      });
      if (!res.ok) throw new Error("Errore");
      queryClient.invalidateQueries({ queryKey: ["user-mode", userId] });
      queryClient.invalidateQueries({ queryKey: ["user-mode-dashboard"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Compass className="w-4 h-4 text-primary" /> Modalità percorso
          {saved && <span className="ml-auto text-xs text-emerald-600 font-medium">Salvato!</span>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="h-16 bg-muted animate-pulse rounded-xl" />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: "explorer" as const, label: "Explorer", icon: "🧭", desc: "Esplora settori e opportunità" },
              { id: "climber" as const, label: "Climber", icon: "📈", desc: "Focus su crescita e carriera" },
            ].map((opt) => {
              const active = currentMode === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => switchMode(opt.id)}
                  disabled={saving}
                  className={cn(
                    "flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active
                      ? "border-primary/40 bg-primary/5 text-foreground shadow-sm"
                      : "border-border bg-card text-muted-foreground hover:border-primary/20 hover:bg-primary/5",
                    saving && "opacity-50 cursor-not-allowed",
                  )}
                >
                  <span className="text-lg">{opt.icon}</span>
                  <span className="text-xs font-semibold leading-tight">{opt.label}</span>
                  <span className="text-[11px] leading-snug">{opt.desc}</span>
                  {active && <TrendingUp className="w-3 h-3 text-primary mt-auto self-end" />}
                </button>
              );
            })}
          </div>
        )}
        <p className="text-xs text-muted-foreground leading-relaxed">
          {currentMode === "climber"
            ? "Modalità Climber attiva: il tuo dashboard mostra strumenti avanzati per la crescita professionale."
            : "Modalità Explorer attiva: esplora settori, professioni e percorsi di studio."}
        </p>
      </CardContent>
    </Card>
  );
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

const BADGE_DEFS: Array<{
  id: string;
  emoji: string;
  label: string;
  check: (d: CompletionResponse) => boolean;
}> = [
  { id: "test",      emoji: "🧠", label: "Primo test",          check: (d) => d.hasTestSession },
  { id: "sector",    emoji: "🎯", label: "Settore scelto",      check: (d) => d.hasConfirmedSector },
  { id: "cv",        emoji: "📄", label: "CV caricato",         check: (d) => d.hasCv },
  { id: "shared",    emoji: "🌐", label: "Profilo pubblico",    check: (d) => d.isPublic },
  { id: "objectives",emoji: "🏆", label: "5 obiettivi fatti",   check: (d) => d.completedObjectives >= 5 },
  { id: "streak",    emoji: "🔥", label: "Streak 3 giorni",     check: (d) => d.streakDays >= 3 },
];

/* ── Avatar upload widget ──────────────────────────────── */
function AvatarUpload({ userId, name, currentUrl, onUploaded }: {
  userId: number;
  name: string;
  currentUrl?: string | null;
  onUploaded: (url: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const BASE = import.meta.env.BASE_URL || "/";

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 400_000) { setError("Max 400 KB"); return; }
    if (!file.type.startsWith("image/")) { setError("Solo immagini"); return; }

    setError(null);
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch(`${BASE}api/profile/${userId}/avatar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarDataUrl: dataUrl }),
        credentials: "include",
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? "Errore upload"); }
      const json = await res.json();
      onUploaded(json.avatarUrl);
    } catch (err: any) {
      setError(err.message ?? "Errore upload");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemove() {
    setUploading(true);
    try {
      await fetch(`${BASE}api/profile/${userId}/avatar`, {
        method: "DELETE",
        credentials: "include",
      });
      onUploaded(null);
    } finally {
      setUploading(false);
    }
  }

  const initials = name.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col items-start gap-2 mb-4">
      <div className="relative group">
        <div
          onClick={() => !uploading && fileRef.current?.click()}
          className="w-16 h-16 rounded-2xl overflow-hidden bg-primary/10 border border-primary/20 flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
        >
          {currentUrl ? (
            <img src={currentUrl} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-serif font-bold text-primary">{initials}</span>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-2xl">
              <Loader2 className="w-5 h-5 animate-spin text-white" />
            </div>
          )}
        </div>

        {/* Camera overlay on hover */}
        <div
          onClick={() => !uploading && fileRef.current?.click()}
          className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100"
        >
          <Camera className="w-5 h-5 text-white" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => !uploading && fileRef.current?.click()}
          disabled={uploading}
          className="text-xs text-primary hover:underline font-medium disabled:opacity-50"
        >
          {currentUrl ? "Cambia foto" : "Carica foto"}
        </button>
        {currentUrl && (
          <>
            <span className="text-muted-foreground text-xs">·</span>
            <button
              onClick={handleRemove}
              disabled={uploading}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 flex items-center gap-0.5"
            >
              <Trash2 className="w-3 h-3" /> Rimuovi
            </button>
          </>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-[11px] text-muted-foreground -mt-1">JPG, PNG, WebP · max 400 KB</p>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={handleFile}
        aria-label="Carica foto profilo"
      />
    </div>
  );
}

export default function Profilo() {
  const { t } = useTranslation();
  const { user, logout, isLoggedIn, updateUser } = useAuth();
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(user?.avatarUrl);
  const { data: profile } = useProfile(user?.id ?? 0);

  const { data: completionData } = useQuery<CompletionResponse | null>({
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

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground">{t("profilo.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("profilo.subtitle", { defaultValue: "Gestisci il tuo account e consulta la tua storia" })}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/score/${user.id}`}>
            <Button variant="outline" size="sm" className="rounded-full gap-2 text-xs border-primary/30 text-primary hover:bg-primary/10">
              <TrendingUp className="w-3.5 h-3.5" /> Il tuo NorthStar Score
            </Button>
          </Link>
          <Button variant="outline" size="sm" className="rounded-full w-fit" onClick={logout}>
            {t("profilo.logout", { defaultValue: "Esci dall'account" })}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="md:col-span-1 space-y-5">
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <User className="w-4 h-4 text-primary" /> {t("profilo.accountInfo")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <AvatarUpload
                userId={user.id}
                name={user.name}
                currentUrl={avatarUrl}
                onUploaded={(url) => {
                  setAvatarUrl(url);
                  updateUser({ avatarUrl: url });
                }}
              />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">{t("profilo.name")}</p>
                <p className="font-semibold text-foreground">{user.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">{t("profilo.email")}</p>
                <div className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  <p className="text-sm truncate">{user.email}</p>
                </div>
              </div>
              {profile && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">{t("profilo.memberSince")}</p>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-sm">{formatDate(profile.createdAt)}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center gap-1.5 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-xs text-emerald-700 font-medium">{t("profilo.emailVerified")}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-primary" /> {t("profilo.changePassword")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChangePasswordForm userId={user.id} />
            </CardContent>
          </Card>

          <PrivacyCard userId={user.id} />
          {completionData && (
            <Card className="rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-primary" /> Achievement
                  {completionData.streakDays > 0 && (
                    <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                      <Flame className="w-3 h-3" /> {completionData.streakDays} {completionData.streakDays === 1 ? "giorno" : "giorni"}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {BADGE_DEFS.map((b) => {
                    const earned = b.check(completionData);
                    return (
                      <div
                        key={b.id}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-xl border text-xs",
                          earned
                            ? "bg-primary/5 border-primary/20 text-foreground"
                            : "bg-muted/30 border-border text-muted-foreground opacity-40",
                        )}
                      >
                        <span className={cn("text-base", !earned && "grayscale")}>{b.emoji}</span>
                        <span className="font-medium leading-tight">{b.label}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="md:col-span-2 space-y-5">
          <ProssimiEventi userId={user.id} limit={5} />
          {completionData && (
            <ProfileCompletionCard
              data={{
                hasTestSession: completionData.hasTestSession,
                hasConfirmedSector: completionData.hasConfirmedSector,
                hasWorkPreference: completionData.hasWorkPreference,
                hasCv: completionData.hasCv,
                hasObjectives: completionData.totalObjectives > 0,
              }}
            />
          )}
          <JourneyScoreWidget userId={user.id} />
          <UserModeCard userId={user.id} />
          <WorkModeCard userId={user.id} />
          <TestHistoryCard />
          <CertificationsSection userId={user.id} />
          <SavedItems />
          <div>
            <h2 className="font-semibold text-base mb-3 flex items-center gap-2">
              <span>📋</span> I miei obiettivi
            </h2>
            <ObjectivesKanban userId={user.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
