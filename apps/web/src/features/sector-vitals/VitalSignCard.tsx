import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { VitalSign } from "@workspace/api-client-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { STATUS_STYLES, VITAL_SIGN_META } from "./vital-signs-config";

interface VitalSignCardProps {
  sign: VitalSign;
  emphasized?: boolean;
  plain?: boolean;
  compact?: boolean;
  onSelect?: () => void;
}

export function VitalSignCard({
  sign,
  emphasized = false,
  plain = false,
  compact = false,
  onSelect,
}: VitalSignCardProps) {
  const meta = VITAL_SIGN_META[sign.key]!;
  const status = STATUS_STYLES[sign.status]!;
  const Icon = meta.icon;
  const DeltaIcon = sign.delta > 0 ? ArrowUpRight : sign.delta < 0 ? ArrowDownRight : Minus;
  const chartData = sign.sparkline.map((value: number, index: number) => ({ index, value }));

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group min-h-[148px] rounded-lg border bg-card p-4 text-left shadow-sm transition-all hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        emphasized && "border-primary/40 bg-primary/5",
        compact && "min-h-[128px] p-3",
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {plain ? meta.plainLabel : meta.label}
            </p>
            <p className="text-[11px] text-muted-foreground">{meta.unit}</p>
          </div>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={cn(
                  "shrink-0 gap-1 text-[10px] font-semibold",
                  status.badge,
                  sign.status !== "green" && "animate-pulse",
                )}
              >
                {status.label}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>{meta.description}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div>
          <div className={cn("font-mono text-2xl font-bold text-foreground", compact && "text-xl")}>
            {Math.round(sign.value)}
          </div>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <DeltaIcon className="h-3 w-3" />
            <span>{sign.delta > 0 ? "+" : ""}{sign.delta}%</span>
          </div>
        </div>
        <div className="h-12 w-24 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <Area
                type="monotone"
                dataKey="value"
                stroke={status.stroke}
                fill={status.fill}
                fillOpacity={0.65}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </button>
  );
}
