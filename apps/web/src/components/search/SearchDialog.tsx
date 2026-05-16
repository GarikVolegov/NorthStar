import { useEffect, useRef } from "react";
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
import type { SearchResult, RouterOutput } from "@/hooks/useGlobalSearch";
import {
  Briefcase,
  BookOpenText,
  Newspaper,
  Layers,
  Sparkles,
  TrendingUp,
  Lightbulb,
  Bot,
} from "lucide-react";
import { useWendy } from "@/contexts/WendyProvider";

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
}

const TYPE_CONFIG = {
  sector: {
    labelKey: "search.sectors",
    icon: Layers,
    className: "text-blue-400 bg-blue-500/10",
  },
  role: {
    labelKey: "search.roles",
    icon: Briefcase,
    className: "text-green-400 bg-green-500/10",
  },
  article: {
    labelKey: "search.articles",
    icon: BookOpenText,
    className: "text-amber-400 bg-amber-500/10",
  },
  news: {
    labelKey: "search.news",
    icon: Newspaper,
    className: "text-purple-400 bg-purple-500/10",
  },
} as const;

const SUGGESTIONS_DEFAULTS = [
  { title: "Esplora i settori", description: "Scopri tutti i settori disponibili", url: "/settori" },
  { title: "Fai il test", description: "Scopri la tua personalità professionale", url: "/test" },
  { title: "Trend di mercato", description: "Le ultime tendenze del lavoro", url: "/news" },
  { title: "Coach AI", description: "Parla con il tuo coach personale", url: "/coach" },
];

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
}: SearchDialogProps) {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const wendy = useWendy();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, close]);

  const grouped = results.reduce(
    (acc, r) => {
      if (!acc[r.type]) acc[r.type] = [];
      acc[r.type].push(r);
      return acc;
    },
    {} as Record<string, typeof results>,
  );

  const order: Array<keyof typeof TYPE_CONFIG> = [
    "sector",
    "role",
    "article",
    "news",
  ];

  function handleSelect(url: string) {
    setLocation(url);
    close();
  }

  function handleResultSelect(item: SearchResult) {
    trackClick(item);
    setLocation(item.url);
    close();
  }

  function askWendy() {
    close();
    setTimeout(() => wendy.ask(query), 200);
  }

  const showDefaultSuggestions = query.length < 2 && !isLoading;
  const showResults = !isLoading && results.length > 0;
  const hasSuggestions = suggestions.length > 0;
  const activeSuggestions = hasSuggestions ? suggestions : SUGGESTIONS_DEFAULTS;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <m.div
            key="search-backdrop"
            className="fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={close}
          />

            <m.div
              key="search-dropdown"
              className="fixed z-50 left-1/2 -translate-x-1/2 w-full max-w-5xl px-4"
              style={{ top: "68px" }}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="rounded-2xl border border-white/10 bg-card/95 backdrop-blur-xl shadow-2xl overflow-hidden">
              <Command shouldFilter={false}>
                <CommandInput
                  ref={inputRef}
                  placeholder={t("search.placeholder")}
                  value={query}
                  onValueChange={setQuery}
                  className="border-b border-white/10"
                />
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

                  {query.length >= 2 && route && route.confidence >= 0.6 && (
                    <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                        {route.intent}
                      </span>
                      <span className="text-[10px] text-muted-foreground/40">·</span>
                      <span className="text-[10px] text-muted-foreground/60">
                        {route.experience_level}
                      </span>
                      <div className="ml-auto flex items-center gap-1">
                        <div
                          className={`h-1.5 w-1.5 rounded-full ${
                            route.confidence > 0.8
                              ? "bg-green-400"
                              : route.confidence > 0.6
                                ? "bg-amber-400"
                                : "bg-muted-foreground/30"
                          }`}
                        />
                        <span className="text-[10px] text-muted-foreground/40">
                          {Math.round(route.confidence * 100)}%
                        </span>
                      </div>
                    </div>
                  )}

                  {query.length >= 2 && route?.needs_clarification && route?.clarifying_question && (
                    <div className="px-4 py-3 border-b border-white/5">
                      <p className="text-xs text-muted-foreground/80 italic">
                        {route.clarifying_question}
                      </p>
                    </div>
                  )}

                  {query.length >= 2 && (
                    <CommandGroup heading="Wendy AI">
                      <CommandItem
                        value={query}
                        onSelect={askWendy}
                        className="cursor-pointer"
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-r from-primary to-purple-500 text-white">
                          <Bot className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-sm font-medium truncate">
                            {t("search.askWendy", { query })}
                          </span>
                          <span className="text-xs text-muted-foreground truncate">
                            {t("search.askWendyDesc")}
                          </span>
                        </div>
                      </CommandItem>
                    </CommandGroup>
                  )}

                  {showDefaultSuggestions && (
                    <CommandGroup heading={t("search.suggestions")}>
                      {activeSuggestions.map((item, i) => (
                        <CommandItem
                          key={`suggestion-${i}`}
                          value={item.title}
                          onSelect={() => handleSelect(item.url)}
                          className="cursor-pointer"
                        >
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                            {i < 1 ? <TrendingUp className="h-3.5 w-3.5" /> :
                             i < 2 ? <Lightbulb className="h-3.5 w-3.5" /> :
                             <Sparkles className="h-3.5 w-3.5" />}
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm font-medium truncate">
                              {item.title}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                              {item.description}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}

                  {hasSuggestions && !showDefaultSuggestions && (
                    <CommandGroup heading={t("search.suggestions")}>
                      {suggestions.slice(0, 3).map((item, i) => (
                        <CommandItem
                          key={`suggest-${i}`}
                          value={item.title}
                          onSelect={() => handleSelect(item.url)}
                          className="cursor-pointer"
                        >
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                            <Sparkles className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-sm font-medium truncate">
                              {item.title}
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                              {item.description}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}

                  {showResults && (
                    <>
                      {order
                        .filter((type) => grouped[type]?.length)
                        .map((type) => {
                          const config = TYPE_CONFIG[type];
                          const Icon = config.icon;
                          return (
                            <CommandGroup key={type} heading={t(config.labelKey)}>
                              {grouped[type].map((item) => (
                                <CommandItem
                                  key={`${type}-${item.id}`}
                                  value={`${item.title} ${item.description}`}
                                  onSelect={() => handleResultSelect(item)}
                                  className="cursor-pointer"
                                >
                                  <div
                                    className={`flex h-7 w-7 items-center justify-center rounded-full ${config.className}`}
                                  >
                                    <Icon className="h-3.5 w-3.5" />
                                  </div>
                                  <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-sm font-medium truncate">
                                      {item.title}
                                    </span>
                                    <span className="text-xs text-muted-foreground truncate">
                                      {item.description}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          );
                        })}
                    </>
                  )}
                </CommandList>
              </Command>
            </div>
          </m.div>
        </>
      )}
    </AnimatePresence>
  );
}
