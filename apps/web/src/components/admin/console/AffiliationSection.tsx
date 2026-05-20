import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Eye, Handshake, RefreshCw, Save, Search, Shield } from "lucide-react";
import type { AffiliationInboxResponse, AffiliationLeadItem } from "./types";
import { assigneeLabel, fmtShortDate } from "./utils";

const LEAD_STATUS_UI: Record<AffiliationLeadItem["status"], { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-primary/10 text-primary border-primary/30" },
  contacted: { label: "Contattato", className: "bg-amber-100 text-amber-800 border-amber-200" },
  converted: { label: "Convertito", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  rejected: { label: "Rifiutato", className: "bg-red-100 text-red-800 border-red-200" },
};

function leadStatusBadge(status: AffiliationLeadItem["status"]) {
  const cfg = LEAD_STATUS_UI[status] ?? LEAD_STATUS_UI.pending;
  return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
}

type AffiliationSectionProps = {
  data: AffiliationInboxResponse | null;
  loading: boolean;
  search: string;
  readFilter: string;
  statusFilter: string;
  sourceFilter: string;
  assignedToFilter: string;
  selectedLead: AffiliationLeadItem | null;
  notes: string;
  actionLoading: string | null;
  currentUserId?: number | null;
  onSearchChange: (value: string) => void;
  onReadFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onSourceFilterChange: (value: string) => void;
  onAssignedToFilterChange: (value: string) => void;
  onSelectLead: (lead: AffiliationLeadItem) => void;
  onNotesChange: (value: string) => void;
  onRefresh: () => void;
  onUpdateLead: (
    id: number,
    path: "read" | "status" | "notes" | "assign",
    body: Record<string, unknown>,
  ) => void;
};

export function AffiliationSection({
  data,
  loading,
  search,
  readFilter,
  statusFilter,
  sourceFilter,
  assignedToFilter,
  selectedLead,
  notes,
  actionLoading,
  currentUserId,
  onSearchChange,
  onReadFilterChange,
  onStatusFilterChange,
  onSourceFilterChange,
  onAssignedToFilterChange,
  onSelectLead,
  onNotesChange,
  onRefresh,
  onUpdateLead,
}: AffiliationSectionProps) {
  return (
    <div className="p-4 md:p-8 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-serif font-bold">
            <Handshake className="w-5 h-5 inline mr-2 text-primary" />
            Partner & Affiliazioni
          </h3>
          <p className="text-sm text-muted-foreground">Gestione lead da scuole, aziende, partner e contatti istituzionali.</p>
        </div>
        <Button size="sm" variant="outline" onClick={onRefresh} disabled={loading} className="min-h-11">
          {loading ? <RefreshCw size={13} className="animate-spin mr-1" /> : <RefreshCw size={13} className="mr-1" />}
          Aggiorna
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          ["Totali", data?.stats?.total ?? 0],
          ["Non letti", data?.stats?.unread ?? 0],
          ["Pending", data?.stats?.pending ?? 0],
          ["Contattati", data?.stats?.contacted ?? 0],
          ["Convertiti", data?.stats?.converted ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border bg-card p-3">
            <p className="text-lg font-bold">{String(value)}</p>
            <p className="text-xs text-muted-foreground">{String(label)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_140px_150px_160px_190px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 min-h-11"
            placeholder="Cerca nome, email, tipo o messaggio..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onRefresh();
            }}
          />
        </div>
        <select className="min-h-11 rounded-md border bg-background px-3 text-sm" value={readFilter} onChange={(event) => onReadFilterChange(event.target.value)}>
          <option value="all">Tutti</option>
          <option value="unread">Non letti</option>
          <option value="read">Letti</option>
        </select>
        <select className="min-h-11 rounded-md border bg-background px-3 text-sm" value={statusFilter} onChange={(event) => onStatusFilterChange(event.target.value)}>
          <option value="all">Tutti gli stati</option>
          {Object.entries(LEAD_STATUS_UI).map(([value, cfg]) => <option key={value} value={value}>{cfg.label}</option>)}
        </select>
        <select className="min-h-11 rounded-md border bg-background px-3 text-sm" value={sourceFilter} onChange={(event) => onSourceFilterChange(event.target.value)}>
          <option value="all">Tutti i tipi</option>
          {data?.sources?.map((row) => <option key={row.source} value={row.source}>{row.source.replace(/_/g, " ")}</option>)}
        </select>
        <select className="min-h-11 rounded-md border bg-background px-3 text-sm" value={assignedToFilter} onChange={(event) => onAssignedToFilterChange(event.target.value)}>
          <option value="all">Tutti gli admin</option>
          <option value="unassigned">Non assegnati</option>
          {data?.assignees?.map((admin) => <option key={admin.id} value={admin.id}>{admin.name || admin.email}</option>)}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      ) : data?.items ? (
        <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,1.1fr)] gap-4">
          <div className="space-y-2 min-w-0">
            {data.items.map((lead) => (
              <button
                key={lead.id}
                type="button"
                onClick={() => onSelectLead(lead)}
                className={cn(
                  "w-full min-h-11 text-left p-4 rounded-lg border bg-card hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  selectedLead?.id === lead.id && "border-primary/50 bg-primary/5",
                  !lead.read && "border-primary/30",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{lead.institutionName}</p>
                    <p className="text-xs text-muted-foreground truncate">{lead.contactName} · {lead.email}</p>
                  </div>
                  <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                    {!lead.read && <Badge className="bg-primary text-primary-foreground">Nuovo</Badge>}
                    {leadStatusBadge(lead.status)}
                  </div>
                </div>
                {lead.message && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{lead.message}</p>}
                <p className="text-xs text-muted-foreground mt-2">{fmtShortDate(lead.createdAt)} · {lead.partnerType.replace(/_/g, " ")} · {assigneeLabel(data.assignees, lead.assignedTo)}</p>
              </button>
            ))}
            {data.items.length === 0 && <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">Nessun lead trovato.</div>}
          </div>

          <div className="rounded-lg border bg-card min-w-0">
            {selectedLead ? (
              <div className="p-4 md:p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="font-semibold truncate">{selectedLead.institutionName}</h4>
                    <p className="text-sm text-muted-foreground">{selectedLead.contactName} · {selectedLead.email}</p>
                  </div>
                  {leadStatusBadge(selectedLead.status)}
                </div>
                <div className="rounded-lg border bg-background p-4">
                  <p className="text-xs text-muted-foreground mb-1">Messaggio originale</p>
                  <p className="text-sm whitespace-pre-wrap">{selectedLead.message || "Nessun messaggio."}</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <select className="min-h-11 rounded-md border bg-background px-3 text-sm" value={selectedLead.status} onChange={(event) => onUpdateLead(selectedLead.id, "status", { status: event.target.value })}>
                    {Object.entries(LEAD_STATUS_UI).map(([value, cfg]) => <option key={value} value={value}>{cfg.label}</option>)}
                  </select>
                  <select className="min-h-11 rounded-md border bg-background px-3 text-sm" value={selectedLead.assignedTo ?? ""} onChange={(event) => onUpdateLead(selectedLead.id, "assign", { assignedTo: event.target.value || null })}>
                    <option value="">Non assegnato</option>
                    {data.assignees.map((admin) => <option key={admin.id} value={admin.id}>{admin.name || admin.email}</option>)}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="min-h-11" disabled={!!actionLoading} onClick={() => onUpdateLead(selectedLead.id, "read", { read: !selectedLead.read })}>
                    <Eye className="w-4 h-4 mr-2" /> {selectedLead.read ? "Segna non letto" : "Segna letto"}
                  </Button>
                  {currentUserId ? (
                    <Button variant="outline" className="min-h-11" disabled={!!actionLoading} onClick={() => onUpdateLead(selectedLead.id, "assign", { assignedTo: currentUserId })}>
                      <Shield className="w-4 h-4 mr-2" /> Assegna a me
                    </Button>
                  ) : null}
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">Note interne</p>
                  <Textarea value={notes} onChange={(event) => onNotesChange(event.target.value)} placeholder="Prossimo contatto, contesto partner, priorità..." />
                  <Button className="mt-2 min-h-11" disabled={!!actionLoading} onClick={() => onUpdateLead(selectedLead.id, "notes", { internalNotes: notes })}>
                    <Save className="w-4 h-4 mr-2" /> Salva note
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">Seleziona un lead per gestirlo.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Nessun dato disponibile.</p>
          <Button variant="outline" className="mt-3 min-h-11" onClick={onRefresh}>Riprova</Button>
        </div>
      )}
    </div>
  );
}
