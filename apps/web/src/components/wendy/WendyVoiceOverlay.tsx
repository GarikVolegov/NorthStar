/**
 * WendyVoiceOverlay
 *
 * Fullscreen modal per la conversazione vocale con Wendy.
 * Si apre sopra la chat testuale — condivide la stessa history.
 *
 * Layout:
 *   ┌──────────────────────────────────────┐
 *   │  ✕  (chiudi)                         │
 *   │                                      │
 *   │        [avatar pulsante]             │
 *   │        Wendy · listening/thinking…   │
 *   │                                      │
 *   │  [bubble risposta Wendy]             │
 *   │  [transcript live utente]            │
 *   │                                      │
 *   │  [  🎙️  Tieni premuto  ]  [stop ■]   │
 *   └──────────────────────────────────────┘
 *
 * Accessibility:
 *   - role="dialog" + aria-modal + aria-label
 *   - Trap focus sull'overlay (close button)
 *   - aria-live per la trascrizione
 */
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { UseVoiceChatReturn, VoiceChatPhase, VoiceChatMessage } from '../../hooks/useVoiceChat.js';
import { useVoiceChat } from '../../hooks/useVoiceChat.js';
import { WendyAvatar } from '../wendy-avatar.js';

const PHASE_LABEL: Record<VoiceChatPhase, string> = {
  idle:      'Premi il microfono per parlare',
  listening: 'In ascolto…',
  thinking:  'Wendy sta pensando…',
  speaking:  'Wendy sta parlando…',
  error:     'Qualcosa è andato storto',
};

const PHASE_COLOR: Record<VoiceChatPhase, string> = {
  idle:      'text-muted-foreground',
  listening: 'text-primary',
  thinking:  'text-amber-500',
  speaking:  'text-emerald-500',
  error:     'text-destructive',
};

export interface WendyVoiceOverlayProps {
  open: boolean;
  onClose: () => void;
  apiUrl?: string;
  historyRef: React.MutableRefObject<VoiceChatMessage[]>;
}

export function WendyVoiceOverlay({
  open,
  onClose,
  apiUrl,
  historyRef,
}: WendyVoiceOverlayProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  const vc: UseVoiceChatReturn = useVoiceChat({ apiUrl, historyRef });

  // Focus close button on open for accessibility
  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  // Stop everything when overlay closes
  useEffect(() => {
    if (!open) vc.cancelAll();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard: Escape closes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        vc.cancelAll();
        onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, vc]);

  const isListening = vc.phase === 'listening';
  const isThinking  = vc.phase === 'thinking';
  const isSpeaking  = vc.phase === 'speaking';
  const isIdle      = vc.phase === 'idle';

  if (!vc.isSupported) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="wendy-voice-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-background/95 backdrop-blur-md px-6 py-8"
          role="dialog"
          aria-modal="true"
          aria-label="Conversazione vocale con Wendy"
          data-testid="wendy-voice-overlay"
        >
          {/* ── Close ─────────────────────────────────────────────────── */}
          <div className="w-full flex justify-end">
            <button
              ref={closeRef}
              onClick={() => { vc.cancelAll(); onClose(); }}
              aria-label="Chiudi conversazione vocale"
              data-testid="wendy-voice-overlay-close"
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* ── Avatar pulsante ───────────────────────────────────────── */}
          <div className="flex flex-col items-center gap-4 flex-1 justify-center">
            <motion.div
              animate={{
                scale:     isSpeaking  ? [1, 1.08, 1]   : isListening ? [1, 1.04, 1] : 1,
                opacity:   isThinking  ? [1, 0.6, 1]   : 1,
              }}
              transition={{
                repeat:   (isSpeaking || isListening || isThinking) ? Infinity : 0,
                duration: isSpeaking ? 0.7 : isListening ? 1.1 : 1.4,
                ease:     'easeInOut',
              }}
              className="relative"
            >
              {/* Glow ring */}
              <div className={[
                'absolute -inset-3 rounded-full blur-xl opacity-40 transition-all duration-500',
                isSpeaking  ? 'bg-emerald-400' :
                isListening ? 'bg-primary'     :
                isThinking  ? 'bg-amber-400'   : 'bg-muted',
              ].join(' ')} />
              <WendyAvatar
                size={96}
                speaking={isSpeaking}
                listening={isListening}
                className="relative z-10 drop-shadow-xl"
              />
            </motion.div>

            {/* Phase label */}
            <p
              className={['text-sm font-medium transition-colors duration-300', PHASE_COLOR[vc.phase]].join(' ')}
              aria-live="polite"
              data-testid="wendy-voice-phase-label"
            >
              {PHASE_LABEL[vc.phase]}
            </p>

            {/* Thinking dots */}
            {isThinking && (
              <div className="flex gap-1.5" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="w-2 h-2 rounded-full bg-amber-400"
                    animate={{ y: [0, -6, 0] }}
                    transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.15 }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Bubbles area ──────────────────────────────────────────── */}
          <div className="w-full max-w-md flex flex-col gap-3 mb-6 min-h-[120px] justify-end">
            {/* Wendy reply bubble */}
            <AnimatePresence>
              {vc.lastReply && (
                <motion.div
                  key={vc.lastReply}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="self-start max-w-[85%] px-4 py-3 rounded-2xl rounded-tl-sm bg-muted text-sm leading-relaxed"
                  data-testid="wendy-voice-reply"
                >
                  {vc.lastReply}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Live transcript */}
            <AnimatePresence>
              {isListening && vc.transcript && (
                <motion.div
                  key="transcript"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  aria-live="polite"
                  className="self-end max-w-[85%] px-4 py-3 rounded-2xl rounded-tr-sm bg-primary/10 border border-primary/20 text-sm text-primary"
                  data-testid="wendy-voice-transcript"
                >
                  {vc.transcript}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            {vc.phase === 'error' && vc.errorMessage && (
              <p className="text-xs text-destructive text-center">{vc.errorMessage}</p>
            )}
          </div>

          {/* ── Controls ──────────────────────────────────────────────── */}
          <div className="flex items-center gap-4">
            {/* Mic button — push to talk */}
            <motion.button
              onPointerDown={vc.startListening}
              onPointerUp={vc.stopAndSend}
              onPointerLeave={vc.stopAndSend}
              disabled={isThinking || isSpeaking}
              whileTap={{ scale: 0.93 }}
              aria-label={isListening ? 'Rilascia per inviare' : 'Tieni premuto per parlare'}
              aria-pressed={isListening}
              data-testid="wendy-voice-mic-button"
              className={[
                'flex items-center gap-2 px-6 py-3 rounded-2xl font-medium text-sm transition-all duration-200 select-none',
                isListening
                  ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
                  : 'bg-muted text-foreground hover:bg-muted/80',
                (isThinking || isSpeaking) ? 'opacity-40 cursor-not-allowed' : '',
              ].join(' ')}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M9 11V7a3 3 0 016 0v4a3 3 0 01-6 0z" />
              </svg>
              {isListening ? 'Rilascia per inviare' : 'Tieni premuto'}
            </motion.button>

            {/* Stop/interrupt button — only when thinking or speaking */}
            {(isThinking || isSpeaking) && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={vc.cancelAll}
                aria-label="Interrompi"
                data-testid="wendy-voice-stop-button"
                className="p-3 rounded-2xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </svg>
              </motion.button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
