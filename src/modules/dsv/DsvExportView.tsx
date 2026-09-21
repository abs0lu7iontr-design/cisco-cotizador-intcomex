// ============================================================================
// CISCO AUTOMATED - DSV EXPORT VIEW COMPONENT
// Partner Identification (Col U) with Symmetric HUD Layout
// ============================================================================

import React, { useEffect } from 'react';
import { IdCard, Hash } from 'lucide-react';
import { usePartnerDatabase } from '../../hooks/usePartnerDatabase';

export interface DsvExportViewProps {
  dealId?: string;
  onDealIdChange?: (val: string) => void;
  originalBomName: string;
  value: string;
  onChange: (val: string) => void;
  onLearnPartnerTrigger?: (learnFn: (bomName: string, xclCode: string) => Promise<void>) => void;
  onDownloadPlantillaDsv?: () => Promise<void>;
  className?: string;
}

export const DsvExportView: React.FC<DsvExportViewProps> = ({
  dealId,
  onDealIdChange,
  originalBomName,
  value,
  onChange,
  onLearnPartnerTrigger,
  onDownloadPlantillaDsv,
  className = '',
}) => {
  // 1. Ejecutar búsqueda difusa (Fuzzy Matching >90%)
  const { suggestedXcl, matchScore, matchedNameDb, learnNewPartner } = usePartnerDatabase(originalBomName);

  // 2. Auto-rellenar cuando el código sugerido cambie y el input esté vacío
  useEffect(() => {
    if (suggestedXcl && !value) {
      onChange(suggestedXcl);
    }
  }, [suggestedXcl, value, onChange]);

  // Compartir la función de aprendizaje si el padre la requiere
  useEffect(() => {
    if (onLearnPartnerTrigger) {
      onLearnPartnerTrigger(learnNewPartner);
    }
  }, [onLearnPartnerTrigger, learnNewPartner]);

  // 3. Persistencia automática al descargar plantilla DSV
  const handleDownloadPlantillaDsv = async () => {
    const finalXcl = value.trim().toUpperCase();

    if (finalXcl && originalBomName && finalXcl !== suggestedXcl) {
      await learnNewPartner(originalBomName, finalXcl);
    }

    if (onDownloadPlantillaDsv) {
      await onDownloadPlantillaDsv();
    }
  };

  return (
    <div className={className}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Deal ID (si es proporcionado) */}
        {dealId !== undefined && onDealIdChange ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
                <span>Deal ID (Col L) *</span>
              </label>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                {dealId.length}/8 dígitos
              </span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-mono text-xs">
                <Hash className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                maxLength={8}
                value={dealId}
                onChange={(e) => onDealIdChange(e.target.value.replace(/\D/g, ''))}
                placeholder="86146758"
                className="w-full bg-[#050c1a] border border-cyan-950 focus:border-cyan-500 rounded-lg pl-8 pr-3 py-2 text-xs font-mono text-white placeholder-slate-600 outline-none transition-all"
              />
            </div>
            <p className="text-[10px] text-slate-500 font-mono">
              Exactamente 8 dígitos numéricos (del BOM)
            </p>
          </div>
        ) : null}

        {/* Partner Identification (Col U) - Diseño HUD Simétrico */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-mono text-slate-300 flex items-center gap-1.5">
              <span>Partner Identification (Col U) *</span>
            </label>
            {matchScore >= 90 ? (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-[#00ff9d] border border-emerald-500/40 shadow-[0_0_8px_rgba(0,255,157,0.2)]">
                Match {Math.round(matchScore)}%
              </span>
            ) : (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-700">
                Manual
              </span>
            )}
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 font-mono text-xs">
              <IdCard className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value.toUpperCase())}
              placeholder="Ej. XCL007919"
              className={`w-full bg-[#050c1a] border rounded-lg pl-8 pr-3 py-2 text-xs font-mono text-white placeholder-slate-600 outline-none transition-all ${
                matchScore >= 90
                  ? 'border-emerald-500/50 focus:border-emerald-400'
                  : 'border-cyan-950 focus:border-cyan-500'
              }`}
            />
          </div>
          {matchScore >= 90 ? (
            <p className="text-[10px] text-[#00ff9d] font-mono truncate" title={`Auto-detectado: ${matchedNameDb}`}>
              ✓ Auto-detectado: {matchedNameDb}
            </p>
          ) : (
            <p className="text-[10px] text-slate-500 font-mono">
              Buyer/Reseller Partner Identification (se inyecta en Col U)
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
