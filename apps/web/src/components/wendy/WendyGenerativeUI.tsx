/**
 * WendyGenerativeUI — Componenti React generati dinamicamente da Wendy
 *
 * Come funziona:
 *   1. Il backend (wendy-chat route) riceve un messaggio speciale:
 *      "mostrami un grafico delle mie competenze" o "crea una checklist"
 *   2. Il LLM risponde con un tool_call: { name: 'render_ui', input: { component, props } }
 *   3. Il frontend riceve il messaggio SSE con type='ui_component'
 *   4. WendyGenerativeUI.render(component, props) monta il componente corretto
 *
 * Componenti disponibili:
 *   - RiasecRadarChart  — grafico radar RIASEC (Recharts)
 *   - SkillsBarChart    — bar chart competenze
 *   - CareerRoadmap     — timeline step-by-step
 *   - InterviewChecklist — checklist domande colloquio
 *   - SalaryRange       — range stipendi con percentili
 *
 * Sicurezza:
 *   - Il componente da renderizzare è scelto da una whitelist lato frontend.
 *   - Il backend non invia mai codice JS eseguibile — solo il nome del
 *     componente e le props serializzate (JSON).
 *   - Se il nome non è nella whitelist, mostra un fallback testuale.
 *
 * Aggiungere un nuovo componente:
 *   1. Crea il componente in components/wendy/generative/
 *   2. Aggiungi alla UI_REGISTRY
 *   3. Aggiungi la definizione tool lato backend (wendy-chat.ts)
 */

import React, { memo, Suspense, lazy } from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UIComponentPayload {
  component: string;
  props:     Record<string, unknown>;
  caption?:  string;
}

// Messaggio SSE inviato dal backend quando Wendy genera un componente
export interface WendyUIEvent {
  type:    'ui_component';
  payload: UIComponentPayload;
}

// ─── Whitelist componenti inline ────────────────────────────────────────────────────────
// Componenti leggeri definiti inline (senza lazy-load).
// Per componenti pesanti (Recharts), usa UI_LAZY_REGISTRY.

// ── RiasecRadarChart (CSS-based, senza Recharts) ───────────────────────────

interface RiasecScores {
  R: number; I: number; A: number; S: number; E: number; C: number;
}

const RIASEC_COLORS: Record<keyof RiasecScores, string> = {
  R: 'hsl(var(--chart-1))', I: 'hsl(var(--chart-4))', A: '#ec4899',
  S: 'hsl(var(--chart-2))', E: 'hsl(var(--chart-1))', C: 'hsl(var(--chart-3))',
};
const RIASEC_LABELS: Record<keyof RiasecScores, string> = {
  R: 'Realistico', I: 'Investigativo', A: 'Artistico',
  S: 'Sociale', E: 'Intraprendente', C: 'Convenzionale',
};

