import type { ChatMessage } from "@/hooks/useWendyChat";
import { cn } from "@/lib/utils";
import {
  Boxes,
  Database,
  ExternalLink,
  FileText,
  MousePointer2,
  Route,
  Sparkles,
} from "lucide-react";
import { WendyOrb, type WendyOrbState } from "./WendyOrb";

export type WendyNodeKind = "source" | "tool" | "visual";
export type WendyNodeStatus = "active" | "used" | "pending" | "failed";

export interface WendyExtractedNode {
  id: string;
  kind: WendyNodeKind;
  title: string;
  subtitle: string;
  detail?: string;
  status: WendyNodeStatus;
  href?: string | null;
  messageId: string;
}

function statusFromAction(status: string | undefined): WendyNodeStatus {
  if (status === "failed" || status === "cancelled") return "failed";
  if (status === "running" || status === "needs_confirmation" || status === "preview") return "pending";
  return "used";
}

export function deriveWendyNodesFromMessages(messages: ChatMessage[]): WendyExtractedNode[] {
  const nodes: WendyExtractedNode[] = [];

  for (const message of messages) {
    if (message.role !== "assistant") continue;

    for (const citation of message.citations ?? []) {
      nodes.push({
        id: `source-${citation.nodeId}`,
        kind: "source",
        title: citation.title,
        subtitle: citation.type || "Fonte RAG",
        detail: `Rilevanza ${Math.round(citation.score * 100)}%`,
        status: "active",
        href: citation.url,
        messageId: message.id,
      });
    }

    for (const action of message.actions ?? []) {
      nodes.push({
        id: `tool-${action.id}`,
        kind: "tool",
        title: action.label,
        subtitle: action.sourceTool ?? action.type,
        detail: action.description,
        status: statusFromAction(action.status),
        href: action.targetRoute ?? (typeof action.payload.url === "string" ? action.payload.url : null),
        messageId: message.id,
      });
    }

    if (message.uiTool) {
      nodes.push({
        id: `visual-${message.id}-${message.uiTool.name}`,
        kind: "visual",
        title: message.uiTool.name,
        subtitle: "Visualizzazione",
        detail: Object.keys(message.uiTool.args).slice(0, 3).join(", ") || "Output interattivo",
        status: "active",
        messageId: message.id,
      });
    }
  }

  return nodes.slice(-12);
}

interface WendyNodeStageProps {
  nodes: WendyExtractedNode[];
  activeNodeId?: string | null;
  onActiveNodeChange: (nodeId: string) => void;
  orbState: WendyOrbState;
  level?: number;
  className?: string;
}

const KIND_META: Record<WendyNodeKind, {
  label: string;
  icon: typeof FileText;
  className: string;
}> = {
  source: {
    label: "Fonte",
    icon: Database,
    className: "border-info/30 bg-info/10 text-info",
  },
  tool: {
    label: "Strumento",
    icon: Route,
    className: "border-primary/30 bg-primary/10 text-primary",
  },
  visual: {
    label: "Vista",
    icon: Boxes,
    className: "border-growth/30 bg-growth/10 text-growth",
  },
};

export function WendyNodeStage({
  nodes,
  activeNodeId,
  onActiveNodeChange,
  orbState,
  level = 0.45,
  className,
}: WendyNodeStageProps) {
  const activeNode = nodes.find((node) => node.id === activeNodeId) ?? nodes[nodes.length - 1] ?? null;
  const orbitNodes = nodes.slice(-8);

  return (
    <section
      className={cn(
        "relative flex min-h-[520px] flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-card/70 p-6 shadow-2xl backdrop-blur-xl",
        className,
      )}
      aria-label="Orb interattivo di Wendy"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(193,158,74,0.16),transparent_58%)]" />
      <div className="pointer-events-none absolute inset-x-10 top-1/2 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent" />

      <div className="relative z-10 flex flex-col items-center">
        <div className="mb-4 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          Wendy Core
        </div>
        <WendyOrb state={orbState} level={level} size={280} />
      </div>

      {orbitNodes.map((node, index) => {
        const meta = KIND_META[node.kind];
        const Icon = meta.icon;
        const angle = (Math.PI * 2 * index) / Math.max(orbitNodes.length, 1) - Math.PI / 2;
        const radius = 205;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius * 0.72;
        const isActive = activeNode?.id === node.id;

        return (
          <button
            key={node.id}
            type="button"
            onClick={() => onActiveNodeChange(node.id)}
            className={cn(
              "absolute left-1/2 top-1/2 z-20 flex min-h-12 w-44 -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-xl border bg-background/82 px-3 py-2 text-left shadow-lg backdrop-blur-xl transition-all hover:-translate-y-[calc(50%+2px)] hover:border-primary/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
              isActive ? "border-primary/45 ring-1 ring-primary/35" : "border-white/10",
            )}
            style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
          >
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", meta.className)}>
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-foreground">{node.title}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{meta.label}</span>
            </span>
          </button>
        );
      })}

      <div className="absolute bottom-5 left-5 right-5 z-30">
        {activeNode ? (
          <ExtractedNodeCard node={activeNode} />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-background/70 px-4 py-3 text-sm text-muted-foreground backdrop-blur-xl">
            Quando Wendy usera una fonte o uno strumento, il nodo uscira dall'orb e apparira qui.
          </div>
        )}
      </div>
    </section>
  );
}

function ExtractedNodeCard({ node }: { node: WendyExtractedNode }) {
  const meta = KIND_META[node.kind];
  const Icon = meta.icon;

  return (
    <article className="rounded-2xl border border-primary/20 bg-background/86 p-4 shadow-xl backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border", meta.className)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {meta.label}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              <Sparkles className="h-3 w-3" />
              {node.status}
            </span>
          </div>
          <h2 className="mt-2 truncate text-base font-semibold text-foreground">{node.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{node.subtitle}</p>
          {node.detail ? <p className="mt-2 text-xs leading-relaxed text-muted-foreground/85">{node.detail}</p> : null}
        </div>
        {node.href ? (
          <a
            href={node.href}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
            aria-label={`Apri ${node.title}`}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : (
          <MousePointer2 className="mt-2 h-4 w-4 shrink-0 text-muted-foreground/45" />
        )}
      </div>
    </article>
  );
}
