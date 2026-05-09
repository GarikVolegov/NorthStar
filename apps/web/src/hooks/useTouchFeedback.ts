/**
 * useTouchFeedback.ts — Phase 1
 *
 * Provides haptic + visual feedback for touch interactions.
 *
 * Features:
 *   - Vibration API (Android) with configurable pattern
 *   - Visual press state (isPressed) for CSS/Framer Motion feedback
 *   - Correct touchstart/touchend cleanup to avoid ghost events
 *   - Graceful degradation on desktop (no vibration, isPressed still works)
 *
 * Usage:
 *   const { handlers, isPressed } = useTouchFeedback();
 *   <button {...handlers} className={cn('...', isPressed && 'scale-95')}>
 *
 * Advanced usage (custom vibration):
 *   const { handlers } = useTouchFeedback({ vibrationMs: 30, onPress: () => console.log('tapped') });
 */

import { useCallback, useRef, useState } from 'react';

interface UseTouchFeedbackOptions {
  /** Vibration duration in ms. 0 = disable vibration. Default: 40ms */
  vibrationMs?: number;
  /** Called on every press start */
  onPress?: () => void;
  /** Called on release (touchend / mouseup) */
  onRelease?: () => void;
  /** Disable all feedback (e.g. when button is in disabled state) */
  disabled?: boolean;
}

interface UseTouchFeedbackReturn {
  /** Spread these on the interactive element */
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchEnd:   (e: React.TouchEvent) => void;
    onTouchCancel:(e: React.TouchEvent) => void;
    onMouseDown:  (e: React.MouseEvent) => void;
    onMouseUp:    (e: React.MouseEvent) => void;
    onMouseLeave: (e: React.MouseEvent) => void;
  };
  /** True while finger/pointer is pressed — use for active CSS classes */
  isPressed: boolean;
}

function vibrate(ms: number): void {
  if (ms > 0 && typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(ms);
  }
}

export function useTouchFeedback(options: UseTouchFeedbackOptions = {}): UseTouchFeedbackReturn {
  const { vibrationMs = 40, onPress, onRelease, disabled = false } = options;

  const [isPressed, setIsPressed] = useState(false);
  const pressedRef = useRef(false);

  const press = useCallback(() => {
    if (disabled || pressedRef.current) return;
    pressedRef.current = true;
    setIsPressed(true);
    vibrate(vibrationMs);
    onPress?.();
  }, [disabled, vibrationMs, onPress]);

  const release = useCallback(() => {
    if (!pressedRef.current) return;
    pressedRef.current = false;
    setIsPressed(false);
    onRelease?.();
  }, [onRelease]);

  const handlers = {
    onTouchStart:  (_e: React.TouchEvent)  => press(),
    onTouchEnd:    (_e: React.TouchEvent)  => release(),
    onTouchCancel: (_e: React.TouchEvent)  => release(),
    onMouseDown:   (_e: React.MouseEvent)  => press(),
    onMouseUp:     (_e: React.MouseEvent)  => release(),
    onMouseLeave:  (_e: React.MouseEvent)  => release(),
  };

  return { handlers, isPressed };
}
