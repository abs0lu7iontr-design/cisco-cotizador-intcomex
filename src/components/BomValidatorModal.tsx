// ============================================================================
// CISCO AUTOMATED - BOM PREDICTIVE VALIDATOR MODAL
// ============================================================================

import React from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Info,
  Sparkles,
  X,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { BomValidationReport } from '../core/bomValidator';

interface BomValidatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: BomValidationReport | null;
}

export const BomValidatorModal: React.FC<BomValidatorModalProps> = ({
  isOpen,
  onClose,
  report,
}) => {
  if (!isOpen || !report) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded-2xl ${
              report.warningsCount > 0
                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
            }`}>
              {report.warningsCount > 0 ? (
                <ShieldAlert className="w-5 h-5" />
              ) : (
                <CheckCircle2 className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="text-base font-black text-white tracking-tight flex items-center gap-2">
                <span>Auditor Predictivo de BOM Cisco</span>
                {report.warningsCount > 0 ? (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-700/50">
                    {report.totalIssuesCount} hallazgo{report.totalIssuesCount > 1 ? 's' : ''}
                  </span>
                ) : (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                    100% Conforme
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                Verificación automática de completitud técnica (DNA, licencias Meraki, cables y contratos).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar flex-1">
          {report.issues.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto animate-pulse" />
              <h4 className="text-sm font-bold text-white">¡Lista de Materiales Impecable!</h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                No se detectaron inconsistencias de preventa. Las licencias requeridas, accesorios y soporte están correctamente contemplados.
              </p>
            </div>
          ) : (
            report.issues.map((issue) => (
              <div
                key={issue.id}
                className={`p-4 rounded-2xl border space-y-2.5 transition-all ${
                  issue.severity === 'warning'
                    ? 'bg-amber-950/20 border-amber-500/40'
                    : issue.severity === 'info'
                    ? 'bg-sky-950/20 border-sky-500/30'
                    : 'bg-indigo-950/20 border-indigo-500/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center space-x-2">
                    {issue.severity === 'warning' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    ) : (
                      <Info className="w-4 h-4 text-sky-400 shrink-0" />
                    )}
                    <h5 className="text-xs font-bold text-white">{issue.title}</h5>
                  </div>
                  <span
                    className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${
                      issue.severity === 'warning'
                        ? 'bg-amber-950 text-amber-300 border-amber-600/40'
                        : 'bg-sky-950 text-sky-300 border-sky-600/40'
                    }`}
                  >
                    {issue.severity === 'warning' ? 'Revisar' : 'Sugerencia'}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">{issue.description}</p>

                {issue.affectedPartNumbers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {issue.affectedPartNumbers.map((pn) => (
                      <span
                        key={pn}
                        className="font-mono text-[10px] px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 font-bold"
                      >
                        {pn}
                      </span>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                  <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Acción recomendada: {issue.suggestedAction}</span>
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
