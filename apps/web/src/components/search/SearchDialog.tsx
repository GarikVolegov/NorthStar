import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { m, AnimatePresence } from "framer-motion";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { SearchResult, RouterOutput, AiSource } from "@/hooks/useGlobalSearch";
import {
  Briefcase,
  BookOpenText,
  Newspaper,
  Layers,
  Sparkles,
  TrendingUp,
  Lightbulb,
  Bot,
  Cpu,
  ChevronDown,
  ChevronRight,
  Send,
} from "lucide-react";
import { useWendy } from "@/contexts/WendyProvider";
import { cn } from "@/lib/utils";

interface SearchDialogProps {
  query: string;
  setQuery: (q: string) => void;
  results: SearchResult[];
  suggestions: Array<{ title: string; description: string; url: string }>;
  route: RouterOutput;
  hasSemantic: boolean;
  isLoading: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  close: () => void;
  trackClick: (result: SearchResult) => void;
  // AI orchestrator
  aiTokens:    string;
  aiStatus:    string | null;
  aiSources:   AiSource[];
  isStreaming: boolean;
  sendFollowUp: (q: string) => void;
}

const TYPE_CONFIG = {
  sector:  { labelKey: "search.sectors",  icon: Layers,       className: "text-blue-400 bg-blue-500/10"   },
  role:    { labelKey: "search.roles",    icon: Briefcase,    className: "text-green-400 bg-green-500/10" },
  article: { labelKey: "search.articles", icon: BookOpenText, className: "text-amber-400 bg-amber-500/10" },
  news:    { labelKey: "search.news",     icon: Newspaper,    className: "text-purple-400 bg-purple-500/10"},
} as const;

const SUGGESTIONS_DEFAULTS = [
  { title: "Esplora i settori",   description: "Scopri tutti i settori disponibili",      url: "/settori" },
  { title: "Fai il test",         description: "Scopri la tua personalità professionale", url: "/test"    },
  { title: "Trend di mercato",    description: "Le ultime tendenze del lavoro",           url: "/news"    },
  { title: "Coach AI",            description: "Parla con il tuo coach personale",        url: "/coach"   },
];

const ORDER: Array<keyof typeof TYPE_CONFIG> = ["sector", "role", "article", "news"];

// ── Micro components ────────────────────────────────────────────────────────

function AgentStatusBadge({ status }: { status: string }) {
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 border border-primary/20 w-fit mb-3">
      <Cpu className="h-3 w-3 text-primary animate-pulse" />
      <span className="text-[11px] font-medium text-primary">{status}</span>
    </div>
  );
}

function StreamingCursor() {
  return (
    <span className="inline-block w-0.5 h-4 bg-primary ml-0.5 animate-pulse align-middle" />
  );
}

