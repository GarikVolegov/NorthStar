import React, { memo } from 'react';

interface RoadmapStep {
  title: string;
  description: string;
  duration?: string;
}

interface MatchScore {
  role: string;
  score: number;
  pros: string[];
}

interface QuizQuestion {
  question: string;
  options: string[];
  correct: number;
}

interface ResourceItem {
  title: string;
  url?: string;
  type?: string;
}

interface ActionPlanTask {
  task: string;
  day?: string;
  done?: boolean;
}

type UiToolArgs =
  | { steps: RoadmapStep[]; title?: string }
  | { matches: MatchScore[]; title?: string }
  | { title: string; questions: QuizQuestion[] }
  | { items: ResourceItem[]; title?: string }
  | { tasks: ActionPlanTask[]; title?: string };

function renderRoadmap(args: UiToolArgs) {
  const data = args as { steps: RoadmapStep[]; title?: string };
  return (
    <div className="p-4">
      {data.title && <p className="mb-3 text-sm font-semibold text-white/80">{data.title}</p>}
      <div className="space-y-3">
        {data.steps.map((s, i) => (
          <div key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/20 text-xs font-bold text-violet-400">
                {i + 1}
              </div>
              {i < data.steps.length - 1 && <div className="mt-1 h-full w-px bg-white/10" />}
            </div>
            <div className="flex-1 pb-4">
              <div className="text-sm font-medium text-white/90">{s.title}</div>
              <div className="mt-0.5 text-xs text-white/50">{s.description}</div>
              {s.duration && <div className="mt-1 text-[11px] text-violet-400/60">{s.duration}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderCareerMatch(args: UiToolArgs) {
  const data = args as { matches: MatchScore[]; title?: string };
  return (
    <div className="p-4">
      {data.title && <p className="mb-3 text-sm font-semibold text-white/80">{data.title}</p>}
      <div className="space-y-3">
        {data.matches.map((m, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white/90">{m.role}</span>
              <span className="rounded-full bg-violet-500/20 px-2 py-0.5 text-xs font-medium text-violet-400">
                {m.score}%
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500"
                style={{ width: `${m.score}%` }}
              />
            </div>
            {m.pros.length > 0 && (
              <ul className="mt-2 space-y-0.5">
                {m.pros.map((p, j) => (
                  <li key={j} className="text-[11px] text-white/50">+ {p}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function renderActionPlan(args: UiToolArgs) {
  const data = args as { tasks: ActionPlanTask[]; title?: string };
  return (
    <div className="p-4">
      {data.title && <p className="mb-3 text-sm font-semibold text-white/80">{data.title}</p>}
      <div className="space-y-2">
        {data.tasks.map((t, i) => (
          <label key={i} className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-3 cursor-pointer hover:bg-white/[0.07] transition-colors">
            <input type="checkbox" defaultChecked={t.done} className="mt-0.5 h-4 w-4 rounded border-white/20 text-violet-500 focus:ring-violet-500" />
            <div className="flex-1 min-w-0">
              <span className={`text-sm ${t.done ? 'line-through text-white/30' : 'text-white/90'}`}>{t.task}</span>
              {t.day && <span className="ml-2 text-[11px] text-white/40">{t.day}</span>}
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

function renderQuiz(args: UiToolArgs) {
  const data = args as { title: string; questions: QuizQuestion[] };
  return (
    <div className="p-4">
      <p className="mb-3 text-sm font-semibold text-white/80">{data.title}</p>
      <div className="space-y-4">
        {data.questions.map((q, i) => (
          <div key={i} className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="mb-2 text-sm text-white/90">{i + 1}. {q.question}</p>
            <div className="space-y-1">
              {q.options.map((o, j) => (
                <label key={j} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name={`q-${i}`} className="h-3.5 w-3.5 border-white/20 text-violet-500" />
                  <span className="text-xs text-white/60">{o}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function renderResourceList(args: UiToolArgs) {
  const data = args as { items: ResourceItem[]; title?: string };
  return (
    <div className="p-4">
      {data.title && <p className="mb-3 text-sm font-semibold text-white/80">{data.title}</p>}
      <div className="space-y-2">
        {data.items.map((item, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/20 text-xs text-violet-400">
              {item.type === 'article' ? 'A' : item.type === 'course' ? 'C' : 'R'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white/90 truncate">{item.title}</div>
              {item.url && (
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-violet-400 hover:underline">
                  Apri
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const TOOL_RENDERERS: Record<string, (args: UiToolArgs) => React.ReactElement | null> = {
  render_roadmap: renderRoadmap,
  render_career_match: renderCareerMatch,
  render_action_plan: renderActionPlan,
  render_quiz: renderQuiz,
  render_resource_list: renderResourceList,
};

export const UiToolRenderer = memo(function UiToolRenderer({
  name,
  args,
}: {
  name: string;
  args: Record<string, unknown>;
}) {
  const renderer = TOOL_RENDERERS[name];
  if (!renderer) {
    return (
      <div className="p-3 text-xs text-white/40">
        [Tool UI non disponibile: <code>{name}</code>]
      </div>
    );
  }
  return renderer(args as UiToolArgs);
});
