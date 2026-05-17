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
    await fetch(`${BASE}api/search/track`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, sessionId }),
      keepalive: true,
    });
  } catch {}
}

export function useGlobalSearch() {
  const [query, setQuery]         = useState("");
  const [isOpen, setIsOpen]       = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 350);

  // ── AI orchestrator state ──────────────────────────────────────────────────
  const [aiTokens, setAiTokens]       = useState("");
  const [aiStatus, setAiStatus]       = useState<string | null>(null);
  const [aiSources, setAiSources]     = useState<AiSource[]>([]);
  const [aiRoute, setAiRoute]         = useState<RouterOutput>(DEFAULT_ROUTE);
  const [isStreaming, setIsStreaming]  = useState(false);
  const [history, setHistory]         = useState<ChatMessage[]>([]);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  // ── Legacy React Query (fallback / risultati DB istantanei) ───────────────
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

  const results    = data?.results  ?? [];
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

  const suggestions = suggestData?.suggestions ?? [];

  // ── Wendy AI streaming (integrated directly in search bar) ──────────────────

  function stopStream() {
    readerRef.current?.cancel().catch(() => {});
    readerRef.current = null;
    setIsStreaming(false);
  }

  const startWendyAI = useCallback(async (q: string, msgs: ChatMessage[]) => {
    stopStream();
    setAiTokens("");
    setAiStatus(null);
    setAiSources([]);
    setIsStreaming(true);

    try {
      const token = sessionStorage.getItem("northstar_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${BASE}api/wendy/ask`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ message: q, history: msgs }),
      });

      if (!res.ok || !res.body) {
        setIsStreaming(false);
        return;
      }

      const reader  = res.body.getReader();
      readerRef.current = reader;
      const decoder = new TextDecoder();
      let   buf     = "";
      let   finalText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n\n");
        buf = lines.pop()!;

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          let event: Record<string, unknown>;
          try { event = JSON.parse(line.slice(6)); } catch { continue; }

          if (event.type === "status")  setAiStatus(event.value as string);
          if (event.type === "sources") setAiSources(event.chunks as AiSource[]);
          if (event.type === "token") {
            const tok = event.value as string;
            finalText += tok;
            setAiTokens((t) => t + tok);
          }
          if (event.type === "done") {
            setIsStreaming(false);
            if (finalText) {
              setHistory((h) => [
                ...h,
                { role: "user",      content: q },
                { role: "assistant", content: finalText },
              ]);
            }
            break;
          }
          if (event.type === "error") {
            setIsStreaming(false);
            break;
          }
        }
      }
    } catch {
      setIsStreaming(false);
    }
  }, []);

  // Lancia Wendy AI quando la query cambia (>= 3 chars)
  useEffect(() => {
    if (debouncedQuery.length >= 3 && isOpen) {
      startWendyAI(debouncedQuery, history);
    } else if (debouncedQuery.length < 3) {
      stopStream();
      setAiTokens("");
      setAiStatus(null);
      setAiSources([]);
    }
  }, [debouncedQuery, isOpen]);

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
      stopStream();
      if (query && query.length >= 2) {
        trackSearch({ query, resultsShown: results, dismissed: true });
      }
      setQuery("");
      setAiTokens("");
      setAiStatus(null);
      setAiSources([]);
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

  // Follow-up: aggiunge alla history e richiama Wendy AI
  const sendFollowUp = useCallback((followUpQuery: string) => {
    setQuery(followUpQuery);
    startWendyAI(followUpQuery, history);
  }, [history, startWendyAI]);

  return {
    query,
    setQuery,
    results,
    suggestions,
    route: aiRoute,
    hasSemantic,
    isLoading: isLoading && debouncedQuery.length >= 2,
    isError,
    isOpen,
    setIsOpen,
    close,
    trackClick,
    inputRef,
    debouncedQuery,
    // AI orchestrator
    aiTokens,
    aiStatus,
    aiSources,
    isStreaming,
    history,
    sendFollowUp,
  };
}
