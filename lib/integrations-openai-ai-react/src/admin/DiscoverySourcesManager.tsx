/**
 * DiscoverySourcesManager — Admin UI per gestire le fonti RSS del Discovery.
 *
 * FEATURES:
 *   - Lista tutte le fonti con stato (enabled/disabled)
 *   - Toggle on/off con un click
 *   - Aggiungi nuova fonte (form inline)
 *   - Test feed: verifica che l'URL sia valido e mostra preview dei titoli
 *   - Modifica inline (click su nome/URL)
 *   - Elimina con conferma
 *   - Badge errore se lastError presente
 *   - Stats: totalFetched, lastFetchAt
 *
 * PREREQUISITI:
 *   - Route /api/admin/discovery/sources registrata in app.ts
 *   - Tabella discovery_sources nel DB (migration applicata)
 */
import React, { useState, useEffect, useCallback } from "react";

const API = "/api/admin/discovery/sources";

const ITEM_TYPES = ["news", "opportunity", "formation", "growth", "sector_trend"] as const;
type ItemType = typeof ITEM_TYPES[number];

const TYPE_COLORS: Record<ItemType, string> = {
  news:         "bg-blue-100 text-blue-700",
  opportunity:  "bg-green-100 text-green-700",
  formation:    "bg-purple-100 text-purple-700",
  growth:       "bg-amber-100 text-amber-700",
  sector_trend: "bg-rose-100 text-rose-700",
};

interface Source {
  id:          number;
  name:        string;
  feedUrl:     string;
  description?: string | null;
  itemType:    string;
  sector:      string;
  category:    string;
  language:    string;
  enabled:     boolean;
  itemsPerRun: number;
  lastFetchAt?: string | null;
  lastError?:  string | null;
  totalFetched: number;
  createdAt:   string;
}

interface TestResult {
  ok:           boolean;
  error?:       string;
  itemsPreview?: Array<{ title: string; url: string }>;
}

const EMPTY_FORM = {
  name: "", feedUrl: "", description: "",
  itemType: "news" as ItemType, sector: "General",
  category: "news", language: "it", itemsPerRun: 6, enabled: true,
};

