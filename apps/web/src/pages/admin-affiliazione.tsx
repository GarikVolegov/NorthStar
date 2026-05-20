import { AdminAuthGate } from "@/components/AdminAuthGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";
import {
  Building2,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Circle,
  ExternalLink,
  Eye,
  Filter,
  Handshake,
  Loader2,
  LogOut,
  Mail,
  Phone,
  RefreshCw,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL || "/";

const PARTNER_LABELS: Record<string, string> = {
  scuola_media: "Scuola media",
  scuola_superiore: "Scuola superiore",
  universita: "UniversitÃ ",
  agenzia_lavoro: "Agenzia per il lavoro",
  centro_formazione: "Centro di formazione",
  ente_pubblico: "Ente pubblico",
  orientatore: "Orientatore / Consulente",
  altro: "Altro",
};

const PARTNER_COLORS: Record<string, string> = {
  scuola_media: "bg-blue-100 text-blue-700",
  scuola_superiore: "bg-emerald-100 text-emerald-700",
  universita: "bg-violet-100 text-violet-700",
  agenzia_lavoro: "bg-orange-100 text-orange-700",
  centro_formazione: "bg-rose-100 text-rose-700",
  ente_pubblico: "bg-teal-100 text-teal-700",
  orientatore: "bg-amber-100 text-amber-700",
  altro: "bg-slate-100 text-slate-700",
};

const STATUS_LABELS: Record<string, string> = {
  nuovo: "Nuovo",
  contattato: "Contattato",
  in_trattativa: "In trattativa",
  attivo: "Attivo",
};

const STATUS_COLORS: Record<string, string> = {
  nuovo: "bg-primary/10 text-primary border-primary/30",
  contattato: "bg-yellow-100 text-yellow-700 border-yellow-200",
  in_trattativa: "bg-orange-100 text-orange-700 border-orange-200",
  attivo: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

type Lead = {
  id: number;
  institutionName: string;
  partnerType: string;
  contactName: string;
  email: string;
  phone: string | null;
  message: string | null;
  estimatedUsers: string | null;
  status: string;
  read: boolean;
  createdAt: string;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("it-IT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminAffiliazione() {
  useEffect(() => {
    document.title = "Admin Affiliazione â€” NorthStar";
  }, []);

  const { key, logout } = useAdminAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  const fetchLeads = useCallback(async (adminKey: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await apiFetch(`${BASE}api/affiliazione/leads`, {
        headers: { Authorization: `Bearer ${adminKey}` },
      });
      if (!res.ok) throw new Error("Errore caricamento");
      const data: Lead[] = await res.json();
      setLeads(data);
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (key) fetchLeads(key);
  }, [key, fetchLeads]);

  const [updatingStatus, setUpdatingStatus] = useState<number | null>(null);

  async function markContacted(id: number) {
    const res = await apiFetch(`${BASE}api/affiliazione/leads/${id}/read`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.ok) {
      const updated: Lead = await res.json();
      setLeads((prev) =>
        prev.map((l) =>
          l.id === id ? { ...l, read: true, status: updated.status } : l,
        ),
      );
    }
  }

  async function updateStatus(id: number, status: string) {
    setUpdatingStatus(id);
    try {
      const res = await apiFetch(`${BASE}api/affiliazione/leads/${id}/status`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const updated: Lead = await res.json();
        setLeads((prev) =>
          prev.map((l) =>
            l.id === id
              ? { ...l, status: updated.status, read: updated.read }
              : l,
          ),
        );
      }
    } finally {
      setUpdatingStatus(null);
    }
  }

  const typeCounts = Object.keys(PARTNER_LABELS).reduce<Record<string, number>>(
    (acc, k) => {
      acc[k] = leads.filter((l) => l.partnerType === k).length;
      return acc;
    },
    {},
  );

  const filtered = leads.filter((l) => {
    if (filterType !== "all" && l.partnerType !== filterType) return false;
    if (filterStatus !== "all" && l.status !== filterStatus) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      if (
        !l.institutionName.toLowerCase().includes(s) &&
        !l.contactName.toLowerCase().includes(s) &&
        !l.email.toLowerCase().includes(s)
      )
        return false;
    }
    return true;
  });

  const newCount = leads.filter((l) => !l.read).length;
  const activeCount = leads.filter((l) => l.status === "attivo").length;

  // â”€â”€ Main panel â”€â”€
  return (
    <AdminAuthGate
      title="Admin Affiliazione"
      description="Gestisci le richieste di affiliazione"
    >
      <div className="min-h-screen bg-slate-50/50">
        {/* Top bar */}
        <div className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur">
          <div className="container mx-auto px-4 max-w-5xl flex h-14 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Handshake className="w-4 h-4 text-primary" />
              </div>
              <span className="font-serif font-bold">
                Admin Â· Affiliazione
              </span>
              {newCount > 0 && (
                <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                  {newCount} nuovi
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full gap-1.5"
                onClick={() => fetchLeads(key)}
                disabled={loading}
              >
                <RefreshCw
                  className={cn("w-3.5 h-3.5", loading && "animate-spin")}
                />
                Aggiorna
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full gap-1.5 text-muted-foreground"
                onClick={logout}
              >
                <LogOut className="w-3.5 h-3.5" />
                Esci
              </Button>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 max-w-5xl py-8 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Totali",
                value: leads.length,
                color: "text-foreground",
              },
              { label: "Nuovi", value: newCount, color: "text-primary" },
              {
                label: "Attivi",
                value: activeCount,
                color: "text-emerald-600",
              },
              {
                label: "Mostrati",
                value: filtered.length,
                color: "text-muted-foreground",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border bg-card p-4 text-center"
              >
                <p className={cn("text-2xl font-bold font-serif", s.color)}>
                  {s.value}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="rounded-2xl border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
              <Filter className="w-4 h-4" /> Filtri
            </div>

            {/* Type filter */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilterType("all")}
                className={cn(
                  "px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors",
                  filterType === "all"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/40",
                )}
              >
                Tutti ({leads.length})
              </button>
              {Object.entries(PARTNER_LABELS).map(
                ([k, label]) =>
                  (typeCounts[k] ?? 0) > 0 && (
                    <button
                      key={k}
                      onClick={() => setFilterType(k)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors",
                        filterType === k
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/40",
                      )}
                    >
                      {label} ({typeCounts[k] ?? 0})
                    </button>
                  ),
              )}
            </div>

            {/* Status + search */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t">
              {(
                [
                  "all",
                  "nuovo",
                  "contattato",
                  "in_trattativa",
                  "attivo",
                ] as const
              ).map((v) => (
                <button
                  key={v}
                  onClick={() => setFilterStatus(v)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors",
                    filterStatus === v
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40",
                  )}
                >
                  {v === "all" ? "Tutti gli stati" : STATUS_LABELS[v]}
                </button>
              ))}
              <div className="ml-auto">
                <Input
                  placeholder="Cerca istituzione, referente, emailâ€¦"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 text-xs rounded-xl w-56"
                />
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          {/* Leads list */}
          {loading && leads.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 opacity-40" />
              Caricamento leadâ€¦
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Handshake className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Nessun lead trovato</p>
              <p className="text-sm mt-1">Prova a cambiare i filtri</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((lead) => (
                <div
                  key={lead.id}
                  className={cn(
                    "rounded-2xl border bg-card overflow-hidden transition-all",
                    !lead.read && "border-primary/30 shadow-sm",
                  )}
                >
                  {/* Lead header */}
                  <div className="flex items-start gap-3 p-4">
                    <div className="pt-1 shrink-0">
                      {lead.read ? (
                        <Circle className="w-3 h-3 text-muted-foreground/30 fill-muted-foreground/10" />
                      ) : (
                        <Circle className="w-3 h-3 text-primary fill-primary" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">
                          {lead.institutionName}
                        </span>
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            PARTNER_COLORS[lead.partnerType] ??
                              PARTNER_COLORS["altro"],
                          )}
                        >
                          {PARTNER_LABELS[lead.partnerType] ?? lead.partnerType}
                        </span>
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full border font-medium",
                            STATUS_COLORS[lead.status] ??
                              STATUS_COLORS["nuovo"],
                          )}
                        >
                          {STATUS_LABELS[lead.status] ?? lead.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3" /> {lead.contactName}
                        </span>
                        <a
                          href={`mailto:${lead.email}`}
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <Mail className="w-3 h-3" /> {lead.email}
                        </a>
                        {lead.phone && (
                          <a
                            href={`tel:${lead.phone}`}
                            className="flex items-center gap-1 hover:text-foreground"
                          >
                            <Phone className="w-3 h-3" /> {lead.phone}
                          </a>
                        )}
                        {lead.estimatedUsers && (
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3" /> {lead.estimatedUsers}{" "}
                            utenti
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground/60 mt-1">
                        {fmtDate(lead.createdAt)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {!lead.read && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 rounded-full text-xs gap-1.5"
                          onClick={() => markContacted(lead.id)}
                        >
                          <CheckCheck className="w-3.5 h-3.5" /> Segna
                          contattato
                        </Button>
                      )}
                      <button
                        onClick={() =>
                          setExpanded(expanded === lead.id ? null : lead.id)
                        }
                        className="w-8 h-8 rounded-xl border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                      >
                        {expanded === lead.id ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded body */}
                  {expanded === lead.id && (
                    <div className="border-t bg-muted/30 px-5 py-4 space-y-4">
                      {/* Details grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="p-3 rounded-xl bg-background border">
                          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <Building2 className="w-3 h-3" /> Tipo partner
                          </p>
                          <p className="text-sm font-medium">
                            {PARTNER_LABELS[lead.partnerType] ??
                              lead.partnerType}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-background border">
                          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                            <Users className="w-3 h-3" /> Utenti stimati
                          </p>
                          <p className="text-sm font-medium">
                            {lead.estimatedUsers ?? "Non specificato"}
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-background border">
                          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                            {updatingStatus === lead.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : null}
                            Stato pipeline
                          </p>
                          <select
                            value={lead.status}
                            disabled={updatingStatus === lead.id}
                            onChange={(e) =>
                              updateStatus(lead.id, e.target.value)
                            }
                            className={cn(
                              "w-full text-sm font-medium rounded-lg border px-2 py-1.5 bg-background",
                              "focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all",
                              "disabled:opacity-50 disabled:cursor-not-allowed",
                              STATUS_COLORS[lead.status] ??
                                STATUS_COLORS["nuovo"],
                            )}
                          >
                            {Object.entries(STATUS_LABELS).map(
                              ([val, label]) => (
                                <option
                                  key={val}
                                  value={val}
                                  className="bg-background text-foreground"
                                >
                                  {label}
                                </option>
                              ),
                            )}
                          </select>
                        </div>
                      </div>

                      {/* Message */}
                      {lead.message && (
                        <div>
                          <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                            <Eye className="w-3.5 h-3.5" /> Messaggio
                          </p>
                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-background border rounded-xl p-3">
                            {lead.message}
                          </p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="pt-3 border-t flex flex-wrap items-center gap-3">
                        <a
                          href={`mailto:${lead.email}?subject=Partnership NorthStar â€” ${lead.institutionName}`}
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          Rispondi via email
                        </a>
                        {lead.phone && (
                          <a
                            href={`tel:${lead.phone}`}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            Chiama
                          </a>
                        )}
                        <a
                          href={`/affiliazione`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          Pagina affiliazione
                        </a>
                        {!lead.read && (
                          <button
                            onClick={() => markContacted(lead.id)}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:underline ml-auto"
                          >
                            <CheckCheck className="w-3.5 h-3.5" />
                            Segna come contattato
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminAuthGate>
  );
}
