/**
 * ParallelStatusPanel — split-view loading indicator for parallel handoff.
 *
 * WHEN IT RENDERS
 * ───────────────
 * Only visible while `isStreaming === true` AND statusMessage contains
 * a domain-tagged prefix like "[career]" or "[mindset]".
 * As soon as the first token arrives (statusMessage = null), it disappears.
 *
 * VISUAL LAYOUT
 * ─────────────
 *  ┌─────────────────────────────────────────────┐
 *  │  ⚡ Due specialisti al lavoro in parallelo   │  ← header
 *  ├───────────────────┬─────────────────────────┤
 *  │  📼 career        │  🧠 mindset              │  ← split columns
 *  │  ─────────────    │  ─────────────           │
 *  │  🔍 Cerco KB...   │  🧠 Analizzando...       │  ← last status per domain
 *  │  [████░░░░░░░░]   │  [██████░░░░░░]          │  ← animated progress bar
 *  ├───────────────────┴─────────────────────────┤
 *  │  🧩 Fusione prospettive in corso...          │  ← fusion status (if active)
 *  └─────────────────────────────────────────────┘
 *
 * PROPS
 * ─────
 * statusMessage  string | null   — latest status SSE value from useGrowthChat
 * statusHistory  string[]        — all status values received so far this turn
 *
 * The component derives domain-specific state by parsing the "[domain]" prefix
 * that parallel-handoff.ts injects into every parallel status event.
 *
 * USAGE (in GrowthChatPanel)
 * ──────────────────────────
 * <ParallelStatusPanel
 *   statusMessage={statusMessage}
 *   statusHistory={statusHistory}
 * />
 */
import React, { useMemo } from "react";

type Domain = "career" | "mindset" | "habits" | "trading" | "general";

const DOMAIN_META: Record<Domain, { icon: string; label: string; color: string; bg: string; border: string }> = {
  career:  { icon: "💼", label: "Career",  color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200" },
  mindset: { icon: "🧠", label: "Mindset", color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200" },
  habits:  { icon: "🌱", label: "Habits",  color: "text-green-700",  bg: "bg-green-50",  border: "border-green-200" },
  trading: { icon: "📈", label: "Trading", color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200" },
  general: { icon: "✨", label: "Coach",   color: "text-indigo-700", bg: "bg-indigo-50", border: "border-indigo-200" },
};

interface DomainState {
  domain: Domain;
  lastStatus: string;  // stripped of the [domain] prefix
  stepCount: number;   // how many status events received for this domain
  done: boolean;       // true if a later non-domain status (fusion) appeared
}

function parseDomainPrefix(value: string): { domain: Domain | null; text: string } {
  const match = value.match(/^\[([a-z]+)\]\s*(.+)$/);
  if (!match) return { domain: null, text: value };
  return { domain: match[1] as Domain, text: match[2] };
}

function isFusionStatus(value: string): boolean {
  return value.includes("Fusione") || value.includes("fusione") || value.includes("🧩");
}

function isParallelStatus(value: string): boolean {
  return /^\[[a-z]+\]/.test(value) || value.includes("parallelo") || value.includes("⚡");
}

interface ParallelStatusPanelProps {
  statusMessage: string | null;
  statusHistory: string[];
  className?: string;
}

export function ParallelStatusPanel({
  statusMessage,
  statusHistory,
  className = "",
}: ParallelStatusPanelProps) {
  // Derive domain states from full history
  const domainStates = useMemo<DomainState[]>(() => {
    const stateMap = new Map<Domain, DomainState>();
    let fusionSeen = false;

    for (const val of statusHistory) {
      if (isFusionStatus(val)) {
        fusionSeen = true;
        // Mark all domains as done
        for (const [, ds] of stateMap) ds.done = true;
        continue;
      }

      const { domain, text } = parseDomainPrefix(val);
      if (!domain) continue;

      const existing = stateMap.get(domain);
      if (existing) {
        existing.lastStatus = text;
        existing.stepCount += 1;
        existing.done = fusionSeen;
      } else {
        stateMap.set(domain, {
          domain,
          lastStatus: text,
          stepCount: 1,
          done: fusionSeen,
        });
      }
    }

    return Array.from(stateMap.values());
  }, [statusHistory]);

  const fusionActive = statusMessage ? isFusionStatus(statusMessage) : false;
  const isParallel   = statusHistory.some(isParallelStatus);

  // Don't render at all if there's no parallel activity in history
  if (!isParallel || domainStates.length === 0) return null;

  const MAX_STEPS = 5; // typical steps per specialist

  return (
    <div className={`mx-2 mb-3 rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-sm ${className}`}>
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-gray-100">
        <span className="text-sm">⚡</span>
        <p className="text-xs font-semibold text-indigo-700">
          {domainStates.length} specialisti al lavoro in parallelo
        </p>
        <div className="ml-auto flex gap-1">
          {domainStates.map((ds) => (
            <span
              key={ds.domain}
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                DOMAIN_META[ds.domain]?.bg ?? "bg-gray-50"
              } ${
                DOMAIN_META[ds.domain]?.color ?? "text-gray-600"
              } ${
                DOMAIN_META[ds.domain]?.border ?? "border-gray-200"
              } border`}
            >
              {DOMAIN_META[ds.domain]?.icon} {DOMAIN_META[ds.domain]?.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Split columns ───────────────────────────────────────── */}
      <div
        className="grid divide-x divide-gray-100"
        style={{ gridTemplateColumns: `repeat(${domainStates.length}, 1fr)` }}
      >
        {domainStates.map((ds) => {
          const meta     = DOMAIN_META[ds.domain] ?? DOMAIN_META.general;
          const progress = Math.min(ds.stepCount / MAX_STEPS, 1);

          return (
            <div key={ds.domain} className="px-4 py-3">
              {/* Domain label */}
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-base">{meta.icon}</span>
                <span className={`text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                {ds.done && <span className="ml-auto text-xs text-green-500">✓</span>}
              </div>

              {/* Last status text */}
              <p className="text-xs text-gray-500 mb-2.5 leading-relaxed min-h-[2rem]">
                {ds.done ? (
                  <span className="text-green-600">Completato</span>
                ) : (
                  <span className="animate-pulse">{ds.lastStatus}</span>
                )}
              </p>

              {/* Progress bar */}
              <div className="w-full h-1 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    ds.done
                      ? "bg-green-400"
                      : `${
                          meta.bg.replace("bg-", "bg-") /* keep domain color */
                        } ${meta.color.replace("text-", "bg-")}`
                  }`}
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Fusion status ───────────────────────────────────────── */}
      {fusionActive && (
        <div className="px-4 py-2.5 border-t border-gray-100 bg-gradient-to-r from-indigo-50/60 to-purple-50/60 flex items-center gap-2">
          <span className="text-sm animate-spin" style={{ animationDuration: "2s" }}>🧩</span>
          <p className="text-xs text-indigo-600 animate-pulse">
            {statusMessage}
          </p>
        </div>
      )}
    </div>
  );
}
