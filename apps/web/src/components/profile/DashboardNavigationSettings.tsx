import { DashboardLayoutManager } from "@/components/dashboard/DashboardLayoutManager";
import { TopNavigationLayoutManager } from "@/components/profile/TopNavigationLayoutManager";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useDashboardLayout } from "@/hooks/useDashboardLayout";
import { useTopNavigationLayout } from "@/hooks/useTopNavigationLayout";
import { Check, LayoutDashboard, Loader2, Navigation } from "lucide-react";

export function DashboardNavigationSettings() {
  const dashboard = useDashboardLayout();
  const navigation = useTopNavigationLayout();

  return (
    <Accordion type="multiple" defaultValue={["dashboard"]} className="pb-1">
      <AccordionItem value="dashboard" className="border-b border-border">
        <AccordionTrigger className="py-3 hover:no-underline">
          <span className="flex min-w-0 flex-1 items-center justify-between gap-3 pr-2">
            <span className="flex min-w-0 items-center gap-2">
              <LayoutDashboard className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm font-medium">Dashboard</span>
            </span>
            <SaveState saving={dashboard.isSaving} active={!dashboard.isLoading} />
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="space-y-3 pb-3">
            <p className="text-xs text-muted-foreground">
              Ordina e mostra solo le sezioni reali della dashboard.
            </p>
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
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="navigation" className="border-b-0">
        <AccordionTrigger className="py-3 hover:no-underline">
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
            <Navigation className="h-4 w-4 shrink-0 text-primary" />
            Barra superiore
          </span>
        </AccordionTrigger>
        <AccordionContent>
          <div className="pb-3">
            <TopNavigationLayoutManager
              layout={navigation.layout}
              availableItems={navigation.availableItems}
              errorMessage={navigation.errorMessage}
              isSaving={navigation.isSaving}
              onLayoutChange={navigation.updateLayout}
              onReset={navigation.resetLayout}
            />
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
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
