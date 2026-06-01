import { cn } from "@/lib/utils";
import { BookOpen, Crown, ExternalLink, Map } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Sector } from "./CalendarioEventoModal.api";

interface CalendarioSectorSuggestionProps {
  baseUrl: string;
  isPremium: boolean;
  selectedSector: Sector;
}

export function CalendarioSectorSuggestion({
  baseUrl,
  isPremium,
  selectedSector,
}: CalendarioSectorSuggestionProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "rounded-xl border p-3 space-y-2",
        isPremium
          ? "bg-primary/5 border-primary/20"
          : "bg-muted/40 border-muted",
      )}
    >
      {isPremium ? (
        <>
          <p className="text-xs font-semibold text-primary flex items-center gap-1">
            <Crown className="h-3 w-3" />{" "}
            {t("calendar.suggestedContent", { name: selectedSector.name })}
          </p>
          <div className="flex flex-wrap gap-2">
            <a
              href={`${baseUrl}wiki`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <BookOpen className="h-3 w-3" /> {t("calendar.wikiLabel")}
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
            <a
              href={`${baseUrl}roadmap`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Map className="h-3 w-3" /> {t("calendar.roadmapLabel")}
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
            <a
              href={`${baseUrl}crescita`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" /> {t("calendar.growthLabel")}
            </a>
          </div>
        </>
      ) : (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Crown className="h-3 w-3 text-amber-500" />
          <span>
            {
              t("calendar.premiumNote", {
                name: selectedSector.name,
              }).split(selectedSector.name)[0]
            }
            <a
              href={`${baseUrl}premium`}
              className="font-semibold text-amber-600 hover:underline"
            >
              Premium
            </a>
            {
              t("calendar.premiumNote", {
                name: selectedSector.name,
              }).split("Premium")[1]
            }
          </span>
        </p>
      )}
    </div>
  );
}