export const DiscoverySourcesManager: React.FC = () => {
  const [sources,     setSources]     = useState<Source[]>([]);
  const [isLoading,   setIsLoading]   = useState(true);
  const [error,       setError]       = useState<string | null>(null);
  const [showForm,    setShowForm]    = useState(false);
  const [form,        setForm]        = useState({ ...EMPTY_FORM });
  const [formError,   setFormError]   = useState<string | null>(null);
  const [saving,      setSaving]      = useState(false);
  const [testingId,   setTestingId]   = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, TestResult>>({});
  const [editingId,   setEditingId]   = useState<number | null>(null);
  const [editForm,    setEditForm]    = useState<Partial<Source>>({});
  const [deleteId,    setDeleteId]    = useState<number | null>(null);

  const fetchSources = useCallback(async () => {
    setIsLoading(true);
    try {
      const res  = await fetch(API, { credentials: "include" });
      const data = await res.json() as { sources?: Source[] };
      setSources(data.sources ?? []);
      setError(null);
    } catch { setError("Errore nel caricamento delle fonti"); }
    finally  { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchSources(); }, [fetchSources]);

  // ── Toggle enabled ────────────────────────────────────────────────────────
  const toggleEnabled = async (src: Source) => {
    setSources((prev) => prev.map((s) => s.id === src.id ? { ...s, enabled: !s.enabled } : s));
    try {
      const res = await fetch(`${API}/${src.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !src.enabled }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setSources((prev) => prev.map((s) => s.id === src.id ? { ...s, enabled: src.enabled } : s));
    }
  };

  // ── Test feed ─────────────────────────────────────────────────────────────
  const testFeed = async (id: number) => {
    setTestingId(id);
    try {
      const res    = await fetch(`${API}/${id}/test`, { method: "POST", credentials: "include" });
      const result = await res.json() as TestResult;
      setTestResults((prev) => ({ ...prev, [id]: result }));
      if (result.ok) fetchSources(); // refresh lastFetchAt
    } catch { setTestResults((prev) => ({ ...prev, [id]: { ok: false, error: "Errore di rete" } })); }
    finally  { setTestingId(null); }
  };

  // ── Add new source ────────────────────────────────────────────────────────
  const addSource = async () => {
    if (!form.name.trim() || !form.feedUrl.trim()) { setFormError("Nome e URL sono obbligatori"); return; }
    setSaving(true); setFormError(null);
    try {
      const res = await fetch(API, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.status === 409) { setFormError("URL già presente"); return; }
      if (!res.ok) throw new Error();
      setForm({ ...EMPTY_FORM }); setShowForm(false);
      fetchSources();
    } catch { setFormError("Errore nel salvataggio"); }
    finally  { setSaving(false); }
  };

  // ── Inline edit ───────────────────────────────────────────────────────────
  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await fetch(`${API}/${editingId}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      fetchSources();
    } catch { /* ignore */ }
    setEditingId(null); setEditForm({});
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await fetch(`${API}/${deleteId}`, { method: "DELETE", credentials: "include" });
      setSources((prev) => prev.filter((s) => s.id !== deleteId));
    } catch { /* ignore */ }
    setDeleteId(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">📡 Fonti Discovery</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gestisci le fonti RSS. Le modifiche hanno effetto al prossimo run del collector.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchSources}
            className="px-3 py-2 rounded-xl text-sm border border-gray-200 hover:bg-gray-50 transition"
          >↻ Aggiorna</button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition"
          >+ Aggiungi fonte</button>
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 space-y-3">
          <h2 className="font-semibold text-gray-800 text-sm">Nuova fonte RSS</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input placeholder="Nome (es. Wired Italia)" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
            <input placeholder="Feed URL (https://...)" value={form.feedUrl}
              onChange={(e) => setForm((f) => ({ ...f, feedUrl: e.target.value }))}
              className="rounded-xl border px-3 py-2 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-400" />
            <input placeholder="Settore (es. Technology)" value={form.sector}
              onChange={(e) => setForm((f) => ({ ...f, sector: e.target.value }))}
              className="rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
            <select value={form.itemType} onChange={(e) => setForm((f) => ({ ...f, itemType: e.target.value as ItemType }))}
              className="rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400">
              {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input placeholder="Categoria (es. marketing_trend)" value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
            <div className="flex gap-2">
              <select value={form.language} onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
                className="rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 w-24">
                <option value="it">🇮🇹 it</option>
                <option value="en">🇬🇧 en</option>
              </select>
              <input type="number" min={1} max={20} placeholder="Items/run" value={form.itemsPerRun}
                onChange={(e) => setForm((f) => ({ ...f, itemsPerRun: Number(e.target.value) }))}
                className="rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 flex-1" />
            </div>
          </div>
          <textarea placeholder="Descrizione (opzionale)" value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
          {formError && <p className="text-xs text-red-600">{formError}</p>}
          <div className="flex gap-2 justify-end">
            <button onClick={() => { setShowForm(false); setForm({ ...EMPTY_FORM }); }}
              className="px-4 py-2 rounded-xl text-sm border hover:bg-gray-50 transition">Annulla</button>
            <button onClick={addSource} disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60 transition">
              {saving ? "Salvando..." : "Salva fonte"}
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {error && <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />)}
        </div>
      )}

      {/* Sources list */}
      {!isLoading && sources.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-4xl mb-3">📡</div>
          <p className="text-sm">Nessuna fonte configurata. Aggiungi la prima fonte RSS.</p>
        </div>
      )}

      {!isLoading && sources.length > 0 && (
        <div className="space-y-3">
          {sources.map((src) => (
            <div key={src.id} className={`rounded-2xl border bg-white p-4 transition-all ${src.enabled ? "" : "opacity-60"}` }>

              {editingId === src.id ? (
                // ── Inline edit mode ──────────────────────────────────────
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input value={editForm.name ?? src.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      className="rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
                    <input value={editForm.feedUrl ?? src.feedUrl}
                      onChange={(e) => setEditForm((f) => ({ ...f, feedUrl: e.target.value }))}
                      className="rounded-lg border px-3 py-1.5 text-sm font-mono outline-none focus:ring-2 focus:ring-indigo-400" />
                    <input value={editForm.sector ?? src.sector}
                      onChange={(e) => setEditForm((f) => ({ ...f, sector: e.target.value }))}
                      placeholder="Settore"
                      className="rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400" />
                    <select value={editForm.itemType ?? src.itemType}
                      onChange={(e) => setEditForm((f) => ({ ...f, itemType: e.target.value }))}
                      className="rounded-lg border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400">
                      {ITEM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => { setEditingId(null); setEditForm({}); }}
                      className="px-3 py-1 rounded-lg text-xs border hover:bg-gray-50">Annulla</button>
                    <button onClick={saveEdit}
                      className="px-3 py-1 rounded-lg text-xs bg-indigo-600 text-white hover:bg-indigo-700">Salva</button>
                  </div>
                </div>
              ) : (
                // ── Normal view ───────────────────────────────────────────
                <div className="flex items-start gap-3">
                  {/* Toggle */}
                  <button
                    onClick={() => toggleEnabled(src)}
                    className={`mt-0.5 flex-shrink-0 w-10 h-5 rounded-full transition-colors ${
                      src.enabled ? "bg-indigo-500" : "bg-gray-200"
                    }`}
                    title={src.enabled ? "Disabilita" : "Abilita"}
                    aria-label={src.enabled ? "Disabilita" : "Abilita"}
                  >
                    <span className={`block w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${
                      src.enabled ? "translate-x-5" : "translate-x-0"
                    }`} />
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-sm text-gray-900">{src.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        TYPE_COLORS[src.itemType as ItemType] ?? "bg-gray-100 text-gray-600"
                      }`}>{src.itemType}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{src.language?.toUpperCase()}</span>
                      {!src.enabled && <span className="text-[10px] text-gray-400">disabilitata</span>}
                    </div>
                    <p className="text-xs text-gray-400 font-mono truncate mt-0.5">{src.feedUrl}</p>
                    <div className="flex flex-wrap gap-3 mt-1 text-[10px] text-gray-400">
                      <span>Settore: <span className="text-gray-600">{src.sector}</span></span>
                      <span>Items/run: <span className="text-gray-600">{src.itemsPerRun}</span></span>
                      {src.totalFetched > 0 && <span>Fetchati: <span className="text-gray-600">{src.totalFetched}</span></span>}
                      {src.lastFetchAt && <span>Ultimo fetch: <span className="text-gray-600">{new Date(src.lastFetchAt).toLocaleDateString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span></span>}
                    </div>

                    {/* Error badge */}
                    {src.lastError && (
                      <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                        ⚠️ {src.lastError.slice(0, 80)}
                      </div>
                    )}

                    {/* Test result */}
                    {testResults[src.id] && (
                      <div className={`mt-1.5 text-xs rounded-lg px-3 py-2 ${
                        testResults[src.id].ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
                      }`}>
                        {testResults[src.id].ok ? (
                          <>
                            ✅ Feed OK &mdash; {testResults[src.id].itemsPreview?.length ?? 0} item trovati:
                            <ul className="mt-1 space-y-0.5 list-disc list-inside">
                              {testResults[src.id].itemsPreview?.map((item, i) => (
                                <li key={i} className="truncate">{item.title}</li>
                              ))}
                            </ul>
                          </>
                        ) : (
                          <>❌ {testResults[src.id].error}</>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => testFeed(src.id)}
                      disabled={testingId === src.id}
                      className="px-2 py-1 rounded-lg text-[11px] border border-gray-200 hover:bg-gray-50 disabled:opacity-50 transition"
                      title="Testa feed"
                    >{testingId === src.id ? "..." : "Test"}</button>
                    <button
                      onClick={() => { setEditingId(src.id); setEditForm({}); }}
                      className="px-2 py-1 rounded-lg text-[11px] border border-gray-200 hover:bg-gray-50 transition"
                      title="Modifica"
                    >✏️</button>
                    <button
                      onClick={() => setDeleteId(src.id)}
                      className="px-2 py-1 rounded-lg text-[11px] border border-red-100 hover:bg-red-50 text-red-500 transition"
                      title="Elimina"
                    >🗑️</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h3 className="font-bold text-gray-900 mb-2">Elimina fonte?</h3>
            <p className="text-sm text-gray-500 mb-4">
              Questa operazione è irreversibile. Gli item già raccolti non vengono eliminati.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteId(null)}
                className="px-4 py-2 rounded-xl text-sm border hover:bg-gray-50">Annulla</button>
              <button onClick={confirmDelete}
                className="px-4 py-2 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700">Elimina</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
