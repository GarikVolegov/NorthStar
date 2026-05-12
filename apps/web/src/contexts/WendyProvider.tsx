import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { useWendyOpenAITTS } from '../hooks/useWendyOpenAITTS';

export type WendyPhase = 'idle' | 'thinking' | 'speaking' | 'listening';

interface WendyContextValue {
  isOpen: boolean;
  isSpeaking: boolean;
  phase: WendyPhase;
  setPhase: (p: WendyPhase) => void;
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

function WendyTTSBridge({ onSpeakingChange, onPhaseChange }: { onSpeakingChange: (v: boolean) => void; onPhaseChange: (p: WendyPhase) => void }) {
  const { play } = useWendyOpenAITTS({
    onStart: () => {
      onSpeakingChange(true);
      onPhaseChange('speaking');
    },
    onEnd: () => {
      onSpeakingChange(false);
      onPhaseChange('idle');
    },
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
  const [phase, setPhase] = useState<WendyPhase>('idle');
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
    <WendyContext.Provider value={{ isOpen, isSpeaking, phase, setPhase, open, close, toggle, speak, ask, setIsSpeaking }}>
      {children}
      <WendyTTSBridge onSpeakingChange={setIsSpeaking} onPhaseChange={setPhase} />
    </WendyContext.Provider>
  );
}
