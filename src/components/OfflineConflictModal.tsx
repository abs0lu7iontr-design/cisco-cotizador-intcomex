// ============================================================================
// CISCO AUTOMATED v2.22.0 - OFFLINE CONFLICT RESOLUTION MODAL
// Side-by-side visual diff of remote cloud vs local offline changes.
// Gives the user 3 clear resolution paths: Keep Cloud, Overwrite, or Fork Version.
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Cloud,
  HardDrive,
  GitFork,
  ArrowRight,
  CheckCircle2,
  X,
  FileSpreadsheet,
  Clock,
  User,
  ShieldAlert,
  ChevronRight,
} from 'lucide-react';
import {
  OfflineConflictItem,
  ConflictResolutionMode,
  resolveOfflineConflict,
} from '../core/storage/offlineConflictDetector';

interface OfflineConflictModalProps {
  conflicts: OfflineConflictItem[];
  isOpen: boolean;
  onClose: () => void;
  onAllResolved: () => void;
}

export const OfflineConflictModal: React.FC<OfflineConflictModalProps> = ({
  conflicts,
  isOpen,
  onClose,
  onAllResolved,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionFeedback, setResolutionFeedback] = useState<string | null>(null);

  const currentConflict = conflicts[currentIndex];

  useEffect(() => {
    if (isOpen && conflicts.length > 0 && !currentConflict) {
      onAllResolved();
    }
  }, [isOpen, conflicts.length, currentConflict, onAllResolved]);

  if (!isOpen || conflicts.length === 0 || !currentConflict) return null;

  const handleResolve = async (mode: ConflictResolutionMode) => {
    setIsResolving(true);
    setResolutionFeedback(null);
    try {
      const res = await resolveOfflineConflict(currentConflict, mode);
      if (res.success) {
        setResolutionFeedback(res.message);
        setTimeout(() => {
          setResolutionFeedback(null);
          if (currentIndex + 1 < conflicts.length) {
            setCurrentIndex((prev) => prev + 1);
          } else {
            onAllResolved();
          }
        }, 1200);
      } else {
        setResolutionFeedback(`❌ ${res.message}`);
      }
    } finally {
      setIsResolving(false);
    }
  };

  const fmtCurrency = (val?: number) => {
    if (val === undefined || isNaN(val)) return 'N/A';
    return (
      '$' +
      val.toLocaleString('es-CL', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) +
      ' USD'
    );
  };

  return (
    <div
      className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-slate-900 border border-amber-500/40 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
        {/* Cabecera del Conflicto */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl border border-amber-500/30">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-700/50">
                  Conflicto de Sincronización ({currentIndex + 1} de {conflicts.length})
                </span>
              </div>
              <h2 className="text-lg font-black text-white mt-1">
                {currentConflict.entityTitle}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            title="Posponer resolución"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Motivo de la Discrepancia */}
        <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-start space-x-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="leading-relaxed">{currentConflict.conflictReason}</p>
        </div>

        {/* Comparativa Lado a Lado (Nube vs Local Offline) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tarjeta Versión Remota en la Nube */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-cyan-500/30 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-cyan-400 border-b border-slate-800/80 pb-2">
              <span className="flex items-center space-x-1.5">
                <Cloud className="w-4 h-4 text-cyan-400" />
                <span>Versión en la Nube (Remota)</span>
              </span>
              {currentConflict.remote.versionTag && (
                <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-600/40 text-[10px]">
                  {currentConflict.remote.versionTag}
                </span>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Modificado por:</span>
                <strong className="text-white font-medium truncate max-w-[150px]">
                  {currentConflict.remote.author}
                </strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Fecha:</span>
                <span className="text-slate-200 font-mono text-[11px]">
                  {currentConflict.remote.timestamp}
                </span>
              </div>
              {currentConflict.remote.amountUsd !== undefined && (
                <div className="flex justify-between text-slate-400">
                  <span>Monto Total:</span>
                  <strong className="text-cyan-300 font-mono">
                    {fmtCurrency(currentConflict.remote.amountUsd)}
                  </strong>
                </div>
              )}
              {currentConflict.remote.itemsCount !== undefined && (
                <div className="flex justify-between text-slate-400">
                  <span>Líneas BOM:</span>
                  <span className="text-slate-200">{currentConflict.remote.itemsCount} ítems</span>
                </div>
              )}
              {currentConflict.remote.stageOrStatus && (
                <div className="flex justify-between text-slate-400">
                  <span>Etapa / Estado:</span>
                  <span className="text-cyan-300 font-bold">
                    {currentConflict.remote.stageOrStatus}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Tarjeta Versión Local Offline */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-indigo-500/30 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-indigo-400 border-b border-slate-800/80 pb-2">
              <span className="flex items-center space-x-1.5">
                <HardDrive className="w-4 h-4 text-indigo-400" />
                <span>Tu Versión Local (Offline)</span>
              </span>
              {currentConflict.local.versionTag && (
                <span className="px-2 py-0.5 rounded bg-indigo-950 border border-indigo-600/40 text-[10px]">
                  {currentConflict.local.versionTag}
                </span>
              )}
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Modificado por:</span>
                <strong className="text-white font-medium truncate max-w-[150px]">
                  {currentConflict.local.author}
                </strong>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Guardado en PC:</span>
                <span className="text-slate-200 font-mono text-[11px]">
                  {currentConflict.local.timestamp}
                </span>
              </div>
              {currentConflict.local.amountUsd !== undefined && (
                <div className="flex justify-between text-slate-400">
                  <span>Monto Total:</span>
                  <strong className="text-indigo-300 font-mono">
                    {fmtCurrency(currentConflict.local.amountUsd)}
                  </strong>
                </div>
              )}
              {currentConflict.local.itemsCount !== undefined && (
                <div className="flex justify-between text-slate-400">
                  <span>Líneas BOM:</span>
                  <span className="text-slate-200">{currentConflict.local.itemsCount} ítems</span>
                </div>
              )}
              {currentConflict.local.stageOrStatus && (
                <div className="flex justify-between text-slate-400">
                  <span>Etapa / Estado:</span>
                  <span className="text-indigo-300 font-bold">
                    {currentConflict.local.stageOrStatus}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Feedback de Resolución */}
        {resolutionFeedback && (
          <div className="p-3 rounded-xl bg-slate-800/80 text-emerald-300 border border-emerald-500/30 text-xs flex items-center space-x-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{resolutionFeedback}</span>
          </div>
        )}

        {/* Opciones de Resolución (3 Caminos) */}
        <div className="border-t border-slate-800 pt-4 space-y-2.5">
          <p className="text-xs font-bold text-slate-300">
            ¿Cómo deseas resolver este conflicto?
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Opción 1: Guardar como Nueva Versión (Recomendada) */}
            <button
              disabled={isResolving}
              onClick={() => handleResolve('fork_version')}
              className="p-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex flex-col items-center justify-center text-center gap-1.5 transition-all shadow-lg hover:shadow-indigo-500/25 cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center space-x-1.5">
                <GitFork className="w-4 h-4 text-amber-300" />
                <span>Bifurcar Versión</span>
              </div>
              <span className="text-[10px] font-normal text-indigo-100">
                (Recomendado: Cero Pérdida)
              </span>
            </button>

            {/* Opción 2: Sobrescribir con Versión Local */}
            <button
              disabled={isResolving}
              onClick={() => handleResolve('overwrite_local')}
              className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center space-x-1.5">
                <HardDrive className="w-4 h-4 text-amber-400" />
                <span>Sobrescribir Nube</span>
              </div>
              <span className="text-[10px] font-normal text-slate-400">
                (Usar tu versión local)
              </span>
            </button>

            {/* Opción 3: Conservar Nube */}
            <button
              disabled={isResolving}
              onClick={() => handleResolve('keep_cloud')}
              className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold flex flex-col items-center justify-center text-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center space-x-1.5">
                <Cloud className="w-4 h-4 text-cyan-400" />
                <span>Conservar Nube</span>
              </div>
              <span className="text-[10px] font-normal text-slate-400">
                (Descartar copia offline)
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
