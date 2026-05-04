import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User, Mail, Calendar, CheckCircle2, KeyRound, Sparkles, ShieldCheck, Globe, Lock, Bookmark, X, Users, Briefcase } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useFavorites } from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";
import { ProssimiEventi } from "@/components/calendario/ProssimiEventi";
import { WorkModeSelector, useWorkPreference } from "@/components/WorkModeSelector";
import type { WorkPreference } from "@/components/WorkModeSelector";
import { useTranslation } from "react-i18next";

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

export default function Profilo() {
  const { t } = useTranslation();
  const { user, logout, isLoggedIn } = useAuth();
  const { data: profile } = useProfile(user?.id ?? 0);

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
        <Button variant="outline" size="sm" className="rounded-full w-fit" onClick={logout}>
          {t("profilo.logout", { defaultValue: "Esci dall'account" })}
        </Button>
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
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <span className="text-2xl font-serif font-bold text-primary">{user.name.charAt(0).toUpperCase()}</span>
              </div>
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
        </div>

        <div className="md:col-span-2 space-y-5">
          <ProssimiEventi userId={user.id} limit={5} />
          <WorkModeCard userId={user.id} />
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> {t("profilo.testHistory", { defaultValue: "Cronologia test" })}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t("profilo.historyAvailable", { defaultValue: "Cronologia disponibile." })}</p>
            </CardContent>
          </Card>
          <SavedItems />
        </div>
      </div>
    </div>
  );
}
