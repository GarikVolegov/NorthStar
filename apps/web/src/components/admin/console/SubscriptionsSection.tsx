import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  CalendarClock,
  CreditCard,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
} from "lucide-react";
import type {
  AdminSubscriptionDetail,
  AdminSubscriptionItem,
  AdminSubscriptionPlan,
  AdminSubscriptionsResponse,
} from "./types";
import { fmtShortDate } from "./utils";

const PLAN_UI: Record<
  AdminSubscriptionPlan,
  { label: string; className: string }
> = {
  free: {
    label: "Free",
    className: "bg-muted text-muted-foreground border-muted-border",
  },
  pro: {
    label: "Pro",
    className: "bg-primary/10 text-primary border-primary/30",
  },
  team: {
    label: "Team",
    className: "bg-success-surface text-success border-success-muted",
  },
};

const STATUS_UI = {
  free: {
    label: "Free",
    className: "bg-muted text-muted-foreground border-muted-border",
  },
  active: {
    label: "Attivo",
    className: "bg-success-surface text-success border-success-muted",
  },
  expired: {
    label: "Scaduto",
    className: "bg-warning-surface text-warning border-warning-muted",
  },
  cancelled: {
    label: "Annullato",
    className: "bg-danger-surface text-danger border-danger-muted",
  },
};

function planBadge(plan: AdminSubscriptionPlan) {
  const cfg = PLAN_UI[plan] ?? PLAN_UI.free;
  return (
    <Badge variant="outline" className={cfg.className}>
      {cfg.label}
    </Badge>
  );
}

function statusBadge(status: keyof typeof STATUS_UI) {
  const cfg = STATUS_UI[status] ?? STATUS_UI.free;
  return (
    <Badge variant="outline" className={cfg.className}>
      {cfg.label}
    </Badge>
  );
}

function sourceBadge(item: AdminSubscriptionItem["current"]) {
  if (item.hasStripeSubscription) {
    return (
      <Badge
        variant="outline"
        className="border-info-muted bg-info-surface text-info"
      >
        Stripe collegato
      </Badge>
    );
  }
  if (item.source === "internal") {
    return (
      <Badge
        variant="outline"
        className="border-info-muted bg-info-surface text-info"
      >
        Override interno
      </Badge>
    );
  }
  return null;
}

type SubscriptionForm = {
  plan: AdminSubscriptionPlan;
  validUntil: string;
  reason: string;
};

type SubscriptionsSectionProps = {
  data: AdminSubscriptionsResponse | null;
  detail: AdminSubscriptionDetail | null;
  loading: boolean;
  detailLoading: boolean;
  actionLoading: boolean;
  search: string;
  planFilter: string;
  statusFilter: string;
  form: SubscriptionForm;
  fields: Record<string, string>;
  onSearchChange: (value: string) => void;
  onPlanFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onFormChange: (form: SubscriptionForm) => void;
  onRefresh: () => void;
  onSelectUser: (item: AdminSubscriptionItem) => void;
  onSave: () => void;
};

