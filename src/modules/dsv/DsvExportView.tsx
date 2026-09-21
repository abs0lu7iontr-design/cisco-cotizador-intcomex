// ============================================================================
// CISCO AUTOMATED - DSV EXPORT VIEW COMPONENT
// Partner Identification (Col U) with Fuzzy Matching & Name Immutability Protection
// ============================================================================

import React, { useEffect } from 'react';
import { usePartnerDatabase } from '../../hooks/usePartnerDatabase';

export interface DsvExportViewProps {
  originalBomName: string;
  value: string;
  onChange: (val: string) => void;
  onLearnPartnerTrigger?: (learnFn: (bomName: string, xclCode: string) => Promise<void>) => void;
  className?: string;
}

export const DsvExportView: React.FC<DsvExportViewProps> = ({
  originalBomName,
  value,
  onChange,
  onLearnPartnerTrigger,
  className = '',
}) => {
  // 1. Ejecutar búsqueda difusa (Fuzzy Matching >90%)
  const { suggestedXcl, matchScore, matchedNameDb, learnNewPartner } = usePartnerDatabase(originalBomName);

  // 2. Auto-rellenar cuando el código sugerido cambie y el input esté vacío o coincida con la sugerencia anterior
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

  return (
    <div className={`bg-slate-900/50 p-4 rounded-lg border border-slate-700 ${className}`}>
      {/* Nombre detectado en BOM (Inmutable) */}
      <div className="mb-3">
        <span className="block text-xs text-slate-400 font-mono">
          Nombre detectado en BOM (No modificable):
        </span>
        <span className="block text-sm text-slate-200 font-bold">
          {originalBomName || 'No detectado'}
        </span>
      </div>

      {/* Partner Identification (Col U) */}
      <label className="block text-sm font-medium mb-1 text-slate-300">
        Partner Identification (Col U) *
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        placeholder="Ej. XCL005331"
        className="w-full bg-slate-950 border border-slate-600 rounded px-3 py-2 text-white font-mono"
      />

      {/* Indicadores de Coincidencia */}
      {matchScore >= 90 && (
        <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
          <span>✓</span>
          XCL encontrado basado en &quot;{matchedNameDb}&quot; ({Math.round(matchScore)}% similitud en BD)
        </p>
      )}
      {matchScore > 0 && matchScore < 90 && (
        <p className="text-xs text-amber-400 mt-2">
          Similitud baja ({Math.round(matchScore)}%) con &quot;{matchedNameDb}&quot;. Por favor verifica e ingresa el XCL manualmente.
        </p>
      )}
    </div>
  );
};
