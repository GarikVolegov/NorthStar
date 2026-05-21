import { Badge } from "@/components/ui/badge";
import { ROADMAP_TEXT } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  BookOpen,
  Briefcase,
  Euro,
  GraduationCap,
  MapPin,
  Plus,
  Rocket,
  School,
  Star,
  ThumbsDown,
  ThumbsUp,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";

type PathOption = {
  id: string;
  type: string;
  title: string;
  shortDescription: string;
  duration: string;
  estimatedCost: string;
  fitScore: number;
  fitReason: string;
  bestFor: string;
  pros: string[];
  cons: string[];
};

function pathTypeIcon(type: string): React.ReactNode {
  const t = type.toLowerCase();
  if (t.includes("universitÃ ") || t.includes("laurea") || t.includes("master"))
    return <GraduationCap className="w-4 h-4" />;
  if (t.includes("its")) return <School className="w-4 h-4" />;
  if (t.includes("bootcamp")) return <Rocket className="w-4 h-4" />;
  if (t.includes("apprendistato")) return <Briefcase className="w-4 h-4" />;
  if (t.includes("autodidatta") || t.includes("certificazion"))
    return <Wrench className="w-4 h-4" />;
  return <BookOpen className="w-4 h-4" />;
}

export function fitScoreColor(score: number): string {
  if (score >= 80) return "text-emerald-700 bg-emerald-50 border-emerald-200";
  if (score >= 60) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-slate-600 bg-slate-50 border-slate-200";
}

export function PathCard({
  path,
  isSelected,
  isRecommended,
  onClick,
}: {
  path: PathOption;
  isSelected: boolean;
  isRecommended: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-left rounded-2xl border bg-card p-4 transition-all hover:shadow-md hover:-translate-y-0.5",
        isSelected
          ? "border-primary ring-2 ring-primary/20 shadow-sm"
          : "border-border",
      )}
    >
      <div className="flex items-start gap-3 mb-2">
        <div
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
            isSelected
              ? "bg-primary/15 text-primary"
              : "bg-muted text-muted-foreground",
          )}
        >
          {pathTypeIcon(path.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              {path.type}
            </Badge>
            {isRecommended && (
              <Badge className="text-[10px] px-1.5 py-0 bg-primary text-primary-foreground border-primary">
                <Star className="w-2.5 h-2.5 mr-0.5" /> Consigliato per te
              </Badge>
            )}
          </div>
          <h3 className="font-semibold text-sm leading-tight">{path.title}</h3>
        </div>
        <div
          className={cn(
            "shrink-0 px-2 py-1 rounded-lg border text-xs font-bold",
            fitScoreColor(path.fitScore),
          )}
          title={`Affinita con il tuo profilo: ${path.fitScore}/100`}
        >
          {path.fitScore}%
        </div>
      </div>
      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
        {path.shortDescription}
      </p>
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          {path.duration}
        </span>
        <span className="flex items-center gap-1">
          <Euro className="w-3 h-3" />
          {path.estimatedCost}
        </span>
      </div>
    </button>
  );
}

export function ProsConsBlock({
  pros,
  cons,
}: {
  pros: string[];
  cons: string[];
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <ThumbsUp className="w-4 h-4 text-emerald-600" />
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
            {ROADMAP_TEXT.content.prosCons.pros}
          </span>
        </div>
        <ul className="space-y-1.5">
          {pros.map((pro, index) => (
            <li key={index} className="text-sm flex items-start gap-2">
              <Plus className="w-3 h-3 text-emerald-600 shrink-0 mt-1" />
              <span>{pro}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="bg-rose-50/40 border border-rose-100 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <ThumbsDown className="w-4 h-4 text-rose-600" />
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-700">
            {ROADMAP_TEXT.content.prosCons.cons}
          </span>
        </div>
        <ul className="space-y-1.5">
          {cons.map((con, index) => (
            <li key={index} className="text-sm flex items-start gap-2">
              <span className="text-rose-600 shrink-0 mt-0.5 font-bold leading-none">
                âˆ’
              </span>
              <span>{con}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function useRotatingMessage(
  messages: string[],
  intervalMs: number,
  active: boolean,
) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!active) {
      setIdx(0);
      return;
    }
    const id = setInterval(
      () => setIdx((index) => (index + 1) % messages.length),
      intervalMs,
    );
    return () => clearInterval(id);
  }, [active, messages.length, intervalMs]);
  return messages[idx];
}
