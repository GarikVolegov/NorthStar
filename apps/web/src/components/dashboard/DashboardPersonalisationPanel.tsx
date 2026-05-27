import { Button } from "@/components/ui/button";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, ChevronUp, Loader2, Settings2 } from "lucide-react";
import { useState } from "react";
import { DashboardLayoutManager } from "./DashboardLayoutManager";

export function DashboardPersonalisationPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const { layout, isLoading, isSaving, updateLayout } = useDashboardLayout();

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Settings2 className="h-3.5 w-3.5" />
          </div>
          <span className="text-sm font-semibold text-foreground">Personalizza dashboard</span>

          {/* Save state indicator */}
          <span
            className={cn(
              "flex items-center gap-1 text-xs transition-opacity",
              isSaving || (!isLoading && isOpen)
                ? "opacity-100"
                : "opacity-0",
            )}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="text-muted-foreground">Salvataggio...</span>
              </>
            ) : (
              <>
                <Check className="h-3 w-3 text-green-500" />
                <span className="text-green-600 dark:text-green-400">Salvato</span>
              </>
            )}
          </span>
        </div>

        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" asChild>
          <span aria-hidden="true">
            {isOpen
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />
            }
          </span>
        </Button>
      </button>

      {/* Collapsible content */}
      {isOpen && (
        <div className="px-4 pb-4 pt-2 border-t">
          {isLoading ? (
            <p className="text-xs text-muted-foreground py-4 text-center">Caricamento layout...</p>
          ) : (
            <DashboardLayoutManager layout={layout} onLayoutChange={updateLayout} />
          )}
        </div>
      )}
    </div>
  );
}