function SourcesAccordion({ sources }: { sources: AiSource[] }) {
  const [open, setOpen] = useState(false);
  if (sources.length === 0) return null;
  return (
    <div className="mt-4 border-t border-border/50 pt-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <BookOpenText className="h-3 w-3" />
        {sources.length} fonte{sources.length > 1 ? "i" : ""} usate
      </button>
      <AnimatePresence>
        {open && (
          <m.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-1.5">
              {sources.map((s, i) => (
                <div key={i} className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg px-2.5 py-1.5">
                  <span className="font-medium text-foreground/70">{s.source}</span>
                  {" — "}
                  {s.content.slice(0, 100)}{s.content.length > 100 ? "…" : ""}
                </div>
              ))}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Mobile detection ────────────────────────────────────────────────────────

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < 768,
  );
  useEffect(() => {
    const fn = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn, { passive: true });
    return () => window.removeEventListener("resize", fn);
  }, []);
  return isMobile;
}

// ── Main component ───────────────────────────────────────────────────────────

export function SearchDialog({
  query,
  setQuery,
  results,
  suggestions,
  route,
  hasSemantic,
  isLoading,
  isOpen,
  setIsOpen,
  close,
  trackClick,
  aiTokens,
  aiStatus,
  aiSources,
  isStreaming,
  sendFollowUp,
}: SearchDialogProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const wendy = useWendy();
  const inputRef = useRef<HTMLInputElement>(null);
  const aiPanelRef = useRef<HTMLDivElement>(null);
  const [followUpInput, setFollowUpInput] = useState("");
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close]);

  // Scroll AI panel to bottom as tokens arrive
  useEffect(() => {
    if (aiPanelRef.current) {
      aiPanelRef.current.scrollTop = aiPanelRef.current.scrollHeight;
    }
  }, [aiTokens]);

  const grouped = results.reduce(
    (acc, r) => { if (!acc[r.type]) acc[r.type] = []; acc[r.type].push(r); return acc; },
    {} as Record<string, typeof results>,
  );

  function handleSelect(url: string) { setLocation(url); close(); }
  function handleResultSelect(item: SearchResult) { trackClick(item); setLocation(item.url); close(); }
  function askWendy() { close(); setTimeout(() => wendy.ask(query), 200); }

  function handleFollowUp(e: React.FormEvent) {
    e.preventDefault();
    if (!followUpInput.trim()) return;
    sendFollowUp(followUpInput.trim());
    setQuery(followUpInput.trim());
    setFollowUpInput("");
  }

  const showDefaultSuggestions = query.length < 2 && !isLoading;
  const showResults = !isLoading && results.length > 0;
  const hasSuggestions = suggestions.length > 0;
  const activeSuggestions = hasSuggestions ? suggestions : SUGGESTIONS_DEFAULTS;

  // AI panel visible when streaming or has response
  const isAIActive = isStreaming || aiTokens.length > 0;
  const queryLong  = query.length >= 3;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <m.div
            key="search-backdrop"
            className={cn("fixed inset-0 z-40", isMobile && "bg-black/70 backdrop-blur-sm")}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={close}
          />

          {/* Container: bottom sheet su mobile, dropdown su desktop */}
          <m.div
            key="search-dialog"
            className={isMobile
              ? "fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-3xl bg-card/95 backdrop-blur-xl border-t border-white/10 shadow-2xl overflow-hidden"
              : "fixed z-50 left-1/2 -translate-x-1/2 w-full px-4"}
            style={isMobile
              ? { maxHeight: "85dvh" }
              : { top: "68px", maxWidth: isAIActive && queryLong ? "900px" : "640px" }}
            initial={isMobile ? { y: "100%" } : { opacity: 0, y: -8, scale: 0.98 }}
            animate={isMobile ? { y: 0 }   : { opacity: 1, y: 0,   scale: 1 }}
            exit={isMobile    ? { y: "100%" } : { opacity: 0, y: -8, scale: 0.98 }}
            transition={isMobile
              ? { type: "spring", stiffness: 300, damping: 35 }
              : { duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Drag handle (solo mobile) */}
            {isMobile && (
              <div className="flex justify-center pt-2.5 pb-1 shrink-0">
                <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
              </div>
            )}

            <div className={cn(
              "overflow-hidden",
              isMobile ? "flex flex-col flex-1" : "rounded-2xl border border-white/10 bg-card/95 backdrop-blur-xl shadow-2xl",
            )}>
              {/* Input sempre in cima */}
              <Command shouldFilter={false}>
                <CommandInput
                  ref={inputRef}
                  placeholder={isAIActive ? "Fai una domanda di follow-up..." : t("search.placeholder")}
                  value={query}
                  onValueChange={setQuery}
                  className="border-b border-white/10"
                />

                {/* Layout split quando AI è attiva (solo desktop) */}
                {isAIActive && queryLong && !isMobile ? (
                  <div className="flex" style={{ minHeight: "320px", maxHeight: "65vh" }}>

                    {/* Colonna sinistra: risultati DB */}
                    <div className="w-2/5 border-r border-white/10 overflow-y-auto">
                      <CommandList className="max-h-none">
                        {isLoading && (
                          <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
                            <Sparkles className="h-4 w-4 animate-pulse text-primary" />
                            Ricerca in corso...
                          </div>
                        )}
                        {showResults && ORDER.filter((type) => grouped[type]?.length).map((type) => {
                          const config = TYPE_CONFIG[type];
                          const Icon   = config.icon;
                          return (
                            <CommandGroup key={type} heading={t(config.labelKey)}>
                              {grouped[type].slice(0, 3).map((item) => (
                                <CommandItem
                                  key={`${type}-${item.id}`}
                                  value={`${item.title} ${item.description}`}
                                  onSelect={() => handleResultSelect(item)}
                                  className="cursor-pointer"
                                >
                                  <div className={`flex h-6 w-6 items-center justify-center rounded-full shrink-0 ${config.className}`}>
                                    <Icon className="h-3 w-3" />
                                  </div>
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-xs font-medium truncate">{item.title}</span>
                                    <span className="text-[11px] text-muted-foreground truncate">{item.description}</span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          );
                        })}
                        {!isLoading && results.length === 0 && query.length >= 2 && (
                          <CommandEmpty>
                            <p className="text-sm">{t("search.noResults", { query })}</p>
                          </CommandEmpty>
                        )}
                      </CommandList>
                    </div>

                    {/* Colonna destra: AI response */}
                    <div
                      ref={aiPanelRef}
                      className="w-3/5 p-4 overflow-y-auto flex flex-col"
                    >
                      {/* Route info chip */}
                      {route.confidence >= 0.6 && (
                        <div className="flex items-center gap-1.5 mb-3">
                          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">
                            {route.intent}
                          </span>
                          <div className={cn("h-1.5 w-1.5 rounded-full", route.confidence > 0.8 ? "bg-green-400" : "bg-amber-400")} />
                        </div>
                      )}

                      {/* Status badge */}
                      {aiStatus && isStreaming && <AgentStatusBadge status={aiStatus} />}

                      {/* Streaming text */}
                      {(aiTokens || isStreaming) && (
                        <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap flex-1">
                          {aiTokens}
                          {isStreaming && <StreamingCursor />}
                        </div>
                      )}

                      {/* Sources */}
                      {!isStreaming && <SourcesAccordion sources={aiSources} />}

                      {/* Follow-up input */}
                      {!isStreaming && aiTokens && (
                        <form onSubmit={handleFollowUp} className="mt-4 flex gap-2">
                          <input
                            type="text"
                            value={followUpInput}
                            onChange={(e) => setFollowUpInput(e.target.value)}
                            placeholder="Domanda di follow-up..."
                            className="flex-1 text-xs bg-muted/40 border border-border rounded-full px-3 py-1.5 outline-none focus:border-primary transition-colors"
                          />
                          <button
                            type="submit"
                            disabled={!followUpInput.trim()}
                            className="flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground disabled:opacity-40 transition-opacity"
                          >
                            <Send className="h-3 w-3" />
                          </button>
                        </form>
                      )}
                    </div>
                  </div>

                ) : (
                  /* Layout classico (senza AI attiva) */
                  <CommandList className="max-h-[60vh]">
                    {isLoading && (
                      <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                        <Sparkles className="h-4 w-4 animate-pulse text-primary" />
                        {t("common.searching")}
                      </div>
                    )}

                    {!isLoading && results.length === 0 && query.length >= 2 && (
                      <CommandEmpty>
                        <p>{t("search.noResults", { query })}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Prova: tecnologia, marketing, finanza, sanità, istruzione
                        </p>
                      </CommandEmpty>
                    )}

                    {query.length >= 2 && route?.confidence >= 0.6 && (
                      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{route.intent}</span>
                        <span className="text-[10px] text-muted-foreground/40">·</span>
                        <span className="text-[10px] text-muted-foreground/60">{route.experience_level}</span>
                        <div className="ml-auto flex items-center gap-1">
                          <div className={cn("h-1.5 w-1.5 rounded-full", route.confidence > 0.8 ? "bg-green-400" : route.confidence > 0.6 ? "bg-amber-400" : "bg-muted-foreground/30")} />
                          <span className="text-[10px] text-muted-foreground/40">{Math.round(route.confidence * 100)}%</span>
                        </div>
                      </div>
                    )}

                    {query.length >= 2 && route?.needs_clarification && route?.clarifying_question && (
                      <div className="px-4 py-3 border-b border-white/5">
                        <p className="text-xs text-muted-foreground/80 italic">{route.clarifying_question}</p>
                      </div>
                    )}

                    {/* AI in elaborazione */}
                    {query.length >= 3 && isStreaming && aiStatus && (
                      <div className="px-4 py-3 border-b border-white/5">
                        <AgentStatusBadge status={aiStatus} />
                      </div>
                    )}

                    {query.length >= 2 && (
                      <CommandGroup heading="Wendy AI">
                        <CommandItem value={query} onSelect={askWendy} className="cursor-pointer">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-linear-to-r from-primary to-purple-500 text-white">
                            <Bot className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm font-medium truncate">{t("search.askWendy", { query })}</span>
                            <span className="text-xs text-muted-foreground truncate">{t("search.askWendyDesc")}</span>
                          </div>
                        </CommandItem>
                      </CommandGroup>
                    )}

                    {showDefaultSuggestions && (
                      <CommandGroup heading={t("search.suggestions")}>
                        {activeSuggestions.map((item, i) => (
                          <CommandItem key={`suggestion-${i}`} value={item.title} onSelect={() => handleSelect(item.url)} className="cursor-pointer">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                              {i < 1 ? <TrendingUp className="h-3.5 w-3.5" /> : i < 2 ? <Lightbulb className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-medium truncate">{item.title}</span>
                              <span className="text-xs text-muted-foreground truncate">{item.description}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}

                    {hasSuggestions && !showDefaultSuggestions && (
                      <CommandGroup heading={t("search.suggestions")}>
                        {suggestions.slice(0, 3).map((item, i) => (
                          <CommandItem key={`suggest-${i}`} value={item.title} onSelect={() => handleSelect(item.url)} className="cursor-pointer">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <Sparkles className="h-3.5 w-3.5" />
                            </div>
                            <div className="flex flex-col min-w-0 flex-1">
                              <span className="text-sm font-medium truncate">{item.title}</span>
                              <span className="text-xs text-muted-foreground truncate">{item.description}</span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}

                    {showResults && (
                      ORDER.filter((type) => grouped[type]?.length).map((type) => {
                        const config = TYPE_CONFIG[type];
                        const Icon   = config.icon;
                        return (
                          <CommandGroup key={type} heading={t(config.labelKey)}>
                            {grouped[type].map((item) => (
                              <CommandItem key={`${type}-${item.id}`} value={`${item.title} ${item.description}`} onSelect={() => handleResultSelect(item)} className="cursor-pointer">
                                <div className={`flex h-7 w-7 items-center justify-center rounded-full ${config.className}`}>
                                  <Icon className="h-3.5 w-3.5" />
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                  <span className="text-sm font-medium truncate">{item.title}</span>
                                  <span className="text-xs text-muted-foreground truncate">{item.description}</span>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        );
                      })
                    )}
                  </CommandList>
                )}

                {/* AI streaming (mobile: panel singolo inline) */}
                {isMobile && isAIActive && queryLong && (
                  <div ref={aiPanelRef} className="px-4 py-3 border-t border-white/10 overflow-y-auto" style={{ maxHeight: "40vh" }}>
                    {route.confidence >= 0.6 && (
                      <div className="flex items-center gap-1.5 mb-2">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">{route.intent}</span>
                        <div className={cn("h-1.5 w-1.5 rounded-full", route.confidence > 0.8 ? "bg-green-400" : "bg-amber-400")} />
                      </div>
                    )}
                    {aiStatus && isStreaming && <AgentStatusBadge status={aiStatus} />}
                    {(aiTokens || isStreaming) && (
                      <div className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                        {aiTokens}
                        {isStreaming && <StreamingCursor />}
                      </div>
                    )}
                    {!isStreaming && <SourcesAccordion sources={aiSources} />}
                    {!isStreaming && aiTokens && (
                      <form onSubmit={handleFollowUp} className="mt-3 flex gap-2">
                        <input
                          type="text"
                          value={followUpInput}
                          onChange={(e) => setFollowUpInput(e.target.value)}
                          placeholder="Domanda di follow-up..."
                          className="flex-1 text-xs bg-muted/40 border border-border rounded-full px-3 py-1.5 outline-none focus:border-primary transition-colors"
                        />
                        <button type="submit" disabled={!followUpInput.trim()} className="flex items-center justify-center h-7 w-7 rounded-full bg-primary text-primary-foreground disabled:opacity-40">
                          <Send className="h-3 w-3" />
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </Command>
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
}
