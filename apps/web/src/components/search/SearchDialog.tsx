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
  ChevronDown,
  ChevronRight,
  Send,
  Search,
  Calendar,
  BadgeCheck,
  Brain,
  Target,
  User,
  Users,
  Mic,
  RotateCcw,
  Square,
} from "lucide-react";
import { useWendy } from "@/contexts/WendyProvider";
import { cn } from "@/lib/utils";
import { useWendyChat, type ChatMessage as WendyMessage } from "@/hooks/useWendyChat";
import { WendyThinkingIndicator } from "@/components/WendyThinkingIndicator";
import { WendyActionCard } from "@/components/wendy/WendyActionCard";
import { UiToolRenderer } from "@/components/wendy/UiToolRenderer";

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
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  close: () => void;
  trackClick: (result: SearchResult) => void;
}

const TYPE_CONFIG = {
  sector:  { labelKey: "search.sectors",  icon: Layers,       className: "text-blue-400 bg-blue-500/10"   },
  role:    { labelKey: "search.roles",    icon: Briefcase,    className: "text-green-400 bg-green-500/10" },
  article: { labelKey: "search.articles", icon: BookOpenText, className: "text-amber-400 bg-amber-500/10" },
  news:    { labelKey: "search.news",     icon: Newspaper,    className: "text-purple-400 bg-purple-500/10"},
  idea:    { labelKey: "Idee",             icon: Lightbulb,    className: "text-yellow-400 bg-yellow-500/10"},
  objective: { labelKey: "Obiettivi",      icon: Target,       className: "text-emerald-400 bg-emerald-500/10"},
  calendar: { labelKey: "Calendario",      icon: Calendar,     className: "text-cyan-400 bg-cyan-500/10"},
  certification: { labelKey: "Certificazioni", icon: BadgeCheck, className: "text-blue-400 bg-blue-500/10"},
  memory:  { labelKey: "Memoria Wendy",    icon: Brain,        className: "text-violet-400 bg-violet-500/10"},
  workspace: { labelKey: "Workspace",      icon: Users,        className: "text-teal-400 bg-teal-500/10"},
  profile: { labelKey: "Profilo",          icon: User,         className: "text-slate-400 bg-slate-500/10"},
} as const;

const SUGGESTIONS_DEFAULTS = [
  { title: "Esplora i settori",   description: "Scopri tutti i settori disponibili",      url: "/settori" },
  { title: "Fai il test",         description: "Scopri la tua personalità professionale", url: "/test"    },
  { title: "Trend di mercato",    description: "Le ultime tendenze del lavoro",           url: "/news"    },
  { title: "Chiedi a Wendy",      description: "Parla con l'assistente AI di NorthStar",  url: "#wendy"   },
];

const ORDER: Array<keyof typeof TYPE_CONFIG> = [
  "idea",
  "objective",
  "calendar",
  "memory",
  "workspace",
  "profile",
  "certification",
  "sector",
  "role",
  "article",
  "news",
];

// ── Micro components ────────────────────────────────────────────────────────

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

