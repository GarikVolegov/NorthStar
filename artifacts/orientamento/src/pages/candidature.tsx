import { useState } from "react";
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
  Link2, Star, Calendar, AlertCircle,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL || "/";

type AppStatus = "saved" | "applied" | "interview" | "offer" | "rejected";

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

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

export default function Candidature() {
  const { user, isLoggedIn } = useAuth();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editApp, setEditApp] = useState<Application | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);

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
      setFormError("Azienda e ruolo sono obbligatori");
      return;
    }
    if (editApp) {
      updateMutation.mutate({ id: editApp.id, updates: form }, {
        onSuccess: () => { setEditApp(null); setForm(EMPTY_FORM); setFormError(null); },
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

  function openAdd() {
    setEditApp(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setAddOpen(true);
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <Star className="w-12 h-12 text-primary/30 mb-4" />
        <h2 className="text-xl font-semibold mb-2">Accedi per vedere le tue candidature</h2>
        <p className="text-muted-foreground mb-6 max-w-sm">Tieni traccia di tutte le tue candidature in un unico posto.</p>
        <Button asChild><Link href="/">Vai alla home</Link></Button>
      </div>
    );
  }

  const total = applications.length;
  const byStatus = COLUMNS.reduce((acc, s) => ({ ...acc, [s]: applications.filter((a) => a.status === s) }), {} as Record<AppStatus, Application[]>);

  return (
    <div className="min-h-screen bg-muted/30">
      {/* ── Page header ── */}
      <div className="bg-background border-b">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-8 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-serif font-bold text-foreground">Le mie Candidature</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {total === 0 ? "Nessuna candidatura ancora" : `${total} candidatur${total === 1 ? "a" : "e"} totali`}
              </p>
            </div>
            <Button onClick={openAdd} className="rounded-full gap-2 shrink-0">
              <Plus className="w-4 h-4" /> Aggiungi
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
                    {m.emoji} {m.label}: {count}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Kanban board ── */}
      <div className="max-w-screen-2xl mx-auto px-4 md:px-8 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
          </div>
        ) : total === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Briefcase className="w-8 h-8 text-primary/60" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Inizia a tracciare le tue candidature</h2>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Aggiungi le offerte di lavoro che ti interessano e monitora ogni passaggio del processo selettivo.
            </p>
            <Button onClick={openAdd} className="rounded-full gap-2">
              <Plus className="w-4 h-4" /> Aggiungi la prima candidatura
            </Button>
          </div>
        ) : (
          /* Kanban columns */
          <div className="flex gap-4 overflow-x-auto pb-6 -mx-4 md:-mx-8 px-4 md:px-8">
            {COLUMNS.map((status) => {
              const meta = STATUS_META[status];
              const cards = byStatus[status];
              return (
                <div key={status} className="flex-shrink-0 w-[300px] md:w-[280px] xl:w-[300px] flex flex-col">
                  {/* Column header */}
                  <div className={cn("flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3", meta.bg)}>
                    <span className="text-base">{meta.emoji}</span>
                    <span className={cn("text-sm font-semibold flex-1", meta.color)}>{meta.label}</span>
                    <Badge variant="outline" className={cn("text-xs h-5 px-1.5 font-semibold", meta.badge)}>
                      {cards.length}
                    </Badge>
                  </div>

                  {/* Cards */}
                  <div className="space-y-2.5 flex-1">
                    {cards.length === 0 ? (
                      <div className="border-2 border-dashed border-border rounded-xl p-5 text-center">
                        <p className="text-xs text-muted-foreground">Nessuna candidatura</p>
                      </div>
                    ) : (
                      cards.map((app) => (
                        <AppCard
                          key={app.id}
                          app={app}
                          onEdit={() => openEdit(app)}
                          onDelete={() => deleteMutation.mutate(app.id)}
                          onStatusChange={(s) => updateMutation.mutate({ id: app.id, updates: { status: s } })}
                          deleting={deleteMutation.isPending && deleteMutation.variables === app.id}
                        />
                      ))
                    )}

                    {/* Add to this column */}
                    <button
                      onClick={() => { setForm({ ...EMPTY_FORM, status }); setEditApp(null); setFormError(null); setAddOpen(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 border border-dashed border-border transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Aggiungi a {meta.label.toLowerCase()}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add / Edit dialog ── */}
      <Dialog open={addOpen} onOpenChange={(open) => { if (!open) { setAddOpen(false); setEditApp(null); setFormError(null); } else setAddOpen(true); }}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editApp ? "Modifica candidatura" : "Nuova candidatura"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Company + Role */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" /> Azienda *
                </Label>
                <Input
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  placeholder="es. Google Italia"
                  className="h-9 rounded-xl text-sm"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-muted-foreground" /> Ruolo *
                </Label>
                <Input
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  placeholder="es. UX Designer"
                  className="h-9 rounded-xl text-sm"
                />
              </div>
            </div>

            {/* URL */}
            <div>
              <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-muted-foreground" /> Link offerta <span className="font-normal text-muted-foreground">(opzionale)</span>
              </Label>
              <Input
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                placeholder="https://..."
                className="h-9 rounded-xl text-sm"
                type="url"
              />
            </div>

            {/* Status + Location */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold mb-1.5 block">Stato</Label>
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as AppStatus }))}
                  className="w-full h-9 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {COLUMNS.map((s) => (
                    <option key={s} value={s}>{STATUS_META[s].emoji} {STATUS_META[s].label}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" /> Sede
                </Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="es. Milano / Remote"
                  className="h-9 rounded-xl text-sm"
                />
              </div>
            </div>

            {/* Salary */}
            <div>
              <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-muted-foreground" /> RAL / Stipendio <span className="font-normal text-muted-foreground">(opzionale)</span>
              </Label>
              <Input
                value={form.salary}
                onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))}
                placeholder="es. 45.000 € / 3.500 € mese"
                className="h-9 rounded-xl text-sm"
              />
            </div>

            {/* Notes */}
            <div>
              <Label className="text-xs font-semibold mb-1.5 block flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-muted-foreground" /> Note <span className="font-normal text-muted-foreground">(opzionale)</span>
              </Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Contatti, colloqui passati, impressioni, dettagli importanti..."
                className="min-h-[80px] rounded-xl text-sm resize-none"
              />
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
              Annulla
            </Button>
            <Button
              className="rounded-xl gap-2"
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
              {editApp ? "Salva modifiche" : "Aggiungi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Application card ─────────────────────────────────────────────────── */
function AppCard({
  app, onEdit, onDelete, onStatusChange, deleting,
}: {
  app: Application;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (s: AppStatus) => void;
  deleting: boolean;
}) {
  const meta = STATUS_META[app.status];
  const otherStatuses = COLUMNS.filter((s) => s !== app.status);

  return (
    <div
      className={cn(
        "bg-background rounded-xl border border-l-4 p-3 shadow-sm hover:shadow-md transition-all cursor-pointer group",
        meta.border,
      )}
      onClick={onEdit}
    >
      {/* Company + Delete */}
      <div className="flex items-start gap-1.5 mb-1">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-foreground leading-tight truncate">{app.company}</p>
          <p className="text-xs text-muted-foreground truncate">{app.role}</p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all shrink-0 -mt-0.5 -mr-0.5"
          disabled={deleting}
        >
          {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
        </button>
      </div>

      {/* Badges row */}
      <div className="flex flex-wrap gap-1.5 mt-2">
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

      {/* Notes preview */}
      {app.notes && (
        <p className="text-[11px] text-muted-foreground italic mt-1.5 line-clamp-2">{app.notes}</p>
      )}

      {/* Footer: date + url + status pill */}
      <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-border/50">
        <span className="text-[11px] text-muted-foreground flex items-center gap-1 mr-auto">
          <Calendar className="w-2.5 h-2.5" />{formatDate(app.appliedAt)}
        </span>

        {app.url && (
          <a
            href={app.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
            title="Apri offerta"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        )}

        {/* Status dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1 hover:opacity-80 transition-opacity", meta.badge)}
            >
              {meta.emoji} {meta.label} <ChevronDown className="w-2.5 h-2.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {otherStatuses.map((s) => {
              const m = STATUS_META[s];
              return (
                <DropdownMenuItem
                  key={s}
                  onClick={(e) => { e.stopPropagation(); onStatusChange(s); }}
                  className="text-xs gap-2 cursor-pointer"
                >
                  <span>{m.emoji}</span> Sposta in {m.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
