/**
 * ProgressPanel — Passo 3: streak, XP, timeline attività.
 *
 * SEZIONI:
 *   1. Streak card  — fiamma CSS animata, giorni consecutivi voiceStreak
 *      + streakDays generico. Se streak = 0 mostra stato vuoto motivante.
 *   2. XP bar       — livello corrente (500 XP/livello), barra progresso,
 *      XP totali e XP al prossimo livello.
 *   3. Timeline     — ultime 10 attività miste (sessioni Wendy, test,
 *      obiettivi). Ogni item ha icona, label e timestamp relativo.
 *
 * Design:
 *   Nessuna libreria aggiuntiva. Fiamma = emoji + keyframe CSS inline.
 *   Barra XP = div con width% transition. Timeline = lista verticale
 *   con linea connettore SVG-free (border-left).
 *
 * Props:
 *   token     JWT
 *   apiBase   default '/api'
 *   className
 */
import React, { useEffect, useState } from "react";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ActivityItem {
  type:      "session" | "test" | "objective";
  label:     string;
  sublabel?: string;
  timestamp: string; // ISO
  xp?:       number;
}

export interface ProgressData {
  streakDays:    number;
  voiceStreak:   number;
  totalXp:       number;
  level:         number;   // floor(totalXp / XP_PER_LEVEL)
  xpInLevel:     number;   // totalXp % XP_PER_LEVEL
  xpToNextLevel: number;   // XP_PER_LEVEL - xpInLevel
  xpPerLevel:    number;   // 500
  activities:    ActivityItem[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (m < 2)  return "ora";
  if (m < 60) return `${m} min fa`;
  if (h < 24) return `${h}h fa`;
  if (d < 7)  return `${d}g fa`;
  if (d < 30) return `${Math.floor(d / 7)} sett. fa`;
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

const ACTIVITY_META: Record<ActivityItem["type"], { emoji: string; color: string }> = {
  session:   { emoji: "💬", color: "#6366f1" }, // indigo
  test:      { emoji: "🧠", color: "#8b5cf6" }, // violet
  objective: { emoji: "✅", color: "#22c55e" }, // green
};

// ── Fiamma CSS (keyframe inline via <style>) ─────────────────────────────────────

const FLAME_CSS = `
@keyframes ns-flame {
  0%,100% { transform: scaleY(1)   rotate(-2deg); }
  25%     { transform: scaleY(1.1) rotate(2deg);  }
  50%     { transform: scaleY(0.95) rotate(-1deg); }
  75%     { transform: scaleY(1.05) rotate(1deg);  }
}
@keyframes ns-flame-glow {
  0%,100% { opacity: 0.7; }
  50%     { opacity: 1; }
}
.ns-flame {
  display: inline-block;
  animation: ns-flame 1.6s ease-in-out infinite;
  transform-origin: bottom center;
  filter: drop-shadow(0 0 6px #fb923c);
}
.ns-flame-glow {
  animation: ns-flame-glow 1.6s ease-in-out infinite;
}
`;

function FlameIcon({ size = 48 }: { size?: number }) {
  return (
    <span className="ns-flame ns-flame-glow" style={{ fontSize: size, lineHeight: 1 }}>
      🔥
    </span>
  );
}

// ── StreakCard ─────────────────────────────────────────────────────────────────────

function StreakCard({ streakDays, voiceStreak }: { streakDays: number; voiceStreak: number }) {
  const activeStreak = Math.max(streakDays, voiceStreak);
  const isEmpty = activeStreak === 0;

  // Mini calendar: last 7 days dot indicators
  // We just show dots since we don't have per-day data client-side.
  // The server could send a `activeDays` array in the future.
  const dots = Array.from({ length: 7 }, (_, i) => {
    // Heuristic: if streak >= (7-i), that day was active
    const dayIndex = 7 - i; // 7 = today, 1 = 6 days ago
    return activeStreak >= dayIndex;
  }).reverse(); // index 0 = oldest

  return (
    <div className="rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-5">
      <div className="flex items-center justify-between">
        {/* Left: flame + number */}
        <div className="flex items-center gap-3">
          {isEmpty ? (
            <span className="text-4xl grayscale opacity-40">🔥</span>
          ) : (
            <FlameIcon size={44} />
          )}
          <div>
            <p className="text-3xl font-black tabular-nums leading-none text-orange-600">
              {activeStreak}
            </p>
            <p className="text-xs font-medium text-orange-500 mt-0.5">
              {activeStreak === 1 ? "giorno consecutivo" : "giorni consecutivi"}
            </p>
          </div>
        </div>

        {/* Right: 7-day dot calendar */}
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex gap-1">
            {dots.map((active, i) => (
              <div
                key={i}
                className={`h-2.5 w-2.5 rounded-full ${
                  active ? "bg-orange-400" : "bg-orange-100 border border-orange-200"
                }`}
              />
            ))}
          </div>
          <p className="text-[10px] text-orange-400">ultimi 7 giorni</p>
        </div>
      </div>

      {isEmpty ? (
        <p className="mt-3 text-xs text-orange-400">
          💪 Completa una sessione oggi per iniziare la tua streak!
        </p>
      ) : voiceStreak > 0 && streakDays > 0 ? (
        <div className="mt-3 flex gap-3 text-[11px] text-orange-500">
          <span>💬 Voce: <strong>{voiceStreak}g</strong></span>
          <span>•</span>
          <span>🎯 Generale: <strong>{streakDays}g</strong></span>
        </div>
      ) : null}
    </div>
  );
}

// ── XPBar ───────────────────────────────────────────────────────────────────────────

const LEVEL_NAMES: Record<number, string> = {
  0:  "Esploratore",
  1:  "Curioso",
  2:  "Apprendista",
  3:  "Praticante",
  4:  "Competente",
  5:  "Esperto",
  6:  "Specialista",
  7:  "Maestro",
  8:  "Campione",
  9:  "Leggenda",
  10: "Visionario",
};

function levelName(level: number): string {
  return LEVEL_NAMES[Math.min(level, 10)] ?? `Livello ${level}`;
}

function XPBar({ totalXp, level, xpInLevel, xpPerLevel, xpToNextLevel }: {
  totalXp: number; level: number; xpInLevel: number; xpPerLevel: number; xpToNextLevel: number;
}) {
  const pct = Math.round((xpInLevel / xpPerLevel) * 100);

  return (
    <div className="rounded-xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center">
            <span className="text-white text-xs font-black">{level}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-indigo-800">{levelName(level)}</p>
            <p className="text-[10px] text-indigo-400">Livello {level}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-black tabular-nums text-indigo-700">{totalXp.toLocaleString("it-IT")}</p>
          <p className="text-[10px] text-indigo-400">XP totali</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="h-3 rounded-full bg-indigo-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-1000"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-indigo-400">
          <span>{xpInLevel} XP nel livello</span>
          <span>{xpToNextLevel} XP al Lv.{level + 1}</span>
        </div>
      </div>

      {/* Next level preview */}
      {level < 10 && (
        <p className="mt-2 text-[11px] text-indigo-500">
          ⭐ Prossimo: <strong>{levelName(level + 1)}</strong>
        </p>
      )}
    </div>
  );
}

// ── ActivityTimeline ─────────────────────────────────────────────────────────────

function ActivityTimeline({ activities }: { activities: ActivityItem[] }) {
  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border py-8 text-center">
        <p className="text-2xl mb-2">🌱</p>
        <p className="text-sm font-medium">Nessuna attività ancora</p>
        <p className="text-xs text-muted-foreground mt-1">Le tue sessioni, test e obiettivi appariranno qui</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {activities.map((item, idx) => {
        const meta = ACTIVITY_META[item.type];
        const isLast = idx === activities.length - 1;
        return (
          <div key={idx} className="flex gap-3">
            {/* Timeline connector */}
            <div className="flex flex-col items-center flex-shrink-0" style={{ width: 28 }}>
              <div
                className="h-7 w-7 rounded-full flex items-center justify-center text-sm flex-shrink-0"
                style={{ background: `${meta.color}18`, border: `2px solid ${meta.color}40` }}
              >
                {meta.emoji}
              </div>
              {!isLast && (
                <div className="w-px flex-1 my-0.5" style={{ background: `${meta.color}20`, minHeight: 16 }} />
              )}
            </div>

            {/* Content */}
            <div className={`pb-3 flex-1 min-w-0 ${isLast ? "" : ""}` }>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight truncate">{item.label}</p>
                  {item.sublabel && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">{item.sublabel}</p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-[10px] text-muted-foreground whitespace-nowrap">{relativeTime(item.timestamp)}</p>
                  {item.xp != null && item.xp > 0 && (
                    <p className="text-[10px] font-semibold text-indigo-500 mt-0.5">+{item.xp} XP</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main: ProgressPanel ───────────────────────────────────────────────────────────

export interface ProgressPanelProps {
  token:      string;
  apiBase?:   string;
  className?: string;
}

export function ProgressPanel({ token, apiBase = "/api", className = "" }: ProgressPanelProps) {
  const [data,    setData]    = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${apiBase}/users/me/progress`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(await res.text());
        setData(await res.json() as ProgressData);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Errore");
      } finally { setLoading(false); }
    })();
  }, [token, apiBase]);

  if (loading) return (
    <div className="flex h-48 items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );

  if (error) return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
  );

  if (!data) return null;

  return (
    <>
      {/* Inject flame keyframes once */}
      <style dangerouslySetInnerHTML={{ __html: FLAME_CSS }} />

      <div className={`space-y-4 ${className}`}>

        {/* Row: Streak + XP side by side on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <StreakCard streakDays={data.streakDays} voiceStreak={data.voiceStreak} />
          <XPBar
            totalXp={data.totalXp}
            level={data.level}
            xpInLevel={data.xpInLevel}
            xpPerLevel={data.xpPerLevel}
            xpToNextLevel={data.xpToNextLevel}
          />
        </div>

        {/* Activity timeline */}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
            Attività recente
          </p>
          <ActivityTimeline activities={data.activities} />
        </div>

      </div>
    </>
  );
}
