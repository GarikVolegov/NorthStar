/**
 * AffiliateDashboard — Passo 5: UI dashboard programma affiliazione.
 *
 * SEZIONI:
 *   1. Balance cards  — locked, disponibile, totale guadagnato
 *   2. Link referral  — URL copia con badge "X referral attivi"
 *   3. Progress bar   — quanti referral mancano per abbonamento gratuito
 *   4. Tabella referral recenti (nome, data, commissione mensile)
 *   5. Storico prelievi
 *   6. CTA prelievo   — modale semplice con importo + metodo
 *
 * Design: card indigo/emerald, zero librerie aggiuntive.
 *
 * Props:
 *   token     JWT
 *   apiBase   default '/api'
 *   appUrl    default 'https://northstar.app' (per costruire referralUrl)
 *   className
 */
import React, { useEffect, useState, useCallback } from "react";

// ── Types ───────────────────────────────────────────────────────────────────

interface AffiliateAccount {
  referralCode:              string;
  referralUrl:               string;
  lockedBalanceEur:          number;
  withdrawableEur:           number;
  totalEarnedEur:            number;
  totalReferrals:            number;
  isPremiumActive:           boolean;
  nextRenewalAt:             string | null;
  status:                    string;
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
  account:            AffiliateAccount;
  recentReferrals:    ReferralRow[];
  recentWithdrawals:  WithdrawalRow[];
  projections:        { currentMonthEur: number; annualEur: number };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(eur: number) {
  return eur.toLocaleString("it-IT", { style: "currency", currency: "EUR" });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(()=>setCopied(false), 2000); }}
      className="flex-shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
    >{copied ? "✓ Copiato!" : "Copia link"}</button>
  );
}

// ── Balance cards ──────────────────────────────────────────────────────────────

