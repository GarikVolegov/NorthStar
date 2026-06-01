/**
 * DashboardDiscoveryFeed
 *
 * Shows top sector recommendations as swipeable discovery cards.
 * Save/dismiss reactions stored in localStorage (keyed by userId + sectorId).
 * No backend required for v1 — reactions are local only.
 */
import { cn } from "@/lib/utils";
import { Bookmark, BookmarkCheck, TrendingUp, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import type { AdaptiveSectionPresentation } from "./dashboard-adaptive-flow";

export interface DiscoverySector {
  sectorId: number;
  sectorName: string;
  matchScore: number;
  matchReason?: string | undefined;
}

type Reaction = "saved" | "dismissed";
type ReactionsMap = Record<number, Reaction>;

const STORAGE_KEY = (userId: number | string) => `ns_discovery_reactions_${userId}`;

function loadReactions(userId: number | string): ReactionsMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(userId));
    return raw ? (JSON.parse(raw) as ReactionsMap) : {};
  } catch {
    return {};
  }
}

function saveReactions(userId: number | string, reactions: ReactionsMap) {
  try {
    localStorage.setItem(STORAGE_KEY(userId), JSON.stringify(reactions));
  } catch {
    // ignore quota errors
  }
}

export function useSavedSectorsCount(userId: number | string | undefined): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const reactions = loadReactions(userId);
    setCount(Object.values(reactions).filter((r) => r === "saved").length);
  }, [userId]);

  return count;
}

function MatchBadge({ score }: { score: number }) {
  // score is already 0–100
  const pct = Math.round(score);
  const color =
    pct >= 80 ? "text-emerald-600 bg-emerald-50 border-emerald-200" :
    pct >= 60 ? "text-amber-600 bg-amber-50 border-amber-200" :
                "text-muted-foreground bg-muted/40 border-border";
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-bold tabular-nums", color)}>
      {pct}% affinita
    </span>
  );
}

export function DashboardDiscoveryFeed({
  sectors,
  userId,
  onSavedCountChange,
  presentation,
}: {
  sectors: DiscoverySector[];
  userId: number | string;
  onSavedCountChange?: (count: number) => void;
  presentation?: AdaptiveSectionPresentation | undefined;
}) {
  const [reactions, setReactions] = useState<ReactionsMap>(() => loadReactions(userId));

  // Notify parent whenever saved count changes
  useEffect(() => {
    const count = Object.values(reactions).filter((r) => r === "saved").length;
    onSavedCountChange?.(count);
  }, [reactions, onSavedCountChange]);

  const react = useCallback(
    (sectorId: number, reaction: Reaction) => {
      setReactions((prev) => {
        const next = { ...prev };
        if (prev[sectorId] === reaction) {
          // Toggle off
          delete next[sectorId];
        } else {
          next[sectorId] = reaction;
        }
        saveReactions(userId, next);
        return next;
      });
    },
    [userId],
  );

  // Show saved first, then unseen, then dismissed last
  const sorted = [...sectors].sort((a, b) => {
    const ra = reactions[a.sectorId];
    const rb = reactions[b.sectorId];
    if (ra === "saved" && rb !== "saved") return -1;
    if (rb === "saved" && ra !== "saved") return 1;
    if (ra === "dismissed" && rb !== "dismissed") return 1;
    if (rb === "dismissed" && ra !== "dismissed") return -1;
    return b.matchScore - a.matchScore;
  });

  const maxVisible = presentation?.priority === "compact" ? 3 : 6;
  const visible = sorted.slice(0, maxVisible);
  const savedCount = Object.values(reactions).filter((r) => r === "saved").length;
  const isCompact = presentation?.priority === "compact";
  const isPrimary = presentation?.priority === "primary";

  if (sectors.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center">
        <TrendingUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
        <p className="text-sm font-medium text-muted-foreground">Completa il test per ricevere i settori consigliati</p>
        <Link
          href="/test"
          className="mt-3 inline-block rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          Inizia il test →
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {savedCount > 0 && (
        <div className="flex items-center gap-1.5">
          <BookmarkCheck className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">
            {savedCount} {savedCount === 1 ? "settore salvato" : "settori salvati"}
          </span>
        </div>
      )}

      <div className={cn("space-y-2", isPrimary && "rounded-2xl border border-primary/25 bg-primary/5 p-2")}>
        {visible.map((sector, index) => {
          const reaction = reactions[sector.sectorId];
          const isSaved = reaction === "saved";
          const isDismissed = reaction === "dismissed";
          const isPromoted = isPrimary && index === 0;

          return (
            <div
              key={sector.sectorId}
              aria-label={`${sector.sectorName}${isPromoted ? " settore promosso" : ""}`}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3 transition-all duration-200",
                isPromoted && "border-primary/35 bg-primary/8 shadow-sm",
                isSaved && "border-primary/25 bg-primary/5",
                isDismissed && "opacity-40",
                !isPromoted && !isSaved && !isDismissed && "border-border bg-card hover:border-primary/20",
              )}
            >
              {/* Match indicator */}
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-bold",
                  isSaved ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground",
                )}
              >
                {Math.round(sector.matchScore)}
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-semibold leading-tight", isSaved ? "text-primary" : "text-foreground")}>
                  {sector.sectorName}
                </p>
                {sector.matchReason && !isCompact && (
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{sector.matchReason}</p>
                )}
                <div className="mt-1">
                  <MatchBadge score={sector.matchScore} />
                </div>
              </div>

              {/* Actions */}
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => react(sector.sectorId, "saved")}
                  aria-label={isSaved ? "Rimuovi dai salvati" : "Salva settore"}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border transition-all active:scale-95",
                    isSaved
                      ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                      : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-primary",
                  )}
                >
                  {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => react(sector.sectorId, "dismissed")}
                  aria-label={isDismissed ? "Ripristina" : "Non fa per me"}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full border transition-all active:scale-95",
                    isDismissed
                      ? "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
                      : "border-border bg-card text-muted-foreground hover:border-destructive/20 hover:text-destructive",
                  )}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Link
        href="/settori"
        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
      >
        <TrendingUp className="h-3 w-3" />
        Esplora tutti i settori →
      </Link>
    </div>
  );
}
