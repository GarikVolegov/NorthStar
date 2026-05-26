import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ActiveUserBackground } from "@/features/user-background/types";
import { useUserBackground } from "@/hooks/useUserBackground";
import { cn } from "@/lib/utils";
import { Check, ImagePlus, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useCallback, type CSSProperties } from "react";

interface BackgroundPickerProps {
  userId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function previewStyle(
  background: ActiveUserBackground | null,
  localPreviewUrl: string | null,
): CSSProperties | undefined {
  if (localPreviewUrl) return { backgroundImage: `url(${localPreviewUrl})` };
  if (!background || background.kind !== "user") return undefined;
  return { backgroundImage: `url(${background.entry.dataUrl})` };
}

function previewClass(background: ActiveUserBackground | null, localPreviewUrl: string | null) {
  if (localPreviewUrl) return "bg-cover bg-center";
  if (!background) return "bg-[linear-gradient(135deg,hsl(var(--background)),hsl(var(--muted)))]";
  if (background.kind === "preset") return background.preset.previewClassName;
  return "bg-cover bg-center";
}

export function BackgroundPicker({ userId, open, onOpenChange }: BackgroundPickerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("presets");
  const {
    activeBackground,
    activeBackgroundId,
    previewBackground,
    previewBackgroundId,
    appearance,
    presets,
    library,
    loading,
    saving,
    uploading,
    error,
    serverError,
    persistenceUnavailable,
    imageTooLarge,
    libraryFull,
    setPreviewBackground,
    updateAppearance,
    setActiveBackground,
    uploadBackground,
    deleteBackground,
  } = useUserBackground(userId);
  const isLibraryFull = libraryFull || library.length >= 5;

  // Local draft for live preview of appearance sliders (updates while dragging)
  const [draft, setDraft] = useState(appearance);
  // Sync draft when server appearance changes (e.g. after save or on open)
  useEffect(() => { setDraft(appearance); }, [appearance]);

  const commitAppearance = useCallback(
    (patch: Partial<typeof appearance>) => {
      const next = { ...draft, ...patch };
      setDraft(next);
      void updateAppearance(next);
    },
    [draft, updateAppearance],
  );

  useEffect(() => {
    if (!open) return;
    setSelectedId(previewBackgroundId ?? activeBackgroundId ?? null);
  }, [activeBackgroundId, open, previewBackgroundId]);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  const selectedBackground = useMemo(() => {
    if (localPreviewUrl) return null;
    if (previewBackground) return previewBackground;
    return activeBackground;
  }, [activeBackground, localPreviewUrl, previewBackground]);

  const select = (id: string | null) => {
    setSelectedId(id);
    setPreviewBackground(id);
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviewUrl(null);
    }
  };