function WendySources({ message }: { message: WendyMessage }) {
  if (!message.citations?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {message.citations.slice(0, 4).map((source) => (
        <a
          key={`${message.id}-${source.nodeId}`}
          href={source.url ?? "#"}
          onClick={(event) => {
            if (!source.url) event.preventDefault();
          }}
          className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
        >
          {source.title}
        </a>
      ))}
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
  searchMode = hasSemantic ? "semantic" : "keyword",
  indexStatus = "ready",
  isLoading,
  isOpen,
  setIsOpen,
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
  const aiPanelRef = useRef<HTMLDivElement>(null);
  const [slowThinking, setSlowThinking] = useState(false);
  const isMobile = useIsMobile();
  const chat = useWendyChat({ apiUrl: "/api/ai/wendy", maxRetries: 0 });

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
    if (!chat.thinking.active) {
      setSlowThinking(false);
      return;
    }
    const timeout = window.setTimeout(() => setSlowThinking(true), 9_000);
    return () => window.clearTimeout(timeout);
  }, [chat.thinking.active, chat.thinking.startedAt]);

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

  // Scroll AI panel to bottom as tokens arrive
  useEffect(() => {
    if (aiPanelRef.current) {
      aiPanelRef.current.scrollTop = aiPanelRef.current.scrollHeight;
    }
  }, [chat.messages, chat.thinking.active]);

  const grouped = results.reduce(
    (acc, r) => { if (!acc[r.type]) acc[r.type] = []; acc[r.type].push(r); return acc; },
    {} as Record<string, typeof results>,
  );

  const handleClose = useCallback(() => {
    close();
    closeWendy();
  }, [close, closeWendy]);

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
    setQuery("");
  }

  function askQuickAction(label: string) {
    setQuery(label);
    void chat.sendMessage(label);
  }

  function handleComposerSubmit(event: React.FormEvent) {
    event.preventDefault();
    askCurrentQuery();
  }

  const showDefaultSuggestions = query.length < 2 && !isLoading;
  const showResults = !isLoading && results.length > 0;
  const hasSuggestions = suggestions.length > 0;
  const activeSuggestions = hasSuggestions ? suggestions : SUGGESTIONS_DEFAULTS;
  const pageHints = getPageHints();
  const quickActions = pageHints.quickActions.slice(0, 3);

  // AI panel visible when streaming or has response
  const hasConversation = chat.messages.length > 0 || chat.thinking.active || !!chat.streamError;
  const isAIActive = hasConversation || chat.isStreaming;
  const queryLong  = query.length >= 3 || hasConversation;
  const showSideResults = isLoading || showResults;

  function renderWendyMessage(message: WendyMessage) {
    if (message.role === "error") {
      return (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {message.content}
        </div>
      );
    }

    const hasBody = !!message.content || !!message.uiTool;
    return (
      <div className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
        <div className={cn("max-w-[92%]", message.role === "user" ? "text-right" : "text-left")}>
          {hasBody && (
            <div
              className={cn(
                "rounded-3xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
                message.role === "user"
                  ? "rounded-tr-md bg-primary text-primary-foreground"
                  : "rounded-tl-md bg-muted/65 text-foreground",
              )}
            >
              {message.uiTool ? (
                <UiToolRenderer name={message.uiTool.name} args={message.uiTool.args} />
              ) : (
                message.content
              )}
            </div>
          )}
          {message.role === "assistant" && (
            <>
              {message.actions?.map((action) => (
                <WendyActionCard
                  key={action.id}
                  action={action}
                  onConfirm={() => void chat.confirmAction(message.id, action.id)}
                  onCancel={() => chat.cancelAction(message.id, action.id)}
                />
              ))}
              <WendySources message={message} />
            </>
          )}
        </div>
      </div>
    );
  }

  function renderChatComposer(compact = false) {
    return (
      <form
        onSubmit={handleComposerSubmit}
        className={cn(
          "flex items-center gap-2 border-t border-white/10 bg-card/80 backdrop-blur-xl",
          compact ? "px-3 py-2" : "px-4 py-3",
        )}
      >
        {chat.stt.supported && (
          <button
            type="button"
            onClick={() => chat.stt.isListening ? chat.commitSTT() : chat.stt.start()}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
              chat.stt.isListening ? "bg-destructive text-destructive-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
            )}
            aria-label={chat.stt.isListening ? "Invia dettatura" : "Detta a Wendy"}
          >
            <Mic className="h-4 w-4" />
          </button>
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Chiedi a Wendy..."
          className="min-h-10 flex-1 rounded-full border border-white/10 bg-background/70 px-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60"
        />
        {chat.isStreaming ? (
          <button
            type="button"
            onClick={chat.stopStream}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            aria-label="Interrompi Wendy"
          >
            <Square className="h-4 w-4 fill-current" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={query.trim().length < 2}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            aria-label="Invia a Wendy"
          >
            <Send className="h-4 w-4" />
          </button>
        )}
      </form>
    );
  }

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
              ? { maxHeight: "85dvh" }
              : { top: "76px", maxWidth: isAIActive && queryLong ? "920px" : "720px" }}
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
              isMobile ? "flex flex-col flex-1" : "rounded-3xl border border-white/10 bg-card/90 backdrop-blur-2xl shadow-2xl",
            )}>
              {/* Input sempre in cima */}
              <Command shouldFilter={false}>
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
                  <CommandInput
                    ref={inputRef}
                    placeholder={t("search.placeholder")}
                    value={query}
                    onValueChange={setQuery}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        askCurrentQuery();
                      }
                    }}
                    className="border-b border-white/10"
                  />
                )}

                {/* Layout split quando AI è attiva (solo desktop) */}
                {isAIActive && queryLong && !isMobile ? (
                  <div className="flex" style={{ minHeight: "320px", maxHeight: "65vh" }}>

                    {/* Colonna sinistra: risultati DB */}
                    {showSideResults && (
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
                        {!isLoading && !showResults && (
                          <div className="px-4 py-5 text-sm text-muted-foreground">
                            Nessun risultato nell'app. Wendy puo comunque rispondere qui accanto.
                          </div>
                        )}
                      </CommandList>
                    </div>
                    )}

                    {/* Colonna destra: Wendy AI response */}
                    <div
                      ref={aiPanelRef}
                      className={cn(showSideResults ? "w-3/5" : "w-full", "p-4 overflow-y-auto flex flex-col")}
                    >
                      {/* Wendy header */}
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-linear-to-r from-amber-400 to-amber-600">
                          <span className="text-[10px] font-bold text-white">✦</span>
                        </div>
                        <span className="text-xs font-semibold text-foreground">Wendy</span>
                        <span className="text-[10px] text-muted-foreground">AI Coach</span>
                      </div>

                      <div className="mb-3 flex items-center justify-end gap-1">
                        {chat.messages.length > 0 && (
                          <button
                            type="button"
                            onClick={chat.clearHistory}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                            aria-label="Nuova conversazione"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                        {chat.messages.map((message) => (
                          <div key={message.id}>{renderWendyMessage(message)}</div>
                        ))}
                        <WendyThinkingIndicator thinking={chat.thinking} />
                        {slowThinking && chat.thinking.active && (
                          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
                            Wendy sta ancora lavorando. Puoi interrompere e riprovare con una domanda piu breve.
                          </div>
                        )}
                        {chat.streamError && (
                          <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                            <span>Wendy non ha risposto correttamente.</span>
                            <button type="button" onClick={() => void chat.retryLast()} className="font-semibold underline underline-offset-2">
                              Riprova
                            </button>
                          </div>
                        )}
                      </div>

                      {renderChatComposer()}
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

                    {query.length >= 2 && !chat.isStreaming && !isAIActive && (
                      <div className="px-3 py-2 border-b border-white/5">
                        <button
                          type="button"
                          onClick={askCurrentQuery}
                          className="flex min-h-10 w-full items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 text-left text-sm font-semibold text-primary transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                        >
                          <Search className="h-4 w-4" />
                          <span className="min-w-0 truncate">Chiedi a Wendy di guidarti su “{query}”</span>
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

                {/* Wendy AI streaming (mobile: panel singolo inline) */}
                {isMobile && isAIActive && queryLong && (
                  <div ref={aiPanelRef} className="px-4 py-3 border-t border-white/10 overflow-y-auto" style={{ maxHeight: "40vh" }}>
                    {/* Wendy header */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-linear-to-r from-amber-400 to-amber-600">
                        <span className="text-[8px] font-bold text-white">✦</span>
                      </div>
                      <span className="text-xs font-semibold text-foreground">Wendy</span>
                      <span className="text-[10px] text-muted-foreground">AI Coach</span>
                    </div>

                    <div className="space-y-3">
                      {chat.messages.map((message) => (
                        <div key={message.id}>{renderWendyMessage(message)}</div>
                      ))}
                      <WendyThinkingIndicator thinking={chat.thinking} />
                      {slowThinking && chat.thinking.active && (
                        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
                          Wendy sta ancora lavorando. Puoi interrompere e riprovare.
                        </div>
                      )}
                      {chat.streamError && (
                        <div className="flex items-center justify-between gap-3 rounded-2xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                          <span>Wendy non ha risposto correttamente.</span>
                          <button type="button" onClick={() => void chat.retryLast()} className="font-semibold underline underline-offset-2">
                            Riprova
                          </button>
                        </div>
                      )}
                    </div>
                    {renderChatComposer(true)}
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
