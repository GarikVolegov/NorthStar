import { Bot, CheckCircle2, ChevronDown, ChevronUp, Eye, History, Pencil, RefreshCw, RotateCcw, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PersistenceWarningBanner } from "./shared";
import type {
  AgentPrompt,
  AiModelPolicy,
  PersistenceMeta,
  PromptEditorTab,
  PromptPreview,
  PromptVersion,
} from "./types";
import { fmtShortDate } from "./utils";

type PromptsSectionProps = {
  aiModelPolicy: AiModelPolicy | null;
  promptsPersistenceMeta: PersistenceMeta;
  promptsLoading: boolean;
  prompts: AgentPrompt[];
  promptExpandedKey: string | null;
  promptTab: PromptEditorTab;
  promptEditValues: Record<string, string>;
  promptNotes: Record<string, string>;
  promptVersions: Record<string, PromptVersion[]>;
  promptPreview: Record<string, PromptPreview>;
  promptVersionPersistence: Record<string, PersistenceMeta>;
  promptSaving: Set<string>;
  onOpenStatus: () => void;
  onLoadPrompts: () => void;
  onLoadPromptVersions: (key: string) => void;
  onLoadPromptPreview: (key: string) => void;
  onExpandedKeyChange: (key: string | null) => void;
  onPromptTabChange: (tab: PromptEditorTab) => void;
  onPromptEditValuesChange: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  onPromptNotesChange: (updater: (prev: Record<string, string>) => Record<string, string>) => void;
  onSavePrompt: (key: string) => void;
  onPublishPrompt: (key: string) => void;
  onResetPrompt: (key: string) => void;
  onRollbackPrompt: (key: string, versionId: number) => void;
};

