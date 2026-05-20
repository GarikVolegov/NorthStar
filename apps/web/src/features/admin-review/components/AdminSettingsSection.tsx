import { Badge } from "@/components/ui/badge";
import type { DashboardStats } from "../adminReviewTypes";

type AdminSettingsSectionProps = {
  stats: DashboardStats | null;
  suggestionsTotal: number;
};

export function AdminSettingsSection({ stats, suggestionsTotal }: AdminSettingsSectionProps) {
  return (
    <div className="p-8">
      <h3 className="text-lg font-serif font-bold mb-4">
        Impostazioni
      </h3>
      <div className="space-y-4">
        <div className="bg-card border rounded-2xl p-6">
          <h4 className="font-semibold mb-2">Stato del Sistema</h4>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Suggerimenti totali:{" "}
              <strong className="text-foreground">
                {suggestionsTotal}
              </strong>
            </p>
            <p>
              In attesa:{" "}
              <strong className="text-amber-600">
                {stats?.pending ?? 0}
              </strong>
            </p>
            <p>
              Approvati:{" "}
              <strong className="text-emerald-600">
                {stats?.approved ?? 0}
              </strong>
            </p>
            <p>
              Rifiutati:{" "}
              <strong className="text-red-600">
                {stats?.rejected ?? 0}
              </strong>
            </p>
            <p>
              Esecuzioni agenti:{" "}
              <strong className="text-foreground">
                {stats?.totalRuns ?? 0}
              </strong>
            </p>
          </div>
        </div>
        <div className="bg-card border rounded-2xl p-6">
          <h4 className="font-semibold mb-2">Agenti Attivi</h4>
          <div className="flex flex-wrap gap-2">
            {[
              "Sector",
              "Role",
              "Education",
              "Calendar",
              "Growth",
              "WorkMode",
              "Validator",
            ].map((name) => (
              <Badge key={name} variant="secondary">
                {name}Agent
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
