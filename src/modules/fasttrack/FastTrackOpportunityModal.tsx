// ============================================================================
// CISCO AUTOMATED - FAST TRACK MARGIN OPPORTUNITY MODAL
// ============================================================================

import React from 'react';
import {
  Sparkles,
  TrendingUp,
  X,
  Check,
  Percent,
  ArrowRight,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react';
import { FastTrackAuditResult } from './types';

interface FastTrackOpportunityModalProps {
  isOpen: boolean;
  auditResult: FastTrackAuditResult | null;
  onApply: () => void;
  onSkip: () => void;
}

export const FastTrackOpportunityModal: React.FC<FastTrackOpportunityModalProps> = ({
  isOpen,
  auditResult,
  onApply,
  onSkip,
}) => {
  if (!isOpen || !auditResult || !auditResult.hasOpportunity) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-emerald-500/40 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-emerald-600/20 text-emerald-400 rounded-2xl border border-emerald-500/40 shadow-lg shadow-emerald-600/20">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-black text-white tracking-tight">
                  Oportunidad de Margen & Profit Boost
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/50">
                  Fast Track Cross-Check
                </span>
                {auditResult.promotionCode && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Promo: {auditResult.promotionCode}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Se encontraron mejores descuentos promocionales en el catálogo Fast Track ({auditResult.validUntilFormatted ? `Vigente hasta ${auditResult.validUntilFormatted}` : 'Activo'})
              </p>
            </div>
          </div>
          <button
            onClick={onSkip}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-slate-200 custom-scrollbar">
          {/* Expired / Obsolete Banner */}
          {auditResult.isExpired && (
            <div className="p-4 rounded-2xl bg-rose-950/80 border border-rose-600/60 text-xs text-rose-200 flex items-start space-x-3 shadow-lg">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-rose-100 font-bold block text-sm">
                  ⚠️ Advertencia de Vigencia: Catálogo Fast Track OBSOLETO
                </strong>
                <span>
                  El catálogo Fast Track en memoria venció el {auditResult.validUntilFormatted}. Los descuentos promocionales podrían no estar vigentes en Cisco CCW. Se recomienda cargar el catálogo más reciente.
                </span>
              </div>
            </div>
          )}

          {/* Key Metrics Banner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-300">
                <Percent className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-emerald-300 uppercase tracking-wider block">
                  Productos con Mayor Descuento
                </span>
                <strong className="text-lg font-black text-white">
                  {auditResult.totalMatchedSkus} ítems en tu cotización
                </strong>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider block">
                  Ahorro en Costo Total (Profit USD)
                </span>
                <strong className="text-lg font-black text-emerald-400">
                  +${auditResult.totalSavings.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </strong>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            El sistema detectó que <strong>{auditResult.totalMatchedSkus} productos</strong> tienen un descuento promocional superior en Fast Track que el descuento actual del BOM. ¿Deseas aplicar la promoción para reducir tu costo de compra y maximizar el margen de rentabilidad?
          </p>

          {/* Comparative Table */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-inner max-h-64 overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] font-bold sticky top-0 border-b border-slate-800">
                <tr>
                  <th className="p-3">Part Number</th>
                  <th className="p-3 text-center">Cant.</th>
                  <th className="p-3 text-right">Dcto. Archivo</th>
                  <th className="p-3 text-right text-amber-400">Dcto. Fast Track</th>
                  <th className="p-3 text-right text-emerald-400">Ahorro Extendido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {auditResult.matches.map((match) => (
                  <tr key={match.rowIdx} className="hover:bg-slate-800/40">
                    <td className="p-3 font-bold text-white whitespace-nowrap">
                      {match.partNumber}
                      <span className="block text-[10px] font-sans font-normal text-slate-400 truncate max-w-xs">
                        {match.description}
                      </span>
                    </td>
                    <td className="p-3 text-center text-slate-300">{match.qty}</td>
                    <td className="p-3 text-right text-slate-400">{match.currentDiscountPct.toFixed(1)}%</td>
                    <td className="p-3 text-right font-bold text-amber-300">{match.fastTrackDiscountPct.toFixed(1)}%</td>
                    <td className="p-3 text-right font-black text-emerald-400">
                      +${match.totalSavings.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <button
            onClick={onSkip}
            className="px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Omitir y Usar BOM Original
          </button>
          <button
            onClick={onApply}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-lg shadow-emerald-600/30 transition-all cursor-pointer transform hover:scale-[1.02]"
          >
            <Check className="w-4 h-4" />
            <span>Aplicar Promociones Fast Track</span>
          </button>
        </div>
      </div>
    </div>
  );
};
