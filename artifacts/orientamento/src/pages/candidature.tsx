import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, ExternalLink, Trash2, Loader2, ChevronDown,
  Building2, Briefcase, MapPin, DollarSign, FileText,
  Link2, Star, Calendar, AlertCircle, Bell, X,
  BarChart3, TrendingUp, ArrowRight, StickyNote, Send,
  ChevronUp, Clock, Copy, Sparkles, GripVertical,
} from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL || "/";

type AppStatus = "saved" | "applied" | "interview" | "offer" | "rejected";

interface NoteEntry {
  text: string;
  createdAt: string;
}

interface Application {
  id: number;
  userId: number;
  company: string;
  role: string;
  url: string | null;
  status: AppStatus;
  notes: string | null;
  salary: string | null;
  location: string | null;
  appliedAt: string;
  updatedAt: string;
  notesLog: NoteEntry[] | null;
}

const STATUS_META: Record<AppStatus, { label: string; emoji: string; color: string; border: string; bg: string; badge: string }> = {
  saved:     { label: "Salvata",    emoji: "💾", color: "text-slate-700",   border: "border-l-slate-400",  bg: "bg-slate-50",   badge: "bg-slate-100 text-slate-700 border-slate-200" },
  applied:   { label: "Candidato",  emoji: "📤", color: "text-blue-700",    border: "border-l-blue-500",   bg: "bg-blue-50",    badge: "bg-blue-100 text-blue-700 border-blue-200" },
  interview: { label: "Colloquio",  emoji: "🎤", color: "text-violet-700",  border: "border-l-violet-500", bg: "bg-violet-50",  badge: "bg-violet-100 text-violet-700 border-violet-200" },
  offer:     { label: "Offerta",    emoji: "🎉", color: "text-emerald-700", border: "border-l-emerald-500",bg: "bg-emerald-50", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  rejected:  { label: "Rifiutato", emoji: "❌", color: "text-rose-700",    border: "border-l-rose-400",   bg: "bg-rose-50",    badge: "bg-rose-100 text-rose-700 border-rose-200" },
};

const COLUMNS: AppStatus[] = ["saved", "applied", "interview", "offer", "rejected"];
const EMPTY_FORM = { company: "", role: "", url: "", status: "saved" as AppStatus, notes: "", salary: "", location: "" };

function useFormatDate() {
  const { i18n } = useTranslation();
  return (iso: string) => new Date(iso).toLocaleDateString(i18n.language, { day: "numeric", month: "short" });
}

function useFormatNoteDate() {
  const { t, i18n } = useTranslation();
  return (iso: string): string => {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return t("candidature.now");
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays === 1) return t("amici.yesterday");
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString(i18n.language, { day: "numeric", month: "short" });
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   Main page component
═══════════════════════════════════════════════════════════════════════ */
export default function Candidature() {
  const { t } = useTranslation();
  const { user, isLoggedIn } = useAuth();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [editApp, setEditApp] = useState<Application | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [view, setView] = useState<"kanban" | "stats">("kanban");
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [coverLetterApp, setCoverLetterApp] = useState<Application | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["applications", user?.id],
    queryFn: async () => {
      if (!user?.id) return { applications: [] };
      const res = await fetch(`${BASE}api/applications/${user.id}`);
      return res.json() as Promise<{ applications: Application[] }>;
    },
    enabled: !!user?.id,
  });

  const applications = data?.applications ?? [];

  const createMutation = useMutation({
    mutationFn: async (payload: typeof EMPTY_FORM) => {
      const res = await fetch(`${BASE}api/applications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, userId: user?.id }),
      });
      if (!res.ok) throw new Error("Errore nella creazione");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications", user?.id] });
      setAddOpen(false);
      setForm(EMPTY_FORM);
      setFormError(null);
    },
    onError: (e: any) => setFormError(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<Application> }) => {
      const res = await fetch(`${BASE}api/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error("Errore nell'aggiornamento");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["applications", user?.id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${BASE}api/applications/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Errore nell'eliminazione");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["applications", user?.id] }),
  });

  function handleSubmit() {
    if (!form.company.trim() || !form.role.trim()) {
      setFormError(t("candidature.requiredFields"));
      return;
    }
    if (editApp) {
      updateMutation.mutate({ id: editApp.id, updates: form }, {
        onSuccess: () => { setEditApp(null); setForm(EMPTY_FORM); setFormError(null); setAddOpen(false); },
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
              <h1 className="text-2xl font-serif font-bold text-foreground">{t("candidature.myCandidatures")}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {total === 0 ? t("candidature.noCandidatures") : t("candidature.totalCount", { count: total })}
              </p>
            </div>
            <Button onClick={() => openAdd()} className="rounded-full gap-2 shrink-0">
              <Plus className="w-4 h-4" /> {t("candidature.add")}
            </Button>
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
                    {m.emoji} {t(`candidature.status.${s}`)}: {count}
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
                    "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors",
                    view === v ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted",
                  )}
                >
                  {v === "kanban" ? <><Briefcase className="w-3.5 h-3.5" /> {t("candidature.kanban")}</> : <><BarChart3 className="w-3.5 h-3.5" /> {t("candidature.statistics")}</>}
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
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
        ) : total === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Briefcase className="w-8 h-8 text-primary/60" />
            </div>
            <h2 className="text-lg font-semibold mb-2">{t("candidature.startTracking")}</h2>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              {t("candidature.startTrackingDesc")}
            </p>
            <Button onClick={() => openAdd()} className="rounded-full gap-2">
              <Plus className="w-4 h-4" /> {t("candidature.addFirst")}
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
                    <span className={cn("text-sm font-semibold flex-1", meta.color)}>{t(`candidature.status.${status}`)}</span>
                    <Badge variant="outline" className={cn("text-xs h-5 px-1.5 font-semibold", meta.badge)}>
                      {cards.length}
                    </Badge>
                  </div>

                  <div className="space-y-2.5 flex-1">
                    {cards.length === 0 ? (
                      <div className="border-2 border-dashed border-border rounded-xl p-5 text-center">
                        <p className="text-xs text-muted-foreground">{t("candidature.noApps")}</p>
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
                          onDragStart={(e) => { (e as any).dataTransfer.setData("appId", String(app.id)); setDraggingId(app.id); }}
                          onDragEnd={() => setDraggingId(null)}
                          onCoverLetter={() => setCoverLetterApp(app)}
                        />
                      ))
                    )}

                    <button
                      onClick={() => openAdd(status)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-dashed border-border transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> {t("candidature.addTo", { status: t(`candidature.status.${status}`).toLowerCase() })}
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
              {editApp ? t("candidature.editApp") : t("candidature.newApp")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" /> {t("candidature.company")}
                </Label>
                <Input value={form.company} onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="es. Google Italia" className="h-9 rounded-xl text-sm" />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-muted-foreground" /> {t("candidature.role")}
                </Label>
                <Input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  placeholder="es. UX Designer" className="h-9 rounded-xl text-sm" />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-muted-foreground" /> {t("candidature.link")} <span className="font-normal text-muted-foreground">({t("candidature.optional")})</span>
              </Label>
              <Input value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://..." className="h-9 rounded-xl text-sm" type="url" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold mb-1.5 block">{t("candidature.statusLbl")}</Label>
                <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as AppStatus }))}
                  className="w-full h-9 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring">
                  {COLUMNS.map((s) => <option key={s} value={s}>{STATUS_META[s].emoji} {t(`candidature.status.${s}`)}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" /> {t("candidature.location")}
                </Label>
                <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="es. Milano / Remote" className="h-9 rounded-xl text-sm" />
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-muted-foreground" /> {t("candidature.salary")} <span className="font-normal text-muted-foreground">({t("candidature.optional")})</span>
              </Label>
              <Input value={form.salary} onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))}
                placeholder="es. 45.000 € / 3.500 € mese" className="h-9 rounded-xl text-sm" />
            </div>

            <div>
              <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" /> {t("candidature.notes")} <span className="font-normal text-muted-foreground">({t("candidature.optional")})</span>
              </Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Contatti, impressioni, dettagli importanti..." className="min-h-[70px] rounded-xl text-sm resize-none" />
            </div>

            {formError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                <p className="text-xs text-destructive">{formError}</p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => { setAddOpen(false); setEditApp(null); }}>
              {t("candidature.cancel")}
            </Button>
            <Button className="rounded-xl gap-2" onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
              {editApp ? t("candidature.saveChanges") : t("candidature.add")}
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