export function PromptsSection({
  aiModelPolicy,
  promptsPersistenceMeta,
  promptsLoading,
  prompts,
  promptExpandedKey,
  promptTab,
  promptEditValues,
  promptNotes,
  promptVersions,
  promptPreview,
  promptVersionPersistence,
  promptSaving,
  onOpenStatus,
  onLoadPrompts,
  onLoadPromptVersions,
  onLoadPromptPreview,
  onExpandedKeyChange,
  onPromptTabChange,
  onPromptEditValuesChange,
  onPromptNotesChange,
  onSavePrompt,
  onPublishPrompt,
  onResetPrompt,
  onRollbackPrompt,
}: PromptsSectionProps) {
  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-5xl">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          Modifica i prompt in bozza, verifica placeholder e preview, poi pubblica una versione attiva con rollback tracciabile.
        </p>
        <p className="text-xs text-muted-foreground">
          I placeholder ammessi sono dichiarati per prompt e scritti come{" "}
          <code className="bg-muted px-1 py-0.5 rounded text-xs">{"{{PLACEHOLDER}}"}</code>.
        </p>
      </div>

      {aiModelPolicy && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" />
                Router modelli AI
              </p>
              <p className="text-xs text-muted-foreground">
                Provider attivo: {aiModelPolicy.activeProvider} · Free router: {aiModelPolicy.openRouterFreeRouter}
              </p>
            </div>
            <Badge variant={aiModelPolicy.allowPaidModels ? "default" : "outline"}>
              {aiModelPolicy.allowPaidModels ? "Paid abilitati" : "Solo modelli gratuiti"}
            </Badge>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {aiModelPolicy.roles.slice(0, 9).map((role) => (
              <div key={role.role} className="rounded-md border bg-background p-3">
                <p className="text-xs font-semibold">{role.role}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {role.tier} · {role.route.provider}
                </p>
                <code className="mt-2 block text-[11px] break-words rounded bg-muted px-2 py-1">
                  {role.route.model}
                </code>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Gli override si fanno via env `MODEL_*`; con OpenRouter vengono accettati solo `openrouter/free` o modelli con suffisso `:free`, salvo `ALLOW_PAID_AI_MODELS=true`.
          </p>
        </div>
      )}

      <PersistenceWarningBanner
        meta={promptsPersistenceMeta}
        title="Prompt caricati da fallback non persistito"
        onRetry={onLoadPrompts}
        onOpenStatus={onOpenStatus}
      />

      {promptsLoading ? (
        <div className="p-8 text-center text-muted-foreground">
          Caricamento prompt...
        </div>
      ) : prompts.length === 0 ? (
        <div className="p-10 text-center text-muted-foreground border rounded-xl bg-muted/20">
          Nessun prompt registrato.
        </div>
      ) : (
        prompts.map((prompt) => {
          const isExpanded = promptExpandedKey === prompt.key;
          const draftSaving = promptSaving.has(`${prompt.key}:draft`);
          const publishSaving = promptSaving.has(`${prompt.key}:publish`);
          const resetSaving = promptSaving.has(`${prompt.key}:reset`);
          const previewSaving = promptSaving.has(`${prompt.key}:preview`);
          const isDirty = (promptEditValues[prompt.key] ?? "") !== (prompt.draftValue ?? prompt.currentValue);
          const validation = prompt.validation;
          const preview = promptPreview[prompt.key];
          const versions = promptVersions[prompt.key] ?? [];
          const versionMeta = promptVersionPersistence[prompt.key] ?? {};

          return (
            <div key={prompt.key} className="bg-card border rounded-xl overflow-hidden">
              <button
                type="button"
                className="min-h-11 w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                onClick={() => {
                  const next = isExpanded ? null : prompt.key;
                  onExpandedKeyChange(next);
                  onPromptTabChange("editor");
                  if (next) void onLoadPromptVersions(prompt.key);
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{prompt.label}</span>
                    <Badge variant="outline" className="text-[10px]">
                      v{prompt.activeVersionNumber ?? 1} attiva
                    </Badge>
                    {prompt.hasDraft && (
                      <Badge className="text-[10px] bg-amber-100 text-amber-700 border-0">
                        Bozza
                      </Badge>
                    )}
                    {prompt.isOverridden && (
                      <Badge variant="secondary" className="text-[10px]">
                        Custom
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {prompt.description}
                  </p>
                  <div className="flex gap-1 flex-wrap mt-2">
                    {prompt.placeholders.map((placeholder) => (
                      <code key={placeholder} className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        {placeholder}
                      </code>
                    ))}
                  </div>
                </div>
                <div className="hidden sm:block text-right text-xs text-muted-foreground">
                  {prompt.updatedAt ? fmtShortDate(prompt.updatedAt) : "Mai pubblicato"}
                </div>
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                )}
              </button>

              {isExpanded && (
                <div className="border-t p-4 space-y-4 bg-muted/10">
                  <PersistenceWarningBanner
                    meta={{
                      persistenceUnavailable: Boolean(
                        prompt.persistenceUnavailable ||
                        versionMeta.persistenceUnavailable ||
                        preview?.persistenceUnavailable,
                      ),
                      reason: prompt.reason ?? versionMeta.reason ?? preview?.reason ?? null,
                      setupAction: prompt.setupAction ?? versionMeta.setupAction ?? preview?.setupAction ?? null,
                    }}
                    title="Versioni prompt non persistite"
                    onRetry={() => {
                      void onLoadPrompts();
                      void onLoadPromptVersions(prompt.key);
                    }}
                    onOpenStatus={onOpenStatus}
                  />
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {[
                      { key: "editor" as PromptEditorTab, label: "Editor", icon: Pencil },
                      { key: "preview" as PromptEditorTab, label: "Preview", icon: Eye },
                      { key: "versions" as PromptEditorTab, label: "Versioni", icon: History },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <Button
                          key={item.key}
                          variant={promptTab === item.key ? "default" : "outline"}
                          className="min-h-11 shrink-0"
                          onClick={() => {
                            onPromptTabChange(item.key);
                            if (item.key === "preview") void onLoadPromptPreview(prompt.key);
                            if (item.key === "versions") void onLoadPromptVersions(prompt.key);
                          }}
                        >
                          <Icon className="w-4 h-4 mr-2" />
                          {item.label}
                        </Button>
                      );
                    })}
                  </div>

                  {validation?.errors.length || validation?.warnings.length ? (
                    <div className={cn(
                      "rounded-lg border p-3 text-sm",
                      validation.errors.length > 0
                        ? "bg-red-50 border-red-200 text-red-800"
                        : "bg-amber-50 border-amber-200 text-amber-800",
                    )}>
                      {[...(validation.errors ?? []), ...(validation.warnings ?? [])].map((message) => (
                        <p key={message}>{message}</p>
                      ))}
                    </div>
                  ) : null}

                  {promptTab === "editor" && (
                    <div className="space-y-3">
                      <textarea
                        value={promptEditValues[prompt.key] ?? ""}
                        onChange={(event) =>
                          onPromptEditValuesChange((prev) => ({
                            ...prev,
                            [prompt.key]: event.target.value,
                          }))
                        }
                        rows={Math.max(10, (promptEditValues[prompt.key] ?? "").split("\n").length + 2)}
                        className="w-full text-xs font-mono border rounded-xl p-3 bg-background resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <Input
                        placeholder="Note versione opzionali"
                        value={promptNotes[prompt.key] ?? ""}
                        onChange={(event) =>
                          onPromptNotesChange((prev) => ({
                            ...prev,
                            [prompt.key]: event.target.value,
                          }))
                        }
                        className="min-h-11"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          disabled={draftSaving || !isDirty}
                          onClick={() => onSavePrompt(prompt.key)}
                          className="min-h-11"
                        >
                          {draftSaving ? (
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4 mr-2" />
                          )}
                          Salva bozza
                        </Button>
                        <Button
                          variant="default"
                          disabled={publishSaving || !prompt.hasDraft}
                          onClick={() => onPublishPrompt(prompt.key)}
                          className="min-h-11"
                        >
                          {publishSaving ? (
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                          )}
                          Pubblica
                        </Button>
                        <Button
                          variant="outline"
                          disabled={resetSaving}
                          onClick={() => onResetPrompt(prompt.key)}
                          className="min-h-11"
                        >
                          {resetSaving ? (
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <RotateCcw className="w-4 h-4 mr-2" />
                          )}
                          Reset default
                        </Button>
                        {isDirty && (
                          <span className="text-xs text-amber-600">
                            Bozza modificata non salvata
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {promptTab === "preview" && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">Prompt finale con variabili simulate</p>
                        <Button
                          variant="outline"
                          disabled={previewSaving}
                          onClick={() => onLoadPromptPreview(prompt.key)}
                          className="min-h-11"
                        >
                          <RefreshCw className={cn("w-4 h-4 mr-2", previewSaving && "animate-spin")} />
                          Rigenera
                        </Button>
                      </div>
                      {preview ? (
                        <>
                          <pre className="bg-background border rounded-xl p-4 text-xs whitespace-pre-wrap overflow-x-auto font-mono">
                            {preview.rendered}
                          </pre>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {Object.entries(preview.variables).map(([key, value]) => (
                              <div key={key} className="rounded-md border bg-background p-3">
                                <p className="text-xs font-semibold text-muted-foreground">{key}</p>
                                <p className="text-xs mt-1 break-words">{value}</p>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="p-8 text-center text-muted-foreground border rounded-xl bg-background">
                          Genera una preview per vedere il prompt renderizzato.
                        </div>
                      )}
                    </div>
                  )}

                  {promptTab === "versions" && (
                    <div className="space-y-3">
                      {versions.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground border rounded-xl bg-background">
                          Nessuna versione caricata.
                        </div>
                      ) : (
                        versions.map((version) => {
                          const rollbackKey = `${prompt.key}:rollback:${version.id}`;
                          const rollbackSaving = promptSaving.has(rollbackKey);
                          const canRollback = version.status !== "active" && version.status !== "draft";
                          return (
                            <div key={version.id} className="rounded-xl border bg-background p-4 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-sm">v{version.versionNumber}</span>
                                  <Badge
                                    variant={version.status === "active" ? "default" : "outline"}
                                    className="capitalize"
                                  >
                                    {version.status}
                                  </Badge>
                                  {version.notes && (
                                    <span className="text-xs text-muted-foreground">{version.notes}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {fmtShortDate(version.publishedAt ?? version.updatedAt)}
                                  </span>
                                  {canRollback && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      disabled={rollbackSaving}
                                      onClick={() => onRollbackPrompt(prompt.key, version.id)}
                                      className="min-h-11"
                                    >
                                      {rollbackSaving ? (
                                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                      ) : (
                                        <RotateCcw className="w-4 h-4 mr-2" />
                                      )}
                                      Rollback
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <pre className="max-h-32 overflow-auto rounded-lg bg-muted/40 p-3 text-xs whitespace-pre-wrap font-mono">
                                {version.value}
                              </pre>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
