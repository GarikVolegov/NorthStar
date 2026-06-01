import { Button } from "@/components/ui/button";
import { Activity, History, ShieldAlert, Workflow } from "lucide-react";
import type { AgentsTab } from "./types";

type AgentsTabButtonsProps = {
  tab: AgentsTab;
  onTabChange: (tab: AgentsTab) => void;
};

const tabs: Array<{ key: AgentsTab; label: string; icon: typeof Activity }> = [
  { key: "overview", label: "Dashboard", icon: Activity },
  { key: "launch", label: "Pipeline", icon: Workflow },
  { key: "history", label: "Cronologia", icon: History },
  { key: "errors", label: "Errori", icon: ShieldAlert },
];

export function AgentsTabButtons({ tab, onTabChange }: AgentsTabButtonsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {tabs.map((item) => {
        const Icon = item.icon;
        return (
          <Button
            key={item.key}
            variant={tab === item.key ? "default" : "outline"}
            onClick={() => onTabChange(item.key)}
            className="min-h-11 shrink-0"
          >
            <Icon className="w-4 h-4 mr-2" />
            {item.label}
          </Button>
        );
      })}
    </div>
  );
}
