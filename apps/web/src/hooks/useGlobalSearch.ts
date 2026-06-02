import type { DiscoveryPersonalization } from "@/components/discovery/DiscoveryMeta";
import { getJson, postJson } from "@/lib/apiClient";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

const BASE = import.meta.env.BASE_URL || "/";

export interface SearchResult {
  type:
    | "sector"
    | "role"
    | "article"
    | "news"
    | "idea"
    | "objective"
    | "calendar"
    | "certification"
    | "memory"
    | "workspace"
    | "profile";
  id: number;
  title: string;
  description: string;
  url: string;
  icon: string;
  color: string;
  score_lexical?: number;
  score_semantic?: number | null;
  score_total?: number;
  visibility?: "public" | "private";
  metadata?: Record<string, unknown>;
  source?: "index" | "live" | "library" | "fallback" | "wendy";
  sourceLabel?: string;
  personalization?: DiscoveryPersonalization;
  reasonLabels?: string[];
  matchSignals?: string[];
  actionLabel?: string;
}

export interface SearchSuggestion {
  title: string;
  description: string;
  url: string;
}

export interface RouterOutput {
  intent: "explore" | "learn" | "solve" | "compare" | "find_job" | "clarify";
  user_mode: "exploring" | "goal_oriented" | "lost" | "expert";
  experience_level: "beginner" | "intermediate" | "advanced";
  needs_clarification: boolean;
  clarifying_question: string | null;
  ui_widget_type: "results_list" | "chat" | "quick_actions" | "sector_cards";
  retrieval_strategy: "semantic" | "keyword" | "hybrid" | "none";
  confidence: number;
}

export interface AiSource {
  content: string;
  source:  string;
  score:   number;
}

export interface ChatMessage {
  role:    "user" | "assistant";
  content: string;
}

interface HybridResponse {
  results: SearchResult[];
  has_semantic: boolean;
  searchMode?: "semantic" | "hybrid" | "keyword";
  indexStatus?: "ready" | "degraded" | "unavailable";
}

interface SuggestResponse {
  suggestions: SearchSuggestion[];
}

const DEFAULT_ROUTE: RouterOutput = {
  intent: "explore",
  user_mode: "exploring",
  experience_level: "beginner",
  needs_clarification: false,
  clarifying_question: null,
  ui_widget_type: "results_list",
  retrieval_strategy: "hybrid",
  confidence: 0.5,
};

let sessionId = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

async function trackSearch(data: Record<string, unknown>) {
  try {
    await postJson(`${BASE}api/search/track`, { ...data, sessionId }, {
      keepalive: true,
    });
  } catch {
    return;
  }
}

export function useGlobalSearch() {
  const [query, setQuery]         = useState("");
  const [isOpen, setIsOpen]       = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 350);

  // Global search stays data-only; Wendy chat is owned by SearchDialog.
  const { data, isLoading, isError } = useQuery<HybridResponse>({
    queryKey: ["global-search-hybrid", debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 2) return { results: [], has_semantic: false };
      return postJson<HybridResponse>(`${BASE}api/search/hybrid`, {
        q: debouncedQuery,
        limit: 10,
      });
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
    gcTime: 60_000,
  });

  const results    = data?.results ?? [];
  const hasSemantic = data?.has_semantic ?? false;
  const indexStatus = data?.indexStatus ?? "ready";
  const searchMode = data?.searchMode ?? (hasSemantic ? "semantic" : "keyword");

  const { data: suggestData } = useQuery<SuggestResponse>({
    queryKey: ["global-search-suggest", debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 2) return { suggestions: [] };
      return getJson<SuggestResponse>(
        `${BASE}api/search/suggest?q=${encodeURIComponent(debouncedQuery)}`,
        { headers: { Accept: "application/json" } },
      );
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 60_000,
    gcTime: 120_000,
    retry: false,
  });

  const suggestions = suggestData?.suggestions ?? [];

  // ── Keyboard shortcut ─────────────────────────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      if (query && query.length >= 2) {
        trackSearch({ query, resultsShown: results, dismissed: true });
      }
      setQuery("");
    }
  }, [isOpen]);

  const close = useCallback(() => setIsOpen(false), []);

  const trackClick = useCallback(
    (result: SearchResult) => {
      trackSearch({
        query: debouncedQuery,
        resultsShown: results,
        resultClicked: result.id,
        resultType: result.type,
      });
    },
    [debouncedQuery, results],
  );

  const sendFollowUp = useCallback((followUpQuery: string) => {
    setQuery(followUpQuery);
  }, []);

  return {
    query,
    setQuery,
    results,
    suggestions,
    route: DEFAULT_ROUTE,
    hasSemantic,
    searchMode,
    indexStatus,
    isLoading: isLoading && debouncedQuery.length >= 2,
    isError,
    isOpen,
    setIsOpen,
    close,
    trackClick,
    inputRef,
    debouncedQuery,
    // Legacy shape kept inert for callers that still read these fields.
    aiTokens: "",
    aiStatus: null,
    aiSources: [] as AiSource[],
    isStreaming: false,
    history: [] as ChatMessage[],
    sendFollowUp,
  };
}
