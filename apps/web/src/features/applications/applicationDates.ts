import { useTranslation } from "react-i18next";

export function useFormatDate() {
  const { i18n } = useTranslation();
  return (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, {
      day: "numeric",
      month: "short",
    });
}

export function useFormatNoteDate() {
  const { t, i18n } = useTranslation();
  return (iso: string): string => {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return t("candidature.now");
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays === 1) return t("amici.yesterday");
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString(i18n.language, { day: "numeric", month: "short" });
  };
}

export function groupByMonth(apps: Array<{ appliedAt: string }>): { month: string; count: number }[] {
  const map = new Map<string, number>();
  apps.forEach((app) => {
    const date = new Date(app.appliedAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));
}

export function formatMonth(ym: string): string {
  const [year, month] = ym.split("-");
  return new Date(parseInt(year ?? "1970"), parseInt(month ?? "1") - 1).toLocaleDateString("it-IT", {
    month: "short",
    year: "2-digit",
  });
}
