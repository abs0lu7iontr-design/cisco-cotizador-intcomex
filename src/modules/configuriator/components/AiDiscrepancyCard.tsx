// ============================================================================
// CISCO AUTOMATED v2.1 - AI DISCREPANCY & CONCORDANCE AUDITOR CARD
// ============================================================================

import React from 'react';
import { AlertTriangle, ShieldCheck, Wrench } from 'lucide-react';
import type { DiscrepancyAuditReport } from '../aiDiscrepancyAuditor';
import type { ExtractedRequirementItem } from '../aiBomExtractor';

export interface AiDiscrepancyCardProps {
  discrepancyReport: DiscrepancyAuditReport;
  showComplianceDetails: boolean;
  onToggleComplianceDetails: () => void;
  onApplyDiscrepancyFix: (itemIndex: number, patch: Partial<ExtractedRequirementItem>) => void;
}

export const AiDiscrepancyCard: React.FC<AiDiscrepancyCardProps> = ({
  discrepancyReport,
  showComplianceDetails,
  onToggleComplianceDetails,
  onApplyDiscrepancyFix,
}) => {
  return (
    <div
      className={`p-3.5 rounded-2xl border transition-all ${
        discrepancyReport.hasDiscrepancies
          ? 'bg-gradient-to-br from-amber-950/30 via-slate-950 to-slate-900 border-amber-500/50 shadow-lg'
          : 'bg-gradient-to-br from-emerald-950/20 via-slate-950 to-slate-900 border-emerald-500/40 shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {discrepancyReport.hasDiscrepancies ? (
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          )}
          <span
            className={`text-xs font-black uppercase tracking-wider ${
              discrepancyReport.hasDiscrepancies ? 'text-amber-300' : 'text-emerald-300'
            }`}
          >
            Co-Piloto Preventa IA &bull; Auditoría de Lenguaje Natural vs Ensamble CCW
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              discrepancyReport.hasDiscrepancies
                ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                : 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
            }`}
          >
            Concordancia: {discrepancyReport.concordanceScore}%
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleComplianceDetails}
          className="text-[10px] font-bold text-slate-400 hover:text-slate-200 underline cursor-pointer"
        >
          {showComplianceDetails ? 'Ocultar Puntos Validados' : 'Ver Puntos Técnicos Validados'}
        </button>
      </div>

      {/* Discrepancias detectadas */}
      {discrepancyReport.hasDiscrepancies && (
        <div className="mt-2.5 space-y-2">
          <p className="text-[11px] text-slate-300">
            La IA analizó en paralelo lo solicitado por el cliente frente al ensamble Golden Template y detectó las siguientes observaciones para asegurar que no falte nada:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {discrepancyReport.discrepancies.map((d) => (
              <div
                key={d.id}
                className="p-2.5 rounded-xl bg-slate-950/90 border border-amber-500/30 space-y-1.5 flex flex-col justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[11px] font-bold text-amber-300">{d.title}</span>
                    <span className="text-[9px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700/50">
                      {d.severity}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    <span className="text-slate-300 font-semibold">Cliente pidió:</span> {d.customerStated}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    <span className="text-slate-300 font-semibold">BOM actual:</span> {d.configuredInBom}
                  </div>
                  <p className="text-[10px] text-slate-300/90 leading-snug">{d.explanation}</p>
                </div>

                {d.applyFixPatch && d.recommendedActionLabel && (
                  <button
                    type="button"
                    onClick={() => onApplyDiscrepancyFix(d.itemIndex, d.applyFixPatch!)}
                    className="mt-1 w-full py-1 px-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/50 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                  >
                    <Wrench className="w-3 h-3 text-amber-400" />
                    <span>{d.recommendedActionLabel}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sin discrepancias */}
      {!discrepancyReport.hasDiscrepancies && (
        <div className="mt-1 text-[11px] text-slate-400">
          ✓ Concordancia técnica total. No se detectaron omisiones ni inconsistencias entre la solicitud en lenguaje natural y la solución técnica armada.
        </div>
      )}

      {/* Desglose de conformidades técnicas */}
      {showComplianceDetails && discrepancyReport.verifiedCompliances.length > 0 && (
        <div className="mt-2.5 pt-2 border-t border-slate-800 space-y-1">
          <div className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">
            Puntos de Control Técnicos Validados ({discrepancyReport.verifiedCompliances.length}):
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 font-mono text-[10px] text-slate-300">
            {discrepancyReport.verifiedCompliances.map((c, cIdx) => (
              <div key={`comp-${cIdx}`} className="flex items-center gap-1.5">
                <span className="text-emerald-400">✓</span>
                <span>{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
