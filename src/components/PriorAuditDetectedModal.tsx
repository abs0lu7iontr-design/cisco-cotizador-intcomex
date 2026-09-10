// ============================================================================
// CISCO AUTOMATED v2.1 - PRIOR AUDIT DETECTED MODAL
// ============================================================================

import React from 'react';
import { AlertTriangle, RefreshCw, SlidersHorizontal, ShieldCheck } from 'lucide-react';
import { DetectedAuditInfo } from '../core/types';

interface PriorAuditDetectedModalProps {
  isOpen: boolean;
  detectedAudit: DetectedAuditInfo | null;
  onLoadPriorMargins: () => void;
  onModifyMargins: () => void;
}

export function PriorAuditDetectedModal({
  isOpen,
  detectedAudit,
  onLoadPriorMargins,
  onModifyMargins,
}: PriorAuditDetectedModalProps) {
  if (!isOpen || !detectedAudit) return null;

  const formatPct = (val: number) => {
    const num = val > 0 && val <= 1 ? val * 100 : val;
    return `${Math.round(num)}%`;
  };

  const intFormatted = formatPct(detectedAudit.previousInternacionPct);
  const marFormatted = formatPct(detectedAudit.previousMarginPct);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header Ribbon */}
        <div className="bg-gradient-to-r from-amber-600/20 via-amber-500/10 to-transparent p-6 border-b border-amber-500/20">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-400 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Cotización Previamente Procesada Detectada
              </h3>
              <p className="text-xs text-amber-300/80 mt-1">
                Este archivo ya fue calculado en Cisco Automated.
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Configuración previa detectada:
            </span>
            <div className="flex items-center gap-4 text-sm font-semibold">
              <div className="flex items-center gap-2 text-indigo-300">
                <span className="text-slate-400 text-xs">Internación:</span>
                <span className="px-2 py-0.5 rounded bg-indigo-500/20 border border-indigo-500/30 text-indigo-200 font-mono">
                  {intFormatted}
                </span>
              </div>
              <span className="text-slate-600">|</span>
              <div className="flex items-center gap-2 text-emerald-300">
                <span className="text-slate-400 text-xs">Margen:</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-200 font-mono">
                  {marFormatted}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-emerald-300 text-xs leading-relaxed">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            <span>
              Los costos netos de fábrica fueron <strong>restaurados automáticamente</strong> para evitar doble margen.
            </span>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            ¿Cómo deseas proceder con el recálculo de esta cotización?
          </p>
        </div>

        {/* Action Buttons */}
        <div className="p-6 pt-2 bg-slate-950/40 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-end gap-3">
          <button
            type="button"
            onClick={onModifyMargins}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer border border-slate-700"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span>Modificar márgenes</span>
          </button>
          <button
            type="button"
            onClick={onLoadPriorMargins}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-indigo-200" />
            <span>Cargar márgenes del archivo</span>
          </button>
        </div>
      </div>
    </div>
  );
}
