/**
 * DiscoveryItemCard — card singola del feed Discovery.
 *
 * LAYOUT:
 *   [cover image opzionale]
 *   [badge tipo]  [badge difficoltà]  [relevance score]
 *   [titolo]
 *   [insight GPT — espandibile tap/click]
 *   [sommario — visibile se insight è collassato]
 *   [journey type chips]
 *   [skill tags]
 *   [footer: fonte | data | bookmark | open]
 *
 * STATI SPECIALI:
 *   - item.isEnriched = false  → shimmer "⏳ Analisi GPT in corso"
 *   - relevanceScore < 0.4     → nessun insight bar (bassa rilevanza)
 *   - isSeen = true            → opacity ridotta
 *
 * INTERAZIONI:
 *   - Click titolo / pulsante apri → markSeen + window.open
 *   - Click 💡 insight pill        → espande/collassa insight completo
 *   - Click bookmark               → toggleSaved
 */
import React, { useState } from "react";
import type { DiscoveryItem } from "./useDiscoveryFeed";

interface Props {
  item:    DiscoveryItem;
  isSaved: boolean;
  isSeen:  boolean;
  onSave:  (id: number) => void;
  onSeen:  (id: number) => void;
}

// ── Labels ────────────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; bg: string; text: string }> = {
  news:         { label: "📰 Notizia",       bg: "bg-blue-50",   text: "text-blue-700" },
  opportunity:  { label: "🚀 Opportunità",   bg: "bg-green-50",  text: "text-green-700" },
  formation:    { label: "🎓 Formazione",    bg: "bg-purple-50", text: "text-purple-700" },
  growth:       { label: "🌱 Crescita",      bg: "bg-amber-50",  text: "text-amber-700" },
  sector_trend: { label: "📈 Trend settore", bg: "bg-rose-50",   text: "text-rose-700" },
};

const DIFFICULTY_META: Record<string, { label: string; dot: string }> = {
  easy:     { label: "Base",        dot: "bg-green-400" },
  medium:   { label: "Intermedio",  dot: "bg-amber-400" },
  advanced: { label: "Avanzato",    dot: "bg-red-400" },
};

const JOURNEY_LABELS: Record<string, string> = {
  developer:      "👨‍💻 Dev",
  designer:       "🎨 Design",
  marketer:       "📣 Marketing",
  career_changer: "🔄 Career switch",
  entrepreneur:   "🚀 Imprenditore",
  student:        "🎓 Studente",
  general:        "🌐 Generale",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  try {
    return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short" }).format(new Date(dateStr));
  } catch { return ""; }
}

/** Barra colorata 0-1 → verde se alto, giallo se medio, grigio se basso */
function RelevanceBar({ score }: { score: number }) {
  if (score <= 0) return null;
  const pct   = Math.round(score * 100);
  const color = score >= 0.7 ? "bg-green-400" : score >= 0.45 ? "bg-amber-400" : "bg-gray-300";
  return (
    <div className="flex items-center gap-1.5" title={`Rilevanza GPT: ${pct}%`}>
      <div className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[9px] text-gray-400 tabular-nums w-6 text-right">{pct}%</span>
    </div>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

export const DiscoveryItemCard: React.FC<Props> = ({ item, isSaved, isSeen, onSave, onSeen }) => {
  const [insightOpen, setInsightOpen] = useState(false);

  const typeMeta   = TYPE_META[item.type] ?? { label: item.type, bg: "bg-gray-50", text: "text-gray-700" };
  const diffMeta   = item.difficulty ? DIFFICULTY_META[item.difficulty] : null;
  const dateLabel  = formatDate(item.publishedAt);
  const hasInsight = !!item.insightText && (item.relevanceScore ?? 0) >= 0.25;
  const isEnriched = (item as any).isEnriched !== false; // backward compat
  const journeys   = (item.journeyTypes ?? []).filter((j) => j !== "general");

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
            src={item.imageUrl} alt=""
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
        </div>
      )}

      <div className="flex flex-col flex-1 p-4 gap-2.5">

        {/* Badges row */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeMeta.bg} ${typeMeta.text}`}>
            {typeMeta.label}
          </span>
          {diffMeta && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${diffMeta.dot}`} />
              {diffMeta.label}
            </span>
          )}
          {/* Enrichment pending badge */}
          {!isEnriched && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
              <svg className="animate-spin w-2.5 h-2.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Analisi GPT...
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

        {/* ── INSIGHT GPT ─────────────────────────────────────────────────── */}
        {hasInsight ? (
          <div>
            {/* Pill trigger */}
            <button
              onClick={() => setInsightOpen((v) => !v)}
              className={`
                flex items-start gap-1.5 w-full text-left rounded-xl px-2.5 py-2
                transition-colors duration-150
                ${insightOpen
                  ? "bg-indigo-50 border border-indigo-100"
                  : "bg-indigo-50/60 hover:bg-indigo-50 border border-transparent"
                }
              `}
            >
              <span className="text-sm leading-none mt-0.5 flex-shrink-0">💡</span>
              <p className={`text-xs text-indigo-700 leading-relaxed transition-all ${
                insightOpen ? "" : "line-clamp-2"
              }`}>
                {item.insightText}
              </p>
              <span className="ml-auto flex-shrink-0 text-[9px] text-indigo-400 mt-0.5">
                {insightOpen ? "▲" : "▼"}
              </span>
            </button>

            {/* Relevance bar (mostra solo quando insight aperto) */}
            {insightOpen && (
              <div className="mt-1.5 px-2.5">
                <RelevanceBar score={item.relevanceScore ?? 0} />
              </div>
            )}
          </div>
        ) : (
          /* Sommario quando non c'è insight */
          item.summary && (
            <p className="text-xs text-gray-500 leading-relaxed line-clamp-3">
              {item.summary}
            </p>
          )
        )}

        {/* Sommario breve sotto insight (solo se collassato) */}
        {hasInsight && !insightOpen && item.summary && (
          <p className="text-xs text-gray-400 leading-relaxed line-clamp-1">
            {item.summary}
          </p>
        )}

        {/* Journey type chips (solo i più informativi, max 2) */}
        {journeys.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {journeys.slice(0, 2).map((j) => (
              <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                {JOURNEY_LABELS[j] ?? j}
              </span>
            ))}
            {journeys.length > 2 && (
              <span className="text-[10px] text-gray-400">+{journeys.length - 2}</span>
            )}
          </div>
        )}

        {/* Skill tags */}
        {item.skillTags && item.skillTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.skillTags.slice(0, 4).map((tag) => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-medium">
                {tag}
              </span>
            ))}
            {item.skillTags.length > 4 && (
              <span className="text-[10px] text-indigo-300">+{item.skillTags.length - 4}</span>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 font-medium truncate max-w-[120px]">{item.source}</span>
            {dateLabel && <span className="text-[10px] text-gray-300">{dateLabel}</span>}
          </div>

          <div className="flex gap-1.5">
            <button
              onClick={(e) => { e.stopPropagation(); onSave(item.id); }}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              title={isSaved ? "Rimuovi dai salvati" : "Salva"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                className={`w-4 h-4 transition-colors ${
                  isSaved ? "fill-indigo-500 stroke-indigo-500" : "fill-none stroke-gray-400 hover:stroke-indigo-400"
                }`} strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
              </svg>
            </button>

            <button onClick={handleOpen} className="p-1.5 rounded-lg hover:bg-indigo-50 transition-colors" title="Apri link">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
                className="w-4 h-4 stroke-gray-400 hover:stroke-indigo-500" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </button>
          </div>
        </div>

      </div>
    </article>
  );
};
