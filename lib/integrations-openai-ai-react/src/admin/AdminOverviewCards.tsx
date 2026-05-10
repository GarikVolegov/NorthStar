/**
 * AdminOverviewCards — KPI cards in cima alla dashboard.
 *
 * Mostra:
 *   - Totale item raccolti
 *   - Item arricchiti (GPT enriched)
 *   - Fonti attive / totali
 *   - Ultimo collect (data + ora)
 */
import React from "react";
import type { AdminStats } from "./useAdminData";

interface Props {
  stats:     AdminStats | null;
  isLoading: boolean;
}

interface KPI {
  label:     string;
  value:     string;
  icon:      string;
  color:     string;
  subLabel?: string;
}

export const AdminOverviewCards: React.FC<Props> = ({ stats, isLoading }) => {
  const cards: KPI[] = [
    {
      label:    "Item totali",
      value:    isLoading ? "—" : String(stats?.totalItems ?? 0),
      icon:     "📊",
      color:    "bg-indigo-50 border-indigo-100",
      subLabel: "nel database",
    },
    {
      label:    "Arricchiti con GPT",
      value:    isLoading ? "—" : String(stats?.enrichedItems ?? 0),
      icon:     "✨",
      color:    "bg-purple-50 border-purple-100",
      subLabel: stats ? `${Math.round(((stats.enrichedItems ?? 0) / Math.max(stats.totalItems ?? 1, 1)) * 100)}% del totale` : "",
    },
    {
      label:    "Fonti attive",
      value:    isLoading ? "—" : `${stats?.enabledSources ?? 0} / ${stats?.totalSources ?? 0}`,
      icon:     "📡",
      color:    "bg-green-50 border-green-100",
      subLabel: "fonti RSS configurate",
    },
    {
      label:    "Ultimo collect",
      value:    isLoading ? "—" : stats?.lastCollectAt
        ? new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(stats.lastCollectAt))
        : "Mai",
      icon:     "⏰",
      color:    "bg-amber-50 border-amber-100",
      subLabel: "aggiornamento automatico ogni 6h",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className={`rounded-2xl border p-4 ${card.color}`}>
          <div className="text-2xl mb-1">{card.icon}</div>
          <div className="text-2xl font-bold text-gray-900 leading-tight">{card.value}</div>
          <div className="text-xs font-medium text-gray-700 mt-0.5">{card.label}</div>
          {card.subLabel && <div className="text-[10px] text-gray-400 mt-0.5">{card.subLabel}</div>}
        </div>
      ))}
    </div>
  );
};
