/**
 * WendyMessageFeedback — 👍/👎 + categoria motivo per risposta Wendy.
 *
 * - Upvote: manda subito
 * - Downvote: mostra 4 chip-reason predefiniti (no testo libero per GDPR)
 * - requestId viene passato da ChatMessage e usato da sendFeedback
 */
import { useState } from 'react';

type Reason = 'inaccurate' | 'irrelevant' | 'too_long' | 'too_slow' | 'harmful' | 'other';

const REASONS: Array<{ value: Reason; label: string }> = [
  { value: 'inaccurate',  label: 'Imprecisa'      },
  { value: 'irrelevant',  label: 'Non pertinente'  },
  { value: 'too_long',    label: 'Troppo lunga'    },
  { value: 'too_slow',    label: 'Troppo lenta'    },
];

export interface WendyMessageFeedbackProps {
  messageId:        string;
  currentFeedback?: 'up' | 'down';
  hasRequestId:     boolean;   // disabilita se requestId non ancora arrivato
  onFeedback: (messageId: string, vote: 'up' | 'down', reason?: Reason) => void;
}

export function WendyMessageFeedback({
  messageId,
  currentFeedback,
  hasRequestId,
  onFeedback,
}: WendyMessageFeedbackProps) {
  const [phase, setPhase] = useState<'idle' | 'choosing' | 'done'>('idle');

  if (!hasRequestId) return null;
  if (phase === 'done' || currentFeedback) {
    return (
      <p className="text-[11px] opacity-40 mt-1 select-none">
        {currentFeedback === 'up' || phase === 'done' ? 'Grazie per il feedback' : null}
      </p>
    );
  }

  function voteUp() {
    onFeedback(messageId, 'up');
    setPhase('done');
  }

  function voteDown(reason: Reason) {
    onFeedback(messageId, 'down', reason);
    setPhase('done');
  }

  return (
    <div className="mt-1.5 flex flex-col gap-1">
      {phase === 'idle' && (
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] opacity-40 select-none">Utile?</span>
          <button
            type="button"
            aria-label="Risposta utile"
            onClick={voteUp}
            className="rounded-md px-1.5 py-0.5 text-sm hover:bg-primary/10 transition-colors"
          >
            👍
          </button>
          <button
            type="button"
            aria-label="Risposta non utile"
            onClick={() => setPhase('choosing')}
            className="rounded-md px-1.5 py-0.5 text-sm hover:bg-destructive/10 transition-colors"
          >
            👎
          </button>
        </div>
      )}

      {phase === 'choosing' && (
        <div className="flex flex-wrap gap-1.5 mt-0.5">
          {REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => voteDown(r.value)}
              className="text-[11px] px-2 py-0.5 rounded-full border border-border/60 hover:bg-destructive/10 hover:border-destructive/40 transition-colors"
            >
              {r.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPhase('idle')}
            className="text-[11px] px-2 py-0.5 rounded-full border border-border/30 opacity-50 hover:opacity-100 transition-opacity"
          >
            Annulla
          </button>
        </div>
      )}
    </div>
  );
}