function BalanceCard({ label, value, sublabel, color, emoji }: {
  label: string; value: string; sublabel?: string;
  color: "indigo" | "emerald" | "violet"; emoji: string;
}) {
  const colors = {
    indigo:  { bg: "bg-indigo-50",  border: "border-indigo-100", text: "text-indigo-700",  sub: "text-indigo-400" },
    emerald: { bg: "bg-emerald-50", border: "border-emerald-100",text: "text-emerald-700", sub: "text-emerald-400" },
    violet:  { bg: "bg-violet-50",  border: "border-violet-100", text: "text-violet-700",  sub: "text-violet-400" },
  }[color];
  return (
    <div className={`rounded-xl border ${colors.border} ${colors.bg} p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{emoji}</span>
        <span className={`text-xs font-medium ${colors.sub}`}>{label}</span>
      </div>
      <p className={`text-2xl font-black tabular-nums ${colors.text}`}>{value}</p>
      {sublabel && <p className={`text-[10px] mt-1 ${colors.sub}`}>{sublabel}</p>}
    </div>
  );
}

// ── Withdraw Modal ─────────────────────────────────────────────────────────────────

function WithdrawModal({ maxEur, onClose, onSubmit }: {
  maxEur: number;
  onClose: () => void;
  onSubmit: (amount: number, method: "paypal" | "bank_transfer", destination: string) => Promise<void>;
}) {
  const [amount,      setAmount]      = useState(Math.floor(maxEur));
  const [method,      setMethod]      = useState<"paypal" | "bank_transfer">("paypal");
  const [destination, setDestination] = useState("");
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");

  async function handleSubmit() {
    if (amount <= 0 || amount > maxEur) { setError("Importo non valido"); return; }
    if (!destination.trim()) { setError("Inserisci la destinazione"); return; }
    setLoading(true); setError("");
    try { await onSubmit(amount, method, destination); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : "Errore"); }
    finally { setLoading(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">Richiedi prelievo</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium">Importo (max {fmt(maxEur)})</label>
          <div className="flex items-center gap-2">
            <input type="number" min={1} max={maxEur} step={0.01} value={amount}
              onChange={(e)=>setAmount(Number(e.target.value))}
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"/>
            <span className="text-sm font-medium">€</span>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium">Metodo</label>
          <div className="grid grid-cols-2 gap-2">
            {(["paypal", "bank_transfer"] as const).map((m) => (
              <button key={m} onClick={()=>setMethod(m)}
                className={`rounded-xl border py-2.5 text-xs font-medium transition-all ${
                  method===m?"border-primary bg-primary/8 text-primary":"border-border"
                }`}>
                {m==="paypal" ? "🐙 PayPal" : "🏦 Bonifico"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium">
            {method==="paypal" ? "Email PayPal" : "IBAN"}
          </label>
          <input type="text" value={destination} onChange={(e)=>setDestination(e.target.value)}
            placeholder={method==="paypal" ? "email@paypal.com" : "IT60 X054 2811 1010 0000 0123 456"}
            className="w-full rounded-lg border border-border px-3 py-2 text-sm"/>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button onClick={handleSubmit} disabled={loading}
          className="w-full rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
          {loading ? "Invio..." : `Preleva ${fmt(amount)}`}
        </button>

        <p className="text-[10px] text-center text-muted-foreground">
          Il pagamento viene elaborato entro 3-5 giorni lavorativi.
        </p>
      </div>
    </div>
  );
}

// ── Status badge ────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string,{ label:string; className:string }> = {
    pending:   { label:"In attesa",   className:"bg-yellow-50 text-yellow-700 border-yellow-200" },
    paid:      { label:"Pagato",      className:"bg-emerald-50 text-emerald-700 border-emerald-200" },
    rejected:  { label:"Rifiutato",  className:"bg-red-50 text-red-700 border-red-200" },
    applied:   { label:"Attivo",     className:"bg-indigo-50 text-indigo-700 border-indigo-200" },
    active:    { label:"Attivo",     className:"bg-emerald-50 text-emerald-700 border-emerald-200" },
    suspended: { label:"Sospeso",    className:"bg-red-50 text-red-700 border-red-200" },
  };
  const meta = map[status] ?? { label: status, className: "bg-gray-50 text-gray-600 border-gray-200" };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.className}`}>
      {meta.label}
    </span>
  );
}

// ── Main: AffiliateDashboard ───────────────────────────────────────────────────────────

export interface AffiliateDashboardProps {
  token:      string;
  apiBase?:   string;
  className?: string;
}

