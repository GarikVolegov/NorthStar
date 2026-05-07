/**
 * GrowthChatMessage v3 — aggiunge DomainBadge e SupervisorBadge.
 *
 * BADGE AGGIUNTI (v3)
 * ──────────────────
 *  DomainBadge      — mostra l'agente specialista che ha risposto
 *                     (career 💼 / habits 🌱 / mindset 🧠 / general ✨)
 *
 *  SupervisorBadge  — mostra l'esito del SupervisorAgent:
 *                     ✅ Qualità verificata  (pass, non riscritto)
 *                     ✏️ Risposta migliorata (pass, riscritto)
 *                     ⚠️ Bassa qualità      (fail)
 *                     Tooltip con score e motivazioni del fail.
 *
 * BADGE ESISTENTE (v2)
 * ───────────────────
 *  ConfidenceBadge  — invariato: mostra livello di confidenza RAG
 *
 * RENDERING
 * ─────────
 *  I badge appaiono SOLO dopo che lo streaming è completato,
 *  disposti in una badge-row orizzontale sotto la bubble.
 */
import React, { useState } from "react";
import type { ChatMessage, ConfidenceLevel, Domain, SupervisorInfo } from "./useGrowthChat";

// ── DomainBadge ───────────────────────────────────────────────────────────────

const DOMAIN_CONFIG: Record<Domain, { icon: string; label: string; color: string }> = {
  career:  { icon: "💼", label: "Career",  color: "bg-blue-50 border-blue-200 text-blue-700" },
  habits:  { icon: "🌱", label: "Habits",  color: "bg-green-50 border-green-200 text-green-700" },
  mindset: { icon: "🧠", label: "Mindset", color: "bg-purple-50 border-purple-200 text-purple-700" },
  general: { icon: "✨",   label: "General", color: "bg-gray-50 border-gray-200 text-gray-600" },
};

