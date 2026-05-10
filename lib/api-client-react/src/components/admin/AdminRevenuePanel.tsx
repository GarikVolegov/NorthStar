/**
 * AdminRevenuePanel — Revenue & Stripe Orders
 *
 * - KPI cards: Total Revenue, MRR, Orders, Active Subscriptions
 * - Tabella ordini Stripe paginata
 * - Empty state se Stripe non è configurato
 */
import React, { useState, useEffect } from "react";
import { KpiCard } from "./KpiCard";
import { EmptyState } from "./EmptyState";

interface RevenueSummary {
  configured:          boolean;
  totalRevenue:        number;
  orderCount:          number;
  mrr:                 number;
  activeSubscriptions: number;
}

interface StripeOrder {
  id:            string;
  amount:        number;
  currency:      string;
  status:        string;
  customerEmail: string | null;
  description:   string | null;
  createdAt:     string;
}

interface OrdersResponse {
  configured: boolean;
  orders:     StripeOrder[];
  hasMore:    boolean;
}

export function AdminRevenuePanel() {
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [orders,  setOrders]  = useState<StripeOrder[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingOrders,  setLoadingOrders]  = useState(true);

  useEffect(() => {
    fetch("/api/admin/revenue/summary", { credentials: "include" })
      .then((r) => r.json() as Promise<RevenueSummary>)
      .then(setSummary)
      .catch(console.error)
      .finally(() => setLoadingSummary(false));

    fetch("/api/admin/revenue?limit=20", { credentials: "include" })
      .then((r) => r.json() as Promise<OrdersResponse>)
      .then((d) => { setOrders(d.orders ?? []); setHasMore(d.hasMore ?? false); })
      .catch(console.error)
      .finally(() => setLoadingOrders(false));
  }, []);

  const fmt = (n: number, currency = "€") =>
    `${currency}${n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (!loadingSummary && summary && !summary.configured) {
    return (
      <EmptyState
        icon="💳"
        title="Stripe non configurato"
        description="Aggiungi STRIPE_SECRET_KEY nelle variabili d'ambiente per vedere revenue e ordini."
      />
    );
  }

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">Revenue</h2>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Total Revenue"        value={summary ? fmt(summary.totalRevenue)        : null} icon="💰" loading={loadingSummary} />
        <KpiCard label="MRR"                  value={summary ? fmt(summary.mrr)                  : null} icon="📈" loading={loadingSummary} />
        <KpiCard label="Ordini completati"    value={summary?.orderCount          ?? null}             icon="🛋️" loading={loadingSummary} />
        <KpiCard label="Abbonamenti attivi"   value={summary?.activeSubscriptions ?? null}             icon="🔑" loading={loadingSummary} />
      </div>

      {/* Tabella ordini */}
      <div>
        <h3 className="text-base font-medium mb-3">Ultimi ordini Stripe</h3>
        {loadingOrders ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon="📋"
            title="Nessun ordine"
            description="Gli ordini Stripe appariranno qui una volta che i clienti effettuano acquisti."
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  {["ID", "Cliente", "Importo", "Stato", "Data"].map((h) => (
                    <th key={h} className="px-4 py-2 text-left font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {orders.map((o) => (
                  <tr key={o.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{o.id.slice(-8)}</td>
                    <td className="px-4 py-2">{o.customerEmail ?? "—"}</td>
                    <td className="px-4 py-2 font-medium">{fmt(o.amount, o.currency === "EUR" ? "€" : "$")}</td>
                    <td className="px-4 py-2">
                      <span className={[
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        o.status === "succeeded" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700",
                      ].join(" ")}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">
                      {new Date(o.createdAt).toLocaleDateString("it-IT")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {hasMore && (
          <p className="mt-2 text-xs text-muted-foreground text-center">
            Visualizzati i 20 ordini più recenti.
          </p>
        )}
      </div>
    </section>
  );
}
