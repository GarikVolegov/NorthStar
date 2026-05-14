import React, { useEffect } from "react";

interface Props {
  xpAwarded: number;
  newStreak: number;
  streakBumped: boolean;
  onClose: () => void;
}

export function XpRewardToast({ xpAwarded, newStreak, streakBumped, onClose }: Props) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div role="status" aria-live="polite"
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-1 rounded-2xl border border-border bg-card shadow-xl px-5 py-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="flex items-center gap-2 text-base font-bold text-yellow-500">
        <span className="text-xl">⚡</span>
        <span>+{xpAwarded} XP guadagnati!</span>
      </div>
      {streakBumped && (
        <div className="flex items-center gap-2 text-sm font-medium text-orange-500">
          <span className="text-lg">🔥</span>
          <span>Streak {newStreak} {newStreak === 1 ? "giorno" : "giorni"}!</span>
        </div>
      )}
      <button onClick={onClose} aria-label="Chiudi notifica" className="absolute top-2 right-3 text-muted-foreground hover:text-foreground text-xs">✕</button>
    </div>
  );
}
