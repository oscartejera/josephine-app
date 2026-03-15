import { useEffect, useRef, useState, useCallback } from 'react';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;   // 30 minutes
const WARNING_BEFORE_MS = 5 * 60 * 1000;  // Warn 5 minutes before
const EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'] as const;

interface UseIdleTimeoutReturn {
  showWarning: boolean;
  minutesRemaining: number;
  resetTimer: () => void;
}

export function useIdleTimeout(enabled: boolean): UseIdleTimeoutReturn {
  const [showWarning, setShowWarning] = useState(false);
  const [minutesRemaining, setMinutesRemaining] = useState(5);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deadlineRef = useRef<number>(Date.now() + IDLE_TIMEOUT_MS);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const resetTimer = useCallback(() => {
    clearTimers();
    setShowWarning(false);
    deadlineRef.current = Date.now() + IDLE_TIMEOUT_MS;

    // Set up warning timer
    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      // Start countdown
      intervalRef.current = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 60000));
        setMinutesRemaining(remaining);
      }, 10000);
    }, IDLE_TIMEOUT_MS - WARNING_BEFORE_MS);
  }, [clearTimers]);

  useEffect(() => {
    if (!enabled) {
      clearTimers();
      setShowWarning(false);
      return;
    }

    resetTimer();

    const handleActivity = () => {
      if (!showWarning) {
        resetTimer();
      }
    };

    for (const event of EVENTS) {
      window.addEventListener(event, handleActivity, { passive: true });
    }

    return () => {
      clearTimers();
      for (const event of EVENTS) {
        window.removeEventListener(event, handleActivity);
      }
    };
  }, [enabled, showWarning, resetTimer, clearTimers]);

  return { showWarning, minutesRemaining, resetTimer };
}