export function SubscriptionsSection({
  data,
  detail,
  loading,
  detailLoading,
  actionLoading,
  search,
  planFilter,
  statusFilter,
  form,
  fields,
  onSearchChange,
  onPlanFilterChange,
  onStatusFilterChange,
  onFormChange,
  onRefresh,
  onSelectUser,
  onSave,
}: SubscriptionsSectionProps) {
  return (
    <div className="p-4 md:p-8 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-serif font-bold">
            <CreditCard className="w-5 h-5 inline mr-2 text-primary" />
            Abbonamenti utenti
          </h3>
          <p className="text-sm text-muted-foreground">
            Controlla e modifica gli accessi interni NorthStar senza toccare
            Stripe.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onRefresh}
          disabled={loading}
          className="min-h-11"
        >
          {loading ? (
            <RefreshCw size={13} className="animate-spin mr-1" />
          ) : (
            <RefreshCw size={13} className="mr-1" />
          )}
          Aggiorna
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ["Utenti", data?.stats?.total ?? data?.total ?? 0],
          ["Free", data?.stats?.free ?? 0],
          ["Pro", data?.stats?.pro ?? 0],
          ["Team", data?.stats?.team ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border bg-card p-3">
            <p className="text-lg font-bold">{String(value)}</p>
            <p className="text-xs text-muted-foreground">{String(label)}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_150px_170px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 min-h-11"
            placeholder="Cerca nome o email..."
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") onRefresh();
            }}
          />
        </div>
        <select
          className="min-h-11 rounded-md border bg-background px-3 text-sm"
          value={planFilter}
          onChange={(event) => onPlanFilterChange(event.target.value)}
        >
          <option value="all">Tutti i piani</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="team">Team</option>
        </select>
        <select
          className="min-h-11 rounded-md border bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(event) => onStatusFilterChange(event.target.value)}
        >
          <option value="all">Tutti gli stati</option>
          <option value="active">Attivi</option>
          <option value="expired">Scaduti</option>
          <option value="cancelled">Annullati</option>
          <option value="free">Senza piano</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Caricamento...</p>
      ) : data?.items ? (
        <div className="grid lg:grid-cols-[minmax(0,0.95fr)_minmax(380px,1.05fr)] gap-4">
          <div className="space-y-2 min-w-0">
            {data.items.map((item) => (
              <button
                key={item.user.id}
                type="button"
                onClick={() => onSelectUser(item)}
                className={cn(
                  "w-full min-h-11 text-left p-4 rounded-lg border bg-card hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  detail?.user.id === item.user.id &&
                    "border-primary/50 bg-primary/5",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">
                      {item.user.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.user.email}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                    {planBadge(item.current.plan)}
                    {statusBadge(item.current.status)}
                  </div>
                </div>
                <div className="mt-2 flex gap-2 flex-wrap">
                  {sourceBadge(item.current)}
                  {item.current.validUntil && (
                    <Badge variant="outline" className="bg-background">
                      Scade {fmtShortDate(item.current.validUntil)}
                    </Badge>
                  )}
                </div>
              </button>
            ))}
            {data.items.length === 0 && (
              <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
                Nessun utente trovato.
              </div>
            )}
          </div>

          <div className="rounded-lg border bg-card min-w-0">
            {detailLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Caricamento dettaglio...
              </div>
            ) : detail ? (
              <div className="p-4 md:p-5 space-y-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="font-semibold truncate">
                      {detail.user.name}
                    </h4>
                    <p className="text-sm text-muted-foreground truncate">
                      {detail.user.email}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Utente #{detail.user.id}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap justify-end">
                    {planBadge(detail.current.plan)}
                    {statusBadge(detail.current.status)}
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <span className="font-medium">
                      Modifica interna NorthStar
                    </span>
                    {sourceBadge(detail.current)}
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    Questa modifica cambia l’accesso nell’app, ma non aggiorna
                    Stripe né la fatturazione reale.
                  </p>
                  {detail.current.stripeSubscriptionId && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Stripe subscription:{" "}
                      <span className="font-mono">
                        {detail.current.stripeSubscriptionId}
                      </span>
                    </p>
                  )}
                </div>

                {fields.general && (
                  <div className="rounded-lg border border-danger-muted bg-danger-surface p-3 text-sm text-danger">
                    {fields.general}
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs font-medium mb-1">Piano</p>
                    <select
                      className="w-full min-h-11 rounded-md border bg-background px-3 text-sm"
                      value={form.plan}
                      onChange={(event) =>
                        onFormChange({
                          ...form,
                          plan: event.target.value as AdminSubscriptionPlan,
                        })
                      }
                    >
                      <option value="free">Free</option>
                      <option value="pro">Pro</option>
                      <option value="team">Team</option>
                    </select>
                    {fields.plan && (
                      <p className="text-xs text-danger mt-1">{fields.plan}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-1">
                      Scadenza opzionale
                    </p>
                    <Input
                      type="date"
                      className="min-h-11"
                      value={form.validUntil}
                      onChange={(event) =>
                        onFormChange({
                          ...form,
                          validUntil: event.target.value,
                        })
                      }
                      disabled={form.plan === "free"}
                    />
                    {fields.validUntil && (
                      <p className="text-xs text-danger mt-1">
                        {fields.validUntil}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium mb-1">Motivo modifica</p>
                  <Textarea
                    value={form.reason}
                    onChange={(event) =>
                      onFormChange({ ...form, reason: event.target.value })
                    }
                    placeholder="Es. concessione manuale, supporto, correzione piano..."
                  />
                  {fields.reason && (
                    <p className="text-xs text-danger mt-1">{fields.reason}</p>
                  )}
                </div>

                <Button
                  onClick={onSave}
                  disabled={actionLoading}
                  className="min-h-11"
                >
                  {actionLoading ? (
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Salva abbonamento
                </Button>

                <div>
                  <p className="text-sm font-medium mb-2">
                    <CalendarClock className="w-4 h-4 inline mr-1 text-muted-foreground" />
                    Storico
                  </p>
                  <div className="space-y-2">
                    {detail.history.length ? (
                      detail.history.map((row) => (
                        <div
                          key={row.id}
                          className="rounded-lg border bg-background p-3 text-sm"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex gap-2 flex-wrap">
                              {planBadge(row.effectivePlan)}
                              {statusBadge(row.status)}
                              {row.hasStripeSubscription && (
                                <Badge
                                  variant="outline"
                                  className="border-info-muted bg-info-surface text-info"
                                >
                                  Stripe
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {fmtShortDate(row.createdAt)}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {row.validUntil
                              ? `Scadenza ${fmtShortDate(row.validUntil)}`
                              : "Nessuna scadenza"}
                            {row.cancelledAt
                              ? ` · Annullato ${fmtShortDate(row.cancelledAt)}`
                              : ""}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Nessun abbonamento registrato.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Seleziona un utente per modificare l’abbonamento.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nessun dato disponibile.
          </p>
          <Button
            variant="outline"
            className="mt-3 min-h-11"
            onClick={onRefresh}
          >
            Riprova
          </Button>
        </div>
      )}
    </div>
  );
}
