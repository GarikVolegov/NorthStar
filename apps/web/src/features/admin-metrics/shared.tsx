import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ReactNode } from "react";

export function KpiCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            {label}
          </span>
          <span className="text-muted-foreground/60">{icon}</span>
        </div>
        <p className="text-3xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function HealthBadge({ state }: { state: "ok" | "warning" }) {
  return (
    <Badge
      variant={state === "ok" ? "outline" : "destructive"}
      className="text-xs"
    >
      {state === "ok" ? "OK" : "Warning"}
    </Badge>
  );
}
