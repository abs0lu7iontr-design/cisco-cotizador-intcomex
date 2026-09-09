// ============================================================================
// CISCO AUTOMATED - CLOUDFLARE TURNSTILE CAPTCHA WIDGET (ISOLATED COMPONENT)
// Renders the interactive Cloudflare Turnstile challenge and controls access gating
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { TURNSTILE_SITE_KEY } from './turnstileService';

interface TurnstileWidgetProps {
  onSuccess: (token: string) => void;
  onError?: (error: string) => void;
  onExpire?: () => void;
  theme?: 'dark' | 'light' | 'auto';
  className?: string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        options: {
          sitekey: string;
          theme?: 'dark' | 'light' | 'auto';
          callback?: (token: string) => void;
          'error-callback'?: (errorCode: string) => void;
          'expired-callback'?: () => void;
          size?: 'normal' | 'compact' | 'flexible';
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

export function TurnstileWidget({
  onSuccess,
  onError,
  onExpire,
  theme = 'dark',
  className = '',
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [lastErrorCode, setLastErrorCode] = useState<string | null>(null);

  useEffect(() => {
    let isSubscribed = true;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const renderWidget = () => {
      if (!isSubscribed || !containerRef.current || !window.turnstile || widgetIdRef.current) return;

      try {
        // Clean container before rendering to avoid duplicate iframes on React re-renders
        containerRef.current.innerHTML = '';

        const id = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme,
          size: 'normal',
          callback: (token: string) => {
            if (!isSubscribed) return;
            setIsVerified(true);
            setWidgetError(null);
            setLastErrorCode(null);
            onSuccess(token);
          },
          'error-callback': (errorCode: string) => {
            if (!isSubscribed) return;
            console.warn('[Turnstile Widget Error Callback - Code]:', errorCode);
            setIsVerified(false);
            setLastErrorCode(errorCode || 'unknown');

            // Format message with exact errorCode
            let explanation = 'Desafío de seguridad no superado.';
            if (errorCode === '110600' || errorCode === '600000') {
              explanation = 'Dominio no autorizado en Cloudflare Dashboard (Error 110600). Agrega cisco-automated.pages.dev.';
            } else if (errorCode === '110200') {
              explanation = 'Site Key no válida o inactiva (Error 110200).';
            } else if (errorCode === '300030') {
              explanation = 'Fallo de red o conexión bloqueada (Error 300030).';
            }

            setWidgetError(`[Turnstile Error: ${errorCode || 'N/A'}] ${explanation}`);
            if (onError) onError(errorCode);
          },
          'expired-callback': () => {
            if (!isSubscribed) return;
            setIsVerified(false);
            setWidgetError('El desafío Turnstile expiró. Por favor verifícalo nuevamente.');
            if (onExpire) onExpire();
          },
        });

        widgetIdRef.current = id;
        setIsLoaded(true);
      } catch (err: any) {
        console.warn('[Turnstile Render Error]:', err);
        if (isSubscribed) {
          setWidgetError(`Error al inicializar Turnstile: ${err?.message || err}`);
        }
      }
    };

    // Passive polling: wait for window.turnstile loaded via index.html script tag
    if (window.turnstile) {
      renderWidget();
    } else {
      pollTimer = setInterval(() => {
        if (window.turnstile) {
          if (pollTimer) clearInterval(pollTimer);
          renderWidget();
        }
      }, 100);
    }

    return () => {
      isSubscribed = false;
      if (pollTimer) clearInterval(pollTimer);
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (_) {}
        widgetIdRef.current = null;
      }
    };
  }, [onSuccess, onError, onExpire, theme]);

  const handleManualRetry = () => {
    setWidgetError(null);
    setLastErrorCode(null);
    setIsVerified(false);
    if (widgetIdRef.current && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch (_) {
        // If reset fails, re-render
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
          widgetIdRef.current = null;
          if (window.turnstile) {
            try {
              const id = window.turnstile.render(containerRef.current, {
                sitekey: TURNSTILE_SITE_KEY,
                theme,
                size: 'normal',
                callback: (token: string) => {
                  setIsVerified(true);
                  setWidgetError(null);
                  onSuccess(token);
                },
                'error-callback': (code: string) => {
                  setLastErrorCode(code);
                  setWidgetError(`[Turnstile Error: ${code}] Desafío no superado.`);
                  if (onError) onError(code);
                },
              });
              widgetIdRef.current = id;
            } catch (_) {}
          }
        }
      }
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center space-y-2 py-1 ${className}`}>
      {/* Widget Container (Hidden dynamically once verified) */}
      <div
        ref={containerRef}
        className={isVerified ? 'hidden' : 'min-h-[65px] flex items-center justify-center overflow-hidden rounded-xl'}
        style={isVerified ? { display: 'none' } : undefined}
      />

      {/* Loading state before Turnstile iframe renders */}
      {!isLoaded && !widgetError && !isVerified && (
        <div className="flex items-center justify-center space-x-2 text-xs text-slate-400 py-3 font-mono">
          <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
          <span>Esperando script Cloudflare Turnstile...</span>
        </div>
      )}

      {/* Error state with exact error code & retry button */}
      {widgetError && (
        <div className="flex items-start justify-between w-full p-2.5 bg-rose-950/50 border border-rose-500/50 rounded-xl text-rose-200 text-xs gap-2">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="leading-snug">
              <span className="font-mono">{widgetError}</span>
              {lastErrorCode && (
                <div className="mt-1 text-[10px] text-rose-300/80 font-mono">
                  Error Code: <span className="font-bold text-rose-100">{lastErrorCode}</span>
                </div>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleManualRetry}
            className="p-1 text-rose-300 hover:text-white hover:bg-rose-900/60 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Reintentar verificación"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Verified indicator badge */}
      {isVerified && (
        <div className="inline-flex items-center gap-1.5 text-xs text-emerald-300 font-bold bg-emerald-950/60 border border-emerald-500/40 px-3.5 py-1.5 rounded-xl shadow-md animate-fadeIn">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Desafío de seguridad verificado</span>
        </div>
      )}
    </div>
  );
}
