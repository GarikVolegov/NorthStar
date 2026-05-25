import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Globe, Lock, Users, X } from "lucide-react";

import type { SocialAuthor, Visibility } from "./socialTypes";

function initials(name?: string | null) {
  return (name || "NS")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function Avatar({
  user,
  size = "md",
}: {
  user: SocialAuthor;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-16 w-16 text-lg",
  }[size];

  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={user.name}
        className={cn(sizeClass, "rounded-full object-cover border border-border bg-background")}
      />
    );
  }

  return (
    <div className={cn(sizeClass, "rounded-full border border-border bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0")}>
      {initials(user.name)}
    </div>
  );
}

export function timeAgo(iso: string) {
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min fa`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h fa`;
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  return visibility === "friends" ? (
    <Badge variant="outline" className="gap-1 text-[11px]">
      <Lock className="h-3 w-3" /> Amici
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 text-[11px]">
      <Globe className="h-3 w-3" /> Pubblico
    </Badge>
  );
}

export function LoadingList({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-20 rounded-2xl border bg-background animate-pulse" />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  compact = false,
}: {
  title: string;
  description: string;
  compact?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed bg-background text-center", compact ? "p-6" : "p-10")}>
      <Users className="mb-3 h-9 w-9 text-muted-foreground/40" />
      <p className="font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
      <div className="flex items-start gap-3">
        <X className="mt-0.5 h-4 w-4 text-destructive" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-destructive">Errore social</p>
          <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          <Button variant="outline" className="mt-3 min-h-10 rounded-xl" onClick={onRetry}>
            Riprova
          </Button>
        </div>
      </div>
    </div>
  );
}
