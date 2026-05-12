import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { useWendyOpenAITTS } from '../hooks/useWendyOpenAITTS';

interface WendyContextValue {
  isOpen: boolean;
  isSpeaking: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  speak: (text: string) => void;
  ask: (message: string) => void;
  setIsSpeaking: (v: boolean) => void;
}

const WendyContext = createContext<WendyContextValue | null>(null);

export function useWendy(): WendyContextValue {
  const ctx = useContext(WendyContext);
  if (!ctx) throw new Error('useWendy must be used within WendyProvider');
  return ctx;
}

function WendyTTSBridge({ onSpeakingChange }: { onSpeakingChange: (v: boolean) => void }) {
  const { play } = useWendyOpenAITTS({
    onStart: () => onSpeakingChange(true),
    onEnd: () => onSpeakingChange(false),
  });

  const speakRef = useRef(play);

  useEffect(() => {
    speakRef.current = play;
  }, [play]);

  useEffect(() => {
    (window as any).__wendySpeak = (text: string) => speakRef.current(text);
    return () => { delete (window as any).__wendySpeak; };
  }, []);

  return null;
}

export function WendyProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const pendingAskRef = useRef<string | null>(null);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const speak = useCallback((text: string) => {
    const fn = (window as any).__wendySpeak;
    if (fn) fn(text);
  }, []);

  const ask = useCallback((message: string) => {
    pendingAskRef.current = message;
    setIsOpen(true);
  }, []);

  return (
    <WendyContext.Provider value={{ isOpen, isSpeaking, open, close, toggle, speak, ask, setIsSpeaking }}>
      {children}
      <WendyTTSBridge onSpeakingChange={setIsSpeaking} />
    </WendyContext.Provider>
  );
}
