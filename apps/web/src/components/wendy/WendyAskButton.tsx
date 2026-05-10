/**
 * WendyAskButton — Bottone ✨ "Chiedi a Wendy" contestuale
 *
 * Uso:
 *   <WendyAskButton
 *     actions={[
 *       {
 *         id: 'explain-riasec',
 *         label: 'Spiega il mio profilo RIASEC',
 *         prompt: `L'utente ha ottenuto il codice RIASEC: ${riasecCode}.
 *                  Spiega in modo chiaro e motivante cosa significa questo profilo
 *                  e quali percorsi di carriera si adattano meglio.`,
 *       },
 *       {
 *         id: 'cv-bullet',
 *         label: 'Aiutami a scrivere un punto del CV',
 *         prompt: 'Aiutami a formulare un bullet point efficace per il CV basato
 *                  sulla mia esperienza come sviluppatore full-stack.',
 *         prefillText: 'Aiutami a scrivere un punto del mio CV',
 *       },
 *     ]}
 *     onAction={(action) => wendy.sendContextualMessage(action)}
 *   />
 *
 * Props:
 *   - actions: lista di ContextualAction da mostrare nel menu
 *   - onAction: callback chiamato con l'azione selezionata
 *   - label: testo del bottone (default: 'Chiedi a Wendy')
 *   - variant: 'button' | 'icon' (default: 'button')
 *   - disabled: disabilita il bottone
 */

import React, { useState, useRef, useEffect } from 'react';
import type { ContextualAction } from '../../hooks/useWendyChat.js';

export interface WendyAskButtonProps {
  actions:   ContextualAction[];
  onAction:  (action: ContextualAction) => void;
  label?:    string;
  variant?:  'button' | 'icon';
  disabled?: boolean;
  className?: string;
}

export function WendyAskButton({
  actions,
  onAction,
  label    = 'Chiedi a Wendy',
  variant  = 'button',
  disabled = false,
  className = '',
}: WendyAskButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Chiudi il menu cliccando fuori
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function handleSelect(action: ContextualAction) {
    setOpen(false);
    onAction(action);
  }

  // Se c'è solo un'azione, bypassa il menu
  if (actions.length === 1) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => handleSelect(actions[0])}
        className={`wendy-ask-btn wendy-ask-btn--${variant} ${className}`}
        aria-label={actions[0].label}
      >
        <span className="wendy-ask-btn__icon" aria-hidden>✨</span>
        {variant === 'button' && <span>{label}</span>}
      </button>
    );
  }

  return (
    <div ref={ref} className={`wendy-ask-wrap ${className}`} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className={`wendy-ask-btn wendy-ask-btn--${variant} ${open ? 'wendy-ask-btn--active' : ''}`}
      >
        <span className="wendy-ask-btn__icon" aria-hidden>✨</span>
        {variant === 'button' && <span>{label}</span>}
        {variant === 'button' && (
          <span className="wendy-ask-btn__chevron" aria-hidden>
            {open ? '▲' : '▼'}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="wendy-ask-menu"
          style={{
            position:       'absolute',
            zIndex:         9999,
            top:            'calc(100% + 6px)',
            left:           0,
            minWidth:       '220px',
            background:     'var(--color-surface, #1e1e2e)',
            border:         '1px solid var(--color-border, #313244)',
            borderRadius:   '10px',
            boxShadow:      '0 8px 24px rgba(0,0,0,0.35)',
            overflow:       'hidden',
          }}
        >
          <div
            style={{
              padding:    '6px 12px 4px',
              fontSize:   '11px',
              fontWeight: 600,
              opacity:    0.5,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            Azioni Wendy
          </div>

          {actions.map((action) => (
            <button
              key={action.id}
              role="menuitem"
              type="button"
              onClick={() => handleSelect(action)}
              className="wendy-ask-menu__item"
              style={{
                display:     'flex',
                alignItems:  'center',
                gap:         '8px',
                width:       '100%',
                padding:     '9px 14px',
                border:      'none',
                background:  'transparent',
                textAlign:   'left',
                cursor:      'pointer',
                fontSize:    '14px',
                color:       'inherit',
                transition:  'background 0.12s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  'var(--color-surface-hover, rgba(139,92,246,0.12))';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <span aria-hidden style={{ flexShrink: 0, opacity: 0.7 }}>✦</span>
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
