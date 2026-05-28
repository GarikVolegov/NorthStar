import { DashboardLayoutManager } from "@/components/dashboard/DashboardLayoutManager";
import { TopNavigationLayoutManager } from "@/components/profile/TopNavigationLayoutManager";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { useTopNavigationLayout } from "@/hooks/useTopNavigationLayout";
import { Check, Loader2 } from "lucide-react";

export function DashboardNavigationSettings() {
  const dashboard = useDashboardLayout();
  const navigation = useTopNavigationLayout();

  return (
    <div className="space-y-5 pb-1">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Dashboard</p>
            <p className="text-xs text-muted-foreground">Ordina e mostra solo le sezioni reali della dashboard.</p>
          </div>
          <SaveState saving={dashboard.isSaving} active={!dashboard.isLoading} />
        </div>

        {dashboard.isLoading ? (
          <p className="py-4 text-center text-xs text-muted-foreground">Caricamento layout...</p>
        ) : (
          <DashboardLayoutManager
            layout={dashboard.layout}
            availableSections={dashboard.availableSections}
            defaultLayout={dashboard.defaultLayout}
            onLayoutChange={dashboard.updateLayout}
          />
        )}
      </section>

      <section className="space-y-3 border-t border-border pt-4">
        <TopNavigationLayoutManager
          layout={navigation.layout}
          availableItems={navigation.availableItems}
          errorMessage={navigation.errorMessage}
          isSaving={navigation.isSaving}
          onLayoutChange={navigation.updateLayout}
          onReset={navigation.resetLayout}
        />
      </section>
    </div>
  );
}

function SaveState({ saving, active }: { saving: boolean; active: boolean }) {
  if (saving) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        Salvataggio...
      </span>
    );
  }
  if (!active) return null;
  return (
    <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
      <Check className="h-3 w-3" />
      Salvato
    </span>
  );
}
