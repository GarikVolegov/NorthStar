import { useState, useCallback, useRef, useEffect } from "react";

export function useTTS() {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const speak = useCallback((text: string, lang = "it-IT") => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = lang;
    utter.rate = 0.95;
    utter.pitch = 1;

    utter.onstart = () => { setSpeaking(true); setPaused(false); };
    utter.onend = () => { setSpeaking(false); setPaused(false); };
    utter.onerror = () => { setSpeaking(false); setPaused(false); };
    utter.onpause = () => setPaused(true);
    utter.onresume = () => setPaused(false);

    utterRef.current = utter;
    window.speechSynthesis.speak(utter);
  }, []);

  const pause = useCallback(() => {
    window.speechSynthesis?.pause();
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    window.speechSynthesis?.resume();
    setPaused(false);
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setPaused(false);
  }, []);

  const toggle = useCallback((text: string, lang = "it-IT") => {
    if (speaking && !paused) {
      pause();
    } else if (speaking && paused) {
      resume();
    } else {
      speak(text, lang);
    }
  }, [speaking, paused, pause, resume, speak]);

  const supported = typeof window !== "undefined" && "speechSynthesis" in window;

  return { speaking, paused, speak, pause, resume, stop, toggle, supported };
}
