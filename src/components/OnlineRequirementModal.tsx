// ============================================================================
// CISCO AUTOMATED v2.15.2 - ONLINE REQUIREMENT MODAL
// Prompts the user when attempting to access cloud-only modules while offline
// ============================================================================

import React from 'react';
import { Cloud, Wifi, WifiOff, ArrowRight, X, ShieldAlert, Sparkles } from 'lucide-react';

interface OnlineRequirementModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
  isNavigatorOffline: boolean;
  onSwitchToOnline: () => void;
}

export const OnlineRequirementModal: React.FC<OnlineRequirementModalProps> = ({
  isOpen,
  onClose,
  featureName = 'Este módulo',
  isNavigatorOffline,
  onSwitchToOnline,
}) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="online-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
    >
      <div className="relative w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-3xl p-6 shadow-2xl overflow-hidden animate-scale-up">
        {/* Glow ambient background */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          aria-label="Cerrar modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon Header */}
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-300 flex items-center justify-center shrink-0 shadow-lg shadow-amber-950/50">
            {isNavigatorOffline ? <WifiOff className="w-6 h-6" /> : <Cloud className="w-6 h-6" />}
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20">
              {isNavigatorOffline ? 'Sin Conexión de Red' : 'Función Exclusiva Online'}
            </span>
            <h3 id="online-modal-title" className="text-base font-black text-white mt-1">
              Conexión Requerida
            </h3>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-3 text-xs text-slate-300 leading-relaxed mb-6">
          <p>
            El módulo <strong className="text-white underline decoration-amber-400">{featureName}</strong>{' '}
            requiere conexión activa a la nube (Firebase Firestore / IA en vivo) para consultar o sincronizar datos.
          </p>

          {isNavigatorOffline ? (
            <div className="p-3 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs flex items-start space-x-2.5">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>
                No se detecta conexión a Internet en este computador. Conecta tu equipo a una red Wi-Fi o cable de red para utilizar esta función.
              </span>
            </div>
          ) : (
            <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 text-slate-300 text-xs flex items-start space-x-2.5">
              <Wifi className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Detectamos que tu equipo tiene acceso a Internet, pero actualmente estás en <strong className="text-amber-300">Modo Offline Manual</strong>.
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-3 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {isNavigatorOffline ? 'Cerrar' : 'Permanecer Offline'}
          </button>

          {!isNavigatorOffline && (
            <button
              type="button"
              onClick={() => {
                onSwitchToOnline();
                onClose();
              }}
              className="px-5 py-2.5 rounded-xl text-xs font-black bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 flex items-center space-x-2 shadow-lg shadow-amber-950/50 cursor-pointer transition-all transform active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-slate-950" />
              <span>Pasar a Modo Online y Abrir</span>
              <ArrowRight className="w-4 h-4 text-slate-950" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
