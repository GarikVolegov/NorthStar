/**
 * WendyTTS — Text-to-Speech con ElevenLabs
 *
 * Pipeline:
 *   1. onPlay() → chiama /api/v1/ai/tts con { text, voiceId }
 *   2. Backend chiama ElevenLabs streaming API e proxya l'audio
 *   3. Frontend riceve ReadableStream audio/mpeg
 *   4. Web Audio API: decoda e riproduce con gain fade-in/out
 *
 * Perché proxy server-side:
 *   - Non espone la chiave ElevenLabs nel bundle
 *   - Permette caching (stesso testo = stesso audio)
 *   - Controllo quota per utente
 *
 * Componenti esportati:
 *   WendyTTSButton   — bottone play/stop da inserire accanto a ogni bolla
 *   useWendyTTS      — hook per controllo programmatico
 *
 * Props WendyTTSButton:
 *   text:      testo da sintetizzare
 *   voiceId:   ID voce ElevenLabs (default: voce Wendy configurata)
 *   disabled:  blocca il pulsante
 *   className: stile aggiuntivo
 */

import { useCallback, useRef, useState } from 'react';

// VoiceID default — override con env VITE_WENDY_VOICE_ID
const env = import.meta.env as unknown as Record<string, unknown>;
const DEFAULT_VOICE_ID =
  typeof env.VITE_WENDY_VOICE_ID === 'string'
    ? env.VITE_WENDY_VOICE_ID
    : 'EXAVITQu4vr4xnSDxMaL'; // Sarah

// ─── Hook ────────────────────────────────────────────────────────────────────

type TTSState = 'idle' | 'loading' | 'playing' | 'error';

function getTtsErrorMessage(value: unknown, fallback: string): string {
  if (value && typeof value === 'object' && 'error' in value) {
    const error = (value as { error?: unknown }).error;
    if (typeof error === 'string') return error;
  }
  return fallback;
}

export interface UseWendyTTSReturn {
  state:  TTSState;
  play:   (text: string, voiceId?: string) => Promise<void>;
  stop:   () => void;
  error:  string | null;
}

export function useWendyTTS(apiUrl = '/api/v1/ai/tts'): UseWendyTTSReturn {
  const [state,  setState]  = useState<TTSState>('idle');
  const [error,  setError]  = useState<string | null>(null);

  const audioCtxRef  = useRef<AudioContext | null>(null);
  const sourceRef    = useRef<AudioBufferSourceNode | null>(null);
  const gainRef      = useRef<GainNode | null>(null);

  const stop = useCallback(() => {
    if (gainRef.current && audioCtxRef.current) {
      const gain = gainRef.current;
      const ctx  = audioCtxRef.current;
      // Fade out in 200ms prima di fermarsi
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.07);
      setTimeout(() => {
        sourceRef.current?.stop();
        sourceRef.current = null;
      }, 250);
    }
    setState('idle');
  }, []);

  const play = useCallback(async (text: string, voiceId = DEFAULT_VOICE_ID) => {
    // Se già sta riproducendo, ferma
    if (state === 'playing') { stop(); return; }

    setError(null);
    setState('loading');

    try {
      const resp = await fetch(apiUrl, {
        method:      'POST',
        headers:     { 'Content-Type': 'application/json' },
        credentials: 'include',
        body:        JSON.stringify({ text: text.slice(0, 5000), voiceId }),
      });

      if (!resp.ok) {
        const err = (await resp.json().catch(() => ({
          error: `HTTP ${resp.status}`,
        }))) as unknown;
        throw new Error(getTtsErrorMessage(err, 'Errore TTS'));
      }

      const arrayBuffer = await resp.arrayBuffer();

      // Crea AudioContext la prima volta (lazy — richiede gesto utente)
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.setTargetAtTime(1, ctx.currentTime, 0.1); // fade-in

      source.connect(gain);
      gain.connect(ctx.destination);

      sourceRef.current = source;
      gainRef.current   = gain;

      source.onended = () => setState('idle');
      source.start();
      setState('playing');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore TTS');
      setState('error');
    }
  }, [apiUrl, state, stop]);

  return { state, play, stop, error };
}

// ─── Button component ─────────────────────────────────────────────────────────────

export interface WendyTTSButtonProps {
  text:      string;
  voiceId?:  string;
  disabled?: boolean;
  className?: string;
}

export function WendyTTSButton({
  text,
  voiceId,
  disabled  = false,
  className = '',
}: WendyTTSButtonProps) {
  const { state, play, stop, error } = useWendyTTS();

  const handleClick = () => {
    if (state === 'playing') stop();
    else                     play(text, voiceId);
  };

  const label = state === 'playing'  ? 'Ferma lettura'
              : state === 'loading'  ? 'Caricamento audio...'
              : state === 'error'    ? `Errore TTS: ${error}`
              : 'Ascolta risposta';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || state === 'loading'}
      aria-label={label}
      title={label}
      className={[
        'flex h-7 w-7 items-center justify-center rounded-full transition-all',
        state === 'playing'
          ? 'bg-violet-500 text-white shadow shadow-violet-500/40'
          : state === 'error'
          ? 'bg-amber-500/20 text-amber-300'
          : 'bg-white/10 text-white/50 hover:bg-white/20 hover:text-white',
        disabled ? 'opacity-40 cursor-not-allowed' : '',
        className,
      ].join(' ')}
    >
      {state === 'loading' ? (
        <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
      ) : state === 'playing' ? (
        // Stop icon
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="1" />
        </svg>
      ) : (
        // Speaker icon
        <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor">
          <path d="M11 5L6 9H2v6h4l5 4V5z"/>
          <path d="M15.5 8.5a5 5 0 0 1 0 7M19 6a9 9 0 0 1 0 12" stroke="currentColor" strokeWidth="2" fill="none"/>
        </svg>
      )}
    </button>
  );
}
