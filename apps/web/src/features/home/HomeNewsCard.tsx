import { cn } from "@/lib/utils";
import { ChevronRight, Clock } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { CAT_COLOR, CAT_EMOJI } from "./homeConstants";
import type { HomeNewsItem } from "./homeTypes";

export function HomeNewsCard({ item }: { item: HomeNewsItem }) {
  const { t } = useTranslation();
  const [imageFailed, setImageFailed] = useState(false);
  const catColor = CAT_COLOR[item.category] ?? CAT_COLOR["general"];
  const catEmoji = CAT_EMOJI[item.category] ?? "ðŸŒ";
  const catLabel = t(`news.categories.${item.category}`, {
    defaultValue: item.category,
  });
  const diff = Date.now() - new Date(item.publishedAt).getTime();
  const h = Math.floor(diff / 3600000);
  let timeLabel: string;
  if (h < 1) timeLabel = t("news.timeAgo.lessThan1h");
  else if (h === 1) timeLabel = t("news.timeAgo.1h");
  else if (h < 24) timeLabel = t("news.timeAgo.hours", { h });
  else {
    const d = Math.floor(h / 24);
    timeLabel =
      d === 1 ? t("news.timeAgo.yesterday") : t("news.timeAgo.days", { d });
  }

  return (
    <Link
      href={item.detailUrl ?? `/news/${item.id}`}
      className="group flex flex-col rounded-2xl border border-border bg-card hover:border-primary/30 transition-all duration-300 overflow-hidden h-full"
    >
      {item.image && !imageFailed ? (
        <div className="aspect-video overflow-hidden bg-muted">
          <img
            src={item.image}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={() => setImageFailed(true)}
          />
        </div>
      ) : (
        <div
          data-testid="home-news-image-fallback"
          role="img"
          aria-label={item.title}
          className="aspect-video bg-muted/60 flex items-center justify-center"
        >
          <span className="text-3xl opacity-60" aria-hidden="true">{catEmoji}</span>
        </div>
      )}
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <span
            className={cn(
              "inline-flex items-center gap-1 text-xs font-semibold border rounded-full px-2.5 py-0.5",
              catColor,
            )}
          >
            {catEmoji} {catLabel}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" /> {timeLabel}
          </span>
        </div>
        <h3 className="font-semibold text-foreground leading-snug mb-2 line-clamp-3 group-hover:text-primary transition-colors">
          {item.title}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-2 flex-1 mb-4">
          {item.description}
        </p>
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/60">
          <span className="text-xs font-medium text-muted-foreground truncate max-w-[60%]">
            {item.source}
          </span>
          <span className="flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-1.5 transition-all">
            {t("common.readMore")} <ChevronRight className="w-3 h-3" />
          </span>
        </div>
      </div>
    </Link>
  );
}

