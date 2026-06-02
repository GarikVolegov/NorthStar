import { WendyConsole, resolveWendyOrbLevel, resolveWendyOrbState } from "@/components/wendy/WendyConsole";
import {
  WendyNodeStage,
  deriveWendyNodesFromMessages,
} from "@/components/wendy/WendyNodeStage";
import { WendyPromptSuggestions } from "@/components/wendy/WendyPromptSuggestions";
import { Button } from "@/components/ui/button";
import { useWendy } from "@/contexts/WendyProvider";
import { useWendyChat } from "@/hooks/useWendyChat";
import { useDynamicTranslation } from "@/lib/dynamic-translation";
import { cn } from "@/lib/utils";
import { ArrowLeft, Brain, Compass, Database, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";

const STARTER_PROMPT_SOURCES = [
  {
    id: "today",
    label: "Cosa dovrei fare oggi?",
    context: "Wendy full-screen starter prompt asking for today's next action",
    icon: "",
  },
  {
    id: "profileNextMove",
    label: "Analizza il mio profilo e dimmi la prossima mossa",
    context: "Wendy full-screen starter prompt asking for profile analysis and next move",
    icon: "",
  },
  {
    id: "sectors",
    label: "Quali settori sono piu adatti a me?",
    context: "Wendy full-screen starter prompt asking which sectors fit the user",
    icon: "",
  },
  {
    id: "weeklyPlan",
    label: "Preparami un piano concreto per questa settimana",
    context: "Wendy full-screen starter prompt asking for a practical weekly plan",
    icon: "",
  },
] as const;

const TOOL_RAIL_SOURCES = [
  { id: "profile", label: "Profilo", detail: "Preferenze e percorso", icon: Compass },
  { id: "memory", label: "Memoria", detail: "Contesto salvato", icon: Brain },
  { id: "sources", label: "Fonti", detail: "RAG e citazioni", icon: Database },
  { id: "actions", label: "Azioni", detail: "Tool e automazioni", icon: Sparkles },
] as const;

export default function WendyPage() {
  const { i18n } = useTranslation();
  const locale = (i18n.resolvedLanguage ?? i18n.language ?? "it").slice(0, 2);
  const chat = useWendyChat({ apiUrl: "/api/ai/wendy", maxRetries: 0 });
  const wendy = useWendy();
  const closeWendy = wendy.close;
  const setWendyPageContext = wendy.setPageContext;
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const nodes = useMemo(() => deriveWendyNodesFromMessages(chat.messages), [chat.messages]);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const orbState = resolveWendyOrbState(chat);
  const orbLevel = resolveWendyOrbLevel(chat);
  const backToDashboardLabel = useDynamicTranslation({
    locale,
    key: "wendy.page.backToDashboard",
    source: "Torna alla dashboard",
    context: "Wendy full-screen page back button aria label",
  });
  const sourcesLabel = useDynamicTranslation({
    locale,
    key: "wendy.page.status.sources",
    source: "Fonti",
    context: "Wendy full-screen page status pill for active sources count",
  });
  const toolStatusLabel = useDynamicTranslation({
    locale,
    key: "wendy.page.status.tools",
    source: "Tool",
    context: "Wendy full-screen page status pill for active tools count",
  });
  const viewsLabel = useDynamicTranslation({
    locale,
    key: "wendy.page.status.views",
    source: "Viste",
    context: "Wendy full-screen page status pill for active visual views count",
  });
  const activeToolsLabel = useDynamicTranslation({
    locale,
    key: "wendy.page.activeTools",
    source: "Strumenti attivi",
    context: "Wendy full-screen page sidebar section title for active tools",
  });
  const starterTodayLabel = useDynamicTranslation({
    locale,
    key: "wendy.page.starters.today.label",
    source: STARTER_PROMPT_SOURCES[0].label,
    context: STARTER_PROMPT_SOURCES[0].context,
  });
  const starterProfileNextMoveLabel = useDynamicTranslation({
    locale,
    key: "wendy.page.starters.profileNextMove.label",
    source: STARTER_PROMPT_SOURCES[1].label,
    context: STARTER_PROMPT_SOURCES[1].context,
  });
  const starterSectorsLabel = useDynamicTranslation({
    locale,
    key: "wendy.page.starters.sectors.label",
    source: STARTER_PROMPT_SOURCES[2].label,
    context: STARTER_PROMPT_SOURCES[2].context,
  });
  const starterWeeklyPlanLabel = useDynamicTranslation({
    locale,
    key: "wendy.page.starters.weeklyPlan.label",
    source: STARTER_PROMPT_SOURCES[3].label,
    context: STARTER_PROMPT_SOURCES[3].context,
  });
  const toolProfileLabel = useDynamicTranslation({
    locale,
    key: "wendy.page.tools.profile.label",
    source: TOOL_RAIL_SOURCES[0].label,
    context: "Wendy full-screen active tool label for user profile",
  });
  const toolProfileDetail = useDynamicTranslation({
    locale,
    key: "wendy.page.tools.profile.detail",
    source: TOOL_RAIL_SOURCES[0].detail,
    context: "Wendy full-screen active tool detail for user profile",
  });
  const toolMemoryLabel = useDynamicTranslation({
    locale,
    key: "wendy.page.tools.memory.label",
    source: TOOL_RAIL_SOURCES[1].label,
    context: "Wendy full-screen active tool label for saved memory",
  });
  const toolMemoryDetail = useDynamicTranslation({
    locale,
    key: "wendy.page.tools.memory.detail",
    source: TOOL_RAIL_SOURCES[1].detail,
    context: "Wendy full-screen active tool detail for saved memory",
  });
  const toolSourcesLabel = useDynamicTranslation({
    locale,
    key: "wendy.page.tools.sources.label",
    source: TOOL_RAIL_SOURCES[2].label,
    context: "Wendy full-screen active tool label for RAG sources",
  });
  const toolSourcesDetail = useDynamicTranslation({
    locale,
    key: "wendy.page.tools.sources.detail",
    source: TOOL_RAIL_SOURCES[2].detail,
    context: "Wendy full-screen active tool detail for RAG sources and citations",
  });
  const toolActionsLabel = useDynamicTranslation({
    locale,
    key: "wendy.page.tools.actions.label",
    source: TOOL_RAIL_SOURCES[3].label,
    context: "Wendy full-screen active tool label for actions and automations",
  });
  const toolActionsDetail = useDynamicTranslation({
    locale,
    key: "wendy.page.tools.actions.detail",
    source: TOOL_RAIL_SOURCES[3].detail,
    context: "Wendy full-screen active tool detail for tools and automations",
  });

  useEffect(() => {
    closeWendy();
    setWendyPageContext({
      page: "wendy",
      title: "Wendy",
      data: { entityType: "assistant", entityName: "Wendy full screen" },
    });
  }, [closeWendy, setWendyPageContext]);

  useEffect(() => {
    const latest = nodes[nodes.length - 1];
    if (latest) setActiveNodeId(latest.id);
  }, [nodes]);

  useEffect(() => {
    if (chat.stt.isListening) {
      setQuery(chat.stt.transcript + chat.stt.interimTranscript);
    }
  }, [chat.stt.interimTranscript, chat.stt.isListening, chat.stt.transcript]);

  function askCurrentQuery() {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;
    void chat.sendMessage(trimmed);
    setQuery("");
  }

  function askPrompt(prompt: string) {
    setQuery(prompt);
    void chat.sendMessage(prompt);
  }

  const activeCounts = {
    source: nodes.filter((node) => node.kind === "source").length,
    tool: nodes.filter((node) => node.kind === "tool").length,
    visual: nodes.filter((node) => node.kind === "visual").length,
  };
  const starterPrompts = [
    { label: starterTodayLabel, icon: STARTER_PROMPT_SOURCES[0].icon },
    { label: starterProfileNextMoveLabel, icon: STARTER_PROMPT_SOURCES[1].icon },
    { label: starterSectorsLabel, icon: STARTER_PROMPT_SOURCES[2].icon },
    { label: starterWeeklyPlanLabel, icon: STARTER_PROMPT_SOURCES[3].icon },
  ];
  const toolRail = [
    {
      id: TOOL_RAIL_SOURCES[0].id,
      label: toolProfileLabel,
      detail: toolProfileDetail,
      icon: TOOL_RAIL_SOURCES[0].icon,
    },
    {
      id: TOOL_RAIL_SOURCES[1].id,
      label: toolMemoryLabel,
      detail: toolMemoryDetail,
      icon: TOOL_RAIL_SOURCES[1].icon,
    },
    {
      id: TOOL_RAIL_SOURCES[2].id,
      label: toolSourcesLabel,
      detail: toolSourcesDetail,
      icon: TOOL_RAIL_SOURCES[2].icon,
    },
    {
      id: TOOL_RAIL_SOURCES[3].id,
      label: toolActionsLabel,
      detail: toolActionsDetail,
      icon: TOOL_RAIL_SOURCES[3].icon,
    },
  ];

  return (
    <main className="min-h-dvh overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(193,158,74,0.14),transparent_46%),radial-gradient(circle_at_12%_18%,rgba(125,184,154,0.09),transparent_34%)]" />
      <div className="relative z-10 flex min-h-dvh flex-col px-4 py-4 lg:px-6">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-card/72 px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label={backToDashboardLabel}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">NorthStar AI</p>
              <h1 className="text-xl font-semibold text-foreground md:text-2xl">Wendy</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <StatusPill label={sourcesLabel} value={activeCounts.source} />
            <StatusPill label={toolStatusLabel} value={activeCounts.tool} />
            <StatusPill label={viewsLabel} value={activeCounts.visual} />
          </div>
        </header>

        <div className="grid flex-1 gap-4 lg:grid-cols-[260px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(380px,1fr)_420px]">
          <aside className="hidden min-h-0 flex-col gap-3 lg:flex">
            <section className="rounded-2xl border border-white/10 bg-card/70 p-4 backdrop-blur-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {activeToolsLabel}
              </p>
              <div className="mt-4 space-y-2">
                {toolRail.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.id} className="rounded-xl border border-white/10 bg-white/4 p-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                          <span className="block text-xs text-muted-foreground">{item.detail}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-card/70 p-4 backdrop-blur-xl">
              <WendyPromptSuggestions
                fallbackPrompts={starterPrompts}
                onPromptSelect={askPrompt}
              />
            </section>
          </aside>

          <WendyNodeStage
            nodes={nodes}
            activeNodeId={activeNodeId}
            onActiveNodeChange={setActiveNodeId}
            orbState={orbState}
            level={orbLevel}
            className="min-h-[420px] lg:min-h-0"
          />

          <section
            className={cn(
              "order-first h-[440px] max-h-[calc(100dvh-8rem)] overflow-hidden rounded-2xl border border-white/10 bg-card/78 shadow-2xl backdrop-blur-xl sm:h-[520px]",
              "lg:order-none lg:h-auto lg:max-h-none",
              "lg:col-span-2 lg:min-h-[560px] xl:col-span-1 xl:min-h-0",
            )}
          >
            <WendyConsole
              chat={chat}
              query={query}
              setQuery={setQuery}
              onSubmit={askCurrentQuery}
              starterPrompts={starterPrompts}
              inputRef={inputRef}
              showOrb={false}
              className="h-full"
            />
          </section>
        </div>
      </div>
    </main>
  );
}

function StatusPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
      <span>{label}</span>
      <span className="font-semibold text-primary">{value}</span>
    </span>
  );
}
