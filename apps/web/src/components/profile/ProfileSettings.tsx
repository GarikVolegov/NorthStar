import { ChangePasswordSection } from "@/components/profile/settings/ChangePasswordSection";
import { EditProfileInfoSection, type ProfileInfoResult } from "@/components/profile/settings/EditProfileInfoSection";
import { BackgroundPicker } from "@/components/user-background/BackgroundPicker";
import { DashboardNavigationSettings } from "@/components/profile/DashboardNavigationSettings";
import { LogoPicker } from "@/components/profile/LogoPicker";
import { MonthlyRitualSettings } from "@/components/profile/MonthlyRitualSettings";
import { NftCertificateGallery } from "@/components/NftCertificateGallery";
import { NotificationSettings } from "@/components/profile/NotificationSettings";
import { CapsuleTrigger } from "@/components/profile/CapsuleTrigger";
import { BADGE_DEFS, WENDY_TONES, type CompletionData } from "@/components/profile/profile-settings-data";
import { PrivacyCard } from "@/components/profile/settings/PrivacyCard";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils";
import { ApiClientError, deleteJson, getJson, patchJson } from "@/lib/apiClient";
import type { AuthUser } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/AuthContext";
import { useAppAudio } from "@/contexts/AppAudioProvider";
import { useLefty } from "@/hooks/useLefty";
import { useQueryClient } from "@tanstack/react-query";
import {
  AtSign,
  AlertCircle,
  Bell,
  Bot,
  Calendar,
  Download,
  Flame,
  Globe,
  Hand,
  KeyRound,
  LayoutDashboard,
  Loader2,
  Mail,
  MapPin,
  Palette,
  Pencil,
  ShieldCheck,
  Trash2,
  Trophy,
  User,
  Volume2,
} from "lucide-react";
import { type ReactNode, useState } from "react";

const BASE = import.meta.env.BASE_URL || "/";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function apiErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : error instanceof Error ? error.message : fallback;
}

interface ProfileSettingsProps {
  user: AuthUser;
  createdAt?: string;
  completionData?: CompletionData;
  bio?: string | null | undefined;
  city?: string | null | undefined;
  username?: string | null | undefined;
  wendyTonePreference?: string | null | undefined;
  journeySections?: ReactNode;
}

