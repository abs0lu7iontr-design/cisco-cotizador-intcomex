// ============================================================================
// CISCO AUTOMATED v2.3 - PRIOR AUDIT & CUSTOM LINE PARAMETERS DETECTED MODAL
// ============================================================================

import React from 'react';
import {
  AlertTriangle,
  RefreshCw,
  SlidersHorizontal,
  ShieldCheck,
  RotateCcw,
  Sliders,
  CheckCircle2,
} from 'lucide-react';
import { DetectedAuditInfo } from '../core/types';

interface PriorAuditDetectedModalProps {
  isOpen: boolean;
  detectedAudit: DetectedAuditInfo | null;
  onLoadPriorMargins: () => void;
  onRestoreOriginal?: () => void;
  onModifyMargins: () => void;
}

export function PriorAuditDetectedModal({
  isOpen,
  detectedAudit,
  onLoadPriorMargins,
  onRestoreOriginal,
  onModifyMargins,
}: PriorAuditDetectedModalProps) {
  if (!isOpen || !detectedAudit) return null;

  const formatPct = (val?: number) => {
    if (val === undefined || val === null || isNaN(val)) return '0%';
    const num = val > 0 && val <= 1 ? val * 100 : val;
    return `${Math.round(num * 10) / 10}%`;
  };

  const intFormatted = formatPct(detectedAudit.previousInternacionPct);
  const marFormatted = formatPct(detectedAudit.previousMarginPct);

  const hasCustomLines = Boolean(
    detectedAudit.hasCustomLineParams &&
      detectedAudit.lineCustomParams &&
      Object.keys(detectedAudit.lineCustomParams).length > 0
  );

  const customLineEntries = hasCustomLines
    ? Object.entries(detectedAudit.lineCustomParams!)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl overflow-hidden">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-amber-600/20 via-amber-500/10 to-transparent p-6 border-b border-amber-500/20">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-2xl text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  {hasCustomLines
                    ? 'Cotización con Parámetros Custom por Línea Detectada'
                    : 'Cotización Previamente Procesada Detectada'}
                </h3>
                {hasCustomLines && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Modo Custom
                  </span>
                )}
              </div>
              <p className="text-xs text-amber-300/80 mt-1">
                {hasCustomLines
                  ? 'Este archivo fue procesado con tasas de internación, arancel o márgenes específicos por línea.'
                  : 'Este archivo ya fue calculado previamente en Cisco Automated.'}
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Global / Base Parameters Snapshot */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Parámetros Generales Guardados:
            </span>
            <div className="flex items-center gap-4 text-sm font-semibold">
              <div className="flex items-center gap-2 text-indigo-300">
                <span className="text-slate-400 text-xs">Internación Base:</span>
                <span className="px-2 py-0.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-200 font-mono">
                  {intFormatted}
                </span>
              </div>
              <span className="text-slate-600">|</span>
              <div className="flex items-center gap-2 text-emerald-300">
                <span className="text-slate-400 text-xs">Margen Base:</span>
                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 font-mono">
                  {marFormatted}
                </span>
              </div>
            </div>
          </div>

          {/* Custom Lines Breakdown Table */}
          {hasCustomLines && (
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-indigo-500/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                  Reglas por Línea / Bloque Madre ({customLineEntries.length}):
                </span>
                <span className="text-[10px] text-slate-400">Heredado a sub-líneas</span>
              </div>

              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {customLineEntries.map(([motherKey, lineParams]) => (
                  <div
                    key={motherKey}
                    className="flex items-center justify-between p-2 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                  >
                    <span className="font-mono font-bold text-white flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px]">
                        Línea {motherKey}
                      </span>
                    </span>

                    <div className="flex items-center gap-2 font-mono text-[11px]">
                      {lineParams.internacionPct !== undefined && (
                        <span className="text-indigo-300">
                          Int: <strong className="text-white">{lineParams.internacionPct}%</strong>
                        </span>
                      )}
                      {lineParams.arancelPct !== undefined && (
                        <span className="text-purple-300">
                          Ar: <strong className="text-white">{lineParams.arancelPct}%</strong>
                        </span>
                      )}
                      {lineParams.margenPct !== undefined && (
                        <span className="text-emerald-300">
                          Mg: <strong className="text-white">{lineParams.margenPct}%</strong>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 text-xs leading-relaxed">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            <span>
              Los costos netos originales de fábrica fueron{' '}
              <strong>restaurados automáticamente</strong> para evitar doble margen o internación acumulada.
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            ¿Cómo deseas proceder con el recálculo de esta cotización?
          </p>
        </div>

        {/* Action Buttons */}
        <div className="p-5 bg-slate-950/60 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          {onRestoreOriginal && (
            <button
              type="button"
              onClick={onRestoreOriginal}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer border border-slate-700"
              title="Restaurar a parámetros estándar CCW (7% Int, 6% Ar, 5% Margen)"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Restaurar Original Sin Editar</span>
            </button>
          )}

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onModifyMargins}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer border border-slate-700"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
              <span>Modificar Parámetros</span>
            </button>

            <button
              type="button"
              onClick={onLoadPriorMargins}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
            >
              {hasCustomLines ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-200" />
                  <span>Usar Parámetros Custom Guardados</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-indigo-200" />
                  <span>Cargar Márgenes del Archivo</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
