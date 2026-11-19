// ============================================================================
// CISCO AUTOMATED - CENTRALIZED TOAST NOTIFICATION SYSTEM (v2.22.0)
// Universal notification queue with stacking, animations, auto-dismiss,
// and cross-module dispatching (React Context + window events).
// ============================================================================

import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  X,
  Sparkles,
} from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  text: string;
  type: ToastType;
  duration: number;
  timestamp: number;
}

export interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (text: string, type?: ToastType, duration?: number) => string;
  showSuccess: (text: string, duration?: number) => string;
  showError: (text: string, duration?: number) => string;
  showWarning: (text: string, duration?: number) => string;
  showInfo: (text: string, duration?: number) => string;
  dismissToast: (id: string) => void;
  clearAllToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATIONS: Record<ToastType, number> = {
  success: 3500,
  info: 4000,
  warning: 5000,
  error: 6000,
};

const TOAST_ICONS: Record<ToastType, React.FC<{ className?: string }>> = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const TOAST_STYLES: Record<
  ToastType,
  {
    bg: string;
    border: string;
    text: string;
    badgeBg: string;
    progressBg: string;
  }
> = {
  success: {
    bg: 'bg-slate-900/95 backdrop-blur-md',
    border: 'border-emerald-500/40 shadow-emerald-500/10',
    text: 'text-emerald-300',
    badgeBg: 'bg-emerald-500/15 text-emerald-400',
    progressBg: 'bg-emerald-500',
  },
  error: {
    bg: 'bg-slate-900/95 backdrop-blur-md',
    border: 'border-rose-500/40 shadow-rose-500/10',
    text: 'text-rose-300',
    badgeBg: 'bg-rose-500/15 text-rose-400',
    progressBg: 'bg-rose-500',
  },
  warning: {
    bg: 'bg-slate-900/95 backdrop-blur-md',
    border: 'border-amber-500/40 shadow-amber-500/10',
    text: 'text-amber-300',
    badgeBg: 'bg-amber-500/15 text-amber-400',
    progressBg: 'bg-amber-500',
  },
  info: {
    bg: 'bg-slate-900/95 backdrop-blur-md',
    border: 'border-indigo-500/40 shadow-indigo-500/10',
    text: 'text-indigo-300',
    badgeBg: 'bg-indigo-500/15 text-indigo-400',
    progressBg: 'bg-indigo-500',
  },
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismissToast = useCallback((id: string) => {
    if (timeoutsRef.current[id]) {
      clearTimeout(timeoutsRef.current[id]);
      delete timeoutsRef.current[id];
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    Object.values(timeoutsRef.current).forEach(clearTimeout);
    timeoutsRef.current = {};
    setToasts([]);
  }, []);

  const showToast = useCallback(
    (text: string, type: ToastType = 'success', duration?: number): string => {
      if (!text || typeof text !== 'string') return '';
      const cleanText = text.trim();
      if (!cleanText) return '';

      const id = 'toast_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6);
      const effectiveDuration = duration && duration > 0 ? duration : DEFAULT_DURATIONS[type];

      const newItem: ToastItem = {
        id,
        text: cleanText,
        type,
        duration: effectiveDuration,
        timestamp: Date.now(),
      };

      setToasts((prev) => {
        // Limitar la cola activa a máximo 5 toasts simultáneos para no saturar la pantalla
        const next = [...prev, newItem];
        if (next.length > 5) {
          const removed = next.shift();
          if (removed && timeoutsRef.current[removed.id]) {
            clearTimeout(timeoutsRef.current[removed.id]);
            delete timeoutsRef.current[removed.id];
          }
        }
        return next;
      });

      // Programar auto-dismiss
      timeoutsRef.current[id] = setTimeout(() => {
        dismissToast(id);
      }, effectiveDuration);

      return id;
    },
    [dismissToast]
  );

  const showSuccess = useCallback((text: string, duration?: number) => showToast(text, 'success', duration), [showToast]);
  const showError = useCallback((text: string, duration?: number) => showToast(text, 'error', duration), [showToast]);
  const showWarning = useCallback((text: string, duration?: number) => showToast(text, 'warning', duration), [showToast]);
  const showInfo = useCallback((text: string, duration?: number) => showToast(text, 'info', duration), [showToast]);

  // Listener para eventos globales de toast ('cisco-toast') fuera del ciclo de vida de React
  useEffect(() => {
    const handleGlobalToast = (e: Event) => {
      const customEvent = e as CustomEvent<{ text: string; type?: ToastType; duration?: number }>;
      if (customEvent.detail && customEvent.detail.text) {
        showToast(customEvent.detail.text, customEvent.detail.type || 'info', customEvent.detail.duration);
      }
    };

    window.addEventListener('cisco-toast', handleGlobalToast as EventListener);
    return () => {
      window.removeEventListener('cisco-toast', handleGlobalToast as EventListener);
      Object.values(timeoutsRef.current).forEach(clearTimeout);
    };
  }, [showToast]);

  return (
    <ToastContext.Provider
      value={{
        toasts,
        showToast,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        dismissToast,
        clearAllToasts,
      }}
    >
      {children}

      {/* Contenedor Flotante Global de Toasts */}
      <div
        className="fixed bottom-20 md:bottom-6 right-0 md:right-6 z-[99999] flex flex-col gap-2.5 max-w-sm w-full px-4 pointer-events-none transition-all duration-300"
        aria-live="polite"
        role="region"
        aria-label="Notificaciones del sistema"
      >
        {toasts.map((toast) => {
          const style = TOAST_STYLES[toast.type];
          const Icon = TOAST_ICONS[toast.type];

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl border shadow-xl ${style.bg} ${style.border} animate-in fade-in slide-in-from-bottom-3 duration-200 transition-all`}
              role="alert"
            >
              <div className={`p-1 rounded-lg shrink-0 ${style.badgeBg}`}>
                <Icon className={`w-4 h-4 ${style.text}`} />
              </div>

              <div className="flex-1 min-w-0 pr-1">
                <p className="text-xs text-slate-100 font-medium leading-relaxed break-words">
                  {toast.text}
                </p>
              </div>

              <button
                onClick={() => dismissToast(toast.id)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors shrink-0 cursor-pointer"
                title="Cerrar notificación"
                aria-label="Cerrar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

/**
 * Hook universal para disparar notificaciones toast reactivas en cualquier componente.
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    // Fallback de contingencia si se usa fuera del Provider
    return {
      toasts: [],
      showToast: (text: string, type: ToastType = 'info') => {
        triggerGlobalToast(text, type);
        return '';
      },
      showSuccess: (text: string) => {
        triggerGlobalToast(text, 'success');
        return '';
      },
      showError: (text: string) => {
        triggerGlobalToast(text, 'error');
        return '';
      },
      showWarning: (text: string) => {
        triggerGlobalToast(text, 'warning');
        return '';
      },
      showInfo: (text: string) => {
        triggerGlobalToast(text, 'info');
        return '';
      },
      dismissToast: () => {},
      clearAllToasts: () => {},
    };
  }
  return context;
}

/**
 * Emite una notificación toast global desde cualquier función JavaScript,
 * servicio de base de datos o listener fuera del árbol de componentes de React.
 */
export function triggerGlobalToast(text: string, type: ToastType = 'info', duration?: number): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent('cisco-toast', {
      detail: { text, type, duration },
    })
  );
}
