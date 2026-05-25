import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export function WinnerBadge({ side }: { side: "left" | "right" | "tie" }) {
  const { t } = useTranslation();
  if (side === "tie") {
    return (
      <span className="text-xs text-muted-foreground font-medium px-2 py-0.5 rounded-full bg-muted">
        {t("confronta.tie")}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "text-xs font-bold px-2 py-0.5 rounded-full",
        side === "left"
          ? "bg-primary/15 text-primary"
          : "bg-violet-100 text-violet-700",
      )}
    >
      {t("confronta.best")}
    </span>
  );
}

export function SalaryBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
    </div>
  );
}
