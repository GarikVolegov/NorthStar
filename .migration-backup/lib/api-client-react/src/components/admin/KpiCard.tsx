/**
 * KpiCard
 *
 * Card KPI cliccabile con:
 * - Skeleton animato durante il loading
 * - Trend opzionale (+N%)
 * - onClick per navigare alla sezione dettaglio
 */
import React from "react";

export interface KpiCardProps {
  label:      string;
  value:      string | number | null;
  icon?:      string;         // emoji o stringa Unicode
  trend?:     number;         // percentuale vs periodo precedente, es. +12.5
  loading?:   boolean;
  onClick?:   () => void;
  className?: string;
}

export function KpiCard({
  label,
  value,
  icon,
  trend,
  loading = false,
  onClick,
  className = "",
}: KpiCardProps) {
  if (loading) {
    return (
      <div className={`animate-pulse rounded-xl border bg-card p-6 h-28 ${className}`}>
        <div className="h-3 w-24 rounded bg-muted mb-3" />
        <div className="h-7 w-16 rounded bg-muted" />
      </div>
    );
  }

  const trendColor =
    trend === undefined ? ""
    : trend >= 0        ? "text-emerald-500"
    : "text-red-500";

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(); } : undefined}
      className={[
        "rounded-xl border bg-card p-6 transition-shadow",
        onClick ? "cursor-pointer hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring" : "",
        className,
      ].join(" ")}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        {icon && <span className="text-xl" aria-hidden>{icon}</span>}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-3xl font-bold leading-none">
          {value === null ? "—" : value}
        </span>
        {trend !== undefined && (
          <span className={`text-xs font-medium mb-0.5 ${trendColor}`}>
            {trend >= 0 ? `+${trend}%` : `${trend}%`}
          </span>
        )}
      </div>
    </div>
  );
}
