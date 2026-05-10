/**
 * useDiscoveryFeed — hook per il feed Discovery personalizzato.
 *
 * FEATURES:
 *   - Fetch paginato: prima pagina (limit 20) + "carica altri" (append)
 *   - Filtro per tipo: news | opportunity | formation | growth | sector_trend | all
 *   - Filtro per journeyType: developer | designer | marketer | career_changer | entrepreneur | student | all
 *   - Seen tracking: POST /api/discovery/seen/:id
 *   - Saved items: toggle POST /api/discovery/saved/:id
 *   - Refresh manuale
 *   - Cache sessionStorage 10min (stale-while-revalidate)
 */
import { useState, useEffect, useCallback, useRef } from "react";

export type DiscoveryItemType =
  | "news" | "opportunity" | "formation" | "growth" | "sector_trend" | "all";

export type DiscoveryJourneyType =
  | "developer" | "designer" | "marketer" | "career_changer"
  | "entrepreneur" | "student" | "all";

export interface DiscoveryItem {
  id:              number;
  type:            string;
  title:           string;
  url:             string;
  source:          string;
  summary:         string;
  imageUrl?:       string | null;
  publishedAt?:    string | null;
  category:        string;
  sectorNames:     string[];
  collectorSource?: string | null;
  // Enrichment
  isEnriched:      boolean;
  relevanceScore:  number;
  skillTags?:      string[] | null;
  insightText?:    string | null;
  difficulty?:     "easy" | "medium" | "advanced" | null;
  journeyTypes?:   string[] | null;
  // Personalizer (future)
  personalScore:   number;
}

interface FeedResponse {
  items: DiscoveryItem[];
  meta:  { total: number; limit: number; typeFilter: string | null; journeyFilter: string | null };
}

const API_BASE = "/api/discovery";
const LIMIT    = 20;

const SESSION_KEY = (type: string, journey: string) =>
  `discovery_feed_${type}_${journey}`;

function getCache(key: string): DiscoveryItem[] | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { items, ts } = JSON.parse(raw) as { items: DiscoveryItem[]; ts: number };
    if (Date.now() - ts > 10 * 60 * 1000) return null;
    return items;
  } catch { return null; }
}
function setCache(key: string, items: DiscoveryItem[]) {
  try { sessionStorage.setItem(key, JSON.stringify({ items, ts: Date.now() })); } catch { /* ignore */ }
}

export interface UseDiscoveryFeedReturn {
  items:          DiscoveryItem[];
  isLoading:      boolean;
  isLoadingMore:  boolean;
  error:          string | null;
  typeFilter:     DiscoveryItemType;
  setTypeFilter:  (t: DiscoveryItemType) => void;
  journeyFilter:  DiscoveryJourneyType;
  setJourneyFilter: (j: DiscoveryJourneyType) => void;
  refresh:        () => void;
  loadMore:       () => void;
  hasMore:        boolean;
  savedIds:       Set<number>;
  toggleSaved:    (id: number) => void;
  markSeen:       (id: number) => void;
  seenIds:        Set<number>;
}

export function useDiscoveryFeed(): UseDiscoveryFeedReturn {
  const [items,         setItems]         = useState<DiscoveryItem[]>([]);
  const [isLoading,     setIsLoading]     = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [typeFilter,    setTypeFilterS]   = useState<DiscoveryItemType>("all");
  const [journeyFilter, setJourneyFilterS]= useState<DiscoveryJourneyType>("all");
  const [page,          setPage]          = useState(0);
  const [hasMore,       setHasMore]       = useState(true);
  const [savedIds,      setSavedIds]      = useState<Set<number>>(new Set());
  const [seenIds,       setSeenIds]       = useState<Set<number>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  const fetchFeed = useCallback(async (
    type: DiscoveryItemType,
    journey: DiscoveryJourneyType,
    pageNum: number,
    force = false,
  ) => {
    const cacheKey = SESSION_KEY(type, journey);

    if (pageNum === 0 && !force) {
      const cached = getCache(cacheKey);
      if (cached) { setItems(cached); setIsLoading(false); }
    }

    if (pageNum === 0) setIsLoading(true);
    else setIsLoadingMore(true);

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const params = new URLSearchParams({ limit: String(LIMIT) });
      if (type !== "all")    params.set("type", type);
      if (journey !== "all") params.set("journeyType", journey);
      if (force)             params.set("refresh", "1");

      const res  = await fetch(`${API_BASE}/feed?${params}`, {
        signal: ctrl.signal,
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: FeedResponse = await res.json();

      if (pageNum === 0) {
        setItems(data.items);
        setCache(cacheKey, data.items);
      } else {
        setItems((prev) => [...prev, ...data.items]);
      }

      setHasMore(data.items.length === LIMIT);
      setError(null);
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") return;
      setError("Errore nel caricamento del feed");
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  // Load saved ids on mount
  useEffect(() => {
    fetch(`${API_BASE}/saved`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: { ids: number[] }) => setSavedIds(new Set(data.ids)))
      .catch(() => {});
  }, []);

  // Refetch when filters change
  useEffect(() => {
    setPage(0); setHasMore(true);
    fetchFeed(typeFilter, journeyFilter, 0);
  }, [typeFilter, journeyFilter, fetchFeed]);

  const setTypeFilter    = useCallback((t: DiscoveryItemType)    => setTypeFilterS(t),    []);
  const setJourneyFilter = useCallback((j: DiscoveryJourneyType) => setJourneyFilterS(j), []);

  const refresh  = useCallback(() => { setPage(0); setHasMore(true); fetchFeed(typeFilter, journeyFilter, 0, true); }, [typeFilter, journeyFilter, fetchFeed]);
  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    const next = page + 1; setPage(next);
    fetchFeed(typeFilter, journeyFilter, next);
  }, [isLoadingMore, hasMore, page, typeFilter, journeyFilter, fetchFeed]);

  const markSeen    = useCallback((id: number) => {
    setSeenIds((p) => { const s = new Set(p); s.add(id); return s; });
    fetch(`${API_BASE}/seen/${id}`, { method: "POST", credentials: "include" }).catch(() => {});
  }, []);

  const toggleSaved = useCallback((id: number) => {
    setSavedIds((p) => { const s = new Set(p); s.has(id) ? s.delete(id) : s.add(id); return s; });
    fetch(`${API_BASE}/saved/${id}`, { method: "POST", credentials: "include" }).catch(() => {});
  }, []);

  return {
    items, isLoading, isLoadingMore, error,
    typeFilter, setTypeFilter,
    journeyFilter, setJourneyFilter,
    refresh, loadMore, hasMore,
    savedIds, toggleSaved, markSeen, seenIds,
  };
}
