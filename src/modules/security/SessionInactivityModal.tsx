// ============================================================================
// CISCO AUTOMATED - SESSION INACTIVITY TIMEOUT WARNING MODAL
// ============================================================================

import React from 'react';
import { ShieldAlert, Clock, RefreshCw } from 'lucide-react';

interface SessionInactivityModalProps {
  isOpen: boolean;
  secondsRemaining: number;
  onStayActive: () => void;
}

export function SessionInactivityModal({
  isOpen,
  secondsRemaining,
  onStayActive,
}: SessionInactivityModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl p-6 shadow-2xl shadow-amber-950/60 text-slate-100 flex flex-col items-center text-center animate-scaleUp">
        {/* Warning Icon Badge */}
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-4 animate-pulse">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <h2 className="text-lg font-black text-white tracking-tight">
          Aviso de Inactividad de Sesión
        </h2>
        <p className="text-xs text-slate-300 mt-2 leading-relaxed">
          No se ha detectado actividad en los últimos 30 minutos. Por políticas de seguridad corporativa, tu sesión se cerrará automáticamente en:
        </p>

        {/* Countdown Badge */}
        <div className="my-5 inline-flex items-center gap-2 px-5 py-2 rounded-2xl bg-amber-950/60 border border-amber-500/50 text-amber-300 font-mono text-xl font-bold">
          <Clock className="w-5 h-5 text-amber-400 animate-spin" />
          <span>{secondsRemaining}s</span>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={onStayActive}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm py-3 px-4 rounded-xl shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Continuar Trabajando</span>
        </button>
      </div>
    </div>
  );
}
