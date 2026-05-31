import {
  appAudio,
  type AppAudioEngine,
  type AppAudioSnapshot,
} from "@/lib/app-audio";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface AppAudioContextValue {
  snapshot: AppAudioSnapshot;
  playWendyRitual: () => void;
  setMuted: (muted: boolean) => void;
}

const AppAudioContext = createContext<AppAudioContextValue | null>(null);

interface AppAudioProviderProps {
  children: ReactNode;
  engine?: Pick<
    AppAudioEngine,
    "activate" | "getSnapshot" | "playWendyRitual" | "setMuted" | "subscribe"
  >;
}

export function AppAudioProvider({
  children,
  engine = appAudio,
}: AppAudioProviderProps) {
  const [snapshot, setSnapshot] = useState(() => engine.getSnapshot());

  useEffect(() => engine.subscribe(setSnapshot), [engine]);

  useEffect(() => {
    let gestureConsumed = false;

    const activateFromGesture = () => {
      const nextSnapshot = engine.getSnapshot();
      if (gestureConsumed || nextSnapshot.muted) return;
      gestureConsumed = true;
      engine.activate();
      window.removeEventListener("pointerdown", activateFromGesture);
      window.removeEventListener("touchstart", activateFromGesture);
      window.removeEventListener("keydown", activateFromGesture);
    };

    window.addEventListener("pointerdown", activateFromGesture, { passive: true });
    window.addEventListener("touchstart", activateFromGesture, { passive: true });
    window.addEventListener("keydown", activateFromGesture);

    return () => {
      window.removeEventListener("pointerdown", activateFromGesture);
      window.removeEventListener("touchstart", activateFromGesture);
      window.removeEventListener("keydown", activateFromGesture);
    };
  }, [engine]);

  const setMuted = useCallback(
    (muted: boolean) => {
      engine.setMuted(muted);
      if (!muted && !engine.getSnapshot().activated) {
        engine.activate();
      }
    },
    [engine],
  );

  const playWendyRitual = useCallback(() => {
    engine.playWendyRitual();
  }, [engine]);

  const value = useMemo(
    () => ({ playWendyRitual, snapshot, setMuted }),
    [playWendyRitual, setMuted, snapshot],
  );

  return (
    <AppAudioContext.Provider value={value}>
      {children}
    </AppAudioContext.Provider>
  );
}

export function useAppAudio() {
  const context = useContext(AppAudioContext);
  if (!context) {
    throw new Error("useAppAudio must be used inside AppAudioProvider");
  }
  return context;
}
