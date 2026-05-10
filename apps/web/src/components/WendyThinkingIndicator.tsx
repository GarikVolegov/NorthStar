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

  useEffect(() => {
    if (!thinking.active) { setElapsedSec(0); return; }
    const interval = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - thinking.startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [thinking.active, thinking.startedAt]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={thinking.label}
      className={[
        'flex items-center gap-2 px-3 py-2 rounded-xl text-sm',
        'bg-muted/60 text-muted-foreground backdrop-blur-sm',
        'transition-all duration-300',
        thinking.active ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none',
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

      <span className="truncate">{thinking.label}</span>

      {/* Tempo trascorso — appare dopo 2 secondi per non essere rumoroso */}
      {elapsedSec >= 2 && (
        <span className="ml-auto shrink-0 tabular-nums opacity-60">
          {elapsedSec}s
        </span>
      )}
    </div>
  );
}
