/**
 * DiscoveryFeedPage — pagina principale "Scopri".
 *
 * LAYOUT:
 *   [Header: titolo + pulsante refresh]
 *   [Tab bar: Tutti | Notizie | Opportunità | Formazione | Crescita | Trend]
 *   [Grid 1-2-3 col responsive di DiscoveryItemCard]
 *   [Pulsante "Carica altri" / spinner]
 *
 * RESPONSIVE:
 *   Mobile:  1 colonna
 *   Tablet:  2 colonne (sm:)
 *   Desktop: 3 colonne (lg:)
 *
 * STATO VUOTO:
 *   Se items.length === 0 dopo il caricamento → empty state con call to action.
 */
import React, { useEffect, useRef } from "react";
import { useDiscoveryFeed, type DiscoveryItemType } from "./useDiscoveryFeed";
import { DiscoveryItemCard } from "./DiscoveryItemCard";
import { DiscoveryItemSkeleton } from "./DiscoveryItemSkeleton";

const TABS: Array<{ label: string; value: DiscoveryItemType }> = [
  { label: "✨ Tutti",        value: "all" },
  { label: "📰 Notizie",     value: "news" },
  { label: "🚀 Opportunità", value: "opportunity" },
  { label: "🎓 Formazione",  value: "formation" },
  { label: "🌱 Crescita",    value: "growth" },
  { label: "📈 Trend",       value: "sector_trend" },
];

export const DiscoveryFeedPage: React.FC = () => {
  const {
    items,
    isLoading,
    isLoadingMore,
    error,
    typeFilter,
    setTypeFilter,
    refresh,
    loadMore,
    hasMore,
    savedIds,
    toggleSaved,
    markSeen,
    seenIds,
  } = useDiscoveryFeed();

  // Infinite scroll sentinel
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting && hasMore && !isLoadingMore) loadMore(); },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, isLoadingMore, loadMore]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">🔭 Scopri</h1>
            <p className="text-xs text-gray-500">Notizie, opportunità e formazione per te</p>
          </div>
          <button
            onClick={refresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              className={`w-4 h-4 stroke-current ${isLoading ? "animate-spin" : ""}`} strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            Aggiorna
          </button>
        </div>

        {/* Tab bar */}
        <div className="max-w-5xl mx-auto mt-3 flex gap-1 overflow-x-auto scrollbar-hide pb-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setTypeFilter(tab.value)}
              className={`
                flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all
                ${typeFilter === tab.value
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }
              `}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-4 py-5">

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {/* Loading skeletons */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <DiscoveryItemSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Feed grid */}
        {!isLoading && items.length > 0 && (
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
        )}

        {/* Empty state */}
        {!isLoading && items.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">🔍</div>
            <h2 className="text-lg font-semibold text-gray-700 mb-1">Nessun contenuto trovato</h2>
            <p className="text-sm text-gray-400 max-w-xs">
              Il sistema sta raccogliendo nuovi contenuti. Torna tra qualche ora
              o prova a cambiare filtro.
            </p>
            <button
              onClick={refresh}
              className="mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition"
            >
              Riprova
            </button>
          </div>
        )}

        {/* Load more sentinel (infinite scroll) */}
        {!isLoading && items.length > 0 && (
          <div ref={sentinelRef} className="py-6 flex justify-center">
            {isLoadingMore && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Carico altri...
              </div>
            )}
            {!hasMore && !isLoadingMore && (
              <p className="text-xs text-gray-300">Hai visto tutto per oggi ✓</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
