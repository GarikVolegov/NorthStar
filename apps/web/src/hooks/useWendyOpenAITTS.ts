import { useState, useRef, useCallback } from 'react';

export type OpenAITTSState = 'idle' | 'loading' | 'playing' | 'error';

export interface UseWendyOpenAITTSOptions {
  apiUrl?: string;
  earconEnabled?: boolean;
  onStart?: () => void;
  onEnd?: () => void;
}

export interface UseWendyOpenAITTSReturn {
  state: OpenAITTSState;
  play: (text: string) => Promise<void>;
  stop: () => void;
  error: string | null;
  isSpeaking: boolean;
}

function playEarcon(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.15);
  gain.gain.setValueAtTime(0.04, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.2);
}

export function useWendyOpenAITTS(options: UseWendyOpenAITTSOptions = {}): UseWendyOpenAITTSReturn {
  const {
    apiUrl = '/api/wendy/voice',
    earconEnabled = true,
    onStart,
    onEnd,
  } = options;

  const [state, setState] = useState<OpenAITTSState>('idle');
  const [error, setError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const playingRef = useRef(false);

  const stop = useCallback(() => {
    if (gainRef.current && audioCtxRef.current) {
      playingRef.current = false;
      const gain = gainRef.current;
      const ctx = audioCtxRef.current;
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setTargetAtTime(0, ctx.currentTime, 0.07);
      setTimeout(() => {
        try { sourceRef.current?.stop(); } catch {}
        sourceRef.current = null;
      }, 250);
    }
    setState('idle');
    onEnd?.();
  }, [onEnd]);

  const play = useCallback(async (text: string) => {
    if (!text.trim()) return;

    if (state === 'playing') stop();

    setError(null);
    setState('loading');
    playingRef.current = true;

    try {
      const resp = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: text.slice(0, 5000) }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        throw new Error((err as { error: string }).error ?? `HTTP ${resp.status}`);
      }

      const arrayBuffer = await resp.arrayBuffer();
      if (!playingRef.current) return;

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      if (earconEnabled) playEarcon(ctx);

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      if (!playingRef.current) return;

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.setTargetAtTime(1, ctx.currentTime, 0.1);

      source.connect(gain);
      gain.connect(ctx.destination);

      sourceRef.current = source;
      gainRef.current = gain;

      source.onended = () => {
        if (playingRef.current) {
          playingRef.current = false;
          setState('idle');
          onEnd?.();
        }
      };

      source.start();
      setState('playing');
      onStart?.();
    } catch (err) {
      playingRef.current = false;
      const msg = err instanceof Error ? err.message : 'TTS error';
      setError(msg);
      setState('error');
    }
  }, [apiUrl, state, stop, earconEnabled, onStart, onEnd]);

  return {
    state,
    play,
    stop,
    error,
    isSpeaking: state === 'playing',
  };
}
