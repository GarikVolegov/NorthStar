import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'northstar_test_progress_v2';

interface TestProgress {
  answers: number[];
  currentIndex: number;
  timestamp: number;
  completed: boolean;
}

const EMPTY_PROGRESS: TestProgress = {
  answers: [],
  currentIndex: 0,
  timestamp: Date.now(),
  completed: false,
};

function loadProgress(): TestProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: TestProgress = JSON.parse(raw);
      // Validità 24 ore
      if (
        typeof parsed.currentIndex === 'number' &&
        Array.isArray(parsed.answers) &&
        Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000 &&
        !parsed.completed
      ) {
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return { ...EMPTY_PROGRESS, timestamp: Date.now() };
}

export function useTestState(totalQuestions: number) {
  const [progress, setProgress] = useState<TestProgress>(loadProgress);
  const [direction, setDirection] = useState<1 | -1>(1);

  // Persisti solo se il test non è completato (evita ghost progress post-complete)
  useEffect(() => {
    if (!progress.completed) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...progress, timestamp: Date.now() })
      );
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [progress]);

  const answer = useCallback(
    (value: number) => {
      setProgress(prev => {
        // Usa prev.currentIndex per evitare stale closure con indice sbagliato
        const idx = prev.currentIndex;
        const newAnswers = [...prev.answers];
        newAnswers[idx] = value;
        return {
          ...prev,
          answers: newAnswers,
          // Non avanza oltre l'ultima domanda
          currentIndex: Math.min(idx + 1, totalQuestions - 1),
        };
      });
      setDirection(1);
    },
    [totalQuestions]
  );

  const goBack = useCallback(() => {
    setProgress(prev => ({
      ...prev,
      currentIndex: Math.max(prev.currentIndex - 1, 0),
    }));
    setDirection(-1);
  }, []);

  const complete = useCallback(() => {
    // Imposta completed — l'useEffect rimuoverà il localStorage
    setProgress(prev => ({ ...prev, completed: true }));
  }, []);

  const reset = useCallback(() => {
    const fresh = { ...EMPTY_PROGRESS, timestamp: Date.now() };
    setProgress(fresh);
    setDirection(1);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // hasProgress: ha risposte, non completato, e non è già all'ultima domanda
  const hasProgress =
    progress.answers.length > 0 &&
    !progress.completed &&
    progress.currentIndex < totalQuestions;

  return {
    currentIndex: progress.currentIndex,
    answers: progress.answers,
    isComplete: progress.completed,
    direction,
    answer,
    goBack,
    complete,
    reset,
    hasProgress,
  };
}
