import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api-fetch";
import type { AgentEvent, AgentSnapshot } from "@workspace/api-zod/agent-registry";
import { STATUS_DOT_CLASS, STATUS_LABEL } from "./status";

type DrawerTab = "state" | "prompt" | "log";

interface AgentDrawerProps {
  agent: AgentSnapshot | null;
  onOpenChange: (open: boolean) => void;
  onRefresh: () => void;
}

export function AgentDrawer({ agent, onOpenChange, onRefresh }: AgentDrawerProps) {
  const [tab, setTab] = useState<DrawerTab>("state");

  useEffect(() => {
    if (agent) setTab("state");
  }, [agent?.slug]);

  return (
    <Sheet open={agent !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-[520px]">
        {agent && (
          <>
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <span aria-hidden className={`text-2xl ${agent.color}`}>{agent.avatar}</span>
                <span>{agent.name}</span>
              </SheetTitle>
              <SheetDescription>{agent.role}</SheetDescription>
            </SheetHeader>
            <Tabs value={tab} onValueChange={(v) => setTab(v as DrawerTab)} className="flex-1 overflow-hidden">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="state">Stato</TabsTrigger>
                <TabsTrigger value="prompt">Istruzioni</TabsTrigger>
                <TabsTrigger value="log">Log</TabsTrigger>
              </TabsList>
              <TabsContent value="state" className="mt-4">
                <StateTab agent={agent} />
              </TabsContent>
              <TabsContent value="prompt" className="mt-4">
                <PromptTab agent={agent} onSaved={onRefresh} />
              </TabsContent>
              <TabsContent value="log" className="mt-4">
                <LogTab events={agent.recentEvents} />
              </TabsContent>
            </Tabs>
            <PauseResumeButton agent={agent} onChanged={onRefresh} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function StateTab({ agent }: { agent: AgentSnapshot }) {
  return (
    <dl className="space-y-3 text-sm">
      <Row label="Status">
        <span className="inline-flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${STATUS_DOT_CLASS[agent.status]}`} aria-hidden />
          {STATUS_LABEL[agent.status]}
        </span>
      </Row>
      <Row label="Task corrente">
        {agent.currentTask?.title ?? <span className="text-muted-foreground">—</span>}
      </Row>
      <Row label="Ultimo task">
        {agent.lastTask?.finishedAt
          ? formatDateTime(agent.lastTask.finishedAt)
          : <span className="text-muted-foreground">—</span>}
      </Row>
      <Row label="Token ultimo task">
        {agent.lastTask?.tokensUsed?.toLocaleString("it-IT") ?? "—"}
      </Row>
      <Row label="Modello LLM">
        {agent.lastTask?.modelUsed ?? <span className="text-muted-foreground">—</span>}
      </Row>
    </dl>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-right text-foreground">{children}</dd>
    </div>
  );
}

function PromptTab({
  agent,
  onSaved,
}: {
  agent: AgentSnapshot;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(agent.systemPrompt);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEditing(false);
    setDraft(agent.systemPrompt);
    setError(null);
  }, [agent.slug, agent.systemPrompt]);

  if (!editing) {
    return (
      <div className="space-y-3">
        <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-card/60 p-3 text-xs leading-relaxed text-foreground">
          {agent.systemPrompt}
        </pre>
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          Modifica
        </Button>
      </div>
    );
  }

  const onSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/admin/agents/${agent.id}`, {
        method: "PATCH",
        body: JSON.stringify({ systemPrompt: draft }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(body || `HTTP ${res.status}`);
      }
      onSaved();
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={12}
        className="text-xs leading-relaxed"
        disabled={saving}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setEditing(false);
            setDraft(agent.systemPrompt);
            setError(null);
          }}
          disabled={saving}
        >
          Annulla
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving || draft.trim().length === 0}>
          {saving ? "Salvataggio…" : "Salva"}
        </Button>
      </div>
    </div>
  );
}

function LogTab({ events }: { events: AgentEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">Nessun evento ancora.</p>;
  }
  const sorted = [...events].sort((a, b) => (a.at < b.at ? 1 : -1));
  return (
    <ul className="max-h-[60vh] space-y-2 overflow-auto pr-1 text-xs">
      {sorted.map((event) => (
        <li
          key={event.id}
          className="flex items-start gap-2 rounded-md border border-border bg-card/40 px-2 py-1.5"
        >
          <span className="tabular-nums text-muted-foreground">{formatTime(event.at)}</span>
          <span className="flex-1 text-foreground">{event.description}</span>
        </li>
      ))}
    </ul>
  );
}

function PauseResumeButton({
  agent,
  onChanged,
}: {
  agent: AgentSnapshot;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const target = !agent.isActive;
  const label = agent.isActive ? "Pausa" : "Riprendi";

  const onClick = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/admin/agents/${agent.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: target }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(body || `HTTP ${res.status}`);
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-t border-border pt-3">
      {error && <p className="mb-2 text-xs text-red-500">{error}</p>}
      <Button
        className="w-full"
        size="sm"
        variant={agent.isActive ? "secondary" : "default"}
        onClick={onClick}
        disabled={busy}
      >
        {busy ? "…" : label}
      </Button>
    </div>
  );
}

function formatTime(iso: string) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const date = d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" });
  return `${date} ${formatTime(iso)}`;
}
