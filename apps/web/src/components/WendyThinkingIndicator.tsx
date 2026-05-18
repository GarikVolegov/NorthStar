import { useEffect, useState } from 'react';
import type { ThinkingPhase } from '../hooks/useWendyChat.js';

/**
 * WendyThinkingIndicator
 *
 * Mostra lo stato di elaborazione di Wendy con:
 *   - Label rotante ("Wendy sta pensando…", ecc.)
 *   - Tre pallini animati (CSS pure, nessuna dipendenza esterna)
 *   - Tempo trascorso in secondi (aggiornato ogni secondo)
 *
 * Visibile solo quando thinking.active === true.
 * La visibilità è gestita con opacity/transform invece di mount/unmount
 * per preservare l'animazione CSS durante il fade-out.
 */

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
    'Pensando...',
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
    if (!thinking.active) {
      setLabelIndex(0);
      return;
    }
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
    <div
      data-testid="wendy-thinking"
      role="status"
      aria-live="polite"
      aria-label={visibleLabel}
      className={[
        'w-fit max-w-[85%] rounded-2xl rounded-tl-sm px-3 py-2 text-sm',
        'bg-muted/70 text-muted-foreground backdrop-blur-sm shadow-sm',
        'flex items-center gap-2 transition-all duration-300',
        className,
      ].join(' ')}
    >
      {/* Tre pallini bouncing — animazione CSS pura */}
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block w-1.5 h-1.5 rounded-full bg-current animate-bounce"
            style={{ animationDelay: `${i * 150}ms`, animationDuration: '900ms' }}
          />
        ))}
      </span>

      <span key={visibleLabel} className={reducedMotion ? 'truncate' : 'truncate animate-in fade-in slide-in-from-bottom-1 duration-300'}>
        {visibleLabel}
      </span>

      {/* Tempo trascorso — appare dopo 2 secondi per non essere rumoroso */}
      {elapsedSec >= 2 && (
        <span className="ml-auto shrink-0 tabular-nums opacity-60">
          {elapsedSec}s
        </span>
      )}
    </div>
  );
}
