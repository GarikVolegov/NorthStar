/**
 * DashboardDiscoveryFeed
 *
 * Shows top sector recommendations as discovery cards.
 * Save/dismiss reactions are stored in localStorage by user and sector.
 */
import { useDynamicTranslation } from "@/lib/dynamic-translation";
import { cn } from "@/lib/utils";
import { ArrowRight, Bookmark, BookmarkCheck, TrendingUp, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
    // Ignore quota errors: this widget remains usable without persistence.
  }
}

function useDashboardLocale(): string {
  const { i18n } = useTranslation();
  return i18n.resolvedLanguage?.slice(0, 2) || i18n.language?.slice(0, 2) || "it";
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

function MatchBadge({ score, locale }: { score: number; locale: string }) {
  const pct = Math.round(score);
  const label = useDynamicTranslation({
    locale,
    key: "dashboard.discoveryFeed.matchBadge",
    source: "affinita",
    context: "Dashboard discovery feed match score badge suffix. Keep the percentage outside this string.",
  });
  const color =
    pct >= 80
      ? "text-emerald-600 bg-emerald-50 border-emerald-200"
      : pct >= 60
        ? "text-amber-600 bg-amber-50 border-amber-200"
        : "text-muted-foreground bg-muted/40 border-border";

  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-bold tabular-nums", color)}>
      {pct}% {label}
    </span>
  );
}

function EmptyDiscoveryState({ locale }: { locale: string }) {
  const title = useDynamicTranslation({
    locale,
    key: "dashboard.discoveryFeed.empty.title",
    source: "Completa il test per ricevere i settori consigliati",
    context: "Dashboard discovery feed empty state shown before the user has test recommendations.",
  });
  const cta = useDynamicTranslation({
    locale,
    key: "dashboard.discoveryFeed.empty.cta",
    source: "Inizia il test",
    context: "Dashboard discovery feed empty state CTA.",
  });

  return (
    <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center">
      <TrendingUp className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <Link
        href="/test"
        className="mt-3 inline-block rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        {cta} <span aria-hidden="true">-&gt;</span>
      </Link>
    </div>
  );
}

