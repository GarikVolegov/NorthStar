/**
 * WendyVoiceInput — Registrazione audio + trascrizione Deepgram real-time
 *
 * Pipeline:
 *   1. getUserMedia() → MediaRecorder (audio/webm;codecs=opus)
 *   2. Ogni 250ms, invia chunk ArrayBuffer a Deepgram via WebSocket
 *   3. Deepgram ritorna trascrizione parziale (is_final=false) e finale
 *   4. Il testo finale è passato a onTranscript(text)
 *
 * Sicurezza:
 *   - Il token Deepgram NON deve mai essere nel bundle frontend.
 *     Usare /api/v1/ai/voice/token per ottenere un token temporaneo
 *     (server-side, scade in 60s, scope: listen only)
 *   - La prop apiTokenUrl permette di configurare l'endpoint.
 *
 * Stati visuali del pulsante:
 *   idle      → 🎤 grigio  (pronto)
 *   listening → 🎤 rosso + pulse ring (registra)
 *   thinking  → spinner (elaborazione finale)
 *   error     → ⚠️ giallo (errore microfono / WS)
 *
 * Props:
 *   onTranscript(text): stringa trascritta finale
 *   onPartial(text):    aggiornamento in tempo reale (opzionale)
 *   apiTokenUrl:        endpoint che ritorna { token: string }
 *   disabled:           blocca il pulsante
 *   language:           codice lingua Deepgram (default: 'it')
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';

type VoiceState = 'idle' | 'listening' | 'thinking' | 'error';

export interface WendyVoiceInputProps {
  onTranscript:  (text: string) => void;
  onPartial?:    (text: string) => void;
  apiTokenUrl?:  string;
  disabled?:     boolean;
  language?:     string;
  className?:    string;
}

const DG_WS_URL = (token: string, lang: string) =>
  `wss://api.deepgram.com/v1/listen?` +
  `model=nova-3&language=${lang}&punctuate=true&interim_results=true&` +
  `encoding=opus&container=webm&sample_rate=48000&token=${token}`;

export function WendyVoiceInput({
  onTranscript,
  onPartial,
  apiTokenUrl = '/api/v1/ai/voice/token',
  disabled    = false,
  language    = 'it',
  className   = '',
}: WendyVoiceInputProps) {
  const [state,   setState]   = useState<VoiceState>('idle');
  const [partial, setPartial] = useState('');
  const [errMsg,  setErrMsg]  = useState('');

  const mediaRef    = useRef<MediaRecorder | null>(null);
  const wsRef       = useRef<WebSocket | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);

  // Cleanup garantito allo smontaggio
  useEffect(() => {
    return () => stopAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopAll = useCallback(() => {
    mediaRef.current?.stop();
    mediaRef.current = null;
    wsRef.current?.close();
    wsRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const startListening = useCallback(async () => {
    setErrMsg('');
    setPartial('');
    setState('thinking'); // mostra spinner mentre otteniamo il token

    try {
      // 1. Ottieni token Deepgram temporaneo dal backend
      const tokenResp = await fetch(apiTokenUrl, { credentials: 'include' });
      if (!tokenResp.ok) throw new Error('Impossibile ottenere il token vocale');
      const { token } = await tokenResp.json() as { token: string };

      // 2. Apri WebSocket verso Deepgram
      const ws = new WebSocket(DG_WS_URL(token, language));
      wsRef.current = ws;

      await new Promise<void>((resolve, reject) => {
        ws.onopen  = () => resolve();
        ws.onerror = () => reject(new Error('Connessione Deepgram fallita'));
        ws.onclose = (e) => { if (e.code !== 1000) reject(new Error(`WS chiuso: ${e.code}`)); };
      });

      // 3. Handler messaggi Deepgram
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string);
          const transcript: string =
            data?.channel?.alternatives?.[0]?.transcript ?? '';
          if (!transcript) return;

          if (data.is_final) {
            onTranscript(transcript);
            setPartial('');
          } else {
            setPartial(transcript);
            onPartial?.(transcript);
          }
        } catch { /* JSON malformato — ignora */ }
      };

      // 4. Accedi al microfono
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // 5. Crea MediaRecorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(e.data);
        }
      };
      recorder.onstop = () => {
        ws.close(1000, 'recording stopped');
        setState('idle');
      };

      recorder.start(250); // chunk ogni 250ms
      setState('listening');
    } catch (err) {
      stopAll();
      setErrMsg(err instanceof Error ? err.message : 'Errore microfono');
      setState('error');
    }
  }, [apiTokenUrl, language, onTranscript, onPartial, stopAll]);

  const stopListening = useCallback(() => {
    setState('thinking');
    mediaRef.current?.stop();
  }, []);

  const toggle = useCallback(() => {
    if (state === 'listening') stopListening();
    else if (state === 'idle' || state === 'error') startListening();
  }, [state, startListening, stopListening]);

  const label = {
    idle:      'Registra messaggio vocale',
    listening: 'Ferma registrazione',
    thinking:  'Elaborazione...',
    error:     `Errore: ${errMsg}`,
  }[state];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="relative">
        {state === 'listening' && (
          <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/40" />
        )}
        <button
          type="button"
          onClick={toggle}
          disabled={disabled || state === 'thinking'}
          aria-label={label}
          title={label}
          className={[
            'relative flex h-9 w-9 items-center justify-center rounded-full transition-all',
            state === 'listening'
              ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/40'
              : state === 'error'
              ? 'bg-amber-500/20 text-amber-400'
              : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white',
            disabled ? 'opacity-40 cursor-not-allowed' : '',
          ].join(' ')}
        >
          {state === 'thinking' ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : state === 'error' ? (
            <span className="text-sm">⚠️</span>
          ) : state === 'listening' ? (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="2" fill="none"/>
              <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2"/>
              <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2"/>
            </svg>
          )}
        </button>
      </div>

      {/* Testo parziale in tempo reale */}
      {partial && (
        <span className="max-w-[200px] truncate text-xs italic text-white/50">
          {partial}
        </span>
      )}
    </div>
  );
}
