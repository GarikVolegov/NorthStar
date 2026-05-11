/**
 * WendyMessageFeedback — UI 👍/👎 Human-in-the-Loop per ogni messaggio
 *
 * Rendering:
 *   - Appare sotto ogni messaggio dell'assistant (non durante lo streaming)
 *   - 👍 / 👎 bottoni con micro-animazione al click
 *   - Se 👎, mostra un campo note opzionale per dettagliare il problema
 *   - Stato "inviato" con checkmark per conferma visiva
 *
 * Uso:
 *   <WendyMessageFeedback
 *     messageId={msg.id}
 *     currentFeedback={msg.feedback}
 *     onFeedback={(id, vote, note) => wendy.sendFeedback(id, vote, note)}
 *   />
 */

import React, { useState } from 'react';

export interface WendyMessageFeedbackProps {
  messageId:       string;
  currentFeedback?: 'up' | 'down';
  onFeedback:      (messageId: string, vote: 'up' | 'down', note?: string) => void;
}

export function WendyMessageFeedback({
  messageId,
  currentFeedback,
  onFeedback,
}: WendyMessageFeedbackProps) {
  const [showNote, setShowNote]   = useState(false);
  const [note,     setNote]       = useState('');
  const [sent,     setSent]       = useState(false);

  function handleVote(vote: 'up' | 'down') {
    if (sent || currentFeedback) return;
    if (vote === 'down') {
      setShowNote(true);  // chiedi prima la nota
      return;
    }
    // Upvote: manda subito
    onFeedback(messageId, 'up');
    setSent(true);
  }

  function handleSubmitDown() {
    onFeedback(messageId, 'down', note.trim() || undefined);
    setShowNote(false);
    setSent(true);
  }

  if (sent || currentFeedback === 'up') {
    return (
      <div className="wendy-feedback wendy-feedback--sent" style={styles.wrap}>
        <span style={{ fontSize: '13px', opacity: 0.5 }}>
          {currentFeedback === 'up' || sent ? '✓ Grazie per il feedback!' : null}
        </span>
      </div>
    );
  }

  return (
    <div className="wendy-feedback" style={styles.wrap}>
      {!showNote ? (
        <div style={styles.row}>
          <span style={styles.label}>Risposta utile?</span>

            <button
              type="button"
              aria-label="Risposta utile"
              onClick={() => handleVote('up')}
              style={{
                ...styles.btn,
                ...(currentFeedback === 'up' ? styles.btnActive : {}),
              }}
            >
              👍
            </button>

            <button
              type="button"
              aria-label="Risposta non utile"
              onClick={() => handleVote('down')}
              style={{
                ...styles.btn,
                ...(currentFeedback === 'down' ? styles.btnActive : {}),
              }}
            >
              👎
            </button>

           <button
             type="button"
             aria-label="Risposta non utile"
             onClick={() => handleVote('down')}
             style={{
               ...styles.btn,
               ...((currentFeedback ?? '') === 'down' ? styles.btnActive : {}),
             }}
           >
             👎
           </button>
        </div>
      ) : (
        <div style={styles.noteWrap}>
          <p style={styles.noteLabel}>
            Cosa poteva essere migliore? <span style={{ opacity: 0.5 }}>(opzionale)</span>
          </p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Es. risposta troppo generica, informazioni errate…"
            rows={2}
            maxLength={300}
            style={styles.textarea}
            autoFocus
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
            <button
              type="button"
              onClick={handleSubmitDown}
              style={styles.submitBtn}
            >
              Invia
            </button>
            <button
              type="button"
              onClick={() => setShowNote(false)}
              style={styles.cancelBtn}
            >
              Annulla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Stili inline (nessuna dipendenza CSS esterna) ───────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    marginTop:  '6px',
    fontSize:   '13px',
    display:    'flex',
    flexDirection: 'column',
    gap:        '4px',
  },
  row: {
    display:    'flex',
    alignItems: 'center',
    gap:        '6px',
  },
  label: {
    opacity:    0.45,
    fontSize:   '12px',
    userSelect: 'none',
  },
  btn: {
    border:        'none',
    background:    'transparent',
    cursor:        'pointer',
    fontSize:      '16px',
    padding:       '2px 4px',
    borderRadius:  '6px',
    transition:    'background 0.12s, transform 0.1s',
    lineHeight:    1,
  },
  btnActive: {
    background: 'rgba(139,92,246,0.15)',
    transform:  'scale(1.2)',
  },
  noteWrap: {
    display:       'flex',
    flexDirection: 'column',
    gap:           '6px',
    marginTop:     '4px',
  },
  noteLabel: {
    margin:   0,
    fontSize: '13px',
    opacity:  0.7,
  },
  textarea: {
    width:        '100%',
    padding:      '8px',
    borderRadius: '8px',
    border:       '1px solid var(--color-border, #313244)',
    background:   'var(--color-surface, #1e1e2e)',
    color:        'inherit',
    fontSize:     '13px',
    resize:       'vertical',
    fontFamily:   'inherit',
    outline:      'none',
    boxSizing:    'border-box',
  },
  submitBtn: {
    padding:       '5px 14px',
    borderRadius:  '8px',
    border:        'none',
    background:    'var(--color-primary, #8b5cf6)',
    color:         '#fff',
    cursor:        'pointer',
    fontSize:      '13px',
    fontWeight:    600,
  },
  cancelBtn: {
    padding:       '5px 14px',
    borderRadius:  '8px',
    border:        '1px solid var(--color-border, #313244)',
    background:    'transparent',
    color:         'inherit',
    cursor:        'pointer',
    fontSize:      '13px',
  },
};
