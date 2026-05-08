/**
 * useWendyToast — lightweight toast queue for Wendy UI.
 *
 * API:
 *   addToast(message, type?)  → push notification (auto-dismissed after `duration` ms)
 *   removeToast(id)           → dismiss immediately
 *   toasts                    → current queue; render with <WendyToast />
 */
import { useState, useCallback, useRef } from "react";

export type ToastType = "error" | "warning" | "info" | "success";

export interface WendyToastItem {
  id: string;
  message: string;
  type: ToastType;
}

function uid() {
  return Math.random().toString(36).slice(2);
}

export function useWendyToast(duration = 5000) {
  const [toasts, setToasts] = useState<WendyToastItem[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const addToast = useCallback(
    (message: string, type: ToastType = "error") => {
      const id = uid();
      setToasts((prev) => [...prev, { id, message, type }]);
      const timer = setTimeout(() => removeToast(id), duration);
      timers.current.set(id, timer);
    },
    [duration, removeToast]
  );

  return { toasts, addToast, removeToast };
}
