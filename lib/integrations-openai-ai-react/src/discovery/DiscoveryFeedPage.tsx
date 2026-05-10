/**
 * DiscoveryFeedPage — pagina principale del feed Discovery.
 *
 * LAYOUT:
 *   [Header: titolo + pulsante refresh]
 *   [Filtri tipo: pill row orizzontale scrollabile]
 *   [Filtri journey: pill row secondaria (collassabile su mobile)]
 *   [Grid item cards: 1 col mobile, 2 col sm, 3 col lg]
 *   [Load more button / skeleton]
 *
 * USO:
 *   <DiscoveryFeedPage />
 */
import React, { useState } from "react";
import { useDiscoveryFeed }     from "./useDiscoveryFeed";
import type { DiscoveryItemType, DiscoveryJourneyType } from "./useDiscoveryFeed";
import { DiscoveryItemCard }    from "./DiscoveryItemCard";
import { DiscoveryItemSkeleton } from "./DiscoveryItemSkeleton";

const TYPE_FILTERS: Array<{ id: DiscoveryItemType; label: string }> = [
  { id: "all",          label: "✨ Tutto" },
  { id: "opportunity",  label: "🚀 Opportunità" },
  { id: "formation",    label: "🎓 Formazione" },
  { id: "news",         label: "📰 Notizie" },
  { id: "growth",       label: "🌱 Crescita" },
  { id: "sector_trend", label: "📈 Trend" },
];

const JOURNEY_FILTERS: Array<{ id: DiscoveryJourneyType; label: string }> = [
  { id: "all",            label: "Tutti" },
  { id: "developer",      label: "👨‍💻 Dev" },
  { id: "designer",       label: "🎨 Design" },
  { id: "marketer",       label: "📣 Marketing" },
  { id: "career_changer", label: "🔄 Career switch" },
  { id: "entrepreneur",   label: "🚀 Imprenditore" },
  { id: "student",        label: "🎓 Studente" },
];

export const DiscoveryFeedPage: React.FC = () => {
  const {
    items, isLoading, isLoadingMore, error,
    typeFilter, setTypeFilter,
    journeyFilter, setJourneyFilter,
    refresh, loadMore, hasMore,
    savedIds, toggleSaved, markSeen, seenIds,
  } = useDiscoveryFeed();

  const [showJourneyFilters, setShowJourneyFilters] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-bold text-gray-900">🔭 Discovery</h1>
            <p className="text-xs text-gray-400">Contenuti selezionati per te</p>
          </div>
          <button
            onClick={refresh}
            className="p-2 rounded-xl hover:bg-gray-100 transition text-gray-400 hover:text-gray-700"
            title="Aggiorna feed"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              className="w-5 h-5 stroke-current" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
          </button>
        </div>

        {/* Type filter pills */}
        <div className="max-w-5xl mx-auto mt-2 -mx-4 px-4 overflow-x-auto scrollbar-hide">
          <div className="flex gap-1.5 pb-1 min-w-max">
            {TYPE_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setTypeFilter(f.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                  typeFilter === f.id
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {f.label}
              </button>
            ))}

            {/* Toggle journey filters */}
            <button
              onClick={() => setShowJourneyFilters((v) => !v)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                showJourneyFilters || journeyFilter !== "all"
                  ? "bg-purple-100 text-purple-700"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              🎯 Per chi
            </button>
          </div>
        </div>

        {/* Journey filter pills (collapsible) */}
        {showJourneyFilters && (
          <div className="max-w-5xl mx-auto mt-1.5 -mx-4 px-4 overflow-x-auto scrollbar-hide">
            <div className="flex gap-1.5 pb-1 min-w-max">
              {JOURNEY_FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setJourneyFilter(f.id)}
                  className={`px-3 py-1 rounded-full text-xs whitespace-nowrap transition ${
                    journeyFilter === f.id
                      ? "bg-purple-600 text-white"
                      : "bg-purple-50 text-purple-600 hover:bg-purple-100"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-5">

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
            ⚠️ {error}
          </div>
        )}

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <DiscoveryItemSkeleton key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🔭</p>
            <p className="text-gray-500 font-medium">Nessun contenuto disponibile</p>
            <p className="text-gray-400 text-sm mt-1">Prova a cambiare filtro o aggiorna il feed</p>
            <button
              onClick={refresh}
              className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm hover:bg-indigo-700 transition"
            >
              Aggiorna
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item) => (
                <DiscoveryItemCard
                  key={item.id}
                  item={item}
                  isSaved={savedIds.has(item.id)}
                  isSeen={seenIds.has(item.id)}
                  onSave={toggleSaved}
                  onSeen={markSeen}
                />
              ))}
            </div>

            {/* Load more */}
            <div className="mt-6 text-center">
              {isLoadingMore ? (
                <div className="flex justify-center gap-4">
                  {Array.from({ length: 3 }).map((_, i) => <DiscoveryItemSkeleton key={i} />)}
                </div>
              ) : hasMore ? (
                <button
                  onClick={loadMore}
                  className="px-6 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition"
                >
                  Carica altri
                </button>
              ) : (
                <p className="text-xs text-gray-400">Hai visto tutto ✓</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
