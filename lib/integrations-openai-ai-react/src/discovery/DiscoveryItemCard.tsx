/**
 * DiscoveryItemCard — card singola del feed Discovery.
 *
 * LAYOUT:
 *   [immagine opzionale]
 *   [badge tipo] [badge difficoltà]
 *   [titolo]
 *   [insight GPT in corsivo]
 *   [sommario]
 *   [skill tags]
 *   [footer: fonte | data | bookmark | open link]
 *
 * INTERAZIONI:
 *   - Click sul titolo/card → apre il link (markSeen)
 *   - Click bookmark → toggleSaved
 *   - Item già visto → opacity ridotta
 */
import React from "react";
import type { DiscoveryItem } from "./useDiscoveryFeed";

interface Props {
  item:        DiscoveryItem;
  isSaved:     boolean;
  isSeen:      boolean;
  onSave:      (id: number) => void;
  onSeen:      (id: number) => void;
}

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  news:         { label: "📰 Notizia",       color: "bg-blue-100 text-blue-800" },
  opportunity:  { label: "🚀 Opportunità",   color: "bg-green-100 text-green-800" },
  formation:    { label: "🎓 Formazione",    color: "bg-purple-100 text-purple-800" },
  growth:       { label: "🌱 Crescita",      color: "bg-amber-100 text-amber-800" },
  sector_trend: { label: "📈 Trend settore", color: "bg-rose-100 text-rose-800" },
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy:     "🟢 Base",
  medium:   "🟡 Intermedio",
  advanced: "🔴 Avanzato",
};

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(new Date(dateStr));
  } catch { return ""; }
}

export const DiscoveryItemCard: React.FC<Props> = ({ item, isSaved, isSeen, onSave, onSeen }) => {
  const typeInfo  = TYPE_LABELS[item.type] ?? { label: item.type, color: "bg-gray-100 text-gray-700" };
  const dateLabel = formatDate(item.publishedAt);

  const handleOpen = () => {
    onSeen(item.id);
    window.open(item.url, "_blank", "noopener,noreferrer");
  };

  return (
    <article
      className={`
        group relative flex flex-col rounded-2xl border bg-white shadow-sm
        hover:shadow-md transition-all duration-200 overflow-hidden
        ${isSeen ? "opacity-60" : "opacity-100"}
      `}
    >
      {/* Cover image */}
      {item.imageUrl && (
        <div className="h-36 w-full overflow-hidden bg-gray-100">
          <img
            src={item.imageUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}

      <div className="flex flex-col flex-1 p-4 gap-2">
        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeInfo.color}`}>
            {typeInfo.label}
          </span>
          {item.difficulty && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {DIFFICULTY_LABELS[item.difficulty]}
            </span>
          )}
        </div>

        {/* Title */}
        <button
          onClick={handleOpen}
          className="text-left text-sm font-semibold text-gray-900 hover:text-indigo-600 transition-colors line-clamp-2 leading-snug"
        >
          {item.title}
        </button>

        {/* GPT Insight */}
        {item.insightText && (
          <p className="text-xs text-indigo-700 italic leading-relaxed line-clamp-2">
            💡 {item.insightText}
          </p>
        )}

        {/* Summary */}
        {item.summary && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
            {item.summary}
          </p>
        )}

        {/* Skill tags */}
        {item.skillTags && item.skillTags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {item.skillTags.slice(0, 4).map((tag) => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 font-medium truncate max-w-[120px]">{item.source}</span>
            {dateLabel && <span className="text-[10px] text-gray-300">{dateLabel}</span>}
          </div>

          <div className="flex gap-1.5">
            {/* Bookmark */}
            <button
              onClick={(e) => { e.stopPropagation(); onSave(item.id); }}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title={isSaved ? "Rimuovi dai salvati" : "Salva"}
              aria-label={isSaved ? "Rimuovi" : "Salva"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                className={`w-4 h-4 transition-colors ${isSaved ? "fill-indigo-500 stroke-indigo-500" : "fill-none stroke-gray-400 hover:stroke-indigo-400"}`}
                strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
              </svg>
            </button>

            {/* Open link */}
            <button
              onClick={handleOpen}
              className="p-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
              title="Apri link"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                className="w-4 h-4 stroke-gray-400 hover:stroke-indigo-500"
                strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};
