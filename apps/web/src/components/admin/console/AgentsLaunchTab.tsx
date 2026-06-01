import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  BriefcaseBusiness,
  FileText,
  Newspaper,
  Play,
  RefreshCw,
  Settings2,
  Workflow,
} from "lucide-react";
import { useState } from "react";
import { AgentLaunchResult } from "./AgentLaunchResult";
import type { AgentPipelineDefinition, RunnableAgentDefinition } from "./types";

type AgentLaunchPayload = Record<string, unknown>;
type AgentLaunchResultState = Record<
  string,
  { ok: boolean; data: Record<string, unknown> }
>;

type AgentsLaunchTabProps = {
  pipelines: AgentPipelineDefinition[];
  advancedAgents: RunnableAgentDefinition[];
  agentsRunning: Set<string>;
  agentsResult: AgentLaunchResultState;
  newsSectorInput: string;
  onNewsSectorInputChange: (value: string) => void;
  onLaunch: (
    agentKey: string,
    endpoint: string,
    body: AgentLaunchPayload,
  ) => void;
};

function pipelineIcon(key: string) {
  if (key === "news-publishing") return Newspaper;
  if (key === "growth-research-review") return FileText;
  if (key === "market-refresh") return BriefcaseBusiness;
  return Workflow;
}

function reviewPolicyLabel(policy: string) {
  if (policy === "auto_publish") return "Pubblicazione automatica";
  if (policy === "requires_review") return "Review prima";
  return "Aggiornamento dati";
}

export function AgentsLaunchTab({
  pipelines,
  advancedAgents,
  agentsRunning,
  agentsResult,
  newsSectorInput,
  onNewsSectorInputChange,
  onLaunch,
}: AgentsLaunchTabProps) {
  const [showAdvancedTools, setShowAdvancedTools] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Pipeline operative</h3>
          <p className="text-sm text-muted-foreground">
            Avvia flussi completi per pubblicare news, preparare bozze growth o aggiornare mercato.
          </p>
        </div>
        <Badge variant="outline" className="w-fit">
          {pipelines.length} pipeline pronte
        </Badge>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
        {pipelines.map((pipeline) => {
          const running = agentsRunning.has(pipeline.key);
          const result = agentsResult[pipeline.key];
          const Icon = pipelineIcon(pipeline.key);
          return (
            <div
              key={pipeline.key}
              className="border rounded-xl p-4 bg-card space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-semibold leading-tight">{pipeline.label}</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      {pipeline.description}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "capitalize",
                    pipeline.risk === "low" && "bg-success-surface text-success",
                    pipeline.risk === "medium" && "bg-warning-surface text-warning",
                    pipeline.risk === "high" && "bg-danger-surface text-danger",
                  )}
                >
                  {pipeline.risk}
                </Badge>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Step</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {pipeline.steps.map((step) => (
                      <Badge key={step} variant="secondary" className="text-xs">
                        {step}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Output</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {pipeline.outputs.map((output) => (
                      <Badge key={output} variant="outline" className="text-xs">
                        {output}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-xs">
                    {reviewPolicyLabel(pipeline.reviewPolicy)}
                  </Badge>
                  {pipeline.requiredConfigKeys.slice(0, 3).map((key) => (
                    <Badge key={key} variant="outline" className="text-xs">
                      {key}
                    </Badge>
                  ))}
                </div>
              </div>
              <Button
                className="w-full min-h-11"
                disabled={running}
                onClick={() => onLaunch(pipeline.key, pipeline.endpoint, {})}
              >
                {running ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    In esecuzione...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Avvia pipeline
                  </>
                )}
              </Button>
              {result && (
                <AgentLaunchResult pipelineKey={pipeline.key} result={result} />
              )}
            </div>
          );
        })}
      </div>
      {pipelines.length === 0 && (
        <div className="rounded-xl border bg-muted/20 p-10 text-center text-muted-foreground">
          Nessuna pipeline configurata.
        </div>
      )}

      {advancedAgents.length > 0 && (
        <div className="rounded-xl border bg-muted/10 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Settings2 className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div>
                <h4 className="font-semibold">Strumenti avanzati</h4>
                <p className="text-sm text-muted-foreground">
                  Trigger atomici per manutenzione e diagnosi.
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setShowAdvancedTools((open) => !open)}
            >
              {showAdvancedTools ? "Nascondi" : "Mostra strumenti"}
            </Button>
          </div>

          {showAdvancedTools && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {advancedAgents.map((agent) => {
                const running = agentsRunning.has(agent.key);
                const result = agentsResult[agent.key];
                return (
                  <div key={agent.key} className="rounded-lg border bg-card p-3 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h5 className="font-medium truncate">{agent.label}</h5>
                        <p className="mt-1 text-xs text-muted-foreground">{agent.description}</p>
                      </div>
                      <Badge variant="outline" className="capitalize text-xs">
                        {agent.risk}
                      </Badge>
                    </div>
                    {agent.key === "news-research" && (
                      <Input
                        placeholder="Aree specifiche opzionali"
                        value={newsSectorInput}
                        onChange={(event) => onNewsSectorInputChange(event.target.value)}
                        className="min-h-11"
                      />
                    )}
                    <Button
                      variant="outline"
                      className="w-full min-h-11"
                      disabled={running}
                      onClick={() => {
                        const body =
                          agent.key === "news-research"
                            ? {
                                sectorNames: newsSectorInput
                                  .split(",")
                                  .map((value) => value.trim())
                                  .filter(Boolean),
                              }
                            : {};
                        onLaunch(agent.key, agent.endpoint, body);
                      }}
                    >
                      {running ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          In esecuzione...
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4 mr-2" />
                          Avvia strumento
                        </>
                      )}
                    </Button>
                    {result && (
                      <AgentLaunchResult agentKey={agent.key} result={result} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
