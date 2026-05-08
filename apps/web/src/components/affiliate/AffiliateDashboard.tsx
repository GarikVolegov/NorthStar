/**
 * AffiliateDashboard.tsx
 *
 * Dashboard completa del programma affiliazione NorthStar.
 * Design coerente con il resto della piattaforma (Tailwind + shadcn tokens).
 *
 * Sezioni:
 *   1. KPI cards  — Commissioni totali / Bloccati / Prelevabili
 *   2. Progress bar rinnovo  — mostra €bloccati/29€ e data scadenza
 *   3. Referral link  — codice + URL con copia one-click e QR placeholder
 *   4. Tabella referral attivi
 *   5. Modale prelievo
 *   6. Storico prelievi
 */
import React, { useState, useEffect, useCallback } from "react";

// ── Types (inline per evitare import circolari) ────────────────────────────────
interface AccountData {
  referralCode:               string;
  referralUrl:                string;
  lockedBalanceEur:           number;
  withdrawableEur:            number;
  totalEarnedEur:             number;
  totalReferrals:             number;
  isPremiumActive:            boolean;
  nextRenewalAt:              string | null;
  status:                     string;
  referralsToFreeSubscription: number;
}
interface ReferralRow {
  userId:     number;
  name:       string | null;
  joinedAt:   string;
  monthlyEur: number;
  isActive:   boolean;
}
interface WithdrawalRow {
  id:        number;
  amountEur: number;
  method:    string;
  status:    string;
  createdAt: string;
  paidAt:    string | null;
}
interface DashboardData {
  account:            AccountData;
  recentReferrals:    ReferralRow[];
  recentWithdrawals:  WithdrawalRow[];
  projections:        { currentMonthEur: number; annualEur: number };
}

// ── Hook ──────────────────────────────────────────────────────────────────────
function useAffiliateDashboard(token: string) {
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/affiliate/dashboard", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const withdraw = useCallback(async (
    amount: number,
    method: "paypal" | "bank_transfer",
    destination?: string,
  ) => {
    const res = await fetch("/api/affiliate/withdraw", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ amount, method, destination }),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
    await fetch_();
  }, [token, fetch_]);

  return { data, loading, error, refetch: fetch_, withdraw };
}

// ── UI Helpers ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent = false }: {
  label: string; value: string; sub?: string; accent?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 space-y-1 ${
      accent ? "border-primary bg-primary/5" : "border-border bg-card"
    }`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  applied: "bg-green-100  text-green-800",
  paid:    "bg-blue-100   text-blue-800",
  failed:  "bg-red-100    text-red-700",
  void:    "bg-gray-100   text-gray-500",
};
function Badge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${STATUS_BADGE[status] ?? "bg-gray-100 text-gray-500"}`}>
      {status}
    </span>
  );
}

