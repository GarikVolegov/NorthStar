/**
 * useDiscoveryFeed — hook per il feed di discovery personalizzato.
 *
 * FEATURES:
 *   - Fetch paginato: prima pagina (limit 20) + "carica altri" (append)
 *   - Filtro per tipo: news | opportunity | formation | growth | sector_trend | all
 *   - Seen tracking: invia POST /api/discovery/seen/:id quando l'utente apre un item
 *   - Saved items: toggle POST /api/discovery/saved/:id
 *   - Refresh manuale: refetch con forceRefresh=true
 *   - Loading/error state
 *
 * CACHE:
 *   Il backend ha cache 30min. Il frontend usa SWR-like stale-while-revalidate
 *   implementato manualmente: al mount mostra dati cached da sessionStorage,
 *   poi re-fetcha in background.
 */
import { useState, useEffect, useCallback, useRef } from "react";

export type DiscoveryItemType =
  | "news"
  | "opportunity"
  | "formation"
  | "growth"
  | "sector_trend"
  | "all";

export interface DiscoveryItem {
  id:             number;
  type:           string;
  title:          string;
  url:            string;
  source:         string;
  summary:        string;
  imageUrl?:      string | null;
  publishedAt?:   string | null;
  category:       string;
  sectorNames:    string[];
  skillTags?:     string[] | null;
  insightText?:   string | null;
  difficulty?:    "easy" | "medium" | "advanced" | null;
  journeyTypes?:  string[] | null;
  relevanceScore: number;
  personalScore:  number;
  collectorSource?: string | null;
}

interface FeedResponse {
  items: DiscoveryItem[];
  meta:  { total: number; limit: number; typeFilter: string | null };
}

const API_BASE = "/api/discovery";
const SESSION_CACHE_KEY = (type: string) => `discovery_feed_cache_${type}`;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10min client-side

function getSessionCache(key: string): DiscoveryItem[] | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const { items, ts } = JSON.parse(raw) as { items: DiscoveryItem[]; ts: number };
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return items;
  } catch { return null; }
}

function setSessionCache(key: string, items: DiscoveryItem[]): void {
  try {
    sessionStorage.setItem(key, JSON.stringify({ items, ts: Date.now() }));
  } catch { /* quota exceeded, ignore */ }
}

export interface UseDiscoveryFeedReturn {
  items:       DiscoveryItem[];
  isLoading:   boolean;
  isLoadingMore: boolean;
  error:       string | null;
  typeFilter:  DiscoveryItemType;
  setTypeFilter: (t: DiscoveryItemType) => void;
  refresh:     () => void;
  loadMore:    () => void;
  hasMore:     boolean;
  savedIds:    Set<number>;
  toggleSaved: (id: number) => void;
  markSeen:    (id: number) => void;
  seenIds:     Set<number>;
}

export function useDiscoveryFeed(): UseDiscoveryFeedReturn {
  const [items, setItems]           = useState<DiscoveryItem[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [typeFilter, setTypeFilterState] = useState<DiscoveryItemType>("all");
  const [page, setPage]             = useState(0);
  const [hasMore, setHasMore]       = useState(true);
  const [savedIds, setSavedIds]     = useState<Set<number>>(new Set());
  const [seenIds, setSeenIds]       = useState<Set<number>>(new Set());
  const abortRef                    = useRef<AbortController | null>(null);

  const LIMIT = 20;

  const fetchFeed = useCallback(async (
    type: DiscoveryItemType,
    pageNum: number,
    force = false,
  ) => {
    const cacheKey = SESSION_CACHE_KEY(type);

    // Show cached data instantly on first page
    if (pageNum === 0 && !force) {
      const cached = getSessionCache(cacheKey);
      if (cached) {
        setItems(cached);
        setIsLoading(false);
        // Still re-fetch in background
      }
    }

    if (pageNum === 0) setIsLoading(true);
    else setIsLoadingMore(true);

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        ...(type !== "all" && { type }),
        ...(force && { refresh: "1" }),
      });
      const res  = await fetch(`${API_BASE}/feed?${params}`, {
        signal: ctrl.signal,
        credentials: "include",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: FeedResponse = await res.json();

      if (pageNum === 0) {
        setItems(data.items);
        setSessionCache(cacheKey, data.items);
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

  // Fetch saved items on mount
  useEffect(() => {
    fetch(`${API_BASE}/saved`, { credentials: "include" })
      .then((r) => r.json())
      .then((data: { ids: number[] }) => setSavedIds(new Set(data.ids)))
      .catch(() => { /* ignore */ });
  }, []);

  // Refetch when typeFilter changes
  useEffect(() => {
    setPage(0);
    setHasMore(true);
    fetchFeed(typeFilter, 0);
  }, [typeFilter, fetchFeed]);

  const setTypeFilter = useCallback((t: DiscoveryItemType) => {
    setTypeFilterState(t);
  }, []);

  const refresh = useCallback(() => {
    setPage(0);
    setHasMore(true);
    fetchFeed(typeFilter, 0, true);
  }, [typeFilter, fetchFeed]);

  const loadMore = useCallback(() => {
    if (isLoadingMore || !hasMore) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchFeed(typeFilter, nextPage);
  }, [isLoadingMore, hasMore, page, typeFilter, fetchFeed]);

  const markSeen = useCallback((id: number) => {
    setSeenIds((prev) => { const s = new Set(prev); s.add(id); return s; });
    fetch(`${API_BASE}/seen/${id}`, { method: "POST", credentials: "include" })
      .catch(() => { /* non-critical */ });
  }, []);

  const toggleSaved = useCallback((id: number) => {
    setSavedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id); else s.add(id);
      return s;
    });
    fetch(`${API_BASE}/saved/${id}`, { method: "POST", credentials: "include" })
      .catch(() => { /* non-critical */ });
  }, []);

  return {
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
  };
}