  const chooseFile = async (file: File | undefined) => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    setLocalPreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return objectUrl;
    });
    try {
      const result = await uploadBackground({ file, label });
      const nextId = `user:${result.entry.id}`;
      setLabel("");
      URL.revokeObjectURL(objectUrl);
      setLocalPreviewUrl(null);
      select(nextId);
    } catch {
      /* hook exposes the error state while the local preview remains visible */
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const applySelection = async () => {
    try {
      await setActiveBackground(selectedId);
    } catch {
      /* hook exposes the error state */
    }
  };

  const reset = async () => {
    select(null);
    try {
      await setActiveBackground(null);
    } catch {
      /* hook exposes the error state */
    }
  };

  const errorMessage = imageTooLarge
    ? "La foto e troppo dettagliata per essere salvata. Prova una foto piu leggera o meno panoramica."
    : persistenceUnavailable
      ? "Lo sfondo resta in anteprima: lo salveremo appena la persistenza torna disponibile."
      : serverError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-hidden p-0 sm:rounded-[2rem]">
        <div className="grid max-h-[92vh] grid-rows-[auto_1fr_auto] overflow-hidden">
          <DialogHeader className="px-5 pb-3 pt-5 text-left sm:px-6">
            <DialogTitle>Personalizza sfondo</DialogTitle>
            <DialogDescription>
              Scegli, prova e imposta lo sfondo della tua area NorthStar.
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 gap-4 overflow-y-auto px-5 pb-4 sm:grid-cols-[280px_1fr] sm:px-6">
            <section className="space-y-3">
              <div
                className={cn(
                  "relative aspect-[9/16] overflow-hidden rounded-[2rem] border shadow-inner sm:aspect-[10/16]",
                  previewClass(selectedBackground, localPreviewUrl),
                )}
                style={previewStyle(selectedBackground, localPreviewUrl)}
                aria-label="Anteprima sfondo"
              >
                <div
                  className="absolute inset-0 backdrop-blur-[1px]"
                  style={{ backgroundColor: `hsl(var(--background) / ${draft.overlay})` } as CSSProperties}
                />
                <div className="absolute inset-x-5 top-7 h-5 rounded-full bg-foreground/12" />
                <div
                  className="absolute bottom-5 left-5 right-5 space-y-3 rounded-3xl border border-white/20 p-4 shadow-2xl backdrop-blur-md"
                  style={{ backgroundColor: `hsl(var(--card) / ${draft.glassOpacity})`, backdropFilter: `blur(${draft.blur}px)` } as CSSProperties}
                >
                  <div className="h-3 w-2/3 rounded-full bg-foreground/30" />
                  <div className="h-3 w-1/2 rounded-full bg-foreground/20" />
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="h-12 rounded-2xl bg-primary/25" />
                    <div className="h-12 rounded-2xl bg-info/20" />
                    <div className="h-12 rounded-2xl bg-success/20" />
                  </div>
                </div>
              </div>
              {serverError && (
                <div className="rounded-2xl border border-warning-muted bg-warning-surface px-3 py-2 text-xs text-warning">
                  {errorMessage}
                </div>
              )}
              {uploading && (
                <div className="rounded-2xl border border-info-muted bg-info-surface px-3 py-2 text-xs text-info">
                  Preparo una versione leggera dello sfondo...
                </div>
              )}
            </section>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="min-w-0">
              <TabsList className="grid w-full grid-cols-4 rounded-full">
                <TabsTrigger value="presets">Preset</TabsTrigger>
                <TabsTrigger value="photos">Foto</TabsTrigger>
                <TabsTrigger value="recent">Recenti</TabsTrigger>
                <TabsTrigger value="appearance">Aspetto</TabsTrigger>
              </TabsList>

              <TabsContent value="presets" className="mt-4 grid gap-3 sm:grid-cols-2">
                {presets.map((preset) => {
                  const selected = selectedId === preset.id;
                  const active = activeBackgroundId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => select(preset.id)}
                      aria-label={`Anteprima ${preset.name}`}
                      className={cn(
                        "liquid-widget group overflow-hidden rounded-3xl border bg-card p-2 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                        selected ? "border-primary shadow-lg" : "border-border",
                      )}
                    >
                      <div className={cn("relative h-36 rounded-2xl border", preset.previewClassName)}>
                        {(selected || active) && (
                          <span className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow">
                            <Check className="h-4 w-4" />
                          </span>
                        )}
                      </div>
                      <div className="px-2 py-3">
                        <p className="font-semibold">{preset.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{preset.description}</p>
                        <p className="mt-2 text-xs font-medium text-primary">
                          {active ? "Attivo" : `Anteprima ${preset.name}`}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </TabsContent>

              <TabsContent value="photos" className="mt-4 space-y-4">
                <div className="liquid-panel rounded-3xl border bg-card p-4">
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <Input
                      value={label}
                      onChange={(event) => setLabel(event.target.value)}
                      placeholder="Nome sfondo opzionale"
                      disabled={isLibraryFull || uploading}
                    />
                    <Button type="button" disabled={isLibraryFull || uploading} onClick={() => fileInputRef.current?.click()}>
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                      Carica foto
                    </Button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    aria-label="Carica sfondo"
                    className="sr-only"
                    disabled={isLibraryFull || uploading}
                    onChange={(event) => void chooseFile(event.target.files?.[0])}
                  />
                  {isLibraryFull && (
                    <p className="mt-2 text-xs text-warning">
                      Hai raggiunto il massimo di 5 sfondi. Rimuovine uno per caricarne un altro.
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="recent" className="mt-4 grid gap-3 sm:grid-cols-2">
                {library.length === 0 ? (
                  <div className="liquid-panel rounded-3xl border bg-card p-6 text-sm text-muted-foreground">
                    Nessuna foto caricata. Aggiungi uno sfondo dalla scheda Foto.
                  </div>
                ) : (
                  library.map((entry) => {
                    const activeId = `user:${entry.id}`;
                    const selected = selectedId === activeId;
                    return (
                      <div key={entry.id} className={cn("liquid-widget rounded-3xl border bg-card p-2", selected && "border-primary")}>
                        <button
                          type="button"
                          aria-label={`Anteprima ${entry.label || "sfondo personale"}`}
                          onClick={() => select(activeId)}
                          className="h-36 w-full rounded-2xl border bg-cover bg-center"
                          style={{ backgroundImage: `url(${entry.dataUrl})` }}
                        />
                        <div className="flex items-center justify-between gap-2 px-2 py-3">
                          <div>
                            <p className="text-sm font-semibold">{entry.label || "Sfondo personale"}</p>
                            <p className="text-xs text-muted-foreground">{new Date(entry.createdAt).toLocaleDateString("it-IT")}</p>
                          </div>
                          <Button type="button" size="icon" variant="ghost" disabled={loading} onClick={() => void deleteBackground(entry.id).catch(() => {})} aria-label="Rimuovi sfondo">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </TabsContent>

              <TabsContent value="appearance" className="mt-4 space-y-4">
                {/* ── Liquid glass ── */}
                <div className="liquid-panel rounded-3xl border bg-card p-4">
                  <p className="text-sm font-semibold">Liquid glass</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Lascia decidere a NorthStar oppure regola manualmente trasparenza e blur.
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={draft.mode === "auto" ? "default" : "outline"}
                      onClick={() => commitAppearance({ mode: "auto" })}
                    >
                      Auto
                    </Button>
                    <Button
                      type="button"
                      variant={draft.mode === "manual" ? "default" : "outline"}
                      onClick={() => commitAppearance({ mode: "manual" })}
                    >
                      Manuale
                    </Button>
                  </div>
                  <div className="mt-5 space-y-5">
                    <label className="block space-y-2 text-sm">
                      <span className="flex justify-between">
                        <span>Opacità card</span>
                        <span className="text-muted-foreground">{Math.round(draft.glassOpacity * 100)}%</span>
                      </span>
                      <Slider
                        min={42}
                        max={92}
                        step={1}
                        value={[Math.round(draft.glassOpacity * 100)]}
                        onValueChange={([value]) => setDraft((prev) => ({ ...prev, glassOpacity: (value ?? 72) / 100 }))}
                        onValueCommit={([value]) => commitAppearance({ mode: "manual", glassOpacity: (value ?? 72) / 100 })}
                      />
                    </label>
                    <label className="block space-y-2 text-sm">
                      <span className="flex justify-between">
                        <span>Blur</span>
                        <span className="text-muted-foreground">{draft.blur}px</span>
                      </span>
                      <Slider
                        min={8}
                        max={30}
                        step={1}
                        value={[draft.blur]}
                        onValueChange={([value]) => setDraft((prev) => ({ ...prev, blur: value ?? 18 }))}
                        onValueCommit={([value]) => commitAppearance({ mode: "manual", blur: value ?? 18 })}
                      />
                    </label>
                    <label className="block space-y-2 text-sm">
                      <span className="flex justify-between">
                        <span>Oscuramento sfondo</span>
                        <span className="text-muted-foreground">{Math.round(draft.overlay * 100)}%</span>
                      </span>
                      <Slider
                        min={12}
                        max={58}
                        step={1}
                        value={[Math.round(draft.overlay * 100)]}
                        onValueChange={([value]) => setDraft((prev) => ({ ...prev, overlay: (value ?? 32) / 100 }))}
                        onValueCommit={([value]) => commitAppearance({ mode: "manual", overlay: (value ?? 32) / 100 })}
                      />
                    </label>
                  </div>
                </div>

                {/* ── Posizione sfondo ── */}
                <div className="liquid-panel rounded-3xl border bg-card p-4">
                  <p className="text-sm font-semibold">Posizione sfondo</p>
                  <p className="mt-1 text-xs text-muted-foreground">Regola il punto focale per desktop e mobile.</p>

                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Desktop</p>
                      <div className="grid grid-cols-3 gap-2">
                        {(["top", "center", "bottom"] as const).map((pos) => (
                          <Button
                            key={`desktop-${pos}`}
                            type="button"
                            size="sm"
                            variant={draft.desktopPosition === pos ? "default" : "outline"}
                            onClick={() => commitAppearance({ desktopPosition: pos })}
                          >
                            {pos === "top" ? "Alto" : pos === "center" ? "Centro" : "Basso"}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium text-muted-foreground">Mobile</p>
                      <div className="grid grid-cols-3 gap-2">
                        {(["top", "center", "bottom"] as const).map((pos) => (
                          <Button
                            key={`mobile-${pos}`}
                            type="button"
                            size="sm"
                            variant={draft.mobilePosition === pos ? "default" : "outline"}
                            onClick={() => commitAppearance({ mobilePosition: pos })}
                          >
                            {pos === "top" ? "Alto" : pos === "center" ? "Centro" : "Basso"}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="flex items-center justify-between gap-3 border-t bg-background/95 px-5 py-4 sm:px-6">
            <Button type="button" variant="ghost" disabled={loading || !activeBackgroundId} onClick={() => void reset()}>
              <RotateCcw className="h-4 w-4" />
              Ripristina
            </Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Annulla
              </Button>
              <Button type="button" disabled={saving || selectedId === activeBackgroundId} onClick={() => void applySelection()}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Imposta
              </Button>
            </div>
          </div>

          {error && (
            <div className="px-5 pb-4 text-sm text-danger sm:px-6">{error}</div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
