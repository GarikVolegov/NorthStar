import { getJson, postJson, stream } from "@/lib/apiClient";
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

type SearchStreamEvent =
  | { type: "status"; value: string }
  | { type: "route"; route: RouterOutput }
  | { type: "results"; results: SearchResult[] }
  | { type: "sources"; chunks: AiSource[] }
  | { type: "token"; value: string }
  | { type: "done" }
  | { type: "error" }
  | { type: "unknown" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSearchResults(value: unknown): SearchResult[] {
  return Array.isArray(value) ? (value as SearchResult[]) : [];
}

function parseAiSources(value: unknown): AiSource[] {
  return Array.isArray(value) ? (value as AiSource[]) : [];
}

function parseRouterOutput(value: unknown): RouterOutput {
  if (!isRecord(value)) return DEFAULT_ROUTE;
  return {
    intent: typeof value.intent === "string" ? value.intent as RouterOutput["intent"] : DEFAULT_ROUTE.intent,
    user_mode: typeof value.user_mode === "string" ? value.user_mode as RouterOutput["user_mode"] : DEFAULT_ROUTE.user_mode,
    experience_level: typeof value.experience_level === "string" ? value.experience_level as RouterOutput["experience_level"] : DEFAULT_ROUTE.experience_level,
    needs_clarification: value.needs_clarification === true,
    clarifying_question: typeof value.clarifying_question === "string" ? value.clarifying_question : null,
    ui_widget_type: typeof value.ui_widget_type === "string" ? value.ui_widget_type as RouterOutput["ui_widget_type"] : DEFAULT_ROUTE.ui_widget_type,
    retrieval_strategy: typeof value.retrieval_strategy === "string" ? value.retrieval_strategy as RouterOutput["retrieval_strategy"] : DEFAULT_ROUTE.retrieval_strategy,
    confidence: typeof value.confidence === "number" ? value.confidence : DEFAULT_ROUTE.confidence,
  };
}

function parseSearchStreamEvent(line: string): SearchStreamEvent {
  try {
    const parsed = JSON.parse(line.slice(6)) as unknown;
    if (!isRecord(parsed) || typeof parsed.type !== "string") {
      return { type: "unknown" };
    }
    if (parsed.type === "status" && typeof parsed.value === "string") {
      return { type: "status", value: parsed.value };
    }
    if (parsed.type === "route") {
      return { type: "route", route: parseRouterOutput(parsed.route) };
    }
    if (parsed.type === "results") {
      return { type: "results", results: parseSearchResults(parsed.results) };
    }
    if (parsed.type === "sources") {
      return { type: "sources", chunks: parseAiSources(parsed.chunks) };
    }
    if (parsed.type === "token" && typeof parsed.value === "string") {
      return { type: "token", value: parsed.value };
    }
    if (parsed.type === "done") return { type: "done" };
    if (parsed.type === "error") return { type: "error" };
    return { type: "unknown" };
  } catch {
    return { type: "unknown" };
  }
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
  const [orchestratedResults, setOrchestratedResults] = useState<SearchResult[]>([]);
  const readerRef = useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null);

  // ── Legacy React Query (fallback / risultati DB istantanei) ───────────────
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

  const results    = orchestratedResults.length > 0 ? orchestratedResults : (data?.results ?? []);
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
    setOrchestratedResults([]);
    setIsStreaming(true);

    try {
      const res = await stream(`${BASE}api/search/orchestrate`, {
        method: "POST",
        credentials: "include",
        body: JSON.stringify({ q, sessionId, history: msgs }),
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
          const event = parseSearchStreamEvent(line);
          if (event.type === "status") setAiStatus(event.value);
          if (event.type === "route") setAiRoute(event.route);
          if (event.type === "results") setOrchestratedResults(event.results);
          if (event.type === "sources") setAiSources(event.chunks);
          if (event.type === "token") {
            finalText += event.value;
            setAiTokens((t) => t + event.value);
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

  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setOrchestratedResults([]);
    }
    if (debouncedQuery.length < 3) {
      stopStream();
      setAiTokens("");
      setAiStatus(null);
      setAiSources([]);
    }
  }, [debouncedQuery]);

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
      setOrchestratedResults([]);
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
    // AI orchestrator
    aiTokens,
    aiStatus,
    aiSources,
    isStreaming,
    history,
    sendFollowUp,
  };
}
