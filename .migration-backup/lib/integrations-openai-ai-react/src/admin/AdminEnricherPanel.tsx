/**
 * AdminEnricherPanel — pannello UI per gestire l'enrichment GPT.
 *
 * FEATURES:
 *   - Badge "N item in attesa" (poll ogni 30s via GET /enrich/status)
 *   - Bottone "Arricchisci ora" → POST /enrich
 *   - Configurazione batchSize e concurrency
 *   - Progress ring durante l'esecuzione
 *   - Risultato: enriched / filtered / retried / durata
 *   - Barra costo stimato (token × rate)
 *   - Spiegazione del pipeline (accordion)
 */
import React, { useState, useEffect, useCallback } from "react";
import type { EnricherResult } from "./useAdminData";

const API_ENRICH = "/api/admin/discovery/enrich";

const GPT_MINI_INPUT_PER_TOKEN  = 0.15 / 1_000_000; // $0.15 / 1M
const GPT_MINI_OUTPUT_PER_TOKEN = 0.60 / 1_000_000;
const AVG_TOKENS_PER_ITEM       = 300; // ~200 input + 100 output

function estimateCost(processed: number): string {
  const cost = processed * AVG_TOKENS_PER_ITEM * (GPT_MINI_INPUT_PER_TOKEN * 0.67 + GPT_MINI_OUTPUT_PER_TOKEN * 0.33);
  return cost < 0.001 ? "< $0.001" : `~$${cost.toFixed(4)}`;
}

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export const AdminEnricherPanel: React.FC = () => {
  const [pending,    setPending]    = useState<number | null>(null);
  const [isRunning,  setIsRunning]  = useState(false);
  const [result,     setResult]     = useState<EnricherResult | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [batchSize,  setBatchSize]  = useState(20);
  const [concurrency,setConcurrency]= useState(5);
  const [showInfo,   setShowInfo]   = useState(false);

  // Poll pending count ogni 30s
  const fetchPending = useCallback(async () => {
    try {
      const res  = await fetch(`${API_ENRICH}/status`, { credentials: "include" });
      const data = await res.json() as { pending?: number };
      setPending(data.pending ?? 0);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchPending();
    const iv = setInterval(fetchPending, 30_000);
    return () => clearInterval(iv);
  }, [fetchPending]);

  const runEnrich = async () => {
    setIsRunning(true);
    setResult(null);
    setError(null);
    try {
      const res  = await fetch(API_ENRICH, {
        method:  "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ batchSize, concurrency }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as EnricherResult;
      setResult(data);
      fetchPending(); // aggiorna pending dopo il run
    } catch (err) {
      setError(String(err));
    } finally {
      setIsRunning(false);
    }
  };

  const enrichedPct = result ? Math.round((result.enriched / Math.max(result.processed, 1)) * 100) : 0;

  return (
    <div className="rounded-2xl border bg-white p-5 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-900">✨ Enricher GPT</h2>
          <p className="text-xs text-gray-400">Arricchisce gli item raw con GPT-4o-mini</p>
        </div>
        <div className="flex items-center gap-2">
          {pending !== null && (
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              pending > 0 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
            }`}>
              {pending > 0 ? `${pending} in attesa` : "✓ tutti arricchiti"}
            </span>
          )}
          <button
            onClick={runEnrich}
            disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 disabled:opacity-60 transition"
          >
            {isRunning ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Elaborando...
              </>
            ) : (
              <>▶ Arricchisci ora</>
            )}
          </button>
        </div>
      </div>

      {/* Config row */}
      <div className="flex flex-wrap gap-4 items-center p-3 rounded-xl bg-gray-50">
        <label className="flex items-center gap-2 text-xs text-gray-600">
          Batch size:
          <input
            type="number" min={1} max={100} value={batchSize}
            onChange={(e) => setBatchSize(Number(e.target.value))}
            className="w-16 rounded-lg border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-purple-300"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-600">
          Concorrenza GPT:
          <input
            type="number" min={1} max={10} value={concurrency}
            onChange={(e) => setConcurrency(Number(e.target.value))}
            className="w-14 rounded-lg border px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-purple-300"
          />
        </label>
        <span className="text-[10px] text-gray-400">
          Costo stimato: {estimateCost(batchSize)}
        </span>
      </div>

      {/* Running */}
      {isRunning && (
        <div className="rounded-xl bg-purple-50 border border-purple-200 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-purple-700 mb-2">
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Chiamate GPT-4o-mini in corso ({concurrency} parallele)...
          </div>
          <div className="w-full bg-purple-100 rounded-full h-1.5 overflow-hidden">
            <div className="h-full bg-purple-500 rounded-full animate-pulse" style={{ width: "40%" }} />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          ⚠️ {error}
        </div>
      )}

      {/* Result */}
      {result && !isRunning && (
        <div className="space-y-3">
          {/* Progress ring + summary */}
          <div className="flex items-center gap-4">
            {/* Mini ring */}
            <div className="relative w-16 h-16 flex-shrink-0">
              <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e9d5ff" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke="#9333ea" strokeWidth="3"
                  strokeDasharray={`${enrichedPct} ${100 - enrichedPct}`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-purple-700">
                {enrichedPct}%
              </span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-2 flex-1">
              {[
                { label: "Processati",  value: result.processed,  color: "text-gray-700" },
                { label: "Arricchiti",  value: result.enriched,   color: "text-purple-600" },
                { label: "Filtrati",    value: result.filtered,   color: "text-amber-600",  title: "Score < 0.25" },
                { label: "Errori",      value: result.skipped,    color: "text-red-500" },
              ].map((s) => (
                <div key={s.label} className="rounded-lg bg-gray-50 px-3 py-2" title={s.title}>
                  <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] text-gray-400">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Metrics row */}
          <div className="flex flex-wrap gap-3 text-xs text-gray-400">
            <span>⏱ {formatMs(result.durationMs)}</span>
            <span>💰 costo effettivo: {estimateCost(result.processed)}</span>
            {result.retried > 0 && <span>🔄 {result.retried} retry incrementati</span>}
          </div>

          {/* Error log */}
          {result.errors.length > 0 && (
            <details className="rounded-xl bg-red-50 border border-red-200 p-3">
              <summary className="text-xs font-semibold text-red-700 cursor-pointer">
                ⚠️ {result.errors.length} errori
              </summary>
              <ul className="mt-2 space-y-0.5">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-xs text-red-600 font-mono">{e}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Info accordion */}
      <div>
        <button
          onClick={() => setShowInfo((v) => !v)}
          className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
        >
          {showInfo ? "▲" : "▼"} Come funziona
        </button>
        {showInfo && (
          <div className="mt-2 text-xs text-gray-500 space-y-1 bg-gray-50 rounded-xl p-3">
            <p>1. Preleva i <strong>{batchSize}</strong> item più prioritari non ancora arricchiti (opportunity → formation → news).</p>
            <p>2. Invia {concurrency} chiamate parallele a <strong>GPT-4o-mini</strong> con titolo + sommario.</p>
            <p>3. GPT risponde con: <code>relevanceScore</code>, <code>skillTags</code>, <code>insightText</code>, <code>journeyTypes</code>, <code>difficulty</code>.</p>
            <p>4. Items con score &lt; 0.25 vengono salvati ma <strong>esclusi dal feed</strong> utente.</p>
            <p>5. In caso di errore, incrementa il retry counter. Dopo 3 fallimenti l'item viene saltato definitivamente.</p>
            <p>6. Il cron esegue automaticamente ogni 2 ore (+ subito dopo ogni collect).</p>
          </div>
        )}
      </div>
    </div>
  );
};
