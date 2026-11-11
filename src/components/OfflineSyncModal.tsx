// ============================================================================
// CISCO AUTOMATED v2.11 - OFFLINE -> ONLINE SYNC CONFIRMATION MODAL
// Muestra resumen de cambios guardados localmente en el PC, advertencias de
// impacto en vistas/conflictos multi-usuario y progreso de subida a Firestore.
// ============================================================================

import React, { useEffect, useState } from 'react';
import {
  Wifi,
  WifiOff,
  AlertTriangle,
  UploadCloud,
  CheckCircle2,
  X,
  HardDrive,
  RefreshCw,
  ShieldAlert,
  Clock,
} from 'lucide-react';
import {
  getOfflineQueueSummary,
  flushOfflineQueue,
  OfflineQueueItem,
} from '../core/storage/offlineSyncQueue';
import {
  isNavigatorOffline,
  setManualOfflineMode,
} from '../core/storage/offlineModeManager';

interface OfflineSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncFinished?: (result: {
    wentOnline: boolean;
    uploadedCount: number;
    failedCount: number;
    remainingCount: number;
  }) => void;
}

export const OfflineSyncModal: React.FC<OfflineSyncModalProps> = ({
  isOpen,
  onClose,
  onSyncFinished,
}) => {
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);
  const [items, setItems] = useState<OfflineQueueItem[]>([]);
  const [byModule, setByModule] = useState<Record<string, number>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<{ processed: number; total: number; label?: string }>({
    processed: 0,
    total: 0,
  });
  const [errors, setErrors] = useState<string[]>([]);
  const [acknowledgedRisk, setAcknowledgedRisk] = useState(true);

  const loadSummary = async () => {
    setIsLoadingSummary(true);
    setErrors([]);
    try {
      const summary = await getOfflineQueueSummary();
      setItems(summary.items);
      setByModule(summary.byModule);
    } finally {
      setIsLoadingSummary(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadSummary();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const netOffline = isNavigatorOffline();
  const totalPending = items.length;

  const handleUploadAndGoOnline = async () => {
    if (netOffline) {
      setErrors(['No se detecta conexión a internet real en este equipo para subir los datos a Firestore.']);
      return;
    }

    setIsUploading(true);
    setErrors([]);
    setProgress({ processed: 0, total: totalPending });

    try {
      const result = await flushOfflineQueue({
        forceEvenIfManualOffline: true,
        onProgress: (processed, total, currentItem) => {
          setProgress({
            processed,
            total,
            label: currentItem?.summary || currentItem?.moduleLabel,
          });
        },
      });

      if (result.failedCount === 0) {
        setManualOfflineMode(false);
        onSyncFinished?.({
          wentOnline: true,
          uploadedCount: result.successCount,
          failedCount: 0,
          remainingCount: 0,
        });
        onClose();
      } else {
        setErrors(result.errors);
        await loadSummary();
        onSyncFinished?.({
          wentOnline: false,
          uploadedCount: result.successCount,
          failedCount: result.failedCount,
          remainingCount: result.remainingCount,
        });
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleGoOnlineWithoutUpload = () => {
    setManualOfflineMode(false);
    onSyncFinished?.({
      wentOnline: true,
      uploadedCount: 0,
      failedCount: 0,
      remainingCount: totalPending,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center">
              <Wifi className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">
                Pasar a Modo Online y Sincronizar Cambios del PC
              </h3>
              <p className="text-[11px] text-slate-400">
                Revisa las modificaciones locales respaldadas y las advertencias antes de subir a la nube
              </p>
            </div>
          </div>
          {!isUploading && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar text-xs">
          {/* Network warning if physical net is down */}
          {netOffline && (
            <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-600/50 text-rose-200 flex items-start space-x-2.5">
              <WifiOff className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Sin conexión real a internet detectada</div>
                <p className="text-[11px] text-rose-300/90 mt-0.5">
                  El sistema operativo reporta estar sin red. Conecta internet antes de intentar subir cambios a Firebase Firestore.
                </p>
              </div>
            </div>
          )}

          {/* Pending changes summary */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <HardDrive className="w-4 h-4 text-amber-400" />
                <span className="font-bold text-slate-200">
                  Cambios Guardados en tu PC Durante Modo Offline
                </span>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border ${
                  totalPending > 0
                    ? 'bg-amber-950/70 text-amber-300 border-amber-700/60'
                    : 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50'
                }`}
              >
                {isLoadingSummary ? 'Leyendo...' : `${totalPending} pendientes`}
              </span>
            </div>

            {totalPending === 0 && !isLoadingSummary ? (
              <div className="flex items-center space-x-2 text-emerald-300/90 py-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  No hay modificaciones pendientes por subir a la nube. Puedes activar el Modo Online de inmediato.
                </span>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(byModule).map(([moduleName, count]) => (
                    <span
                      key={moduleName}
                      className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700/80 text-[11px] font-bold text-slate-200"
                    >
                      {moduleName}: <span className="text-amber-400">{count}</span>
                    </span>
                  ))}
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                  {items.map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800/80 text-[11px]"
                    >
                      <div className="truncate pr-3">
                        <span className="font-bold text-indigo-300 mr-2">
                          [{it.moduleLabel || it.action}]
                        </span>
                        <span className="text-slate-200">{it.summary || it.action}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 shrink-0 flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(it.createdAt).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Conflict & View Impact Warnings */}
          <div className="bg-amber-950/30 border border-amber-700/50 rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center space-x-2 text-amber-300 font-black uppercase tracking-wide text-[11px]">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Advertencias sobre Vistas y Posibles Conflictos al Volver Online</span>
            </div>

            <ul className="space-y-2 text-[11px] text-amber-100/90 leading-relaxed">
              <li className="flex items-start space-x-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Sobrescritura de ediciones de otros usuarios:</strong> Si otro PM editó en la nube un Estimate, Deal del Pipeline, Forecast o Tracking BO mientras estabas Offline, los datos locales subidos actualizarán esos mismos registros según última escritura.
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Recálculo automático de vistas y KPIs:</strong> Al activar Online, las vistas de Dashboard, Pipeline, Forecast, Tracking BO e Historial recargarán registros desde Firebase Firestore y recalcularán montos USD, márgenes y contadores en vivo.
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Versionado de Estimates y planillas Excel:</strong> Si cotizaste o guardaste versiones Offline de un Estimate existente, se sincronizarán sus versiones pendientes; revisa luego el historial si alguien subió otra versión en paralelo.
                </span>
              </li>
              <li className="flex items-start space-x-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">No cerrar durante el envío:</strong> Si decides subir {totalPending > 0 ? `los ${totalPending} cambios` : 'los cambios'} ahora, espera a que la barra de progreso finalice por completo.
                </span>
              </li>
            </ul>

            {totalPending > 0 && (
              <label className="flex items-center space-x-2 pt-2 border-t border-amber-800/40 cursor-pointer text-[11px] text-amber-200 font-semibold">
                <input
                  type="checkbox"
                  checked={acknowledgedRisk}
                  onChange={(e) => setAcknowledgedRisk(e.target.checked)}
                  className="rounded border-amber-600 bg-slate-900 text-indigo-500 focus:ring-indigo-500"
                />
                <span>Comprendo el impacto en las vistas compartidas y autorizo la sincronización con Firestore.</span>
              </label>
            )}
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="p-4 rounded-2xl bg-indigo-950/50 border border-indigo-700/50 space-y-2">
              <div className="flex items-center justify-between text-indigo-200 font-bold">
                <span className="flex items-center space-x-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Subiendo a Firebase Firestore: {progress.label || 'Sincronizando...'}</span>
                </span>
                <span>
                  {progress.processed} / {progress.total}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
                  style={{
                    width: `${
                      progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0
                    }%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Upload Errors */}
          {errors.length > 0 && (
            <div className="p-3.5 rounded-2xl bg-rose-950/60 border border-rose-600/50 text-rose-200 space-y-1">
              <div className="font-bold text-rose-300">
                Algunos cambios no pudieron subirse (permanecen respaldados en tu PC):
              </div>
              <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                {errors.slice(0, 5).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isUploading}
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
          >
            Seguir Offline
          </button>

          {totalPending > 0 ? (
            <>
              <button
                type="button"
                disabled={isUploading}
                onClick={handleGoOnlineWithoutUpload}
                className="px-4 py-2 rounded-xl bg-amber-950/70 hover:bg-amber-900/80 text-amber-300 border border-amber-700/50 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
                title="Cambia a Online pero deja estos cambios en espera dentro de tu PC para subirlos luego"
              >
                Volver Online sin Subir Ahora
              </button>

              <button
                type="button"
                disabled={isUploading || netOffline || !acknowledgedRisk}
                onClick={handleUploadAndGoOnline}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black flex items-center space-x-1.5 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Subir {totalPending} Cambios y Volver Online</span>
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={netOffline}
              onClick={handleGoOnlineWithoutUpload}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-black flex items-center space-x-1.5 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer"
            >
              <Wifi className="w-4 h-4" />
              <span>Activar Modo Online</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
