/**
 * WendyMessageBubble — Bolla messaggio potenziata
 *
 * Supporta:
 *   - Testo puro con markdown-lite (grassetto, corsivo, codice inline)
 *   - Thumbnail immagine con lightbox fullscreen (click per espandere)
 *   - Spinner di caricamento con testo "Wendy sta pensando..."
 *   - Metadati: timestamp, provider VLM, token usati (solo dev/premium)
 *   - Cursor lampeggiante durante streaming SSE
 *   - Feedback 👍/👎 (rimanda a WendyMessageFeedback)
 *   - Generative UI: slot `uiComponent` per componenti React interattivi
 *
 * Props:
 *   role:         'user' | 'assistant'
 *   content:      stringa testo (supporta \n)
 *   images?:      URL/dataURI allegati (mostrati come thumbnail)
 *   isStreaming?: true = mostra cursore lampeggiante
 *   isLoading?:   true = sostituisce contenuto con skeleton
 *   metadata?:    { provider, model, durationMs, tokens }
 *   uiComponent?: ReactNode interattivo generato da Wendy
 *   onFeedback?:  (type: 'up'|'down') => void
 */

import React, { memo, useState } from 'react';

export interface BubbleMetadata {
  provider?:   string;
  model?:      string;
  durationMs?: number;
  tokens?:     { input: number; output: number };
  timestamp?:  Date;
}

export interface WendyMessageBubbleProps {
  role:         'user' | 'assistant';
  content:      string;
  images?:      string[];     // URL o data-URI da mostrare come thumbnail
  isStreaming?: boolean;
  isLoading?:   boolean;
  metadata?:    BubbleMetadata;
  uiComponent?: React.ReactNode;
  onFeedback?:  (type: 'up' | 'down') => void;
  className?:   string;
}

// ── Lightbox ────────────────────────────────────────────────────────────────────

function Lightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        aria-label="Chiudi"
        className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white transition hover:bg-white/40"
      >
        ×
      </button>
      <img
        src={src}
        alt="Immagine a schermo intero"
        className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// ── Thumbnail strip ─────────────────────────────────────────────────────────────

function ImageStrip({ images }: { images: string[] }) {
  const [lightbox, setLightbox] = useState<string | null>(null);

  return (
    <>
      <div className="mt-2 flex flex-wrap gap-2">
        {images.map((src, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setLightbox(src)}
            className="group relative h-20 w-20 overflow-hidden rounded-xl border border-white/20 shadow-sm transition hover:scale-105"
          >
            <img
              src={src}
              alt={`Allegato ${i + 1}`}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
              <span className="text-xl">🔍</span>
            </div>
          </button>
        ))}
      </div>
      {lightbox && <Lightbox src={lightbox} onClose={() => setLightbox(null)} />}
    </>
  );
}

// ── Skeleton loading ─────────────────────────────────────────────────────────────

function BubbleSkeleton() {
  return (
    <div className="flex flex-col gap-2 py-1">
      {[100, 80, 60].map((w) => (
        <div
          key={w}
          className="h-3 animate-pulse rounded-full bg-white/20"
          style={{ width: `${w}%` }}
        />
      ))}
    </div>
  );
}

// ── Markdown-lite renderer ──────────────────────────────────────────────────────────
// Rendering leggero senza dipendenze: **bold**, *italic*, `code`

function renderMarkdownLite(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**'))
      return <strong key={i}>{p.slice(2, -2)}</strong>;
    if (p.startsWith('*') && p.endsWith('*'))
      return <em key={i}>{p.slice(1, -1)}</em>;
    if (p.startsWith('`') && p.endsWith('`'))
      return (
        <code key={i} className="rounded bg-white/20 px-1 font-mono text-[0.85em]">
          {p.slice(1, -1)}
        </code>
      );
    return <React.Fragment key={i}>{p}</React.Fragment>;
  });
}

// ── Metadata bar ─────────────────────────────────────────────────────────────────

function MetaBar({ meta, onFeedback }: {
  meta: BubbleMetadata;
  onFeedback?: (type: 'up' | 'down') => void;
}) {
  const [voted, setVoted] = useState<'up' | 'down' | null>(null);

  const vote = (type: 'up' | 'down') => {
    if (voted) return;
    setVoted(type);
    onFeedback?.(type);
  };

  const ts = meta.timestamp
    ? meta.timestamp.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-white/40">
      {ts    && <span>{ts}</span>}
      {meta.model && <span className="rounded bg-white/10 px-1">{meta.model}</span>}
      {meta.durationMs && <span>{(meta.durationMs / 1000).toFixed(1)}s</span>}
      {meta.tokens && (
        <span>{meta.tokens.input}+{meta.tokens.output} tok</span>
      )}

      {onFeedback && (
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => vote('up')}
            aria-label="Risposta utile"
            className={[
              'rounded px-1.5 py-0.5 transition',
              voted === 'up'
                ? 'bg-emerald-500/30 text-emerald-300'
                : 'hover:bg-white/10',
            ].join(' ')}
          >
            👍
          </button>
          <button
            onClick={() => vote('down')}
            aria-label="Risposta non utile"
            className={[
              'rounded px-1.5 py-0.5 transition',
              voted === 'down'
                ? 'bg-rose-500/30 text-rose-300'
                : 'hover:bg-white/10',
            ].join(' ')}
          >
            👎
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export const WendyMessageBubble = memo(function WendyMessageBubble({
  role,
  content,
  images,
  isStreaming = false,
  isLoading   = false,
  metadata,
  uiComponent,
  onFeedback,
  className = '',
}: WendyMessageBubbleProps) {
  const isAssistant = role === 'assistant';

  return (
    <div className={[
      'flex w-full',
      isAssistant ? 'justify-start' : 'justify-end',
      className,
    ].join(' ')}>
      <div className={[
        'relative max-w-[80%] rounded-2xl px-4 py-3 shadow-md',
        isAssistant
          ? 'rounded-tl-sm bg-gradient-to-br from-indigo-600 to-violet-700 text-white'
          : 'rounded-tr-sm bg-white/10 text-white backdrop-blur-sm border border-white/20',
      ].join(' ')}>

        {/* Immagini allegato utente */}
        {images && images.length > 0 && <ImageStrip images={images} />}

        {/* Contenuto testo */}
        <div className="text-sm leading-relaxed">
          {isLoading ? (
            <BubbleSkeleton />
          ) : (
            <>
              {content.split('\n').map((line, i) => (
                <p key={i} className={i > 0 ? 'mt-1' : ''}>
                  {renderMarkdownLite(line)}
                </p>
              ))}
              {/* Cursore streaming */}
              {isStreaming && (
                <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-white/80" />
              )}
            </>
          )}
        </div>

        {/* Generative UI slot */}
        {uiComponent && (
          <div className="mt-3 overflow-hidden rounded-xl border border-white/20 bg-white/5">
            {uiComponent}
          </div>
        )}

        {/* Metadata + feedback (solo assistant, non durante streaming) */}
        {isAssistant && !isStreaming && !isLoading && metadata && (
          <MetaBar
            meta={metadata}
            {...(onFeedback !== undefined ? { onFeedback } : {})}
          />
        )}
      </div>
    </div>
  );
});
