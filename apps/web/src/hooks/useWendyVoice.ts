import { useCallback, useRef, useState } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

export interface UseWendyVoiceOptions {
  onSend: (text: string) => void;
  lang?: string;
}

export interface UseWendyVoiceReturn {
  startListening: () => void;
  stopAndSend: () => void;
  speak: (text: string) => void;
  cancelSpeech: () => void;
  listening: boolean;
  isSpeaking: boolean;
  transcript: string;
  isSupported: boolean;
}

export function useWendyVoice({
  onSend,
  lang = 'it-IT',
}: UseWendyVoiceOptions): UseWendyVoiceReturn {
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } =
    useSpeechRecognition();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const cancelSpeech = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const startListening = useCallback(() => {
    // Ferma Wendy se sta parlando prima di ascoltare
    cancelSpeech();
    resetTranscript();
    SpeechRecognition.startListening({ language: lang, continuous: false });
  }, [cancelSpeech, resetTranscript, lang]);

  const stopAndSend = useCallback(() => {
    SpeechRecognition.stopListening();
    const trimmed = transcript.trim();
    if (trimmed) {
      onSend(trimmed);
    }
  }, [transcript, onSend]);

  const speak = useCallback(
    (text: string) => {
      if (typeof window === 'undefined') return;

      // Cancella eventuale speech precedente
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 0.92; // Ritmo naturale, non troppo veloce
      utterance.pitch = 1.1; // Tono leggermente più caldo
      utterance.volume = 1;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [lang]
  );

  return {
    startListening,
    stopAndSend,
    speak,
    cancelSpeech,
    listening,
    isSpeaking,
    transcript,
    isSupported: browserSupportsSpeechRecognition,
  };
}
