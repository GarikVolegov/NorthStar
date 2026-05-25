/**
 * useBrowserTTS — TTS gratuito tramite Web Speech API (window.speechSynthesis).
 *
 * Usato come fallback quando VITE_OPENAI_TTS_ENABLED non è configurata.
 * Qualità inferiore a OpenAI TTS ma zero costo e zero dipendenze esterne.
 *
 * Compatibile con Chrome, Firefox, Safari, Edge.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseBrowserTTSReturn {
  isPlaying:  boolean;
  isSupported: boolean;
  play:  (text: string, lang?: string) => void;
  stop:  () => void;
  error: string | null;
}

export function useBrowserTTS(): UseBrowserTTSReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const utterRef                  = useRef<SpeechSynthesisUtterance | null>(null);

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  // Pulizia: cancella speech quando il componente viene smontato
  useEffect(() => {
    return () => {
      if (isSupported) window.speechSynthesis.cancel();
    };
  }, [isSupported]);

  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  }, [isSupported]);

  const play = useCallback((text: string, lang = 'it-IT') => {
    if (!isSupported) {
      setError('Text-to-speech non supportato in questo browser.');
      return;
    }
    if (!text.trim()) return;

    // Cancella eventuali speech in corso
    window.speechSynthesis.cancel();
    setError(null);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang  = lang;
    utterance.rate  = 1.05;   // leggermente più veloce del default
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Scegli una voce in italiano se disponibile
    const voices = window.speechSynthesis.getVoices();
    const italianVoice = voices.find(
      (v) => v.lang.startsWith('it') && v.localService,
    ) ?? voices.find((v) => v.lang.startsWith('it'));
    if (italianVoice) utterance.voice = italianVoice;

    utterance.onstart = () => setIsPlaying(true);
    utterance.onend   = () => setIsPlaying(false);
    utterance.onerror = (e) => {
      setIsPlaying(false);
      setError(`Errore TTS: ${e.error}`);
    };

    utterRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setIsPlaying(true);
  }, [isSupported]);

  return { isPlaying, isSupported, play, stop, error };
}
