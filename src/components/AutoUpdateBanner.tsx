// ============================================================================
// CISCO AUTOMATED - FLOATING AUTO-UPDATE NOTIFICATION BANNER
// Notifica en tiempo real cuando hay una nueva versión disponible y permite
// actualizar en 1 solo clic o aplicar automáticamente al reiniciar / cerrar sesión.
// ============================================================================

import React, { useState } from 'react';
import { Sparkles, DownloadCloud, RefreshCw, X, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAutoUpdate, applyUpdateNow } from '../core/autoUpdateManager';
import { isDesktopApp } from '../core/desktopBridge';

export const AutoUpdateBanner: React.FC = () => {
  const { hasUpdate, latestVersion, currentVersion, releaseNotes, isApplying } = useAutoUpdate();
  const [isDismissed, setIsDismissed] = useState(false);

  if (!hasUpdate || isDismissed) {
    return null;
  }

  const handleApply = async () => {
    await applyUpdateNow();
  };

  return (
    <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 border-b border-indigo-500/40 px-4 py-2 text-white shadow-2xl relative z-50 animate-fade-in">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-400/40 flex items-center justify-center text-indigo-300 shadow-inner">
            <Sparkles className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-black uppercase tracking-wider text-indigo-300">
                Nueva Actualización Disponible
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                v{latestVersion}
              </span>
              <span className="text-[10px] text-slate-400">
                (Actual: v{currentVersion})
              </span>
            </div>
            <p className="text-[11px] text-slate-300 line-clamp-1 max-w-2xl">
              {releaseNotes || 'Mejoras de rendimiento, seguridad y nuevas funciones.'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <span className="text-[10px] text-slate-400 hidden sm:inline">
            Se actualizará automáticamente al reiniciar o cerrar sesión
          </span>
          <button
            type="button"
            onClick={handleApply}
            disabled={isApplying}
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-900/30 flex items-center space-x-1.5 cursor-pointer transition-all disabled:opacity-50"
          >
            {isApplying ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Actualizando...</span>
              </>
            ) : (
              <>
                <DownloadCloud className="w-3.5 h-3.5" />
                <span>{isDesktopApp() ? 'Actualizar en 1 Clic' : 'Recargar y Actualizar'}</span>
                <ArrowRight className="w-3 h-3" />
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            title="Cerrar aviso temporalmente"
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
