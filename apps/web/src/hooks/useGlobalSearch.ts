import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL || "/";

export interface SearchResult {
  type: "sector" | "role" | "article" | "news";
  id: number;
  title: string;
  description: string;
  url: string;
  icon: string;
  color: string;
  score_lexical?: number;
  score_semantic?: number | null;
  score_total?: number;
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

interface HybridResponse {
  results: SearchResult[];
  has_semantic: boolean;
}

interface SuggestResponse {
  suggestions: SearchSuggestion[];
}

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
    await fetch(`${BASE}api/search/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, sessionId }),
      keepalive: true,
    });
  } catch {}
}

export function useGlobalSearch() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [lastQuery, setLastQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  const { data, isLoading, isError } = useQuery<HybridResponse>({
    queryKey: ["global-search-hybrid", debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 2) return { results: [], has_semantic: false };
      const res = await fetch(`${BASE}api/search/hybrid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: debouncedQuery, limit: 10 }),
      });
      if (!res.ok) throw new Error("Hybrid search failed");
      return res.json();
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
    gcTime: 60_000,
  });

  const results = data?.results ?? [];
  const hasSemantic = data?.has_semantic ?? false;

  const { data: suggestData } = useQuery<SuggestResponse>({
    queryKey: ["global-search-suggest", debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 2) return { suggestions: [] };
      const res = await fetch(
        `${BASE}api/search/suggest?q=${encodeURIComponent(debouncedQuery)}`,
        { headers: { Accept: "application/json" } },
      );
      if (!res.ok) return { suggestions: [] };
      return res.json();
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 60_000,
    gcTime: 120_000,
    retry: false,
  });

  const { data: routeData } = useQuery<RouterOutput>({
    queryKey: ["global-search-route", debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < 2) {
        return {
          intent: "explore",
          user_mode: "exploring",
          experience_level: "beginner",
          needs_clarification: false,
          clarifying_question: null,
          ui_widget_type: "results_list",
          retrieval_strategy: "hybrid",
          confidence: 0.5,
        } as RouterOutput;
      }
      const res = await fetch(`${BASE}api/search/route`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: debouncedQuery }),
      });
      if (!res.ok) throw new Error("Route failed");
      return res.json();
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 60_000,
    gcTime: 120_000,
    retry: false,
  });

  const suggestions = suggestData?.suggestions ?? [];
  const route = routeData ?? {
    intent: "explore" as const,
    user_mode: "exploring" as const,
    experience_level: "beginner" as const,
    needs_clarification: false,
    clarifying_question: null,
    ui_widget_type: "results_list" as const,
    retrieval_strategy: "hybrid" as const,
    confidence: 0.5,
  };

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

  return {
    query,
    setQuery,
    results,
    suggestions,
    route,
    hasSemantic,
    isLoading: isLoading && debouncedQuery.length >= 2,
    isError,
    isOpen,
    setIsOpen,
    close,
    trackClick,
    inputRef,
    debouncedQuery,
  };
}
