import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { AppCard } from "@/features/applications/ApplicationCard";
import { CoverLetterDialog } from "@/features/applications/CoverLetterDialog";
import { StatsView } from "@/features/applications/StatsView";
import {
  COLUMNS,
  EMPTY_FORM,
  STATUS_META,
  type Application,
  type ApplicationForm,
  type ApplicationsResponse,
  type AppStatus,
} from "@/features/applications/applicationTypes";
import { deleteJson, getJson, patchJson, postJson } from "@/lib/apiClient";
import { useDynamicTranslation } from "@/lib/dynamic-translation";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, BarChart3, Bell, Briefcase, Building2, DollarSign, FileText, Link2, Loader2, MapPin, Plus, Star, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

function useApplicationsText(locale: string, key: string, source: string, context = "Applications tracking page UI copy") {
  return useDynamicTranslation({ locale, key, source, context });
}

export default function Candidature() {
  const { t, i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? "it").slice(0, 2);
  const { user, isLoggedIn } = useAuth();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [editApp, setEditApp] = useState<Application | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [view, setView] = useState<"kanban" | "stats">("kanban");
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [coverLetterApp, setCoverLetterApp] = useState<Application | null>(null);
  const pageTitle = useApplicationsText(locale, "candidature.myCandidatures", "Le mie candidature");
  const loadErrorShort = useApplicationsText(locale, "candidature.loadErrorShort", "Impossibile caricare le candidature");
  const notConfiguredShort = useApplicationsText(locale, "candidature.notConfiguredShort", "Archivio candidature non collegato");
  const noCandidaturesLabel = useApplicationsText(locale, "candidature.noCandidatures", "Nessuna candidatura ancora");
  const addLabel = useApplicationsText(locale, "candidature.add", "Aggiungi");
  const kanbanLabel = useApplicationsText(locale, "candidature.kanban", "Kanban");
  const statisticsLabel = useApplicationsText(locale, "candidature.statistics", "Statistiche");
  const retryLoadLabel = useApplicationsText(locale, "candidature.retryLoad", "Riprova caricamento");
  const loadErrorTitle = useApplicationsText(locale, "candidature.loadError", "Candidature non disponibili");
  const loadErrorDescription = useApplicationsText(locale, "candidature.loadErrorDesc", "Non siamo riusciti a caricare le candidature. Riprova tra poco.");
  const retryLabel = useApplicationsText(locale, "candidature.retry", "Riprova");
  const notConfiguredTitle = useApplicationsText(locale, "candidature.notConfiguredTitle", "Candidature non ancora collegate");
  const notConfiguredDescription = useApplicationsText(
    locale,
    "candidature.notConfiguredDesc",
    "Questa area e pronta, ma la persistenza delle candidature non e ancora collegata. Non salviamo modifiche finche il backend non sara connesso.",
  );
  const startTrackingTitle = useApplicationsText(locale, "candidature.startTracking", "Inizia a tracciare le candidature");
  const startTrackingDescription = useApplicationsText(
    locale,
    "candidature.startTrackingDesc",
    "Salva aziende, ruoli, link e follow-up per non perdere nessuna opportunita.",
  );
  const addFirstLabel = useApplicationsText(locale, "candidature.addFirst", "Aggiungi la prima candidatura");
  const exploreJobsLabel = useApplicationsText(locale, "candidature.exploreJobs", "Esplora offerte lavoro");
  const noAppsLabel = useApplicationsText(locale, "candidature.noApps", "Nessuna candidatura");
  const editAppLabel = useApplicationsText(locale, "candidature.editApp", "Modifica candidatura");
  const newAppLabel = useApplicationsText(locale, "candidature.newApp", "Nuova candidatura");
  const companyLabel = useApplicationsText(locale, "candidature.company", "Azienda");
  const roleLabel = useApplicationsText(locale, "candidature.role", "Ruolo");
  const linkLabel = useApplicationsText(locale, "candidature.link", "Link");
  const optionalLabel = useApplicationsText(locale, "candidature.optional", "opzionale");
  const statusFieldLabel = useApplicationsText(locale, "candidature.statusLbl", "Stato");
  const locationLabel = useApplicationsText(locale, "candidature.location", "Luogo");
  const salaryLabel = useApplicationsText(locale, "candidature.salary", "Retribuzione");
  const notesLabel = useApplicationsText(locale, "candidature.notes", "Note");
  const cancelLabel = useApplicationsText(locale, "candidature.cancel", "Annulla");
  const saveChangesLabel = useApplicationsText(locale, "candidature.saveChanges", "Salva modifiche");
  const requiredFieldsLabel = useApplicationsText(locale, "candidature.requiredFields", "Azienda e ruolo sono obbligatori.");
  const companyPlaceholder = useApplicationsText(locale, "candidature.companyPlaceholder", "es. Google Italia");
  const rolePlaceholder = useApplicationsText(locale, "candidature.rolePlaceholder", "es. UX Designer");
  const locationPlaceholder = useApplicationsText(locale, "candidature.locationPlaceholder", "es. Milano / Remote");
  const salaryPlaceholder = useApplicationsText(locale, "candidature.salaryPlaceholder", "es. 45.000 EUR / 3.500 EUR mese");
  const notesPlaceholder = useApplicationsText(locale, "candidature.notesPlaceholder", "Contatti, impressioni, dettagli importanti...");
  const statusLabels: Record<AppStatus, string> = {
    saved: useApplicationsText(locale, "candidature.status.saved", "Salvata"),
    applied: useApplicationsText(locale, "candidature.status.applied", "Inviata"),
    interview: useApplicationsText(locale, "candidature.status.interview", "Colloquio"),
    offer: useApplicationsText(locale, "candidature.status.offer", "Offerta"),
    rejected: useApplicationsText(locale, "candidature.status.rejected", "Rifiutata"),
  };

  const { data, error, isError, isLoading, refetch } = useQuery({
    queryKey: ["applications", user?.id],
    queryFn: async () => {
      if (!user?.id) return { applications: [] };
      return getJson<ApplicationsResponse>(`${BASE}api/applications/${user.id}`);
    },
    enabled: !!user?.id,
  });

  const applications = data?.applications ?? [];
  const applicationsNotConfigured = data?.status === "not_configured";
  const applicationsNotConfiguredMessage = notConfiguredDescription;

  const createMutation = useMutation({
    mutationFn: (payload: ApplicationForm) =>
      postJson<Application | ApplicationsResponse>(`${BASE}api/applications`, { ...payload }),
    onSuccess: (response) => {
      if ("status" in response && response.status === "not_configured") {
        setFormError(applicationsNotConfiguredMessage);
        return;
      }
      setMutationError(null);
      queryClient.invalidateQueries({ queryKey: ["applications", user?.id] });
      setAddOpen(false);
      setForm(EMPTY_FORM);
      setFormError(null);
    },
    onError: (error: Error) => setFormError(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<Application> }) => {
      return patchJson<Application | ApplicationsResponse>(`${BASE}api/applications/${id}`, updates);
    },
    onSuccess: (response) => {
      if ("status" in response && response.status === "not_configured") {
        setMutationError(applicationsNotConfiguredMessage);
        return;
      }
      setMutationError(null);
      queryClient.invalidateQueries({ queryKey: ["applications", user?.id] });
    },
    onError: (error: Error) => setMutationError(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return deleteJson<ApplicationsResponse | null>(`${BASE}api/applications/${id}`);
    },
    onSuccess: (response) => {
      if (response?.status === "not_configured") {
        setMutationError(applicationsNotConfiguredMessage);
        return;
      }
      setMutationError(null);
      queryClient.invalidateQueries({ queryKey: ["applications", user?.id] });
    },
    onError: (error: Error) => setMutationError(error.message),
  });

  function handleSubmit() {
    if (!form.company.trim() || !form.role.trim()) {
      setFormError(requiredFieldsLabel);
      return;
    }
    if (editApp) {
      updateMutation.mutate({ id: editApp.id, updates: form }, {
        onSuccess: (response) => {
          if ("status" in response && response.status === "not_configured") {
            setFormError(applicationsNotConfiguredMessage);
            return;
          }
          setEditApp(null);
          setForm(EMPTY_FORM);
          setFormError(null);
          setAddOpen(false);
        },
        onError: (error: Error) => setFormError(error.message),
      });
    } else {
      createMutation.mutate(form);
    }
  }

  function openEdit(app: Application) {
    setEditApp(app);
    setForm({
      company: app.company, role: app.role, url: app.url ?? "",
      status: app.status, notes: app.notes ?? "", salary: app.salary ?? "", location: app.location ?? "",
    });
    setFormError(null);
    setAddOpen(true);
  }

  function openAdd(defaultStatus?: AppStatus) {
    setEditApp(null);
    setForm({ ...EMPTY_FORM, status: defaultStatus ?? "saved" });
    setFormError(null);
    setAddOpen(true);
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <Star className="w-12 h-12 text-primary/30 mb-4" />
        <h2 className="text-xl font-semibold mb-2">{t("candidature.loginRequired")}</h2>
        <p className="text-muted-foreground mb-6 max-w-sm">{t("candidature.loginRequiredDesc")}</p>
        <Button asChild><Link href="/">{t("candidature.goHome")}</Link></Button>
      </div>
    );
  }

  const total = applications.length;
  const byStatus = COLUMNS.reduce((acc, s) => ({ ...acc, [s]: applications.filter((a) => a.status === s) }), {} as Record<AppStatus, Application[]>);

  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const staleInterviews = applications.filter(
    (a) => a.status === "interview" && Date.now() - new Date(a.updatedAt).getTime() > SEVEN_DAYS_MS,
  );

  return (
    <div className="min-h-screen bg-muted/30">
      {/* ── Page header ── */}
      <div className="bg-background border-b">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-8 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-serif font-bold text-foreground">{pageTitle}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isError
                  ? loadErrorShort
                  : applicationsNotConfigured ? notConfiguredShort
                  : total === 0 ? noCandidaturesLabel : t("candidature.totalCount", { count: total })}
              </p>
            </div>
            {!applicationsNotConfigured && (
              <Button onClick={() => openAdd()} className="min-h-11 shrink-0 gap-2 rounded-full">
                <Plus className="w-4 h-4" /> {addLabel}
              </Button>
            )}
          </div>

          {/* Stats bar */}
          {total > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {COLUMNS.map((s) => {
                const count = byStatus[s].length;
                if (count === 0) return null;
                const m = STATUS_META[s];
                return (
                  <span key={s} className={cn("text-xs font-medium px-2.5 py-1 rounded-full border", m.badge)}>
                    {m.emoji} {statusLabels[s]}: {count}
                  </span>
                );
              })}
            </div>
          )}

          {/* View toggle tabs */}
          {total > 0 && (
            <div className="flex gap-1 mt-4">
              {(["kanban", "stats"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
                    view === v ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  {v === "kanban" ? <><Briefcase className="w-3.5 h-3.5" /> {kanbanLabel}</> : <><BarChart3 className="w-3.5 h-3.5" /> {statisticsLabel}</>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Stale interview banner ── */}
      {!bannerDismissed && staleInterviews.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-screen-2xl mx-auto px-4 md:px-8 py-3">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                <Bell className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-900">
                  {t("candidature.staleInterview", { count: staleInterviews.length })}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                  {staleInterviews.map((a) => (
                    <button key={a.id} onClick={() => openEdit(a)}
                      className="text-xs text-amber-700 underline underline-offset-2 hover:text-amber-900 transition-colors">
                      {a.company} — {a.role}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-amber-600 mt-1">
                  {t("candidature.staleInterviewReminder")}
                </p>
              </div>
              <button onClick={() => setBannerDismissed(true)}
                className="p-1 rounded-lg hover:bg-amber-100 text-amber-500 hover:text-amber-700 transition-colors shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <div className="max-w-screen-2xl mx-auto px-4 md:px-8 py-6">
        {mutationError && !isLoading && !isError && !applicationsNotConfigured && total > 0 && (
          <div className="mb-4 flex flex-col gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4 sm:flex-row sm:items-center sm:justify-between" role="alert">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-sm text-destructive">{mutationError}</p>
            </div>
            <Button variant="outline" className="rounded-full" onClick={() => void refetch()}>
              {retryLoadLabel}
            </Button>
          </div>
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-destructive/70" />
            </div>
            <h2 className="text-lg font-semibold mb-2">
              {loadErrorTitle}
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              {error instanceof Error
                ? error.message
                : loadErrorDescription}
            </p>
            <Button onClick={() => void refetch()} variant="outline" className="rounded-full">
              {retryLabel}
            </Button>
          </div>
        ) : applicationsNotConfigured ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl border border-warning-muted bg-warning-surface text-warning flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-semibold mb-2">
              {notConfiguredTitle}
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              {applicationsNotConfiguredMessage}
            </p>
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Briefcase className="w-8 h-8 text-primary/60" />
            </div>
            <h2 className="text-lg font-semibold mb-2">{startTrackingTitle}</h2>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              {startTrackingDescription}
            </p>
            <Button onClick={() => openAdd()} className="min-h-11 gap-2 rounded-full">
              <Plus className="w-4 h-4" /> {addFirstLabel}
            </Button>
            <Button asChild variant="link" className="mt-2 text-primary">
              <Link href="/lavori">{exploreJobsLabel}</Link>
            </Button>
          </div>
        ) : view === "stats" ? (
          <StatsView applications={applications} />
        ) : (
          /* Kanban columns */
          <div className="flex gap-4 overflow-x-auto pb-6 -mx-4 md:-mx-8 px-4 md:px-8">
            {COLUMNS.map((status) => {
              const meta = STATUS_META[status];
              const cards = byStatus[status];
              return (
                <div
                  key={status}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const appId = parseInt(e.dataTransfer.getData("appId"), 10);
                    if (!isNaN(appId)) {
                      const existing = applications.find((a) => a.id === appId);
                      if (existing && existing.status !== status) {
                        updateMutation.mutate({ id: appId, updates: { status } });
                      }
                      setDraggingId(null);
                    }
                  }}
                  className={cn(
                    "flex-shrink-0 w-[300px] md:w-[285px] xl:w-[300px] flex flex-col rounded-xl transition-colors",
                    draggingId !== null && "ring-2 ring-inset ring-primary/10",
                  )}
                >
                  <div className={cn("flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3", meta.bg)}>
                    <span className="text-base">{meta.emoji}</span>
                    <span className={cn("text-sm font-semibold flex-1", meta.color)}>{statusLabels[status]}</span>
                    <Badge variant="outline" className={cn("text-xs h-5 px-1.5 font-semibold", meta.badge)}>
                      {cards.length}
                    </Badge>
                  </div>

                  <div className="space-y-2.5 flex-1">
                    {cards.length === 0 ? (
                      <div className="border-2 border-dashed border-border rounded-xl p-5 text-center">
                        <p className="text-xs text-muted-foreground">{noAppsLabel}</p>
                      </div>
                    ) : (
                      cards.map((app) => (
                        <AppCard
                          key={app.id}
                          app={app}
                          userId={user!.id}
                          onEdit={() => openEdit(app)}
                          onDelete={() => deleteMutation.mutate(app.id)}
                          onStatusChange={(s) => updateMutation.mutate({ id: app.id, updates: { status: s } })}
                          deleting={deleteMutation.isPending && deleteMutation.variables === app.id}
                          isDragging={draggingId === app.id}
                          onDragStart={(e) => { e.dataTransfer.setData("appId", String(app.id)); setDraggingId(app.id); }}
                          onDragEnd={() => setDraggingId(null)}
                          onCoverLetter={() => setCoverLetterApp(app)}
                        />
                      ))
                    )}

                    <button
                      onClick={() => openAdd(status)}
                      className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                    >
                      <Plus className="w-3.5 h-3.5" /> {t("candidature.addTo", { status: statusLabels[status].toLowerCase() })}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add / Edit dialog ── */}
      <Dialog open={addOpen} onOpenChange={(open) => { if (!open) { setAddOpen(false); setEditApp(null); setFormError(null); } }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editApp ? editAppLabel : newAppLabel}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" /> {companyLabel}
                </Label>
                <Input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder={companyPlaceholder} className="h-11 rounded-xl text-sm" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-muted-foreground" /> {roleLabel}
                </Label>
                <Input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  placeholder={rolePlaceholder} className="h-11 rounded-xl text-sm" />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-muted-foreground" /> {linkLabel} <span className="font-normal text-muted-foreground">({optionalLabel})</span>
              </Label>
              <Input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://..." className="h-11 rounded-xl text-sm" type="url" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold mb-1.5 block">{statusFieldLabel}</Label>
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as AppStatus }))}
                  className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  {COLUMNS.map((s) => <option key={s} value={s}>{STATUS_META[s].emoji} {statusLabels[s]}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" /> {locationLabel}
                </Label>
                <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder={locationPlaceholder} className="h-11 rounded-xl text-sm" />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-muted-foreground" /> {salaryLabel} <span className="font-normal text-muted-foreground">({optionalLabel})</span>
              </Label>
              <Input value={form.salary} onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))}
                placeholder={salaryPlaceholder} className="h-11 rounded-xl text-sm" />
            </div>

            <div>
              <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" /> {notesLabel} <span className="font-normal text-muted-foreground">({optionalLabel})</span>
              </Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder={notesPlaceholder} className="min-h-[70px] rounded-xl text-sm resize-none" />
            </div>

            {formError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20" role="alert">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                <p className="text-xs text-destructive">{formError}</p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="min-h-11 rounded-xl" onClick={() => { setAddOpen(false); setEditApp(null); }}>
              {cancelLabel}
            </Button>
            <Button className="min-h-11 gap-2 rounded-xl" onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
              {editApp ? saveChangesLabel : addLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {coverLetterApp && (
        <CoverLetterDialog app={coverLetterApp} onClose={() => setCoverLetterApp(null)} />
      )}
    </div>
  );
}
