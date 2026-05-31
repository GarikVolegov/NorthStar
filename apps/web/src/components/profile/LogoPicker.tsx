import { Button } from "@/components/ui/button";
import { useLogoPreset } from "@/hooks/useLogoPreset";
import { cn } from "@/lib/utils";
import { Check, Loader2 } from "lucide-react";

export function LogoPicker() {
  const {
    activePreset,
    presets,
    isLoading,
    isSaving,
    error,
    setLogoPreset,
  } = useLogoPreset();
  const activeIndex = Math.max(
    presets.findIndex((preset) => preset.id === activePreset.id),
    0,
  );
  const activeNumber = String(activeIndex + 1).padStart(2, "0");

  return (
    <div className="space-y-4 border-t border-border pt-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">
            12 varianti del logo
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            L'utente sceglie l'icona dell'app dal pannello Tweaks &gt; Logo.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
          {(isLoading || isSaving) && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          <span>Attivo: {activeNumber}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {presets.map((preset) => {
          const active = preset.id === activePreset.id;
          return (
            <button
              key={preset.id}
              type="button"
              aria-label={preset.label}
              aria-pressed={active}
              disabled={isSaving}
              onClick={() => void setLogoPreset(preset.id)}
              className={cn(
                "group relative flex min-h-[138px] flex-col items-center justify-between rounded-md border bg-[#101625] p-2.5 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70",
                active
                  ? "border-[#d4ad55] text-[#f5d77d] shadow-[0_0_0_1px_rgba(212,173,85,0.35)]"
                  : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
              )}
            >
              {active && (
                <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#d4ad55] text-[#111827]">
                  <Check className="h-4 w-4" />
                </span>
              )}
              <span className="flex aspect-square w-full max-w-[86px] items-center justify-center overflow-hidden rounded-md bg-[#17213b]">
                <img
                  src={preset.assetUrl}
                  alt=""
                  className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
                />
              </span>
              <span className="block min-h-5 max-w-full truncate text-xs font-semibold">
                {preset.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="rounded-md border border-border bg-background/60 p-3">
        <p className="text-xs font-semibold text-foreground">Anteprima notifiche</p>
        <div className="mt-2 flex items-center gap-2">
          <img
            src={activePreset.notificationIconUrl}
            alt=""
            className="h-8 w-8 rounded-md border bg-card object-cover"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight">Promemoria NorthStar</p>
            <p className="text-xs text-muted-foreground">Il logo scelto accompagna gli avvisi.</p>
          </div>
        </div>
      </div>

      {error && (
        <p className="text-xs font-medium text-destructive">
          Impossibile aggiornare il logo. Riprova tra poco.
        </p>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs"
          disabled={activePreset.id === "northstar" || isSaving}
          onClick={() => void setLogoPreset("northstar")}
        >
          Ripristina logo
        </Button>
      </div>
    </div>
  );
}
