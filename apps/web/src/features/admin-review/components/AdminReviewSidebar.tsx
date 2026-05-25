import { Button } from "@/components/ui/button";
import { ADMIN_NAV_GROUPS } from "@/features/admin-review/adminReviewConfig";
import type { DashboardStats } from "@/features/admin-review/adminReviewTypes";
import { cn } from "@/lib/utils";
import { Bot, LogOut } from "lucide-react";
import type { SidebarSection } from "@/components/admin/console";

type AdminReviewSidebarProps = {
  stats: DashboardStats | null;
  section: SidebarSection;
  onNavigateSection: (section: SidebarSection) => void;
  onLogout: () => void;
};

export function AdminReviewSidebar({
  stats,
  section,
  onNavigateSection,
  onLogout,
}: AdminReviewSidebarProps) {
  return (
    <>
      <div className="p-5 border-b">
        <div className="flex items-center gap-2 mb-1">
          <Bot className="w-5 h-5 text-primary" />
          <h1 className="font-serif font-bold text-lg">Admin Console</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          Controllo operativo NorthStar
        </p>
      </div>

      {stats && (
        <div className="p-4 border-b">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-warning-surface rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-warning">
                {stats.pending}
              </div>
              <div className="text-[10px] text-warning uppercase tracking-wider">
                In Attesa
              </div>
            </div>
            <div className="bg-success-surface rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-success">
                {stats.approved}
              </div>
              <div className="text-[10px] text-success uppercase tracking-wider">
                Approvati
              </div>
            </div>
            <div className="bg-danger-surface rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-danger">
                {stats.rejected}
              </div>
              <div className="text-[10px] text-danger uppercase tracking-wider">
                Rifiutati
              </div>
            </div>
            <div className="bg-muted rounded-lg p-3 text-center">
              <div className="text-xl font-bold text-foreground">
                {stats.totalRuns}
              </div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Esecuzioni
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto p-3 space-y-4">
        {ADMIN_NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </p>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const count = item.count?.(stats);
                return (
                  <button
                    key={item.key}
                    onClick={() => onNavigateSection(item.key)}
                    className={cn(
                      "min-h-11 w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                      section === item.key
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                    aria-current={section === item.key ? "page" : undefined}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="flex-1">{item.label}</span>
                    {count != null && count > 0 && (
                      <span className="text-xs bg-warning text-primary-foreground px-1.5 py-0.5 rounded-full min-w-5 text-center">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="min-h-11 w-full justify-start text-muted-foreground"
          onClick={onLogout}
        >
          <LogOut className="w-4 h-4 mr-2" /> Esci
        </Button>
      </div>
    </>
  );
}