function DiscoverySectorCard({
  sector,
  reaction,
  isCompact,
  isPromoted,
  locale,
  onReact,
}: {
  sector: DiscoverySector;
  reaction: Reaction | undefined;
  isCompact: boolean;
  isPromoted: boolean;
  locale: string;
  onReact: (sectorId: number, reaction: Reaction) => void;
}) {
  const isSaved = reaction === "saved";
  const isDismissed = reaction === "dismissed";
  const promotedAria = useDynamicTranslation({
    locale,
    key: "dashboard.discoveryFeed.promotedAria",
    source: "consiglio principale per te",
    context: "ARIA suffix for the top promoted sector recommendation in the dashboard discovery feed.",
  });
  const matchReason = useDynamicTranslation({
    locale,
    key: `dashboard.discoveryFeed.sectors.${sector.sectorId}.matchReason`,
    source: sector.matchReason ?? "",
    context: `Personalized reason why ${sector.sectorName} is recommended to the user. Keep it user-facing and practical.`,
  });
  const openRolesLabel = useDynamicTranslation({
    locale,
    key: "dashboard.discoveryFeed.openRoles",
    source: "Apri i ruoli collegati",
    context: "Dashboard discovery feed link to open roles for a recommended sector.",
  });
  const saveLabel = useDynamicTranslation({
    locale,
    key: "dashboard.discoveryFeed.actions.save",
    source: `Salva ${sector.sectorName}`,
    context: "Accessible label for saving a recommended sector. Keep the sector name unchanged.",
  });
  const removeSavedLabel = useDynamicTranslation({
    locale,
    key: "dashboard.discoveryFeed.actions.removeSaved",
    source: `Rimuovi ${sector.sectorName} dai salvati`,
    context: "Accessible label for removing a saved sector recommendation. Keep the sector name unchanged.",
  });
  const dismissLabel = useDynamicTranslation({
    locale,
    key: "dashboard.discoveryFeed.actions.dismiss",
    source: `Nascondi ${sector.sectorName}`,
    context: "Accessible label for dismissing a sector recommendation. Keep the sector name unchanged.",
  });
  const restoreLabel = useDynamicTranslation({
    locale,
    key: "dashboard.discoveryFeed.actions.restore",
    source: `Ripristina ${sector.sectorName}`,
    context: "Accessible label for restoring a dismissed sector recommendation. Keep the sector name unchanged.",
  });

  return (
    <div
      aria-label={`${sector.sectorName}${isPromoted ? ` ${promotedAria}` : ""}`}
      className={cn(
        "flex items-center gap-3 rounded-xl border p-3 transition-all duration-200",
        isPromoted && "border-primary/35 bg-primary/8 shadow-sm",
        isSaved && "border-primary/25 bg-primary/5",
        isDismissed && "opacity-40",
        !isPromoted && !isSaved && !isDismissed && "border-border bg-card hover:border-primary/20",
      )}
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-bold",
          isSaved ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground",
        )}
      >
        {Math.round(sector.matchScore)}
      </div>

      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-semibold leading-tight", isSaved ? "text-primary" : "text-foreground")}>
          {sector.sectorName}
        </p>
        {matchReason && !isCompact && (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{matchReason}</p>
        )}
        <div className="mt-1">
          <MatchBadge score={sector.matchScore} locale={locale} />
        </div>
        {!isCompact && (
          <Link
            href={`/settore/${sector.sectorId}#ruoli`}
            aria-label={`${openRolesLabel}: ${sector.sectorName}`}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {openRolesLabel}
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onReact(sector.sectorId, "saved")}
          aria-label={isSaved ? removeSavedLabel : saveLabel}
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
          onClick={() => onReact(sector.sectorId, "dismissed")}
          aria-label={isDismissed ? restoreLabel : dismissLabel}
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
  const locale = useDashboardLocale();
  const [reactions, setReactions] = useState<ReactionsMap>(() => loadReactions(userId));

  useEffect(() => {
    const count = Object.values(reactions).filter((r) => r === "saved").length;
    onSavedCountChange?.(count);
  }, [reactions, onSavedCountChange]);

  const react = useCallback(
    (sectorId: number, reaction: Reaction) => {
      setReactions((prev) => {
        const next = { ...prev };
        if (prev[sectorId] === reaction) {
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
  const savedSingularLabel = useDynamicTranslation({
    locale,
    key: "dashboard.discoveryFeed.saved.singular",
    source: "settore salvato",
    context: "Dashboard discovery feed saved sector count singular label.",
  });
  const savedPluralLabel = useDynamicTranslation({
    locale,
    key: "dashboard.discoveryFeed.saved.plural",
    source: "settori salvati",
    context: "Dashboard discovery feed saved sector count plural label.",
  });
  const chooseSectorRoleLabel = useDynamicTranslation({
    locale,
    key: "dashboard.discoveryFeed.chooseSectorRole",
    source: "Scegli settore e ruolo",
    context: "Dashboard discovery feed link to choose a sector and then a role.",
  });

  if (sectors.length === 0) {
    return <EmptyDiscoveryState locale={locale} />;
  }

  return (
    <div className="space-y-3">
      {savedCount > 0 && (
        <div className="flex items-center gap-1.5">
          <BookmarkCheck className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary">
            {savedCount} {savedCount === 1 ? savedSingularLabel : savedPluralLabel}
          </span>
        </div>
      )}

      <div className={cn("space-y-2", isPrimary && "rounded-2xl border border-primary/25 bg-primary/5 p-2")}>
        {visible.map((sector, index) => (
          <DiscoverySectorCard
            key={sector.sectorId}
            sector={sector}
            reaction={reactions[sector.sectorId]}
            isCompact={isCompact}
            isPromoted={isPrimary && index === 0}
            locale={locale}
            onReact={react}
          />
        ))}
      </div>

      <Link
        href="/settori"
        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
      >
        <TrendingUp className="h-3 w-3" />
        {chooseSectorRoleLabel} <span aria-hidden="true">-&gt;</span>
      </Link>
    </div>
  );
}
