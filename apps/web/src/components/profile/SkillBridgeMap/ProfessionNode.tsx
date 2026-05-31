import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Handle, Position, type NodeProps } from "reactflow";
import type { SkillBridgeProfession } from "./types";

const RING_STYLES: Record<SkillBridgeProfession["ring"], string> = {
  1: "border-emerald-400/70 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/50 dark:text-emerald-50",
  2: "border-amber-400/70 bg-amber-50 text-amber-950 dark:bg-amber-950/50 dark:text-amber-50",
  3: "border-orange-400/70 bg-orange-50 text-orange-950 dark:bg-orange-950/50 dark:text-orange-50",
};

export function ProfessionNode({ data }: NodeProps<SkillBridgeProfession>) {
  return (
    <div
      className={cn(
        "w-40 rounded-lg border px-3 py-2 text-left shadow-sm backdrop-blur",
        RING_STYLES[data.ring],
      )}
    >
      <Handle type="target" position={Position.Left} className="opacity-0" />
      <p className="truncate text-sm font-semibold">{data.title}</p>
      <p className="mt-0.5 truncate text-[11px] opacity-80">{data.sector}</p>
      <div className="mt-2 flex items-center justify-between gap-2">
        <Badge variant="outline" className="bg-background/60 text-[10px]">
          {data.missingSkills.length} skill
        </Badge>
        <span className="text-[11px] font-medium">{data.overlapPercent}% match</span>
      </div>
      <Handle type="source" position={Position.Right} className="opacity-0" />
    </div>
  );
}

