import { cn } from "@/lib/utils";
import { ChevronRight, Crown } from "lucide-react";
import { Link } from "wouter";

export interface ToolItem {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  premium?: boolean;
  accent?: string;
}

export function ToolCard({ tool }: { tool: ToolItem }) {
  const accent = tool.accent ?? "primary";
  return (
    <Link href={tool.href}>
      <div className="group h-full flex flex-col p-5 rounded-2xl border bg-card hover:shadow-md hover:border-primary/30 transition-all duration-200 cursor-pointer relative">
        {tool.badge && (
          <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 rounded-full px-2 py-0.5">
            {tool.badge}
          </span>
        )}
        {tool.premium && (
          <span className="absolute top-3 right-3 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
            <Crown className="w-3 h-3" /> Pro
          </span>
        )}
        <div className={cn(
          "w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-colors shrink-0",
          accent === "primary" && "bg-primary/10 text-primary group-hover:bg-primary/15",
          accent === "amber" && "bg-amber-50 text-amber-700 group-hover:bg-amber-100",
          accent === "emerald" && "bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100",
          accent === "violet" && "bg-violet-50 text-violet-700 group-hover:bg-violet-100",
          accent === "blue" && "bg-blue-50 text-blue-700 group-hover:bg-blue-100",
          accent === "rose" && "bg-rose-50 text-rose-700 group-hover:bg-rose-100",
        )}>
          {tool.icon}
        </div>
        <h3 className="font-semibold text-foreground leading-snug mb-1 group-hover:text-primary transition-colors">
          {tool.title}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 flex-1">
          {tool.description}
        </p>
        <div className="flex items-center gap-1 text-xs font-medium text-primary mt-3">
          Apri <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </Link>
  );
}
