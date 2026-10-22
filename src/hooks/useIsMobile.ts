import { useState, useEffect } from 'react';
import { isDesktopApp } from '../core/desktopBridge';

/**
 * Hook to reactively detect if the user is on a mobile viewport (< 768px).
 * In the desktop app wrapper (PyWebView), mobile mode is disabled unless explicitly resized.
 */
export function useIsMobile(breakpointPx: number = 768): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    // If running inside desktop .exe window, check width
    return window.innerWidth < breakpointPx;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < breakpointPx);
    };

    // Initial check
    checkIsMobile();

    window.addEventListener('resize', checkIsMobile, { passive: true });
    window.addEventListener('orientationchange', checkIsMobile, { passive: true });

    return () => {
      window.removeEventListener('resize', checkIsMobile);
      window.removeEventListener('orientationchange', checkIsMobile);
    };
  }, [breakpointPx]);

  return isMobile;
}