/* ═══════════════════════════════════════════════════════════════════════
   AI Cover-letter dialog
═══════════════════════════════════════════════════════════════════════ */
function CoverLetterDialog({ app, onClose }: { app: Application; onClose: () => void }) {
  const [jobDescription, setJobDescription] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`${BASE}api/cover-letter/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: app.company, role: app.role, jobDescription }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Errore generazione");
      setText(data.text ?? "");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function copyToClipboard() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Lettera di presentazione AI
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 text-sm">
            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="font-medium">{app.company}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{app.role}</span>
          </div>
          <div>
            <Label className="text-xs font-semibold mb-1.5 block">
              Descrizione posizione{" "}
              <span className="font-normal text-muted-foreground">(facoltativo)</span>
            </Label>
            <Textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Incolla la descrizione dell'annuncio per una lettera più personalizzata…"
              className="min-h-[80px] rounded-xl text-sm resize-none"
            />
          </div>
          <Button onClick={generate} disabled={loading} className="w-full rounded-xl gap-2">
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Generazione in corso…</>
              : <><Sparkles className="w-4 h-4" /> {text ? "Rigenera lettera" : "Genera lettera AI"}</>}
          </Button>
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
              <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}
          {text && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Lettera generata</Label>
                <button onClick={copyToClipboard} className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <Copy className="w-3 h-3" /> {copied ? "Copiato!" : "Copia"}
                </button>
              </div>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-[240px] rounded-xl text-sm"
              />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={onClose}>Chiudi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Application card with inline notes diary
═══════════════════════════════════════════════════════════════════════ */
function AppCard({
  app, userId, onEdit, onDelete, onStatusChange, deleting,
  isDragging, onDragStart, onDragEnd, onCoverLetter,
}: {
  app: Application;
  userId: number;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (s: AppStatus) => void;
  deleting: boolean;
  isDragging: boolean;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  onCoverLetter: () => void;
}) {
  const { t } = useTranslation();
  const formatDate = useFormatDate();
  const formatNoteDate = useFormatNoteDate();
  const queryClient = useQueryClient();
  const meta = STATUS_META[app.status];
  const otherStatuses = COLUMNS.filter((s) => s !== app.status);
  const notesLog: NoteEntry[] = Array.isArray(app.notesLog) ? app.notesLog : [];

  const [notesOpen, setNotesOpen] = useState(false);
  const [noteInput, setNoteInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (notesOpen) inputRef.current?.focus();
  }, [notesOpen]);

  const addNoteMutation = useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch(`${BASE}api/applications/${app.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("Errore");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["applications", userId] });
      setNoteInput("");
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (index: number) => {
      const res = await fetch(`${BASE}api/applications/${app.id}/notes/${index}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Errore");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["applications", userId] }),
  });

  function submitNote() {
    const text = noteInput.trim();
    if (!text || addNoteMutation.isPending) return;
    addNoteMutation.mutate(text);
  }

  return (
    <div
      draggable
      onDragStart={onDragStart as any}
      onDragEnd={onDragEnd}
      className={cn(
        "bg-background rounded-xl border border-l-4 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing",
        meta.border,
        isDragging && "opacity-50 scale-[0.97]",
      )}
    >
      {/* ── Clickable card body ── */}
      <div className="p-3 cursor-pointer" onClick={onEdit}>
        {/* Company + Delete */}
        <div className="flex items-start gap-1.5 mb-1">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground leading-tight truncate">{app.company}</p>
            <p className="text-xs text-muted-foreground truncate">{app.role}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all shrink-0 -mt-0.5 -mr-0.5 group"
            disabled={deleting}
          >
            {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3 opacity-0 group-hover:opacity-100" />}
          </button>
        </div>

        {/* Location / Salary */}
        {(app.location || app.salary) && (
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1.5">
            {app.location && (
              <span className="text-[11px] flex items-center gap-1 text-muted-foreground">
                <MapPin className="w-2.5 h-2.5" />{app.location}
              </span>
            )}
            {app.salary && (
              <span className="text-[11px] flex items-center gap-1 text-muted-foreground">
                <DollarSign className="w-2.5 h-2.5" />{app.salary}
              </span>
            )}
          </div>
        )}

        {/* Notes preview */}
        {app.notes && (
          <p className="text-[11px] text-muted-foreground italic mt-1.5 line-clamp-2">{app.notes}</p>
        )}

        {/* Latest diary note teaser (when panel is closed) */}
        {!notesOpen && notesLog.length > 0 && (
          <div className="mt-2 flex items-start gap-1.5">
            <Clock className="w-2.5 h-2.5 text-muted-foreground/60 mt-0.5 shrink-0" />
            <p className="text-[10px] text-muted-foreground/70 line-clamp-1 italic">
              {formatNoteDate(notesLog[0].createdAt)} · {notesLog[0].text}
            </p>
          </div>
        )}
      </div>

      {/* ── Footer: date, url, notes toggle, status ── */}
      <div className="flex items-center gap-1.5 px-3 pb-2.5 pt-0">
        <span className="text-[11px] text-muted-foreground flex items-center gap-1 mr-auto">
          <Calendar className="w-2.5 h-2.5" />{formatDate(app.appliedAt)}
        </span>

        {app.url && (
          <a href={app.url} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors" title="Apri offerta">
            <ExternalLink className="w-3 h-3" />
          </a>
        )}

        <button
          onClick={(e) => { e.stopPropagation(); onCoverLetter(); }}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-violet-600 transition-colors"
          title="Genera lettera di presentazione AI"
        >
          <Sparkles className="w-3 h-3" />
        </button>

        {/* Notes toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); setNotesOpen((o) => !o); }}
          className={cn(
            "flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-md transition-colors",
            notesOpen
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:text-foreground hover:bg-muted",
          )}
          title={notesOpen ? "Chiudi diario" : "Apri diario note"}
        >
          <StickyNote className="w-3 h-3" />
          {notesLog.length > 0 ? notesLog.length : ""}
          {notesOpen ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
        </button>

        {/* Status dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button onClick={(e) => e.stopPropagation()}
              className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 hover:opacity-80 transition-opacity", meta.badge)}>
              {meta.emoji} {meta.label} <ChevronDown className="w-2.5 h-2.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {otherStatuses.map((s) => {
              const m = STATUS_META[s];
              return (
                <DropdownMenuItem key={s} onClick={(e) => { e.stopPropagation(); onStatusChange(s); }}
                  className="text-xs gap-2 cursor-pointer">
                  <span>{m.emoji}</span> {t("candidature.moveTo", { status: t(`candidature.status.${s}`) })}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* ── Inline notes diary ── */}
      {notesOpen && (
        <div
          className="border-t border-border/60 mx-3 pb-3 pt-2.5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Existing notes */}
          {notesLog.length > 0 && (
            <div className="space-y-1.5 mb-2.5 max-h-40 overflow-y-auto pr-1">
              {notesLog.map((entry, i) => (
                <div key={i} className="flex items-start gap-2 group/note">
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap pt-0.5 shrink-0 tabular-nums">
                    {formatNoteDate(entry.createdAt)}
                  </span>
                  <p className="text-[11px] text-foreground leading-relaxed flex-1 min-w-0">{entry.text}</p>
                  <button
                    onClick={() => deleteNoteMutation.mutate(i)}
                    disabled={deleteNoteMutation.isPending}
                    className="opacity-0 group-hover/note:opacity-100 p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all shrink-0"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {notesLog.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic mb-2.5">
              {t("candidature.noNotesYet")}
            </p>
          )}

          {/* Add note input */}
          <div className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitNote(); }
              }}
              placeholder={t("candidature.addNotePlaceholder")}
              className="flex-1 min-w-0 text-xs bg-muted/60 border border-input rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50 transition-shadow"
            />
            <button
              onClick={submitNote}
              disabled={!noteInput.trim() || addNoteMutation.isPending}
              className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
              title="Aggiungi nota (Invio)"
            >
              {addNoteMutation.isPending
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   Statistics view
═══════════════════════════════════════════════════════════════════════ */
function StatsView({ applications }: { applications: Application[] }) {
  const { t } = useTranslation();
  const total = applications.length;

  const counts = {
    saved:     applications.filter((a) => a.status === "saved").length,
    applied:   applications.filter((a) => a.status === "applied").length,
    interview: applications.filter((a) => a.status === "interview").length,
    offer:     applications.filter((a) => a.status === "offer").length,
    rejected:  applications.filter((a) => a.status === "rejected").length,
  };

  const active = counts.applied + counts.interview;
  const sentApplications = counts.applied + counts.interview + counts.offer + counts.rejected;
  const responseRate = sentApplications > 0
    ? Math.round(((counts.interview + counts.offer) / sentApplications) * 100) : 0;
  const offerRate = (counts.interview + counts.offer) > 0
    ? Math.round((counts.offer / (counts.interview + counts.offer)) * 100) : 0;

  const funnelStages: { status: AppStatus; count: number }[] = [
    { status: "saved", count: counts.saved },
    { status: "applied", count: counts.applied },
    { status: "interview", count: counts.interview },
    { status: "offer", count: counts.offer },
  ];
  const maxFunnelCount = Math.max(...funnelStages.map((s) => s.count), 1);

  const monthlyData = groupByMonth(applications);
  const maxMonthly = Math.max(...monthlyData.map((d) => d.count), 1);

  const totalNotes = applications.reduce((sum, a) => sum + (Array.isArray(a.notesLog) ? a.notesLog.length : 0), 0);

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <BarChart3 className="w-12 h-12 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">{t("candidature.addStatNote")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard emoji="📊" label={t("candidature.totalLabel")} value={total} sub={t("candidature.tracked")} valueColor="text-foreground" />
        <KpiCard emoji="💌" label={t("candidature.responseRate")} value={`${responseRate}%`} sub={t("candidature.responseRateDesc")} valueColor="text-blue-600" />
        <KpiCard emoji="⏳" label={t("candidature.inProgress")} value={active} sub={t("candidature.inProgressDesc")} valueColor="text-violet-600" />
        <KpiCard emoji="📝" label={t("candidature.totalNotes")} value={totalNotes} sub={`${(totalNotes / total).toFixed(1)} ${t("candidature.perApp")}`} valueColor="text-amber-600" />
      </div>

      {/* Funnel */}
      <div className="bg-background rounded-2xl border p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> {t("candidature.funnelTitle")}
          </h3>
          {offerRate > 0 && (
            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", STATUS_META.offer.badge)}>
              🎉 {t("candidature.successRate", { rate: offerRate })}
            </span>
          )}
        </div>
        <div className="space-y-2">
          {funnelStages.map((stage, i) => {
            const m = STATUS_META[stage.status];
            const pct = maxFunnelCount > 0 ? (stage.count / maxFunnelCount) * 100 : 0;
            const prevCount = i > 0 ? funnelStages[i - 1].count : null;
            const convPct = prevCount !== null && prevCount > 0
              ? Math.round((stage.count / prevCount) * 100) : null;
            return (
              <div key={stage.status}>
                {convPct !== null && (
                  <div className="flex items-center gap-2 py-1 pl-[108px]">
                    <ArrowRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
                    <span className="text-[11px] text-muted-foreground font-medium">{t("candidature.conversionPct", { pct: convPct })}</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-24 shrink-0 text-right">
                    <span className={cn("text-xs font-semibold", m.color)}>{m.emoji} {t(`candidature.status.${stage.status}`)}</span>
                  </div>
                  <div className="flex-1 bg-muted rounded-full h-8 overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all duration-700 ease-out", m.bg)}
                      style={{ width: `${Math.max(pct, stage.count > 0 ? 6 : 0)}%` }} />
                  </div>
                  <div className="w-20 shrink-0 text-right">
                    <span className="text-base font-bold tabular-nums">{stage.count}</span>
                    <span className="text-[11px] text-muted-foreground ml-1">
                      ({total > 0 ? Math.round((stage.count / total) * 100) : 0}%)
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {counts.rejected > 0 && (
          <div className="mt-5 pt-4 border-t flex items-center gap-3 text-sm">
            <span className="text-base">❌</span>
            <span className="text-muted-foreground">
              <strong className="text-foreground font-semibold">{counts.rejected}</strong> {t(`candidature.status.rejected`).toLowerCase()}
            </span>
            <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", STATUS_META.rejected.badge)}>
              {Math.round((counts.rejected / total) * 100)}% {t("candidature.ofTotal")}
            </span>
          </div>
        )}
      </div>

      {/* Monthly chart */}
      {monthlyData.length > 0 && (
        <div className="bg-background rounded-2xl border p-5">
          <h3 className="text-sm font-semibold mb-5 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" /> {t("candidature.overTime")}
          </h3>
          <div className="flex items-end gap-2" style={{ height: 120 }}>
            {monthlyData.map(({ month, count }) => {
              const barH = Math.max(Math.round((count / maxMonthly) * 100), 4);
              return (
                <div key={month} className="flex-1 flex flex-col items-center gap-1 min-w-0 group">
                  <span className="text-xs font-bold text-foreground tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">{count}</span>
                  <div className="w-full relative" style={{ height: `${barH}%` }}>
                    <div className="w-full h-full bg-primary/20 hover:bg-primary/40 rounded-t-md transition-colors cursor-default" />
                    {monthlyData.length <= 6 && (
                      <span className="absolute -top-5 left-0 right-0 text-center text-xs font-semibold tabular-nums">{count}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground truncate w-full text-center leading-tight">{formatMonth(month)}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3 text-right">
            {t("candidature.avgPerMonth", { avg: (total / Math.max(monthlyData.length, 1)).toFixed(1) })}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── KPI card ─────────────────────────────────────────────────────────── */
function KpiCard({ emoji, label, value, sub, valueColor }: {
  emoji: string; label: string; value: string | number; sub: string; valueColor: string;
}) {
  return (
    <div className="bg-background rounded-2xl border p-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg leading-none">{emoji}</span>
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <p className={cn("text-2xl font-bold tabular-nums leading-none mb-1", valueColor)}>{value}</p>
      <p className="text-[11px] text-muted-foreground leading-tight">{sub}</p>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────────── */
function groupByMonth(apps: Application[]): { month: string; count: number }[] {
  const map = new Map<string, number>();
  apps.forEach((app) => {
    const d = new Date(app.appliedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));
}

function formatMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString("it-IT", { month: "short", year: "2-digit" });
}
