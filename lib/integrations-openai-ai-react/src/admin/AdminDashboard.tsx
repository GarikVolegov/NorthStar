/**
 * AdminDashboard — pagina admin completa del sistema Discovery + Growth Agent.
 *
 * STRUTTURA:
 *   [Sidebar/Tab bar: Overview | Collector | Enricher | Fonti | Items | Agent Health]
 *
 * SEZIONI:
 *   1. Overview      — KPI cards + azioni rapide + schedule
 *   2. Collector     — trigger manuale + risultato ultimo run
 *   3. Enricher GPT  — trigger enrichment + config + risultati
 *   4. Fonti         — DiscoverySourcesManager (CRUD fonti RSS)
 *   5. Items         — tabella item recenti con filtri
 *   6. Agent Health  — stato degli agenti
 */
import React, { useState } from "react";
import { useAdminData }          from "./useAdminData";
import { AdminOverviewCards }    from "./AdminOverviewCards";
import { AdminCollectorPanel }   from "./AdminCollectorPanel";
import { AdminEnricherPanel }    from "./AdminEnricherPanel";
import { AdminAgentHealth }      from "./AdminAgentHealth";
import { AdminRecentItems }      from "./AdminRecentItems";
import { DiscoverySourcesManager } from "./DiscoverySourcesManager";

type Section = "overview" | "collector" | "enricher" | "sources" | "items" | "health";

const SECTIONS: Array<{ id: Section; label: string; icon: string; description: string }> = [
  { id: "overview",  label: "Overview",     icon: "📊", description: "KPI e statistiche generali" },
  { id: "collector", label: "Collector",    icon: "⚡", description: "Raccolta contenuti RSS" },
  { id: "enricher",  label: "Enricher",     icon: "✨", description: "Arricchimento GPT-4o-mini" },
  { id: "sources",   label: "Fonti RSS",    icon: "📡", description: "Gestisci le fonti di contenuto" },
  { id: "items",     label: "Item recenti", icon: "📝", description: "Ultimi item raccolti" },
  { id: "health",    label: "Agent Health", icon: "📍", description: "Stato degli agenti" },
];

export const AdminDashboard: React.FC = () => {
  const [activeSection, setActiveSection] = useState<Section>("overview");
  const {
    agents, collectorStats, recentItems, adminStats,
    isRunning, isLoading, error, refetch, triggerCollect,
  } = useAdminData();

  const current = SECTIONS.find((s) => s.id === activeSection)!;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">

      {/* Sidebar desktop */}
      <aside className="hidden lg:flex flex-col w-60 bg-white border-r border-gray-200 min-h-screen sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xl">⭐</span>
            <div>
              <p className="font-bold text-gray-900 text-sm">NorthStar</p>
              <p className="text-[10px] text-gray-400">Admin Dashboard</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                activeSection === section.id
                  ? "bg-indigo-50 text-indigo-700 font-semibold"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span className="text-base">{section.icon}</span>
              <div className="min-w-0">
                <div className="text-sm">{section.label}</div>
                <div className="text-[10px] text-gray-400 truncate">{section.description}</div>
              </div>
            </button>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-gray-100">
          <button onClick={refetch} className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5 stroke-current" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Aggiorna dati
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 pb-20 lg:pb-0">
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 lg:px-6 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-bold text-gray-900">{current.icon} {current.label}</h1>
              <p className="text-xs text-gray-400 hidden sm:block">{current.description}</p>
            </div>
            {isRunning && (
              <div className="flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 px-3 py-1.5 rounded-full">
                <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Collector in esecuzione
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mx-4 lg:mx-6 mt-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">{error}</div>
        )}

        <div className="px-4 lg:px-6 py-5 space-y-5">

          {activeSection === "overview" && (
            <>
              <AdminOverviewCards stats={adminStats} isLoading={isLoading} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border bg-white p-5">
                  <h3 className="font-semibold text-gray-900 text-sm mb-3">⚡ Azioni rapide</h3>
                  <div className="space-y-2">
                    <button
                      onClick={() => { setActiveSection("collector"); triggerCollect(); }}
                      disabled={isRunning}
                      className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-700 text-sm hover:bg-indigo-100 disabled:opacity-50 transition"
                    >▶ Lancia collector ora</button>
                    <button
                      onClick={() => setActiveSection("enricher")}
                      className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border border-purple-200 bg-purple-50 text-purple-700 text-sm hover:bg-purple-100 transition"
                    >✨ Arricchisci con GPT</button>
                    <button
                      onClick={() => setActiveSection("sources")}
                      className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm text-gray-600 hover:bg-gray-50 transition"
                    >+ Aggiungi fonte RSS</button>
                  </div>
                </div>
                <div className="rounded-2xl border bg-white p-5">
                  <h3 className="font-semibold text-gray-900 text-sm mb-3">📅 Schedule automatico</h3>
                  <div className="space-y-2">
                    {[
                      { label: "Collector",    schedule: "Ogni 6 ore",              icon: "📰" },
                      { label: "Enricher GPT", schedule: "Ogni 2 ore + post-collect", icon: "✨" },
                      { label: "Personalizer", schedule: "Ogni 3 ore",              icon: "🎯" },
                    ].map((job) => (
                      <div key={job.label} className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">{job.icon} {job.label}</span>
                        <span className="text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{job.schedule}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <AdminAgentHealth agents={agents} isLoading={isLoading} onRefresh={refetch} />
            </>
          )}

          {activeSection === "collector" && (
            <AdminCollectorPanel stats={collectorStats} isRunning={isRunning} onTrigger={triggerCollect} />
          )}

          {activeSection === "enricher" && (
            <AdminEnricherPanel />
          )}

          {activeSection === "sources" && (
            <div className="-mx-4 lg:-mx-6">
              <DiscoverySourcesManager />
            </div>
          )}

          {activeSection === "items" && (
            <AdminRecentItems items={recentItems} isLoading={isLoading} />
          )}

          {activeSection === "health" && (
            <AdminAgentHealth agents={agents} isLoading={isLoading} onRefresh={refetch} />
          )}
        </div>
      </main>

      {/* Bottom tab bar mobile */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-gray-200 flex">
        {SECTIONS.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`flex-1 flex flex-col items-center py-2 text-[10px] transition ${
              activeSection === section.id ? "text-indigo-600" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <span className="text-lg leading-none">{section.icon}</span>
            <span className="mt-0.5">{section.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};