function DomainBadge({ domain }: { domain: Domain }) {
  const cfg = DOMAIN_CONFIG[domain] ?? DOMAIN_CONFIG.general;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border font-medium ${cfg.color}`}
      title={`Agente specialista: ${cfg.label}`}
    >
      <span aria-hidden="true">{cfg.icon}</span>
      {cfg.label}
    </span>
  );
}

// ── SupervisorBadge ────────────────────────────────────────────────────────

function SupervisorBadge({ result }: { result: SupervisorInfo }) {
  const [showTooltip, setShowTooltip] = useState(false);

  const wasRewritten = result.rewritten;
  const isPass = result.pass;

  const label = wasRewritten
    ? "✏️ Risposta migliorata"
    : isPass
    ? "✅ Qualità verificata"
    : "⚠️ Bassa qualità";

  const colorClass = wasRewritten
    ? "bg-orange-50 border-orange-200 text-orange-700"
    : isPass
    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
    : "bg-red-50 border-red-200 text-red-700";

  return (
    <div className="relative">
      <button
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border cursor-help ${colorClass}`}
        aria-label={`Supervisor: ${label} (${Math.round(result.score * 100)}%)`}
      >
        {label}
        <span className="opacity-60">({Math.round(result.score * 100)}%)</span>
      </button>

      {showTooltip && (
        <div
          role="tooltip"
          className="absolute bottom-full left-0 mb-2 w-72 bg-gray-900 text-white text-xs rounded-xl px-3 py-2.5 shadow-lg z-10"
        >
          <p className="font-semibold mb-1">
            {wasRewritten
              ? "🔁 Il Supervisor ha riscritto questa risposta"
              : isPass
              ? "✅ Il Supervisor ha approvato questa risposta"
              : "❌ Il Supervisor ha rilevato problemi di qualità"}
          </p>
          <p className="text-gray-400 mb-1.5">
            Score: {Math.round(result.score * 100)}% · soglia 70%
          </p>
          {result.reasons.length > 0 ? (
            <ul className="list-disc list-inside text-gray-300 space-y-1">
              {result.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-400">Nessun problema rilevato.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── ConfidenceBadge (invariato da v2) ─────────────────────────────────────

function ConfidenceBadge({
  level,
  score,
}: {
  level: ConfidenceLevel;
  score: number;
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (level === "high") return null;

  const config = {
    medium: {
      icon: "🔶",
      label: "Risposta parziale",
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
    },
    low: {
      icon: "⚠️",
      label: "Contesto insufficiente",
      bg: "bg-red-50",
      border: "border-red-200",
      text: "text-red-700",
    },
  }[level];

  return (
    <div className="relative">
      <button
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onFocus={() => setShowTooltip(true)}
        onBlur={() => setShowTooltip(false)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${
          config.bg
        } ${config.border} ${config.text} cursor-help`}
        aria-label={`Livello di confidenza: ${level}`}
      >
        <span aria-hidden="true">{config.icon}</span>
        <span className="font-medium">{config.label}</span>
        <span className="opacity-60">({Math.round(score * 100)}%)</span>
      </button>

      {showTooltip && (
        <div
          role="tooltip"
          className="absolute bottom-full left-0 mb-2 w-72 bg-gray-900 text-white text-xs rounded-xl px-3 py-2.5 shadow-lg z-10"
        >
          <p className="font-semibold mb-1">
            Perché questa risposta è{" "}
            {level === "low" ? "incerta" : "parziale"}:
          </p>
          <ul className="space-y-1 list-disc list-inside text-gray-300">
            {level === "medium" && (
              <li>Contesto parziale — il coach ha risposto con assunzioni esplicite</li>
            )}
            {level === "low" && (
              <>
                <li>Documentazione insufficiente nella knowledge base</li>
                <li>La domanda potrebbe essere troppo vaga</li>
                <li>Condividi più dettagli per una risposta precisa</li>
              </>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── GrowthChatMessage — componente principale ────────────────────────────

interface Props {
  message: ChatMessage;
  isLastAssistant: boolean;
}

export function GrowthChatMessage({ message, isLastAssistant }: Props) {
  const isUser = message.role === "user";
  const isStreaming = message.isStreaming && isLastAssistant;

  return (
    <div
      role="article"
      aria-label={`Messaggio di ${isUser ? "utente" : "coach"}`}
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"} mb-4`}
    >
      {/* Avatar coach */}
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center mr-3 mt-1">
          <span className="text-white text-xs font-bold">N</span>
        </div>
      )}

      <div className={`flex flex-col max-w-[75%] ${isUser ? "items-end" : "items-start"}`}>
        {/* Bubble */}
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
            isUser
              ? "bg-indigo-600 text-white rounded-br-sm"
              : "bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm"
          }`}
        >
          {message.content || (isStreaming ? "" : "…")}
          {isStreaming && (
            <span className="inline-block w-0.5 h-4 bg-indigo-500 ml-0.5 align-middle animate-pulse" />
          )}
        </div>

        {/* Badge row — solo dopo che lo stream è completato */}
        {!isUser && !isStreaming && (
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            {/* 1. DomainBadge — agente specialista */}
            {message.domain && <DomainBadge domain={message.domain} />}

            {/* 2. SupervisorBadge — esito quality gate */}
            {message.supervisorResult && (
              <SupervisorBadge result={message.supervisorResult} />
            )}

            {/* 3. ConfidenceBadge — livello confidenza RAG (invariato) */}
            {message.evalLevel && message.evalScore !== undefined && (
              <ConfidenceBadge level={message.evalLevel} score={message.evalScore} />
            )}
          </div>
        )}

        {/* Source pills */}
        {!isUser && !isStreaming && message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {message.sources.slice(0, 4).map((s, i) => (
              <span
                key={i}
                title={s.source}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500 border border-gray-200"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mr-1" />
                {s.source.length > 24 ? s.source.slice(0, 24) + "…" : s.source}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Avatar utente */}
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center ml-3 mt-1">
          <span className="text-gray-600 text-xs font-bold">Tu</span>
        </div>
      )}
    </div>
  );
}
