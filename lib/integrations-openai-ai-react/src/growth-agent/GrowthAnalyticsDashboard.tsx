/**
 * GrowthAnalyticsDashboard — session analytics visualization.
 *
 * LAYOUT
 * ──────
 *  1. KPI row     — 4 cards: sessioni | messaggi | confidence media | streak
 *  2. Confidence trend  — SVG polyline over last 14 days
 *  3. Top topics  — SVG horizontal bar chart
 *  4. Level breakdown — SVG mini donut (high / medium / low)
 *
 * DESIGN PRINCIPLES
 * ─────────────────
 *  · Zero chart library dependencies — pure SVG inline
 *  · Tailwind for layout and typography
 *  · Skeleton loaders while fetching
 *  · Empty state when no sessions yet
 *
 * USAGE
 * ──────
 *  <GrowthAnalyticsDashboard token={jwt} />
 */
import React from "react";
import { useGrowthAnalytics, type TrendEntry, type TopicEntry, type LevelBreakdown } from "./useGrowthAnalytics";

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon,
  loading,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  loading: boolean;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 flex items-start gap-3">
      <span className="text-2xl mt-0.5">{icon}</span>
      <div className="flex-1">
        <p className="text-xs text-gray-400 uppercase tracking-wide">{label}</p>
        {loading ? (
          <div className="h-6 w-16 bg-gray-100 rounded animate-pulse mt-1" />
        ) : (
          <p className="text-2xl font-bold text-gray-800 leading-tight">{value}</p>
        )}
        {sub && !loading && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Confidence Trend (SVG polyline) ───────────────────────────────────────

const CHART_W = 480;
const CHART_H = 100;
const CHART_PAD = { top: 12, right: 16, bottom: 20, left: 32 };

function ConfidenceTrendChart({ data }: { data: TrendEntry[] }) {
  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-24 text-sm text-gray-400">
        Dati insufficienti — servono almeno 2 giorni di sessioni
      </div>
    );
  }

  const innerW = CHART_W - CHART_PAD.left - CHART_PAD.right;
  const innerH = CHART_H - CHART_PAD.top - CHART_PAD.bottom;

  const xScale = (i: number) => CHART_PAD.left + (i / (data.length - 1)) * innerW;
  const yScale = (v: number) => CHART_PAD.top + (1 - v) * innerH;

  const points = data.map((d, i) => `${xScale(i)},${yScale(d.avg)}`).join(" ");
  // Area fill path
  const areaPath = [
    `M ${xScale(0)},${yScale(data[0].avg)}`,
    ...data.map((d, i) => `L ${xScale(i)},${yScale(d.avg)}`),
    `L ${xScale(data.length - 1)},${CHART_PAD.top + innerH}`,
    `L ${xScale(0)},${CHART_PAD.top + innerH}`,
    "Z",
  ].join(" ");

  // Y axis labels
  const yLabels = [0.25, 0.50, 0.75, 1.00];

  return (
    <svg
      viewBox={`0 0 ${CHART_W} ${CHART_H}`}
      className="w-full h-auto"
      aria-label="Trend confidence ultimi 14 giorni"
    >
      <defs>
        <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"  stopColor="#6366f1" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Y grid lines + labels */}
      {yLabels.map((v) => (
        <g key={v}>
          <line
            x1={CHART_PAD.left} y1={yScale(v)}
            x2={CHART_W - CHART_PAD.right} y2={yScale(v)}
            stroke="#f0f0f0" strokeWidth="1"
          />
          <text
            x={CHART_PAD.left - 4} y={yScale(v)}
            textAnchor="end" dominantBaseline="middle"
            fontSize="9" fill="#aaa"
          >
            {Math.round(v * 100)}%
          </text>
        </g>
      ))}

      {/* Area fill */}
      <path d={areaPath} fill="url(#confGrad)" />

      {/* Line */}
      <polyline
        points={points}
        fill="none"
        stroke="#6366f1"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Dots + date labels */}
      {data.map((d, i) => {
        const x = xScale(i);
        const y = yScale(d.avg);
        const dateLabel = d.date.slice(5); // 'MM-DD'
        return (
          <g key={i}>
            <circle cx={x} cy={y} r="3" fill="#6366f1" />
            {/* Show label only for first, last, and every ~3rd point */}
            {(i === 0 || i === data.length - 1 || i % 3 === 0) && (
              <text
                x={x} y={CHART_H - 4}
                textAnchor="middle"
                fontSize="8" fill="#bbb"
              >
                {dateLabel}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Top Topics (horizontal bars) ─────────────────────────────────────────

function TopTopicsChart({ topics }: { topics: TopicEntry[] }) {
  if (topics.length === 0) {
    return <p className="text-sm text-gray-400">Nessun tema ancora registrato</p>;
  }
  const max = Math.max(...topics.map((t) => t.count), 1);

  return (
    <div className="space-y-2.5">
      {topics.map((t, i) => (
        <div key={i} className="flex items-center gap-3">
          {/* Topic label */}
          <span className="text-xs text-gray-600 w-36 truncate flex-shrink-0" title={t.topic}>
            {t.topic}
          </span>
          {/* Bar */}
          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-indigo-400 transition-all"
              style={{ width: `${(t.count / max) * 100}%` }}
            />
          </div>
          {/* Count */}
          <span className="text-xs text-gray-400 w-6 text-right flex-shrink-0">{t.count}x</span>
        </div>
      ))}
    </div>
  );
}

// ── Level Breakdown (mini donut) ───────────────────────────────────────────

function DonutChart({ breakdown }: { breakdown: LevelBreakdown }) {
  const total = breakdown.high + breakdown.medium + breakdown.low;
  if (total === 0) return <p className="text-sm text-gray-400 text-center">Nessun dato</p>;

  const R = 36;
  const cx = 48;
  const cy = 48;
  const circumference = 2 * Math.PI * R;

  // Segments: high=green, medium=amber, low=red
  const segments = [
    { value: breakdown.high,   color: "#10b981", label: "Alta" },
    { value: breakdown.medium, color: "#f59e0b", label: "Media" },
    { value: breakdown.low,    color: "#ef4444", label: "Bassa" },
  ];

  let offset = 0;
  const arcs = segments.map((s) => {
    const pct = s.value / total;
    const dash = pct * circumference;
    const arc = { ...s, dash, offset };
    offset += dash;
    return arc;
  });

  return (
    <div className="flex items-center gap-6">
      {/* Donut */}
      <svg width="96" height="96" viewBox="0 0 96 96">
        {/* Track */}
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#f3f4f6" strokeWidth="14" />
        {/* Segments */}
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={cx} cy={cy} r={R}
            fill="none"
            stroke={arc.color}
            strokeWidth="14"
            strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
            strokeDashoffset={-arc.offset}
            strokeLinecap="butt"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
        {/* Center label */}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="14" fontWeight="bold" fill="#374151">
          {total}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="8" fill="#9ca3af">
          messaggi
        </text>
      </svg>

      {/* Legend */}
      <div className="space-y-2">
        {arcs.map((arc, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ background: arc.color }}
            />
            <span className="text-xs text-gray-600">
              {arc.label} — <span className="font-medium">{arc.value}</span>
              <span className="text-gray-400 ml-1">({Math.round((arc.value / total) * 100)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────────

function ChartSkeleton({ h = "h-24" }: { h?: string }) {
  return <div className={`${h} bg-gray-100 rounded-xl animate-pulse`} />;
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────────

interface GrowthAnalyticsDashboardProps {
  token: string;
  apiBase?: string;
  className?: string;
}

export function GrowthAnalyticsDashboard({
  token,
  apiBase,
  className = "",
}: GrowthAnalyticsDashboardProps) {
  const { data, isLoading, error, refresh } = useGrowthAnalytics({ token, apiBase });

  const isEmpty =
    !isLoading && data && data.totalSessions === 0;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-800">Analytics sessioni</h2>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-500 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 transition-all"
        >
          <svg className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Aggiorna
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600">
          ⚠️ {error}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <span className="text-4xl mb-3">📊</span>
          <p className="text-sm font-medium text-gray-600">Nessuna sessione ancora</p>
          <p className="text-xs text-gray-400 mt-1 max-w-xs">
            Le analytics appaiono dopo la prima sessione col coach.
          </p>
        </div>
      )}

      {/* ── KPI Row ────────────────────────────────────────── */}
      {!isEmpty && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <KpiCard
            icon="💬"
            label="Sessioni"
            value={String(data?.totalSessions ?? 0)}
            sub="ultimi 30 giorni"
            loading={isLoading}
          />
          <KpiCard
            icon="✏️"
            label="Messaggi"
            value={String(data?.totalMessages ?? 0)}
            loading={isLoading}
          />
          <KpiCard
            icon="🎯"
            label="Confidence media"
            value={
              data?.avgConfidence != null
                ? `${Math.round(data.avgConfidence * 100)}%`
                : "—"
            }
            sub="last 30 sessioni"
            loading={isLoading}
          />
          <KpiCard
            icon="🔥"
            label="Streak"
            value={`${data?.streakDays ?? 0} gg`}
            sub="consecutivi"
            loading={isLoading}
          />
        </div>
      )}

      {/* ── Bottom 2 columns ────────────────────────────────────── */}
      {!isEmpty && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Confidence trend — 2/3 width */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Trend confidence — ultimi 14 giorni
            </h3>
            {isLoading ? (
              <ChartSkeleton h="h-24" />
            ) : (
              <ConfidenceTrendChart data={data?.confidenceTrend ?? []} />
            )}
          </div>

          {/* Level breakdown donut — 1/3 width */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-medium text-gray-700 mb-4">
              Distribuzione livelli
            </h3>
            {isLoading ? (
              <ChartSkeleton h="h-24" />
            ) : (
              <DonutChart breakdown={data?.levelBreakdown ?? { high: 0, medium: 0, low: 0 }} />
            )}
          </div>

          {/* Top topics — full width */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
            <h3 className="text-sm font-medium text-gray-700 mb-4">
              Temi più discussi (ultimi 30 giorni)
            </h3>
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-3 bg-gray-100 rounded animate-pulse" style={{ width: `${70 - i * 12}%` }} />
                ))}
              </div>
            ) : (
              <TopTopicsChart topics={data?.topTopics ?? []} />
            )}
          </div>

        </div>
      )}
    </div>
  );
}
