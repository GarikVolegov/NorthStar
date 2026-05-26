import { useEffect, useState } from 'react';
import type { ThinkingPhase } from '../hooks/useWendyChat.js';

interface WendyThinkingIndicatorProps {
  thinking: ThinkingPhase;
  className?: string;
}

export function WendyThinkingIndicator({ thinking, className = '' }: WendyThinkingIndicatorProps) {
  const [elapsedSec, setElapsedSec] = useState(0);
  const [labelIndex, setLabelIndex] = useState(0);
  const reducedMotion = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const defaultLabels = [
    'Sto pensando...',
    'Leggo il contesto...',
    'Elaboro...',
    'Compongo la risposta...',
  ];
  const labels = defaultLabels.includes(thinking.label)
    ? defaultLabels
    : [thinking.label, ...defaultLabels];

  useEffect(() => {
    if (!thinking.active) { setElapsedSec(0); return; }
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - thinking.startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [thinking.active, thinking.startedAt]);

  useEffect(() => {
    if (!thinking.active) { setLabelIndex(0); return; }
    setLabelIndex(0);
    if (reducedMotion) return;
    const interval = setInterval(() => {
      setLabelIndex((current) => (current + 1) % labels.length);
    }, 1400);
    return () => clearInterval(interval);
  }, [thinking.active, thinking.label, reducedMotion, labels.length]);

  if (!thinking.active) return null;

  const visibleLabel = reducedMotion ? thinking.label : labels[labelIndex];

  return (
    <div className="flex justify-start">
      <div className="flex items-end gap-2">
        {/* Wendy avatar */}
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 shadow-sm mb-0.5">
          <span className="text-[10px] font-bold text-white">✦</span>
        </div>

        <div
          data-testid="wendy-thinking"
          role="status"
          aria-live="polite"
          aria-label={visibleLabel}
          className={[
            'rounded-[18px] rounded-bl-md px-4 py-2.5',
            'bg-muted/60 border border-white/6 backdrop-blur-sm',
            'flex items-center gap-2.5',
            className,
          ].join(' ')}
        >
          {/* Tre pallini pulse */}
          <span className="flex items-center gap-1" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="block h-1.5 w-1.5 rounded-full bg-amber-400/80 animate-bounce"
                style={{ animationDelay: `${i * 150}ms`, animationDuration: '900ms' }}
              />
            ))}
          </span>

          <span
            key={visibleLabel}
            className={[
              'text-sm text-muted-foreground truncate max-w-[160px]',
              reducedMotion ? '' : 'animate-in fade-in slide-in-from-bottom-1 duration-300',
            ].join(' ')}
          >
            {visibleLabel}
          </span>

          {elapsedSec >= 2 && (
            <span className="ml-1 shrink-0 tabular-nums text-xs text-muted-foreground/50">
              {elapsedSec}s
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
