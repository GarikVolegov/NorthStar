import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { DiscoveryMeta } from "@/components/discovery/DiscoveryMeta";
import { useWendy } from "@/contexts/WendyProvider";
import type { RouterOutput, SearchResult } from "@/hooks/useGlobalSearch";
import { useWendyChat } from "@/hooks/useWendyChat";
import { eventBus } from "@/lib/event-bus";
import { cn } from "@/lib/utils";
import { ORDER, SUGGESTIONS_DEFAULTS, TYPE_CONFIG } from "./searchDialogConfig";
import { useSearchDialogMobile } from "./useSearchDialogMobile";
import { WendyConsole } from "@/components/wendy/WendyConsole";
import { AnimatePresence, m, useDragControls } from "framer-motion";
import {
  Lightbulb,
  Search,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";

interface SearchDialogProps {
  query: string;
  setQuery: (q: string) => void;
  results: SearchResult[];
  suggestions: Array<{ title: string; description: string; url: string }>;
  route: RouterOutput;
  hasSemantic: boolean;
  searchMode?: "semantic" | "hybrid" | "keyword";
  indexStatus?: "ready" | "degraded" | "unavailable";
  isLoading: boolean;
  isError?: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  close: () => void;
  trackClick: (result: SearchResult) => void;
}

// Main component

export function SearchDialog({
  query,
  setQuery,
  results,
  suggestions,
  route,
  hasSemantic,
  searchMode = hasSemantic ? "semantic" : "keyword",
  indexStatus = "ready",
  isLoading,
  isError = false,
  isOpen,
  close,
  trackClick,
}: SearchDialogProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const wendy = useWendy();
  const closeWendy = wendy.close;
  const consumePendingAsk = wendy.consumePendingAsk;
  const getPageHints = wendy.getPageHints;
  const inputRef = useRef<HTMLInputElement>(null);
  const isMobile = useSearchDialogMobile();
  const chat = useWendyChat({ apiUrl: "/api/ai/wendy", maxRetries: 0 });
  const dragControls = useDragControls();

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || chat.isStreaming) return;
    const pending = consumePendingAsk();
    if (!pending) return;
    setQuery(pending);
    void chat.sendMessage(pending);
  }, [chat, consumePendingAsk, isOpen, setQuery]);

  useEffect(() => {
    if (chat.stt.isListening) {
      setQuery(chat.stt.transcript + chat.stt.interimTranscript);
    }
  }, [chat.stt.interimTranscript, chat.stt.isListening, chat.stt.transcript, setQuery]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        close();
        closeWendy();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close, closeWendy]);

  const grouped = results.reduce(
    (acc, r) => {
      const bucket = acc[r.type] ?? [];
      bucket.push(r);
      acc[r.type] = bucket;
      return acc;
    },
    {} as Record<string, typeof results>,
  );

  const handleClose = useCallback(() => {
    close();
    closeWendy();
  }, [close, closeWendy]);

  useEffect(() => {
    if (!isOpen) return;
    return eventBus.on("wendy:navigation-complete", () => {
      handleClose();
    });
  }, [handleClose, isOpen]);

  function handleSelect(url: string) {
    if (url === "#wendy") {
      setQuery("");
      window.requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setLocation(url);
      handleClose();
    }
  }
  function handleResultSelect(item: SearchResult) { trackClick(item); setLocation(item.url); handleClose(); }

  function askCurrentQuery() {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    void chat.sendMessage(trimmed);
  }

  function askQuickAction(label: string) {
    setQuery(label);
    void chat.sendMessage(label);
  }

  const showDefaultSuggestions = query.length < 2 && !isLoading;
  const showResults = !isLoading && results.length > 0;
  const hasSearchQuery = query.trim().length >= 2;
  const showSearchError = !isLoading && isError && hasSearchQuery;
  const showSearchEmpty = !isLoading && !isError && results.length === 0 && hasSearchQuery;
  const hasSuggestions = suggestions.length > 0;
  const pageHints = getPageHints();
  const quickActions = pageHints.quickActions.slice(0, 3);
  const activeSuggestions = hasSuggestions ? suggestions : SUGGESTIONS_DEFAULTS;
  const mobileDragLabel = "Trascina verso il basso per chiudere";
  const globalSearchTitle = "Ricerca globale";
  const globalSearchDescription = "Cerca pagine, ruoli, articoli e contenuti NorthStar.";
  const globalResultsDescription = "Risultati nell'app NorthStar.";
  const searchPlaceholder = t("search.placeholder");
  const searchingLabel = t("common.searching");
  const searchInProgressLabel = "Ricerca in corso...";
  const searchErrorTitle = "La ricerca globale non e disponibile adesso.";
  const searchErrorHint = "Puoi riprovare tra poco o chiedere a Wendy.";
  const searchErrorSideHint = "Puoi riprovare tra poco o chiedere a Wendy qui accanto.";
  const searchEmptyTitle = `Nessun risultato globale per "${query}"`;
  const searchEmptyHint = "Prova termini piu generali oppure chiedi a Wendy di guidarti.";
  const searchEmptySideHint = "Wendy puo aiutarti a riformulare o ragionare sul prossimo passo.";
  const askWendyCurrentLabel = `Chiedi a Wendy di guidarti su "${query}"`;

  // AI panel visible when streaming or has response
  const hasConversation = chat.messages.length > 0 || chat.thinking.active || !!chat.streamError;
  const isAIActive = hasConversation || chat.isStreaming;
  const queryLong  = query.length >= 3 || hasConversation;
  const showSideResults = isLoading || showResults || showSearchEmpty || showSearchError;
  const mobileAIStack = isMobile && isAIActive && queryLong;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <m.div
            key="search-backdrop"
            className="fixed inset-0 z-40 bg-background/65 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={handleClose}
          />

          {/* Container: bottom sheet su mobile, dropdown su desktop */}
          <m.div
            key="search-dialog"
            className={isMobile
              ? "fixed bottom-0 left-0 right-0 z-50 flex flex-col rounded-t-3xl bg-card/95 backdrop-blur-xl border-t border-white/10 shadow-2xl overflow-hidden"
              : "fixed z-50 left-1/2 -translate-x-1/2 w-full px-4"}
            style={isMobile
              ? { height: "85dvh", maxHeight: "85dvh" }
              : { top: "76px", maxWidth: isAIActive && queryLong ? "920px" : "720px" }}
            initial={isMobile ? { y: "100%" } : { opacity: 0, y: -8, scale: 0.98 }}
            animate={isMobile ? { y: 0 }   : { opacity: 1, y: 0,   scale: 1 }}
            exit={isMobile    ? { y: "100%" } : { opacity: 0, y: -8, scale: 0.98 }}
            transition={isMobile
              ? { type: "spring", stiffness: 300, damping: 35 }
              : { duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            drag={isMobile ? "y" : false}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={isMobile ? 0.35 : 0}
            onDragEnd={(_, info) => {
              if (!isMobile) return;
              if (info.offset.y > 120 || info.velocity.y > 500) handleClose();
            }}
          >
            {/* Drag handle (solo mobile, attiva il drag-to-dismiss) */}
            {isMobile && (
              <div
                onPointerDown={(e) => dragControls.start(e)}
                className="flex justify-center pt-2.5 pb-1 shrink-0 touch-none cursor-grab active:cursor-grabbing"
                role="separator"
                aria-label={mobileDragLabel}
              >
                <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
              </div>
            )}

            <div className={cn(
              "overflow-hidden",
              isMobile ? "flex min-h-0 flex-1 flex-col" : "rounded-3xl border border-white/10 bg-card/90 backdrop-blur-2xl shadow-2xl",
            )}>
              {/* Input sempre in cima */}
              <Command shouldFilter={false} className={mobileAIStack ? "min-h-0 flex-1 overflow-hidden" : undefined}>
                {(showDefaultSuggestions || query.length < 3) && (
                  <div className="flex gap-2 overflow-x-auto border-b border-white/10 px-3 py-3">
                    {quickActions.map((action) => (
                      <button
                        key={`quick-${action.label}`}
                        type="button"
                        onClick={() => askQuickAction(action.label)}
                        className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                      >
                        {action.icon} {action.label}
                      </button>
                    ))}
                    {activeSuggestions.slice(0, 3).map((item, i) => (
                      <button
                        key={`composer-suggest-${i}`}
                        type="button"
                        onClick={() => handleSelect(item.url)}
                        className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                      >
                        {item.title}
                      </button>
                    ))}
                  </div>
                )}
                {!isAIActive && (
                  <div className="border-b border-white/10">
                    <div className="flex items-center justify-between gap-3 px-3 py-2">
                      <div>
                        <p className="text-xs font-semibold uppercase text-muted-foreground">{globalSearchTitle}</p>
                        <p className="text-[11px] text-muted-foreground/70">{globalSearchDescription}</p>
                      </div>
                      <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] text-muted-foreground">
                        {searchMode}
                      </span>
                    </div>
                    <CommandInput
                      ref={inputRef}
                      placeholder={searchPlaceholder}
                      value={query}
                      onValueChange={setQuery}
                    />
                  </div>
                )}

                {/* Layout split quando AI e attiva (solo desktop) */}
                {isAIActive && queryLong && !isMobile ? (
                  <div className="flex" style={{ minHeight: "320px", maxHeight: "65vh" }}>

                    {/* Colonna sinistra: risultati DB */}
                    {showSideResults && (
                    <section className="w-2/5 border-r border-white/10 overflow-y-auto" aria-label={globalSearchTitle}>
                      <div className="border-b border-white/10 px-4 py-3">
                        <p className="text-xs font-semibold uppercase text-muted-foreground">{globalSearchTitle}</p>
                        <p className="text-[11px] text-muted-foreground/70">{globalResultsDescription}</p>
                      </div>
                      <CommandList className="max-h-none">
                        {isLoading && (
                          <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
                            <Sparkles className="h-4 w-4 animate-pulse text-primary" />
                            {searchInProgressLabel}
                          </div>
                        )}
                        {showResults && ORDER.filter((type) => grouped[type]?.length).map((type) => {
                          const config = TYPE_CONFIG[type];
                          const Icon   = config.icon;
                          const typeResults = grouped[type] ?? [];
                          return (
                            <CommandGroup key={type} heading={t(config.labelKey)}>
                              {typeResults.slice(0, 3).map((item) => (
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
                                    <DiscoveryMeta
                                      sourceLabel={item.sourceLabel}
                                      personalization={item.personalization}
                                      reasonLabels={item.reasonLabels}
                                      className="mt-1"
                                    />
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          );
                        })}
                        {showSearchError && (
                          <div className="px-4 py-5 text-sm text-muted-foreground">
                            <p className="font-medium text-foreground">{searchErrorTitle}</p>
                            <p className="mt-1 text-xs">{searchErrorSideHint}</p>
                          </div>
                        )}
                        {showSearchEmpty && (
                          <div className="px-4 py-5 text-sm text-muted-foreground">
                            <p className="font-medium text-foreground">{searchEmptyTitle}</p>
                            <p className="mt-1 text-xs">{searchEmptySideHint}</p>
                          </div>
                        )}
                      </CommandList>
                    </section>
                    )}

                    <section className={cn(showSideResults ? "w-3/5" : "w-full")} aria-label="Chat Wendy">
                      <WendyConsole
                        chat={chat}
                        query={query}
                        setQuery={setQuery}
                        onSubmit={askCurrentQuery}
                        starterPrompts={quickActions.map((a) => ({ label: a.label, icon: a.icon }))}
                        inputRef={inputRef}
                      />
                    </section>
                  </div>

                ) : (
                  /* Layout classico (senza AI attiva) */
                  <CommandList className={mobileAIStack ? "min-h-0 flex-1 basis-0 max-h-none" : "max-h-[60vh]"}>
                    {isLoading && (
                      <div className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
                        <Sparkles className="h-4 w-4 animate-pulse text-primary" />
                        {searchingLabel}
                      </div>
                    )}

                    {showSearchError && (
                      <CommandEmpty>
                        <p className="font-medium text-foreground">{searchErrorTitle}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {searchErrorHint}
                        </p>
                      </CommandEmpty>
                    )}

                    {showSearchEmpty && (
                      <CommandEmpty>
                        <p>{searchEmptyTitle}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {searchEmptyHint}
                        </p>
                      </CommandEmpty>
                    )}

                    {query.length >= 2 && route?.confidence >= 0.6 && (
                      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">{route.intent}</span>
                        <span className="text-[10px] text-muted-foreground/40">-</span>
                        <span className="text-[10px] text-muted-foreground/60">{route.experience_level}</span>
                        <span className="text-[10px] text-muted-foreground/40">/</span>
                        <span className="text-[10px] text-muted-foreground/60">{searchMode}</span>
                        {indexStatus !== "ready" && (
                          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-500">
                            indice {indexStatus}
                          </span>
                        )}
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

                    {hasSearchQuery && !chat.isStreaming && !isAIActive && (
                      <div className="px-3 py-2 border-b border-white/5">
                        <button
                          type="button"
                          onClick={askCurrentQuery}
                          className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 text-left text-sm font-semibold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                        >
                          <Search className="h-4 w-4" />
                          <span className="min-w-0 truncate">{askWendyCurrentLabel}</span>
                        </button>
                      </div>
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
                        const typeResults = grouped[type] ?? [];
                        return (
                          <CommandGroup key={type} heading={t(config.labelKey)}>
                            {typeResults.map((item) => (
                              <CommandItem key={`${type}-${item.id}`} value={`${item.title} ${item.description}`} onSelect={() => handleResultSelect(item)} className="cursor-pointer">
                                <div className={`flex h-7 w-7 items-center justify-center rounded-full ${config.className}`}>
                                  <Icon className="h-3.5 w-3.5" />
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                  <span className="text-sm font-medium truncate">{item.title}</span>
                                  <span className="text-xs text-muted-foreground truncate">{item.description}</span>
                                  <DiscoveryMeta
                                    sourceLabel={item.sourceLabel}
                                    personalization={item.personalization}
                                    reasonLabels={item.reasonLabels}
                                    className="mt-1"
                                  />
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        );
                      })
                    )}
                  </CommandList>
                )}

                {mobileAIStack && (
                  <section className="h-[52dvh] min-h-0 max-h-[52dvh] shrink-0 overflow-hidden border-t border-white/10" aria-label="Chat Wendy">
                    <WendyConsole
                      chat={chat}
                      query={query}
                      setQuery={setQuery}
                      onSubmit={askCurrentQuery}
                      starterPrompts={quickActions.map((a) => ({ label: a.label, icon: a.icon }))}
                      inputRef={inputRef}
                      compact
                      className="min-h-0"
                    />
                  </section>
                )}
              </Command>
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
}