function RiasecBarChart({ scores, title }: { scores: RiasecScores; title?: string }) {
  const max = Math.max(...Object.values(scores), 1);
  return (
    <div className="p-4">
      {title && <p className="mb-3 text-sm font-semibold text-white/80">{title}</p>}
      <div className="space-y-2">
        {(Object.keys(scores) as (keyof RiasecScores)[]).map((k) => (
          <div key={k} className="flex items-center gap-2">
            <span
              className="w-24 shrink-0 text-[11px] font-medium"
              style={{ color: RIASEC_COLORS[k] }}
            >
              {RIASEC_LABELS[k]}
            </span>
            <div className="h-4 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width:      `${(scores[k] / max) * 100}%`,
                  background: RIASEC_COLORS[k],
                }}
              />
            </div>
            <span className="w-8 text-right text-[11px] text-white/50">{scores[k]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CareerRoadmap ─────────────────────────────────────────────────────────────────────

interface RoadmapStep {
  label:       string;
  description: string;
  duration?:   string;
  done?:       boolean;
}

function CareerRoadmap({ steps, title }: { steps: RoadmapStep[]; title?: string }) {
  return (
    <div className="p-4">
      {title && <p className="mb-3 text-sm font-semibold text-white/80">{title}</p>}
      <ol className="relative ml-3 border-l border-white/20">
        {steps.map((step, i) => (
          <li key={i} className="mb-5 ml-5">
            <span className={[
              'absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full text-[10px]',
              step.done ? 'bg-emerald-500 text-white' : 'bg-white/20 text-white/60',
            ].join(' ')}>
              {step.done ? '✓' : i + 1}
            </span>
            <div>
              <p className="text-sm font-medium text-white">{step.label}</p>
              <p className="text-xs text-white/50">{step.description}</p>
              {step.duration && (
                <span className="mt-1 inline-block text-[10px] text-indigo-300">
                  🕒 {step.duration}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── InterviewChecklist ────────────────────────────────────────────────────────────

function InterviewChecklist({ items, title }: { items: string[]; title?: string }) {
  const [checked, setChecked] = React.useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <div className="p-4">
      {title && <p className="mb-3 text-sm font-semibold text-white/80">{title}</p>}
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li
            key={i}
            onClick={() => toggle(i)}
            className="flex cursor-pointer items-start gap-3"
          >
            <span className={[
              'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition',
              checked.has(i)
                ? 'border-emerald-500 bg-emerald-500 text-white'
                : 'border-white/30 bg-white/5',
            ].join(' ')}>
              {checked.has(i) && <span className="text-[10px]">✓</span>}
            </span>
            <span className={[
              'text-sm transition',
              checked.has(i) ? 'text-white/30 line-through' : 'text-white/80',
            ].join(' ')}>
              {item}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-right text-[11px] text-white/30">
        {checked.size}/{items.length} completati
      </p>
    </div>
  );
}

// ── SalaryRange ─────────────────────────────────────────────────────────────────────

function SalaryRange({
  role, min, median, max, currency = '€',
}: { role: string; min: number; median: number; max: number; currency?: string }) {
  const total  = max - min;
  const medPct = ((median - min) / total) * 100;
  return (
    <div className="p-4">
      <p className="mb-1 text-sm font-semibold text-white/80">{role}</p>
      <div className="relative h-6 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
          style={{ width: '100%' }}
        />
        {/* Marker mediana */}
        <div
          className="absolute top-0 h-full w-0.5 bg-white"
          style={{ left: `${medPct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-white/50">
        <span>{currency}{min.toLocaleString('it-IT')}</span>
        <span className="font-medium text-white/80">med. {currency}{median.toLocaleString('it-IT')}</span>
        <span>{currency}{max.toLocaleString('it-IT')}</span>
      </div>
    </div>
  );
}

// ─── Registry ─────────────────────────────────────────────────────────────────────

type AnyComponentFn = (props: Record<string, unknown>) => React.ReactElement | null;

const UI_REGISTRY: Record<string, AnyComponentFn> = {
  RiasecBarChart:      (p) => <RiasecBarChart {...p as Parameters<typeof RiasecBarChart>[0]} />,
  CareerRoadmap:       (p) => <CareerRoadmap  {...p as Parameters<typeof CareerRoadmap>[0]}  />,
  InterviewChecklist:  (p) => <InterviewChecklist {...p as Parameters<typeof InterviewChecklist>[0]} />,
  SalaryRange:         (p) => <SalaryRange    {...p as Parameters<typeof SalaryRange>[0]}    />,
};

// ─── Renderer pubblico ─────────────────────────────────────────────────────────────

export const WendyGenerativeUI = memo(function WendyGenerativeUI({
  payload,
}: {
  payload: UIComponentPayload;
}) {
  const { component, props, caption } = payload;
  const Renderer = UI_REGISTRY[component];

  if (!Renderer) {
    // Fallback: mostra il nome del componente non riconosciuto
    return (
      <div className="p-3 text-xs text-white/40">
        [Componente UI non disponibile: <code>{component}</code>]
      </div>
    );
  }

  return (
    <div>
      <Renderer {...props} />
      {caption && (
        <p className="border-t border-white/10 px-4 pb-3 pt-2 text-[11px] italic text-white/40">
          {caption}
        </p>
      )}
    </div>
  );
});

// ─── Definizioni tool per il backend ──────────────────────────────────────────────────
// Esportate come JSON-schema da passare al LLM come tool definition.
// Importa nel backend: import { WENDY_UI_TOOLS } from '...' (copia il JSON)

export const WENDY_UI_TOOLS = [
  {
    name: 'render_ui',
    description: 'Genera un componente UI interattivo da mostrare nella chat. Usalo quando l\'utente chiede un grafico, una timeline, una checklist o un range salariale.',
    inputSchema: {
      type: 'object',
      required: ['component', 'props'],
      properties: {
        component: {
          type: 'string',
          enum: ['RiasecBarChart', 'CareerRoadmap', 'InterviewChecklist', 'SalaryRange'],
          description: 'Nome del componente React da renderizzare',
        },
        props: {
          type: 'object',
          description: 'Props del componente (variano per tipo)',
        },
        caption: {
          type: 'string',
          description: 'Didascalia opzionale sotto il componente',
        },
      },
    },
  },
];
