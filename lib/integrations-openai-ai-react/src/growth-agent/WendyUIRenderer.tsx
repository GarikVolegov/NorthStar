/**
 * WendyUIRenderer — Generative UI component registry.
 *
 * Maps ui_tool names to React components. Rendered inside GrowthChatMessage
 * when message.uiTool is set instead of message.content.
 *
 * Components:
 *   RoadmapView       — vertical step timeline with optional duration badges
 *   CareerMatchCard   — scored match card with pros/cons and CTA
 *   QuizBlock         — interactive MCQ quiz with instant feedback
 *   ResourceList      — grid of course/article cards with type icons
 *   ActionPlanView    — weekly task table grouped by day
 */
import React, { useState } from "react";
import type {
  UiToolName,
  UiToolArgs,
  RoadmapArgs,
  CareerMatchArgs,
  QuizArgs,
  ResourceListArgs,
  ActionPlanArgs,
} from "@workspace/integrations-openai-ai-server/src/growth-agent/ui-tools";

// ── Helpers ──────────────────────────────────────────────────────────────────

const CONTENT_TYPE_ICON: Record<string, string> = {
  course:      "🎓",
  article:     "📄",
  career_card: "💼",
  resource:    "🔗",
};

// ── RoadmapView ───────────────────────────────────────────────────────────────

function RoadmapView({ title, steps }: RoadmapArgs) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h3 className="font-semibold text-base text-foreground">{title}</h3>
      <ol className="relative border-l border-primary/30 space-y-4 pl-4">
        {steps.map((step, i) => (
          <li key={i} className="relative">
            <span className="absolute -left-[1.35rem] top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">
              {i + 1}
            </span>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-sm text-foreground">{step.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                {step.resources && step.resources.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {step.resources.map((r, j) => (
                      <li key={j} className="text-xs text-primary">→ {r}</li>
                    ))}
                  </ul>
                )}
              </div>
              {step.durationWeeks != null && (
                <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {step.durationWeeks}w
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── CareerMatchCard ───────────────────────────────────────────────────────────

function CareerMatchCard({ careerName, matchScore, riasecTypes, pros, cons, nextStep }: CareerMatchArgs) {
  const color = matchScore >= 75 ? "text-green-600" : matchScore >= 50 ? "text-yellow-600" : "text-red-500";
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-base">{careerName}</h3>
        <span className={`text-2xl font-bold ${color}`}>{matchScore}%</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {riasecTypes.map((t) => (
          <span key={t} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{t}</span>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="font-medium text-green-700 mb-1">✓ Pro</p>
          <ul className="space-y-0.5">{pros.map((p, i) => <li key={i}>• {p}</li>)}</ul>
        </div>
        <div>
          <p className="font-medium text-red-600 mb-1">✗ Contro</p>
          <ul className="space-y-0.5">{cons.map((c, i) => <li key={i}>• {c}</li>)}</ul>
        </div>
      </div>
      <div className="rounded-lg bg-primary/5 px-3 py-2 text-xs">
        <span className="font-medium">Prossimo passo: </span>{nextStep}
      </div>
    </div>
  );
}

// ── QuizBlock ─────────────────────────────────────────────────────────────────

function QuizBlock({ topic, questions }: QuizArgs) {
  const [answers, setAnswers]   = useState<Record<number, number>>({});
  const [submitted, setSubmit]  = useState(false);

  const score = submitted
    ? questions.filter((q, i) => answers[i] === q.correct).length
    : null;

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-4">
      <h3 className="font-semibold text-base">Quiz: {topic}</h3>
      {questions.map((q, qi) => (
        <div key={qi} className="space-y-1.5">
          <p className="text-sm font-medium">{qi + 1}. {q.text}</p>
          <div className="space-y-1">
            {q.options.map((opt, oi) => {
              const selected = answers[qi] === oi;
              const correct  = submitted && oi === q.correct;
              const wrong    = submitted && selected && oi !== q.correct;
              return (
                <button
                  key={oi}
                  disabled={submitted}
                  onClick={() => !submitted && setAnswers((a) => ({ ...a, [qi]: oi }))}
                  className={[
                    "w-full text-left rounded-lg border px-3 py-1.5 text-xs transition-colors",
                    correct  ? "border-green-500 bg-green-50 text-green-800" :
                    wrong    ? "border-red-400 bg-red-50 text-red-700" :
                    selected ? "border-primary bg-primary/10" :
                    "border-border hover:bg-muted",
                  ].join(" ")}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {!submitted ? (
        <button
          onClick={() => setSubmit(true)}
          disabled={Object.keys(answers).length < questions.length}
          className="w-full rounded-lg bg-primary py-2 text-xs font-medium text-primary-foreground disabled:opacity-40"
        >
          Invia risposte
        </button>
      ) : (
        <p className="text-center text-sm font-semibold">
          Risultato: {score}/{questions.length} 🎉
        </p>
      )}
    </div>
  );
}

// ── ResourceList ──────────────────────────────────────────────────────────────

function ResourceList({ heading, resources }: ResourceListArgs) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h3 className="font-semibold text-base">{heading}</h3>
      <ul className="space-y-2">
        {resources.map((r, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <span className="shrink-0 text-base">{CONTENT_TYPE_ICON[r.type] ?? "🔗"}</span>
            <div>
              <a
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary hover:underline"
              >
                {r.title}
              </a>
              <p className="text-xs text-muted-foreground">{r.description}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── ActionPlanView ────────────────────────────────────────────────────────────

function ActionPlanView({ weekLabel, tasks }: ActionPlanArgs) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <h3 className="font-semibold text-base">📅 {weekLabel}</h3>
      <ul className="space-y-2">
        {tasks.map((t, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="min-w-[3rem] text-xs font-medium text-muted-foreground pt-0.5">{t.day}</span>
            <div className="flex-1">
              <p className="text-sm font-medium">{t.task}</p>
              <p className="text-xs text-muted-foreground">{t.why} · {t.durationMin} min</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Registry ──────────────────────────────────────────────────────────────────

export function WendyUIRenderer({
  name,
  args,
}: {
  name: UiToolName;
  args: UiToolArgs;
}) {
  switch (name) {
    case "render_roadmap":
      return <RoadmapView {...(args as RoadmapArgs)} />;
    case "render_career_match":
      return <CareerMatchCard {...(args as CareerMatchArgs)} />;
    case "render_quiz":
      return <QuizBlock {...(args as QuizArgs)} />;
    case "render_resource_list":
      return <ResourceList {...(args as ResourceListArgs)} />;
    case "render_action_plan":
      return <ActionPlanView {...(args as ActionPlanArgs)} />;
    default:
      return (
        <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
          [UI tool non riconosciuto: {name}]
        </div>
      );
  }
}
