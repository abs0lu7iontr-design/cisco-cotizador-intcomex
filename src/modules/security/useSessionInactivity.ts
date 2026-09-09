// ============================================================================
// CISCO AUTOMATED - SESSION INACTIVITY & AUTO-LOGOUT SECURITY HOOK
// Monitors mouse, keyboard & touch activity. Terminates session after 30 mins idle.
// Cross-tab synchronized via localStorage.
// ============================================================================

import { useEffect, useRef, useState, useCallback } from 'react';

const LAST_ACTIVITY_KEY = 'cisco_auth_last_activity_ts';
export const INACTIVITY_LIMIT_MS = 30 * 60 * 1000; // 30 minutes
export const WARNING_THRESHOLD_MS = 60 * 1000; // 1 minute warning

interface SessionInactivityOptions {
  isAuthenticated: boolean;
  onTimeout: () => void;
  timeoutMs?: number;
  warningMs?: number;
}

export function useSessionInactivity({
  isAuthenticated,
  onTimeout,
  timeoutMs = INACTIVITY_LIMIT_MS,
  warningMs = WARNING_THRESHOLD_MS,
}: SessionInactivityOptions) {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  const lastActivityRef = useRef<number>(Date.now());
  const timeoutCallbackRef = useRef(onTimeout);
  timeoutCallbackRef.current = onTimeout;

  // Record user activity
  const recordActivity = useCallback(() => {
    if (!isAuthenticated) return;
    const now = Date.now();
    // Throttle writes to once every 1000ms
    if (now - lastActivityRef.current > 1000) {
      lastActivityRef.current = now;
      try {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      } catch (_) {}
      setShowWarning(false);
    }
  }, [isAuthenticated]);

  // Keep session alive on explicit user action
  const stayActive = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    } catch (_) {}
    setShowWarning(false);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setShowWarning(false);
      return;
    }

    // Initialize timestamp on login
    const now = Date.now();
    lastActivityRef.current = now;
    try {
      localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
    } catch (_) {}

    // Activity event listeners
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click', 'wheel'];
    const handleEvent = () => recordActivity();

    events.forEach((evt) => {
      window.addEventListener(evt, handleEvent, { passive: true });
    });

    // Check timer loop
    const interval = setInterval(() => {
      let last = lastActivityRef.current;
      try {
        const stored = localStorage.getItem(LAST_ACTIVITY_KEY);
        if (stored) {
          const parsed = Number(stored);
          if (parsed && parsed > last) {
            last = parsed;
            lastActivityRef.current = parsed;
          }
        }
      } catch (_) {}

      const currentNow = Date.now();
      const elapsed = currentNow - last;
      const remaining = timeoutMs - elapsed;

      if (remaining <= 0) {
        // Session expired
        setShowWarning(false);
        try {
          localStorage.removeItem(LAST_ACTIVITY_KEY);
        } catch (_) {}
        timeoutCallbackRef.current();
      } else if (remaining <= warningMs) {
        // Warning threshold reached
        setShowWarning(true);
        setSecondsRemaining(Math.ceil(remaining / 1000));
      } else {
        setShowWarning(false);
      }
    }, 2000);

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleEvent);
      });
      clearInterval(interval);
    };
  }, [isAuthenticated, recordActivity, timeoutMs, warningMs]);

  return {
    showWarning,
    secondsRemaining,
    stayActive,
  };
}