export function ProfileSettings({
  user,
  createdAt,
  completionData,
  bio: initialBio,
  city: initialCity,
  username: initialUsername,
  wendyTonePreference: initialTone,
  journeySections,
}: ProfileSettingsProps) {
  const { isLefty, setIsLefty } = useLefty();
  const appAudio = useAppAudio();
  const { updateUser } = useAuth();
  const queryClient = useQueryClient();
  const [backgroundPickerOpen, setBackgroundPickerOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(false);

  // Campi profilo con stato locale (aggiornati dopo il salvataggio)
  const [bio, setBio] = useState<string | null | undefined>(initialBio);
  const [city, setCity] = useState<string | null | undefined>(initialCity);
  const [username, setUsername] = useState<string | null | undefined>(initialUsername);

  // Tono Wendy con auto-save
  const [tone, setTone] = useState<string>(initialTone ?? "auto");
  const [toneSaving, setToneSaving] = useState(false);
  const [toneError, setToneError] = useState<string | null>(null);
  const [accountActionError, setAccountActionError] = useState<string | null>(null);
  const [accountActionSuccess, setAccountActionSuccess] = useState<string | null>(null);
  const [exportingAccount, setExportingAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const soundscapeEnabled = appAudio.snapshot.supported && !appAudio.snapshot.muted;
  const emailVerified = user.emailVerified === true;

  function handleProfileSaved(result: ProfileInfoResult) {
    setBio(result.bio ?? null);
    setCity(result.city ?? null);
    setUsername(result.username ?? null);
    updateUser({
      name: result.name,
      bio: result.bio ?? null,
      city: result.city ?? null,
      username: result.username ?? null,
    });
    queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    setEditingAccount(false);
  }

  async function handleToneChange(value: string) {
    const previousTone = tone;
    setToneError(null);
    setTone(value);
    setToneSaving(true);
    try {
      await patchJson(`${BASE}api/profile/${user.id}/tone`, { tone: value });
    } catch {
      setTone(previousTone);
      setToneError("Impossibile salvare il tono di Wendy. Riprova tra poco.");
    } finally {
      setToneSaving(false);
    }
  }

  async function handleAccountExport() {
    setExportingAccount(true);
    setAccountActionError(null);
    setAccountActionSuccess(null);
    try {
      const payload = await getJson<unknown>(`${BASE}api/account/export`);
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `northstar-account-${user.id}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
      setAccountActionSuccess("Export account pronto. Il file contiene solo dati restituiti dal server.");
    } catch (error) {
      setAccountActionError(
        `Esportazione non riuscita: ${apiErrorMessage(error, "riprova tra poco")}. Nessun file e' stato generato.`,
      );
    } finally {
      setExportingAccount(false);
    }
  }

  async function handleAccountDelete() {
    const confirmed = window.confirm(
      "Richiedere l'eliminazione dell'account? L'operazione anonimizza subito i dati principali e avvia la rimozione definitiva.",
    );
    if (!confirmed) return;

    setDeletingAccount(true);
    setAccountActionError(null);
    setAccountActionSuccess(null);
    try {
      await deleteJson(`${BASE}api/account`);
      setAccountActionSuccess("Eliminazione account avviata. Lo stato verra' aggiornato dal server.");
    } catch (error) {
      setAccountActionError(
        `Eliminazione non avviata: ${apiErrorMessage(error, "riprova tra poco")}. Nessuna modifica all'account e' stata applicata.`,
      );
    } finally {
      setDeletingAccount(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <Accordion type="multiple" defaultValue={["account"]}>

        {/* ── Account ─────────────────────────────── */}
        <AccordionItem value="account" className="border-b border-border px-4">
          <AccordionTrigger className="hover:no-underline py-3.5">
            <CapsuleTrigger
              Icon={User}
              title="Account"
              description="Identita', contatti e dati personali che rendono il profilo riconoscibile."
            />
          </AccordionTrigger>
          <AccordionContent>
            {editingAccount ? (
              <div className="pb-2">
                <EditProfileInfoSection
                  userId={user.id}
                  initialName={user.name}
                  initialBio={bio}
                  initialCity={city}
                  initialUsername={username}
                  onSuccess={handleProfileSaved}
                  onCancel={() => setEditingAccount(false)}
                />
              </div>
            ) : (
              <div className="space-y-3 pb-1">
                {/* Nome */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Nome</p>
                  <p className="font-semibold text-foreground">{user.name}</p>
                </div>

                {/* Username */}
                {username && (
                  <div className="flex items-center gap-1.5">
                    <AtSign className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{username}</p>
                  </div>
                )}

                {/* Bio */}
                {bio && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Bio</p>
                    <p className="text-sm text-foreground leading-relaxed">{bio}</p>
                  </div>
                )}

                {/* Città */}
                {city && (
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-sm">{city}</p>
                  </div>
                )}

                {/* Email */}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Email</p>
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-sm truncate">{user.email}</p>
                  </div>
                </div>

                {/* Data iscrizione */}
                {createdAt && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Membro dal</p>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-sm">{formatDate(createdAt)}</p>
                    </div>
                  </div>
                )}

                {/* Verifica email */}
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className={cn("w-3.5 h-3.5", emailVerified ? "text-emerald-600" : "text-amber-600")} />
                  <span className={cn("text-xs font-medium", emailVerified ? "text-emerald-700" : "text-amber-700")}>
                    {emailVerified ? "Email verificata" : "Email non verificata"}
                  </span>
                </div>

                {/* Pulsante modifica */}
                <div className="pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full gap-1.5"
                    onClick={() => setEditingAccount(true)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Modifica profilo
                  </Button>
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* ── Sicurezza ────────────────────────────── */}
        <AccordionItem value="password" className="border-b border-border px-4">
          <AccordionTrigger className="hover:no-underline py-3.5">
            <CapsuleTrigger
              Icon={KeyRound}
              title="Sicurezza"
              description="Password e protezioni essenziali per tenere l'account sotto controllo."
            />
          </AccordionTrigger>
          <AccordionContent>
            <div className="pb-1">
              <ChangePasswordSection userId={user.id} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ── Privacy ──────────────────────────────── */}
        <AccordionItem value="privacy" className="border-b border-border px-4">
          <AccordionTrigger className="hover:no-underline py-3.5">
            <CapsuleTrigger
              Icon={Globe}
              title="Privacy"
              description="Visibilita' del profilo e preferenze sui dati condivisi."
            />
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pb-1">
              <PrivacyCard userId={user.id} />
              <div className="border-t border-border pt-3">
                <div className="mb-2">
                  <p className="text-sm font-medium">Dati account</p>
                  <p className="text-xs text-muted-foreground">
                    Esporta una copia dei dati o richiedi l'eliminazione senza stati ottimistici.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="justify-center gap-1.5 rounded-full"
                    disabled={exportingAccount || deletingAccount}
                    onClick={handleAccountExport}
                  >
                    {exportingAccount ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    Esporta dati account
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="justify-center gap-1.5 rounded-full border-destructive/30 text-destructive hover:bg-destructive/10"
                    disabled={exportingAccount || deletingAccount}
                    onClick={handleAccountDelete}
                  >
                    {deletingAccount ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Richiedi eliminazione account
                  </Button>
                </div>
                {accountActionError && (
                  <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive" role="alert">
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{accountActionError}</span>
                  </p>
                )}
                {accountActionSuccess && (
                  <p className="mt-2 text-xs font-medium text-emerald-700" role="status">
                    {accountActionSuccess}
                  </p>
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="notifications" className="border-b border-border px-4">
          <AccordionTrigger className="hover:no-underline py-3.5">
            <CapsuleTrigger
              Icon={Bell}
              title="Notifiche"
              description="Inbox, push browser ed email importanti per non perdere i segnali giusti."
            />
          </AccordionTrigger>
          <AccordionContent>
            <NotificationSettings />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="monthly-ritual" className="border-b border-border px-4">
          <AccordionTrigger className="hover:no-underline py-3.5">
            <CapsuleTrigger
              Icon={Flame}
              title="Notte della Fondazione"
              description="Rito mensile, promemoria e scintilla operativa del tuo percorso."
            />
          </AccordionTrigger>
          <AccordionContent>
            <MonthlyRitualSettings />
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="dashboard-navigation" className="border-b border-border px-4">
          <AccordionTrigger className="hover:no-underline py-3.5">
            <CapsuleTrigger
              Icon={LayoutDashboard}
              title="Dashboard e navigazione"
              description="Ordine, visibilita' e scorciatoie principali dell'esperienza NorthStar."
            />
          </AccordionTrigger>
          <AccordionContent>
            <DashboardNavigationSettings />
          </AccordionContent>
        </AccordionItem>

        {/* ── Aspetto ──────────────────────────────── */}
        <AccordionItem value="aspetto" className="border-b border-border px-4">
          <AccordionTrigger className="hover:no-underline py-3.5">
            <CapsuleTrigger
              Icon={Palette}
              title="Aspetto"
              description="Tema, logo, sfondo, atmosfera sonora e tono con cui Wendy ti accompagna."
            />
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-4 pb-1">
              {/* Tema */}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Tema</p>
                <ThemeToggle />
              </div>

              {/* Sfondo */}
              <LogoPicker />

              <div className="flex items-center justify-between gap-3 pt-1 border-t border-border">
                <div>
                  <p className="text-sm font-medium">Sfondo app</p>
                  <p className="text-xs text-muted-foreground">Personalizza l'atmosfera della tua area NorthStar.</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={() => setBackgroundPickerOpen(true)}
                >
                  Personalizza
                </Button>
              </div>

              <div className="flex items-center justify-between gap-3 pt-1 border-t border-border">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-primary" />
                    <p className="text-sm font-medium">Atmosfera sonora</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Abilita il rituale d'apertura e il sottofondo concentrativo.
                  </p>
                </div>
                <Switch
                  aria-label="Atmosfera sonora"
                  checked={soundscapeEnabled}
                  disabled={!appAudio.snapshot.supported}
                  onCheckedChange={(checked) => appAudio.setMuted(!checked)}
                />
              </div>

              {/* Tono Wendy */}
              <div className="pt-1 border-t border-border">
                <div className="flex items-center gap-2 mb-2.5">
                  <Bot className="w-4 h-4 text-primary" />
                  <p className="text-sm font-medium">Tono di Wendy</p>
                  {toneSaving && (
                    <span className="ml-auto text-xs text-muted-foreground animate-pulse">Salvataggio…</span>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {WENDY_TONES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => handleToneChange(t.value)}
                      className={cn(
                        "flex items-start gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors",
                        tone === t.value
                          ? "border-primary/40 bg-primary/5 text-foreground"
                          : "border-border bg-transparent text-muted-foreground hover:bg-muted/50",
                      )}
                    >
                      <span className={cn(
                        "mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-colors",
                        tone === t.value ? "border-primary bg-primary" : "border-muted-foreground/40",
                      )} />
                      <div>
                        <p className="text-xs font-semibold leading-tight">{t.label}</p>
                        <p className="text-xs leading-tight opacity-70">{t.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
                {toneError && (
                  <p className="mt-2 text-xs font-medium text-destructive" role="alert">
                    {toneError}
                  </p>
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ── Accessibilità ────────────────────────── */}
        <AccordionItem
          value="accessibilita"
          className={completionData !== undefined ? "border-b border-border px-4" : "px-4"}
        >
          <AccordionTrigger className="hover:no-underline py-3.5">
            <CapsuleTrigger
              Icon={Hand}
              title="Accessibilita'"
              description="Adattamenti rapidi per rendere l'interfaccia piu' comoda nel quotidiano."
            />
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex items-center justify-between pb-1">
              <div>
                <p className="text-sm font-medium">Modalità mancino</p>
                <p className="text-xs text-muted-foreground">Sposta la navigazione sul lato sinistro.</p>
              </div>
              <Switch checked={isLefty} onCheckedChange={setIsLefty} />
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ── Achievement ──────────────────────────── */}
        {completionData && (
          <AccordionItem value="achievement" className="border-b border-border px-4">
            <AccordionTrigger className="hover:no-underline py-3.5">
              <CapsuleTrigger
                Icon={Trophy}
                title="Achievement"
                description="Badge, streak e piccoli traguardi che rendono visibile il progresso."
                accessory={completionData.streakDays > 0 && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                    <Flame className="w-3 h-3" />
                    {completionData.streakDays} {completionData.streakDays === 1 ? "giorno" : "giorni"}
                  </span>
                )}
              />
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-2 gap-2 pb-5">
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
              <NftCertificateGallery userId={user.id} />
            </AccordionContent>
          </AccordionItem>
        )}
        {journeySections}

      </Accordion>

      <BackgroundPicker
        userId={user.id}
        open={backgroundPickerOpen}
        onOpenChange={setBackgroundPickerOpen}
      />
    </div>
  );
}