function fmt(eur: number) {
  return eur.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Withdraw Modal ────────────────────────────────────────────────────────────

function WithdrawModal({
  maxEur,
  onClose,
  onConfirm,
}: {
  maxEur: number;
  onClose: () => void;
  onConfirm: (amount: number, method: "paypal" | "bank_transfer", dest: string) => Promise<void>;
}) {
  const [amount, setAmount]   = useState(maxEur.toFixed(2));
  const [method, setMethod]   = useState<"paypal" | "bank_transfer">("paypal");
  const [dest,   setDest]     = useState("");
  const [busy,   setBusy]     = useState(false);
  const [err,    setErr]      = useState("");

  async function submit() {
    const n = parseFloat(amount);
    if (isNaN(n) || n <= 0) { setErr("Importo non valido"); return; }
    if (n > maxEur)         { setErr(`Massimo prelevabile: ${fmt(maxEur)}`); return; }
    if (!dest.trim())       { setErr("Inserisci la destinazione"); return; }
    setBusy(true); setErr("");
    try { await onConfirm(n, method, dest); onClose(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Errore"); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-background p-6 shadow-xl space-y-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold">Richiedi prelievo</h2>
        <p className="text-xs text-muted-foreground">Disponibile: <span className="font-medium text-foreground">{fmt(maxEur)}</span></p>

        <div className="space-y-1">
          <label className="text-xs font-medium">Importo (€)</label>
          <input
            type="number" step="0.01" min="1" max={maxEur}
            value={amount} onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium">Metodo</label>
          <div className="flex gap-2">
            {(["paypal", "bank_transfer"] as const).map((m) => (
              <button key={m} onClick={() => setMethod(m)}
                className={`flex-1 rounded-lg border py-2 text-xs font-medium transition-colors ${
                  method === m ? "border-primary bg-primary/10 text-primary" : "border-border"
                }`}>
                {m === "paypal" ? "PayPal" : "Bonifico"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium">
            {method === "paypal" ? "Email PayPal" : "IBAN"}
          </label>
          <input
            type="text"
            placeholder={method === "paypal" ? "nome@email.com" : "IT60 X054 2811 1010 0000 0123 456"}
            value={dest} onChange={(e) => setDest(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>

        {err && <p className="text-xs text-red-500">{err}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-border py-2 text-xs">Annulla</button>
          <button onClick={submit} disabled={busy}
            className="flex-1 rounded-lg bg-primary py-2 text-xs font-medium text-primary-foreground disabled:opacity-40">
            {busy ? "Invio..." : "Conferma prelievo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export function AffiliateDashboard({ token }: { token: string }) {
  const { data, loading, error, refetch, withdraw } = useAffiliateDashboard(token);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [copied, setCopied]             = useState(false);

  function copyLink() {
    if (!data) return;
    navigator.clipboard.writeText(data.account.referralUrl);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );

  if (error) return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {error} <button onClick={refetch} className="ml-2 underline">Riprova</button>
    </div>
  );

  if (!data) return null;
  const { account, recentReferrals, recentWithdrawals, projections } = data;

  const lockProgress = Math.min(100, (account.lockedBalanceEur / 29) * 100);

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Programma Affiliazione</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Invita amici e guadagna il 20% del loro abbonamento ogni mese
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${
          account.isPremiumActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
        }`}>
          {account.isPremiumActive ? "✓ Premium attivo" : "Premium scaduto"}
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard
          label="Commissioni totali"
          value={fmt(account.totalEarnedEur)}
          sub={`${account.totalReferrals} referral`}
        />
        <KpiCard
          label="Bloccati (rinnovo)"
          value={fmt(account.lockedBalanceEur)}
          sub="Coprono il tuo abbonamento"
        />
        <KpiCard
          label="Prelevabili ora"
          value={fmt(account.withdrawableEur)}
          sub="Disponibili al prelievo"
          accent
        />
      </div>

      {/* Rinnovo progress */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Copertura abbonamento</span>
          <span className="text-muted-foreground text-xs">
            Prossimo rinnovo: {fmtDate(account.nextRenewalAt)}
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${lockProgress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{fmt(account.lockedBalanceEur)} bloccati su 29,00€</span>
          {account.referralsToFreeSubscription > 0 ? (
            <span>Mancano <strong>{account.referralsToFreeSubscription}</strong> referral per rinnovo gratuito</span>
          ) : (
            <span className="text-green-600 font-medium">✓ Rinnovo garantito</span>
          )}
        </div>
        {account.lockedBalanceEur < 29 && account.nextRenewalAt && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">
            Se i bloccati sono &lt;29€ al rinnovo, verrà addebitata la differenza
            ({fmt(29 - account.lockedBalanceEur)}) sulla tua carta.
          </p>
        )}
      </div>

      {/* Referral link */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold">Il tuo link di invito</h2>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-xs font-mono truncate">
            {account.referralUrl}
          </code>
          <button
            onClick={copyLink}
            className="shrink-0 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
          >
            {copied ? "✓ Copiato" : "Copia"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Codice: <strong>{account.referralCode}</strong> · {fmt(projections.currentMonthEur)} questo mese ·
          Proiezione annua: <strong>{fmt(projections.annualEur)}</strong>
        </p>
      </div>

      {/* Prelievo CTA */}
      {account.withdrawableEur >= 1 && (
        <button
          onClick={() => setShowWithdraw(true)}
          className="w-full rounded-xl bg-primary py-3 text-sm font-medium text-primary-foreground"
        >
          Preleva {fmt(account.withdrawableEur)} →
        </button>
      )}

      {/* Tabella referral */}
      {recentReferrals.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold">Referral attivi questo mese</h2>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Nome</th>
                <th className="px-4 py-2 text-left font-medium">Iscritto il</th>
                <th className="px-4 py-2 text-right font-medium">Commissione/mese</th>
                <th className="px-4 py-2 text-center font-medium">Stato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentReferrals.map((r) => (
                <tr key={r.userId}>
                  <td className="px-4 py-2.5">{r.name ?? "Utente anonimo"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(r.joinedAt)}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{fmt(r.monthlyEur)}</td>
                  <td className="px-4 py-2.5 text-center">
                    <Badge status={r.isActive ? "applied" : "void"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Storico prelievi */}
      {recentWithdrawals.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="text-sm font-semibold">Storico prelievi</h2>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Data</th>
                <th className="px-4 py-2 text-left font-medium">Metodo</th>
                <th className="px-4 py-2 text-right font-medium">Importo</th>
                <th className="px-4 py-2 text-center font-medium">Stato</th>
                <th className="px-4 py-2 text-left font-medium">Pagato il</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentWithdrawals.map((w) => (
                <tr key={w.id}>
                  <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(w.createdAt)}</td>
                  <td className="px-4 py-2.5 capitalize">{w.method === "bank_transfer" ? "Bonifico" : "PayPal"}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{fmt(w.amountEur)}</td>
                  <td className="px-4 py-2.5 text-center"><Badge status={w.status} /></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{fmtDate(w.paidAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modale prelievo */}
      {showWithdraw && (
        <WithdrawModal
          maxEur={account.withdrawableEur}
          onClose={() => setShowWithdraw(false)}
          onConfirm={withdraw}
        />
      )}
    </div>
  );
}
