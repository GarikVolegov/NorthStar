import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react';
import { useWendyOpenAITTS } from '../hooks/useWendyOpenAITTS';
import { useBrowserTTS } from '../hooks/useBrowserTTS';

// TTS attivo: OpenAI se VITE_OPENAI_TTS_ENABLED=true, altrimenti Web Speech API gratuito
const USE_OPENAI_TTS = import.meta.env.VITE_OPENAI_TTS_ENABLED === 'true';

export type WendyPhase = 'idle' | 'thinking' | 'speaking' | 'listening';

export interface PageContext {
  page: string;
  title?: string;
  data?: Record<string, unknown>;
}

const PAGE_HINTS: Record<string, { welcome?: string; quickActions: { label: string; icon: string }[] }> = {
  dashboard: {
    welcome: "Ecco la tua dashboard! Vuoi che analizzi i tuoi progressi o hai domande su qualcosa?",
    quickActions: [
      { label: 'Analizza i miei progressi', icon: '📊' },
      { label: 'Cosa dovrei fare oggi?', icon: '🎯' },
    ],
  },
  coach: {
    welcome: "Benvenuto nel coaching! Di cosa vuoi parlare oggi?",
    quickActions: [
      { label: 'Fissa un obiettivo', icon: '🎯' },
      { label: 'Rivedi i progressi', icon: '📈' },
    ],
  },
  test: {
    welcome: "Pronto per il test? Se hai dubbi sulle domande, chiedimi pure!",
    quickActions: [
      { label: 'Spiegami questo test', icon: '📝' },
      { label: 'Come prepararmi?', icon: '📚' },
    ],
  },
  trading: {
    welcome: "Analisi di mercato o strategia? Sono qui per aiutarti.",
    quickActions: [
      { label: 'Analizza XAUUSD', icon: '📈' },
      { label: 'Revisione risk management', icon: '🛡️' },
    ],
  },
  calendario: {
    quickActions: [
      { label: 'Ottimizza la mia agenda', icon: '📅' },
      { label: 'Piano settimanale', icon: '📋' },
    ],
  },
  risultati: {
    welcome: "Vediamo insieme i tuoi risultati! Vuoi un'analisi approfondita?",
    quickActions: [
      { label: 'Analizza i risultati', icon: '🔍' },
      { label: 'Prossimi passi', icon: '👣' },
    ],
  },
  default: {
    welcome: "Ciao! Sono Wendy, la tua assistente di orientamento. Come posso aiutarti oggi?",
    quickActions: [
      { label: 'Controlla il mio piano trading', icon: '📈' },
      { label: 'Analizza il mio mindset', icon: '🧠' },
      { label: 'Piano settimanale abitudini', icon: '🌱' },
      { label: 'Revisione carriera', icon: '💼' },
    ],
  },
};

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
  pageContext: PageContext;
  setPageContext: (ctx: PageContext) => void;
  getPageHints: () => { welcome?: string; quickActions: { label: string; icon: string }[] };
}

const WendyContext = createContext<WendyContextValue | null>(null);

export function useWendy(): WendyContextValue {
  const ctx = useContext(WendyContext);
  if (!ctx) throw new Error('useWendy must be used within WendyProvider');
  return ctx;
}

function WendyTTSBridge({ onSpeakingChange, onPhaseChange }: { onSpeakingChange: (v: boolean) => void; onPhaseChange: (p: WendyPhase) => void }) {
  // OpenAI TTS (alta qualità, richiede chiave)
  const { play: playOpenAI } = useWendyOpenAITTS({
    onStart: () => { onSpeakingChange(true);  onPhaseChange('speaking'); },
    onEnd:   () => { onSpeakingChange(false); onPhaseChange('idle');     },
  });

  // Browser TTS (gratuito, fallback automatico)
  const browserTts = useBrowserTTS();

  const speakRef = useRef<(text: string) => void>(() => {});

  useEffect(() => {
    speakRef.current = (text: string) => {
      if (USE_OPENAI_TTS) {
        playOpenAI(text);
      } else if (browserTts.isSupported) {
        onSpeakingChange(true);
        onPhaseChange('speaking');
        browserTts.play(text, navigator.language ?? 'it-IT');
        // Il browser TTS non espone onEnd affidabile su tutti i browser — reset dopo stima
        const estimatedMs = Math.max(2000, text.length * 60);
        setTimeout(() => { onSpeakingChange(false); onPhaseChange('idle'); }, estimatedMs);
      }
    };
  }, [playOpenAI, browserTts, onSpeakingChange, onPhaseChange]);

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
  const [pageContext, setPageContext] = useState<PageContext>({ page: 'default' });
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

  const getPageHints = useCallback(() => {
    return PAGE_HINTS[pageContext.page] ?? PAGE_HINTS.default;
  }, [pageContext.page]);

  return (
    <WendyContext.Provider value={{ isOpen, isSpeaking, phase, setPhase, open, close, toggle, speak, ask, setIsSpeaking, pageContext, setPageContext, getPageHints }}>
      {children}
      <WendyTTSBridge onSpeakingChange={setIsSpeaking} onPhaseChange={setPhase} />
    </WendyContext.Provider>
  );
}
