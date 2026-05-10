import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * useSTT — Speech-to-Text via Web Speech API (SpeechRecognition)
 *
 * Supporto browser:
 *   Chrome/Edge: completo (continuous + interimResults)
 *   Safari 17+:  parziale (no continuous, no interimResults)
 *   Firefox:     non supportato (behind flag)
 *
 * Strategia graceful degradation:
 *   - `supported` false → il microfono non viene mostrato
 *   - errori transitori (network, no-speech) → retry automatico se autoRestart=true
 *   - errori fatali (not-allowed, service-not-allowed) → stato error senza retry
 *
 * Output:
 *   - `transcript`        testo finale confermato (append)
 *   - `interimTranscript` testo corrente in elaborazione (sostituito ad ogni chunk)
 *   - `isListening`       true mentre il microfono è attivo
 *   - `start/stop/reset`  controllo esplicito
 */

type SpeechRecognitionEvent = {
  results: SpeechRecognitionResultList;
  resultIndex: number;
};

type SpeechRecognitionErrorEvent = {
  error: string;
  message?: string;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
  }
}

interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

export interface UseSTTOptions {
  lang?: string;           // default 'it-IT'
  autoRestart?: boolean;   // default false — riavvia automaticamente su no-speech
  onFinalTranscript?: (text: string) => void;
}

export interface UseSTTReturn {
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  error: string | null;
  supported: boolean;
  start: () => void;
  stop: () => void;
  reset: () => void;
  toggle: () => void;
}

export function useSTT(options: UseSTTOptions = {}): UseSTTReturn {
  const { lang = 'it-IT', autoRestart = false, onFinalTranscript } = options;

  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const shouldRestartRef = useRef(false);

  const SpeechRecognitionCtor =
    typeof window !== 'undefined'
      ? window.SpeechRecognition ?? window.webkitSpeechRecognition
      : undefined;

  const supported = !!SpeechRecognitionCtor;

  const buildRecognition = useCallback(() => {
    if (!SpeechRecognitionCtor) return null;
    const rec = new SpeechRecognitionCtor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let finalChunk = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0].transcript;
        if (result.isFinal) {
          finalChunk += text;
        } else {
          interim += text;
        }
      }
      if (finalChunk) {
        setTranscript((prev) => prev + finalChunk);
        onFinalTranscript?.(finalChunk);
      }
      setInterimTranscript(interim);
    };

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      const fatal = ['not-allowed', 'service-not-allowed', 'audio-capture'];
      if (fatal.includes(event.error)) {
        shouldRestartRef.current = false;
        setError(event.error);
        setIsListening(false);
      }
      // Errori non fatali (no-speech, network) — gestiti da onend
    };

    rec.onend = () => {
      setIsListening(false);
      setInterimTranscript('');
      if (shouldRestartRef.current && autoRestart) {
        // Piccolo delay per evitare loop rapidi su no-speech
        setTimeout(() => recognitionRef.current?.start(), 300);
      }
    };

    return rec;
  }, [lang, autoRestart, onFinalTranscript, SpeechRecognitionCtor]);

  const start = useCallback(() => {
    if (!supported) return;
    shouldRestartRef.current = autoRestart;
    if (!recognitionRef.current) {
      recognitionRef.current = buildRecognition();
    }
    try {
      recognitionRef.current?.start();
    } catch {
      // già avviato — ignora
    }
  }, [supported, autoRestart, buildRecognition]);

  const stop = useCallback(() => {
    shouldRestartRef.current = false;
    recognitionRef.current?.stop();
  }, []);

  const reset = useCallback(() => {
    stop();
    setTranscript('');
    setInterimTranscript('');
    setError(null);
  }, [stop]);

  const toggle = useCallback(() => {
    if (isListening) stop();
    else start();
  }, [isListening, start, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      shouldRestartRef.current = false;
      recognitionRef.current?.abort();
    };
  }, []);

  return { transcript, interimTranscript, isListening, error, supported, start, stop, reset, toggle };
}
