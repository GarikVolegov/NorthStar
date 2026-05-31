import { WendyConsole, resolveWendyOrbLevel, resolveWendyOrbState } from "@/components/wendy/WendyConsole";
import {
  WendyNodeStage,
  deriveWendyNodesFromMessages,
} from "@/components/wendy/WendyNodeStage";
import { WendyPromptSuggestions } from "@/components/wendy/WendyPromptSuggestions";
import { Button } from "@/components/ui/button";
import { useWendy } from "@/contexts/WendyProvider";
import { useWendyChat } from "@/hooks/useWendyChat";
import { cn } from "@/lib/utils";
import { ArrowLeft, Brain, Compass, Database, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";

const STARTER_PROMPTS = [
  { label: "Cosa dovrei fare oggi?", icon: "" },
  { label: "Analizza il mio profilo e dimmi la prossima mossa", icon: "" },
  { label: "Quali settori sono piu adatti a me?", icon: "" },
  { label: "Preparami un piano concreto per questa settimana", icon: "" },
];

const TOOL_RAIL = [
  { label: "Profilo", detail: "Preferenze e percorso", icon: Compass },
  { label: "Memoria", detail: "Contesto salvato", icon: Brain },
  { label: "Fonti", detail: "RAG e citazioni", icon: Database },
  { label: "Azioni", detail: "Tool e automazioni", icon: Sparkles },
];

export default function WendyPage() {
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

  return (
    <main className="min-h-dvh overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(193,158,74,0.14),transparent_46%),radial-gradient(circle_at_12%_18%,rgba(125,184,154,0.09),transparent_34%)]" />
      <div className="relative z-10 flex min-h-dvh flex-col px-4 py-4 lg:px-6">
        <header className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-card/72 px-4 py-3 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full" aria-label="Torna alla dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">NorthStar AI</p>
              <h1 className="text-xl font-semibold text-foreground md:text-2xl">Wendy</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <StatusPill label="Fonti" value={activeCounts.source} />
            <StatusPill label="Tool" value={activeCounts.tool} />
            <StatusPill label="Viste" value={activeCounts.visual} />
          </div>
        </header>

        <div className="grid flex-1 gap-4 lg:grid-cols-[260px_minmax(430px,1fr)_420px]">
          <aside className="hidden min-h-0 flex-col gap-3 lg:flex">
            <section className="rounded-2xl border border-white/10 bg-card/70 p-4 backdrop-blur-xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Strumenti attivi
              </p>
              <div className="mt-4 space-y-2">
                {TOOL_RAIL.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.label} className="rounded-xl border border-white/10 bg-white/4 p-3">
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
                fallbackPrompts={STARTER_PROMPTS}
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
            className="min-h-[520px] lg:min-h-0"
          />

          <section
            className={cn(
              "min-h-[560px] overflow-hidden rounded-2xl border border-white/10 bg-card/78 shadow-2xl backdrop-blur-xl",
              "lg:min-h-0",
            )}
          >
            <WendyConsole
              chat={chat}
              query={query}
              setQuery={setQuery}
              onSubmit={askCurrentQuery}
              starterPrompts={STARTER_PROMPTS}
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