export function AffiliateDashboard({ token, apiBase="/api", className="" }: AffiliateDashboardProps) {
  const [data,     setData]     = useState<DashboardData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [withdraw, setWithdraw] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/affiliate/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json() as DashboardData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Errore");
    } finally { setLoading(false); }
  }, [token, apiBase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleWithdraw(amount: number, method: "paypal" | "bank_transfer", destination: string) {
    const res = await fetch(`${apiBase}/affiliate/withdraw`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body:    JSON.stringify({ amount, method, destination }),
    });
    if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? "Errore"); }
    await fetchData(); // refresh
  }

  if (loading) return (
    <div className="flex h-64 items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent"/>
    </div>
  );
  if (error) return (
    <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
  );
  if (!data) return null;

  const { account, recentReferrals, recentWithdrawals, projections } = data;
  const pctToFree = Math.min(
    100,
    Math.round(((5 - account.referralsToFreeSubscription) / 5) * 100),
  );

  return (
    <>
      {withdraw && (
        <WithdrawModal
          maxEur={account.withdrawableEur}
          onClose={()=>setWithdraw(false)}
          onSubmit={handleWithdraw}
        />
      )}

      <div className={`space-y-5 ${className}`}>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Programma Affiliazione</h2>
            <p className="text-xs text-muted-foreground">5.80€ per ogni referral attivo / mese</p>
          </div>
          <StatusBadge status={account.status}/>
        </div>

        {/* Balance cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <BalanceCard emoji="🔒" label="Bloccato (cauzione)" color="indigo"
            value={fmt(account.lockedBalanceEur)}
            sublabel="Si sblocca dopo il 5° referral"/>
          <BalanceCard emoji="💰" label="Disponibile" color="emerald"
            value={fmt(account.withdrawableEur)}
            sublabel={account.withdrawableEur >= 1 ? "Prelevabile ora" : "Min. 1€ per prelevare"}/>
          <BalanceCard emoji="📈" label="Totale guadagnato" color="violet"
            value={fmt(account.totalEarnedEur)}
            sublabel={`Proiezione annua: ${fmt(projections.annualEur)}`}/>
        </div>

        {/* Referral link */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold">Il tuo link affiliato</p>
            <span className="rounded-full bg-indigo-50 border border-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">
              {account.totalReferrals} referral
            </span>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-xs truncate">
              {account.referralUrl}
            </code>
            <CopyButton text={account.referralUrl}/>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Codice: <strong>{account.referralCode}</strong>
            {account.nextRenewalAt && ` • Rinnovo: ${fmtDate(account.nextRenewalAt)}`}
          </p>
        </div>

        {/* Progress verso abbonamento gratuito */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-emerald-700">🎉 Abbonamento gratuito</p>
            <p className="text-xs font-bold text-emerald-700">
              {5 - account.referralsToFreeSubscription}/5 referral
            </p>
          </div>
          <div className="h-2.5 rounded-full bg-emerald-100 overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-700"
              style={{ width: `${pctToFree}%` }}/>
          </div>
          {account.referralsToFreeSubscription > 0 ? (
            <p className="mt-1.5 text-[10px] text-emerald-600">
              Ancora <strong>{account.referralsToFreeSubscription}</strong> referral per coprire l’abbonamento
            </p>
          ) : (
            <p className="mt-1.5 text-[10px] text-emerald-600 font-semibold">
              ✅ Il tuo abbonamento è coperto dai referral!
            </p>
          )}
        </div>

        {/* Prelievo CTA */}
        <div className="flex gap-3">
          <button
            onClick={()=>setWithdraw(true)}
            disabled={account.withdrawableEur < 1}
            className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            Richiedi prelievo
          </button>
          <div className="rounded-xl border border-border bg-card px-4 flex items-center">
            <div className="text-center">
              <p className="text-xs font-black text-indigo-600">{fmt(projections.currentMonthEur)}</p>
              <p className="text-[9px] text-muted-foreground">mese corrente</p>
            </div>
          </div>
        </div>

        {/* Referral recenti */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold">Referral recenti</p>
          </div>
          {recentReferrals.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-2xl mb-2">🔗</p>
              <p className="text-sm font-medium">Nessun referral ancora</p>
              <p className="text-xs text-muted-foreground mt-1">Condividi il tuo link per guadagnare</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentReferrals.map((r, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                      <span className="text-xs font-bold text-indigo-600">
                        {(r.name ?? "?")[0]?.toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{r.name ?? "Utente"}</p>
                      <p className="text-[10px] text-muted-foreground">{fmtDate(r.joinedAt)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-emerald-600">+{fmt(r.monthlyEur)}/mese</p>
                    <StatusBadge status={r.isActive ? "active" : "pending"}/>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Storico prelievi */}
        {recentWithdrawals.length > 0 && (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-xs font-semibold">Storico prelievi</p>
            </div>
            <div className="divide-y divide-border">
              {recentWithdrawals.map((w) => (
                <div key={w.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium">{fmt(w.amountEur)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {w.method === "paypal" ? "🐙 PayPal" : "🏦 Bonifico"}
                      {" • "}{fmtDate(w.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={w.status}/>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer note */}
        <p className="text-center text-[10px] text-muted-foreground pb-4">
          Le commissioni vengono registrate ogni mese al rinnovo dell’abbonamento del referral.
          I primi 29€ restano bloccati come cauzione per il tuo abbonamento.
        </p>

      </div>
    </>
  );
}
